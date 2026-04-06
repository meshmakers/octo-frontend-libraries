import { inject } from '@angular/core';
import { HttpHandlerFn, HttpInterceptorFn, HttpParams, HttpRequest } from '@angular/common/http';
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
      if (req.url.startsWith(serviceUri)) {
        return true;
      }
    }
  }
  return false;
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

  if (token && (isSameOriginUrl(req) || isKnownServiceUri(req, serviceUris))) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Inject acr_values=tenant:{tenantId} into token endpoint POST requests.
  // This ensures the Identity Server resolves the correct tenant during
  // refresh token exchanges, even after a service restart when its
  // in-memory token-to-tenant cache is lost.
  if (req.method === 'POST' && req.url.endsWith('/connect/token')) {
    const tenantId = authorizeService.getStorageTenantId();
    if (tenantId && req.body instanceof HttpParams) {
      req = req.clone({
        body: req.body.set('acr_values', `tenant:${tenantId}`)
      });
    }
  }

  return next(req);
};
