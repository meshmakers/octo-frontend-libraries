import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { inject, Injectable, InjectionToken } from "@angular/core";
import { MessageService } from "../services/message.service";
import { ApiErrorDto } from "../models/apiErrorDto";

/**
 * Optional callback invoked when a network connectivity error (HTTP status 0) is detected.
 * When provided, the interceptor calls this handler instead of showing a generic error toast.
 * This allows host applications to implement custom connection-loss handling (e.g., a full-screen
 * error overlay with retry logic).
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * {
 *   provide: ON_CONNECTION_LOST,
 *   useFactory: () => {
 *     const configService = inject(AppConfigurationService);
 *     return () => configService.reportConnectionLost();
 *   }
 * }
 * ```
 */
export const ON_CONNECTION_LOST = new InjectionToken<() => void>('ON_CONNECTION_LOST');

@Injectable()
export class MmHttpErrorInterceptor implements HttpInterceptor {

  private readonly messageService = inject(MessageService);
  private readonly onConnectionLost = inject(ON_CONNECTION_LOST, { optional: true });

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retry(0),
      catchError((error: HttpErrorResponse) => {

        if (error.status === 0) {
          const isHealthCheck = request.url.endsWith('/health');
          if (!isHealthCheck) {
            if (this.onConnectionLost) {
              this.onConnectionLost();
            } else {
              this.messageService.showError('OctoMesh backend is not reachable. Please check if your network connection is working or contact your Administrator.');
            }
          }
        }

        if (error.status === 403) {
          this.messageService.showError('Access denied. You do not have permission to access this tenant or resource.');
        }

        // 409 is matched on the message alone: OperationFailedErrorDto hardcodes a BadRequest
        // statusCode into its body, so a conflict response carries statusCode 400 and would never
        // satisfy the check below. Without this branch a 409 is shown to the user as nothing at all
        // (AB#4762).
        if ((error.status === 400 && error.error?.statusCode) || (error.status === 409 && error.error?.message)) {
          const apiError = error.error as ApiErrorDto;

          let details = '';
          if (apiError.details && apiError.details.length > 0) {
            for (const detail of apiError.details) {
              if (detail.description) {
                details += `\n✗ ${detail.description}`;
              }
            }
          }

          // Argument order is (message, details): the first argument becomes the toast headline,
          // the second the expandable details. Passing them swapped rendered an empty headline
          // whenever the body carried no details list — which is every OperationFailedErrorDto,
          // so a rejected tenant create showed a blank error toast (AB#4762).
          this.messageService.showErrorWithDetails(apiError.message, details);
        }

        return throwError(() => error);
      })
    );
  }
}
