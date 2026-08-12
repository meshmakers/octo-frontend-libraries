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
      if (!serviceUri || serviceUri === '/' || !req.url.startsWith(serviceUri)) {
        continue;
      }

      // A bare prefix test would also accept a host that merely begins with a configured
      // one — `https://api.example.com.attacker.test` — and hand it the operator's bearer.
      // The match must therefore end on a path, query or fragment boundary.
      const remainder = req.url.slice(serviceUri.length);
      if (serviceUri.endsWith('/') || remainder === '' || '/?#'.includes(remainder.charAt(0))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if the request targets the OIDC token endpoint.
 *
 * The comparison runs on the path alone, because a guard keyed on the raw URL fails
 * silently rather than loudly: a query string, fragment or trailing slash would make the
 * refresh post to that endpoint through this same chain, and the single-flight promise
 * would wait on itself. It never settles, its `finally` never runs, and since every request
 * of that service shares it, each later 401 would await a promise that cannot resolve.
 */
function isTokenEndpointUrl(url: string): boolean {
  const path = url.split('#')[0].split('?')[0].replace(/\/+$/, '');
  return path.endsWith('/connect/token');
}

// =============================================================================
// SINGLE-FLIGHT TOKEN REFRESH
// =============================================================================

/**
 * Parallel 401s share one refresh instead of spending one grant each.
 *
 * Keyed by the service rather than held in a module variable: `AuthorizeService` is provided
 * per injector, so an app still gets exactly one in-flight refresh page-wide, while two
 * injectors in one process no longer await each other's promise and each test gets a clean
 * slate — a module variable is unreachable from a `beforeEach` unless it is exported.
 *
 * Do not restate the single-flight rationale as "concurrent grants would end the session":
 * that holds only for a client whose `RefreshTokenUsage` is `OneTimeOnly`, and ours are not —
 * Duende defaults the property to `ReUse` and nothing in octo-identity-services overrides it
 * (the CK attribute carries no default and reaches Duende through AutoMapper's by-name
 * convention, which is why grepping the C# for its name finds nothing).
 */
const refreshInFlight = new WeakMap<AuthorizeService, Promise<void>>();

function refreshAccessTokenOnce(authorizeService: AuthorizeService): Promise<void> {
  let pending = refreshInFlight.get(authorizeService);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => authorizeService.refreshAccessToken())
      .finally(() => {
        refreshInFlight.delete(authorizeService);
      });
    refreshInFlight.set(authorizeService, pending);
  }

  return pending;
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
 * and the request retried once with the new bearer. If the token has already been replaced
 * by then — a slower request reporting its `401` after someone else's refresh finished —
 * the retry goes out with that token and no second refresh is started. A refresh that fails
 * or yields no new token rethrows the original `401`, so hosts can still classify it.
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
  if (req.method === 'POST' && isTokenEndpointUrl(req.url) && req.body instanceof HttpParams) {
    if (req.body.get('grant_type') === 'refresh_token') {
      const tenantId = authorizeService.getStorageTenantId();
      if (tenantId) {
        req = req.clone({
          body: req.body.set('acr_values', `tenant:${tenantId}`)
        });
      }
    }
  }

  // Never let the token endpoint into the recovery path — see isTokenEndpointUrl for the
  // deadlock this avoids.
  if (!tokenAttached || isTokenEndpointUrl(req.url)) {
    return next(req);
  }

  const authorizedReq = req;

  // `next()` hands off to the rest of the chain, so a retried request does not re-enter this
  // interceptor — at most one retry by construction, without any bookkeeping.
  const retryWith = (bearer: string) =>
    next(authorizedReq.clone({ setHeaders: { Authorization: `Bearer ${bearer}` } }));

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // Single-flight only covers the window while a refresh runs. A slower request that
      // went out with the same stale token reports its 401 after that window closed, and
      // its failure is already explained by the token that has since been replaced —
      // refreshing again would spend a second grant to learn the same thing.
      const currentToken = authorizeService.getAccessTokenSync();
      if (currentToken && currentToken !== token) {
        return retryWith(currentToken);
      }

      // Surface the original 401, not the refresh error: consuming apps classify the status
      // code to pick their message, and AuthorizeService already reacts to
      // `token_refresh_error` by clearing the session. The mapping is bound to the refresh
      // promise rather than placed in the pipe, because as an operator it only holds while it
      // sits above the switchMap below — and a 403 from the retried request must reach the
      // host as 403, not as the remembered 401.
      const refresh = refreshAccessTokenOnce(authorizeService).catch((refreshError: unknown) => {
        console.warn('[AuthInterceptor] Token refresh threw; surfacing the original 401.', refreshError);
        return Promise.reject(error);
      });

      return from(refresh).pipe(
        switchMap(() => {
          const refreshedToken = authorizeService.getAccessTokenSync();
          if (!refreshedToken || refreshedToken === token) {
            // Distinct from the throw above, and from each other: all three end in the same
            // 401 for the host, so the log is the only place they stay tellable apart.
            console.warn(refreshedToken
              ? '[AuthInterceptor] Token refresh returned the same access token; surfacing the original 401.'
              : '[AuthInterceptor] Token refresh returned no access token; surfacing the original 401.');
            return throwError(() => error);
          }

          return retryWith(refreshedToken);
        })
      );
    })
  );
};
