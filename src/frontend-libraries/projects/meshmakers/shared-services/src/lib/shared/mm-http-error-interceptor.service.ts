import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { MessageService } from '../services/message.service';
import { ApiErrorDto } from '../models/apiErrorDto';

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
 * HTTP statuses the CALLER handles itself for one request: the interceptor does not report them
 * (no global toast) and the caller shows its own, more specific message. Example: a 403 of an
 * optional admin read that the page explains in place instead of a generic "Access denied".
 *
 * @example
 * ```typescript
 * http.get(url, { context: new HttpContext().set(MM_CALLER_HANDLED_STATUSES, [403]) });
 * ```
 */
export const MM_CALLER_HANDLED_STATUSES = new HttpContextToken<readonly number[]>(() => []);

/**
 * Marks one request as optional (a probe or a widget read the page can do without): when it fails
 * at network level (status 0 — CORS rejection, DNS, offline) the interceptor does NOT treat that as
 * a lost backend connection, so neither `ON_CONNECTION_LOST` (the host's full-screen overlay) nor
 * the generic toast fires; the caller degrades locally. The error is still rethrown. A real outage
 * is still detected by the non-optional calls of the host (configuration, health, GraphQL).
 * HTTP responses (403, 400, ...) are reported as for any other request.
 *
 * @example
 * ```typescript
 * http.get(url, { context: new HttpContext().set(MM_OPTIONAL_REQUEST, true) });
 * ```
 */
export const MM_OPTIONAL_REQUEST = new HttpContextToken<boolean>(() => false);

/**
 * How the interceptor reports a failed response to the user. `null` means it stays silent and the
 * caller is the only one who can tell the user anything.
 */
type ReportedErrorKind = 'connection-lost' | 'access-denied' | 'problem' | 'api-error';

/** The part of an `HttpErrorResponse` the classification looks at. */
type HttpErrorLike = Pick<HttpErrorResponse, 'status' | 'error' | 'url'>;

/**
 * Structural check instead of `instanceof HttpErrorResponse` on purpose: a host that compiles this
 * library from source next to its own `@angular/common` copy (the Studio's Vitest run does) sees
 * two class identities, and `instanceof` would silently answer `false` there.
 */
function isHttpErrorResponse(error: unknown): error is HttpErrorLike {
  return typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'HttpErrorResponse'
    && typeof (error as { status?: unknown }).status === 'number';
}

/**
 * The readable text of an RFC 9457 problem body (`application/problem+json`), or `null` when the body
 * is no problem or carries no deliberate text. Identity refuses role changes this way (AB#7914):
 * `{ status: 403, title: 'You cannot grant additional roles to your own user.', code: 'self-grant' }`.
 *
 * - `title` counts only when the body carries the `code` extension: ASP.NET fills `title` of a
 *   default problem with the bare reason phrase ("Forbidden"), which says less than the generic text.
 * - `detail` is always written on purpose and is the fallback.
 *
 * A body counts as a problem when it is an object with a numeric `status` or a string `type`/`code`.
 */
function problemMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const problem = body as { status?: unknown; type?: unknown; code?: unknown; title?: unknown; detail?: unknown };
  const hasCode = typeof problem.code === 'string' && problem.code.length > 0;
  const isProblem = typeof problem.status === 'number' || typeof problem.type === 'string' || hasCode;
  if (!isProblem) {
    return null;
  }
  if (hasCode && typeof problem.title === 'string' && problem.title.length > 0) {
    return problem.title;
  }
  return typeof problem.detail === 'string' && problem.detail.length > 0 ? problem.detail : null;
}

@Injectable()
export class MmHttpErrorInterceptor implements HttpInterceptor {

  /**
   * Status-0 errors of `MM_OPTIONAL_REQUEST` requests the interceptor deliberately stayed silent
   * about (AB#6619). `reportsToUser` only receives the error, not the request context, so it
   * recognises these by identity — the interceptor rethrows the very same object.
   */
  private static readonly silencedOptionalErrors = new WeakSet<object>();

  /**
   * Errors whose status the request marked as caller-handled (`MM_CALLER_HANDLED_STATUSES`): the
   * interceptor stayed silent, so `reportsToUser` must answer `false` for them, or a caller that skips
   * its own toast on `true` would leave the user with no message at all. Recognised by identity, like
   * `silencedOptionalErrors`.
   */
  private static readonly silencedCallerHandledErrors = new WeakSet<object>();

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
      && !MmHttpErrorInterceptor.silencedOptionalErrors.has(error)
      && !MmHttpErrorInterceptor.silencedCallerHandledErrors.has(error)
      && MmHttpErrorInterceptor.classify(error, error.url) !== null;
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retry(0),
      catchError((error: HttpErrorResponse) => {

        if (request.context.get(MM_CALLER_HANDLED_STATUSES).includes(error.status)) {
          MmHttpErrorInterceptor.silencedCallerHandledErrors.add(error);
          return throwError(() => error);
        }

        if (error.status === 0 && request.context.get(MM_OPTIONAL_REQUEST)) {
          MmHttpErrorInterceptor.silencedOptionalErrors.add(error);
          console.debug('Optional request failed at network level, not treated as connection loss', request.url);
          return throwError(() => error);
        }

        switch (MmHttpErrorInterceptor.classify(error, request.url)) {
          case 'connection-lost':
            if (this.onConnectionLost) {
              this.onConnectionLost();
            } else {
              this.messageService.showError('OctoMesh backend is not reachable. Please check if your network connection is working or contact your Administrator.');
            }
            break;

          case 'access-denied': {
            // The tenant authorization middleware names the denial reason in a {message} body
            // (AB#5227) — e.g. "tenant does not exist any more, re-create it first" on a restore
            // into a deleted tenant. Prefer that over the generic text, which reads as a
            // permission problem it often is not.
            const deniedMessage = (error.error as { message?: unknown } | null)?.message;
            this.messageService.showError(typeof deniedMessage === 'string' && deniedMessage.length > 0
              ? deniedMessage
              : 'Access denied. You do not have permission to access this tenant or resource.');
            break;
          }

          case 'problem':
            // A 403 refusal with a readable problem title (AB#7969): show that sentence, once, instead of
            // the generic access-denied text. Pages that catch the error skip their own toast because
            // reportsToUser answers true for it.
            this.messageService.showError(problemMessage(error.error) ?? '');
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

    // A 403 problem body with a readable text (identity's role-change refusals, AB#7969) is shown as is
    // instead of the generic "Access denied", which reads as a missing permission it is not. A 409
    // problem stays the caller's job, as before: pages show it in place (identity's last-administrator /
    // built-in-role refusals) or in a dialog (the CK upgrade guard's CK_UPGRADE_BLOCKED). A 403 with the
    // middleware's {message} body is no problem and keeps the access-denied branch.
    if (error.status === 403 && problemMessage(error.error) !== null) {
      return 'problem';
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
