import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpParams,
  HttpRequest
} from '@angular/common/http';
import { from, catchError, switchMap, throwError } from 'rxjs';
import { AuthorizeService } from './authorize.service';

// =============================================================================
// URL MATCHING UTILITIES
// =============================================================================

/**
 * Checks if the request URL is from the same origin as the application.
 */
function isSameOriginUrl(req: HttpRequest<unknown>): boolean {
  // It's an absolute url with the same origin.
  if (req.url.startsWith(`${window.location.origin}/`)) {
    return true;
  }

  // It's a protocol relative url with the same origin.
  // For example: //www.example.com/api/Products
  if (req.url.startsWith(`//${window.location.host}/`)) {
    return true;
  }

  // It's a relative url like /api/Products
  if (/^\/[^/].*/.test(req.url)) {
    return true;
  }

  // It's an absolute or protocol relative url that doesn't have the same origin.
  return false;
}

/**
 * Checks if the request URL matches any of the known service URIs.
 */
function isKnownServiceUri(req: HttpRequest<unknown>, serviceUris: string[] | null): boolean {
  if (serviceUris != null) {
    for (const serviceUri of serviceUris) {
      // An unset host must never match. Blank is a prefix of every URL, and the
      // platform answers `/` for an unconfigured service, which would also match
      // protocol-relative URLs that isSameOriginUrl deliberately rejects.
      if (serviceUri && serviceUri !== '/' && req.url.startsWith(serviceUri)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if the request targets the OIDC token endpoint.
 */
function isTokenEndpointUrl(req: HttpRequest<unknown>): boolean {
  return req.url.endsWith('/connect/token');
}

// =============================================================================
// SINGLE-FLIGHT TOKEN REFRESH
// =============================================================================

/**
 * Module-level so parallel 401s share one refresh: with refresh-token rotation each
 * exchange invalidates the previous token, so concurrent grants end the session.
 */
let refreshInFlight: Promise<void> | null = null;

function refreshAccessTokenOnce(authorizeService: AuthorizeService): Promise<void> {
  refreshInFlight ??= Promise.resolve()
    .then(() => authorizeService.refreshAccessToken())
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// =============================================================================
// FUNCTIONAL INTERCEPTOR (RECOMMENDED)
// =============================================================================

/**
 * Functional HTTP interceptor that adds Bearer token to authorized requests
 * and injects tenant context (acr_values) into token endpoint requests.
 *
 * Adds the Authorization header to requests that are either:
 * - Same-origin requests (relative URLs or same host)
 * - Requests to known service URIs configured in AuthorizeOptions
 *
 * For token endpoint POST requests (`/connect/token`), appends
 * `acr_values=tenant:{tenantId}` to the form body so the Identity Server
 * can resolve the correct tenant during refresh token exchanges.
 *
 * When a request that carried a token comes back `401`, the access token is refreshed
 * and the request retried once with the new bearer. A refresh that fails or yields no
 * new token rethrows the original `401`, so hosts can still classify it.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideHttpClient, withInterceptors } from '@angular/common/http';
 * import { authorizeInterceptor } from '@meshmakers/shared-auth';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(withInterceptors([authorizeInterceptor])),
 *     provideMmSharedAuth(),
 *   ]
 * };
 * ```
 */
export const authorizeInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authorizeService = inject(AuthorizeService);
  const token = authorizeService.getAccessTokenSync();
  const serviceUris = authorizeService.getServiceUris();

  const tokenAttached = !!token && (isSameOriginUrl(req) || isKnownServiceUri(req, serviceUris));
  if (tokenAttached) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Inject acr_values=tenant:{tenantId} into refresh_token grant requests only.
  // This ensures the Identity Server resolves the correct tenant during
  // refresh token exchanges, even after a service restart when its
  // in-memory token-to-tenant cache is lost.
  //
  // Authorization-code exchanges must NOT carry acr_values from local storage:
  // the tenant is already bound to the authorization code on the server side,
  // and injecting a stale storage tenant (e.g., left over from a previous
  // session) would force a refresh-token mismatch on the very next call,
  // causing an infinite reload loop.
  if (req.method === 'POST' && req.url.endsWith('/connect/token') && req.body instanceof HttpParams) {
    if (req.body.get('grant_type') === 'refresh_token') {
      const tenantId = authorizeService.getStorageTenantId();
      if (tenantId) {
        req = req.clone({
          body: req.body.set('acr_values', `tenant:${tenantId}`)
        });
      }
    }
  }

  // Never retry the token endpoint itself: refreshing posts to that very endpoint,
  // so a retry would recurse into the refresh it is trying to perform.
  if (!tokenAttached || isTokenEndpointUrl(req)) {
    return next(req);
  }

  const authorizedReq = req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return from(refreshAccessTokenOnce(authorizeService)).pipe(
        // Surface the original 401, not the refresh error: consuming apps classify the
        // status code to pick their message, and AuthorizeService already reacts to
        // `token_refresh_error` by clearing the session.
        catchError(() => throwError(() => error)),
        switchMap(() => {
          const refreshedToken = authorizeService.getAccessTokenSync();
          if (!refreshedToken || refreshedToken === token) {
            return throwError(() => error);
          }

          // `next()` hands off to the rest of the chain, so the retried request
          // does not re-enter this interceptor — at most one retry by construction.
          return next(authorizedReq.clone({
            setHeaders: {
              Authorization: `Bearer ${refreshedToken}`
            }
          }));
        })
      );
    })
  );
};
