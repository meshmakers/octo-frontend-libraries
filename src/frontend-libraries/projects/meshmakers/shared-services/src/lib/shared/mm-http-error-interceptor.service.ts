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

/**
 * How the interceptor reports a failed response to the user. `null` means it stays silent and the
 * caller is the only one who can tell the user anything.
 */
type ReportedErrorKind = 'connection-lost' | 'access-denied' | 'api-error';

/** The part of an `HttpErrorResponse` the classification looks at. */
type HttpErrorLike = Pick<HttpErrorResponse, 'status' | 'error' | 'url'>;

/**
 * Structural check instead of `instanceof HttpErrorResponse` on purpose: a host that compiles this
 * library from source next to its own `@angular/common` copy (the Studio's Karma run does) sees
 * two class identities, and `instanceof` would silently answer `false` there.
 */
function isHttpErrorResponse(error: unknown): error is HttpErrorLike {
  return typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'HttpErrorResponse'
    && typeof (error as { status?: unknown }).status === 'number';
}

@Injectable()
export class MmHttpErrorInterceptor implements HttpInterceptor {

  private readonly messageService = inject(MessageService);
  private readonly onConnectionLost = inject(ON_CONNECTION_LOST, { optional: true });

  /**
   * Whether the interceptor itself reports this error to the user — as a toast or through the
   * `ON_CONNECTION_LOST` handler. A caller that catches a failed request and shows its own message
   * must skip that message when this returns `true`, otherwise the user sees the same reason twice
   * (once from the interceptor, once from the page — which is what the 409 of the capability
   * disable guards produced, AB#4255). Mirrors exactly the branches `intercept` acts on; anything
   * that is not an `HttpErrorResponse` is never reported here.
   */
  public static reportsToUser(error: unknown): boolean {
    return isHttpErrorResponse(error)
      && MmHttpErrorInterceptor.classify(error, error.url) !== null;
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retry(0),
      catchError((error: HttpErrorResponse) => {

        switch (MmHttpErrorInterceptor.classify(error, request.url)) {
          case 'connection-lost':
            if (this.onConnectionLost) {
              this.onConnectionLost();
            } else {
              this.messageService.showError('OctoMesh backend is not reachable. Please check if your network connection is working or contact your Administrator.');
            }
            break;

          case 'access-denied':
            this.messageService.showError('Access denied. You do not have permission to access this tenant or resource.');
            break;

          case 'api-error': {
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
            // A 400 body is classified on its statusCode alone, so it may carry no message; fall back
            // to a generic headline rather than rendering "undefined" (the details still follow).
            this.messageService.showErrorWithDetails(
              apiError.message || 'The request was rejected by the server.', details);
            break;
          }
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * The single place that decides which failed responses the interceptor reports. `intercept`
   * passes the request URL (the health-check exemption is keyed on it); `reportsToUser` only has
   * the response and uses its URL instead.
   */
  private static classify(error: HttpErrorLike, requestUrl: string | null | undefined): ReportedErrorKind | null {
    if (error.status === 0) {
      const isHealthCheck = requestUrl?.endsWith('/health') ?? false;
      return isHealthCheck ? null : 'connection-lost';
    }

    if (error.status === 403) {
      return 'access-denied';
    }

    // 409 is matched on the message alone: OperationFailedErrorDto hardcodes a BadRequest
    // statusCode into its body, so a conflict response carries statusCode 400 and would never
    // satisfy the check below. Without this branch a 409 is shown to the user as nothing at all
    // (AB#4762).
    if ((error.status === 400 && error.error?.statusCode) || (error.status === 409 && error.error?.message)) {
      return 'api-error';
    }

    return null;
  }
}
