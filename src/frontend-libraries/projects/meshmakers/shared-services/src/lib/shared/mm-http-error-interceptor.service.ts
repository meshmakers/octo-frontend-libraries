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
          if (this.onConnectionLost) {
            this.onConnectionLost();
          } else {
            this.messageService.showError('OctoMesh backend is not reachable. Please check if your network connection is working or contact your Administrator.');
          }
        }

        if (error.status === 403) {
          this.messageService.showError('Access denied. You do not have permission to access this tenant or resource.');
        }

        if (error.status === 400 && error.error.statusCode) {
          const apiError = error.error as ApiErrorDto;

          let details = '';
          if (apiError.details && apiError.details.length > 0) {
            for (const detail of apiError.details) {
              if (detail.description) {
                details += `\n✗ ${detail.description}`;
              }
            }
          }

          this.messageService.showErrorWithDetails(details, apiError.message);
        }

        return throwError(() => error);
      })
    );
  }
}
