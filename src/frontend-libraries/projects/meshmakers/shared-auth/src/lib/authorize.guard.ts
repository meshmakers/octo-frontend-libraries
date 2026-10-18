import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthorizeService } from './authorize.service';

/**
 * Path segment of the blocking route a host registers as `/:tenantId/tenant-mismatch`. The guard
 * redirects there when the token still belongs to another tenant than the route after the switch
 * attempt (AB#6731); render {@link TenantMismatchComponent} on it.
 */
export const TENANT_MISMATCH_PATH = 'tenant-mismatch';

/**
 * Walks up the route tree to find the tenantId parameter.
 */
function findRouteTenantId(route: ActivatedRouteSnapshot): string | undefined {
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    if (current.params?.['tenantId']) {
      return current.params['tenantId'];
    }
    current = current.parent;
  }
  return undefined;
}

function mismatchTree(router: Router, routeTenantId: string): UrlTree {
  return router.createUrlTree(['/', routeTenantId, TENANT_MISMATCH_PATH]);
}

/**
 * Handles authorization check for route activation.
 * Redirects to login if not authenticated, or to home if user lacks required roles.
 * Forces re-authentication when the token's tenant_id does not match the route's tenantId.
 *
 * @param route - The activated route snapshot containing route data
 * @returns true if authorized, false otherwise
 *
 * @example
 * ```typescript
 * // Route without role requirements
 * { path: 'dashboard', component: DashboardComponent, canActivate: [authorizeGuard] }
 *
 * // Route with role requirements
 * { path: 'admin', component: AdminComponent, canActivate: [authorizeGuard], data: { roles: ['AdminPanelManagement'] } }
 * ```
 */
export const authorizeGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> => {
  const authorizeService = inject(AuthorizeService);
  const router = inject(Router);

  // Use signal directly (synchronous)
  const isAuthenticated = authorizeService.isAuthenticated();

  if (!isAuthenticated) {
    // Check if this is a reload after switchTenant — use the stored tenantId
    const pendingTenant = authorizeService.consumePendingTenantSwitch();
    const tenantId = pendingTenant ?? findRouteTenantId(route);
    authorizeService.login(tenantId);
    return false;
  }

  // Force re-authentication if the token was issued for a different tenant.
  // switchTenant clears the local session and reloads, so the next guard
  // invocation enters the !isAuthenticated branch above with the correct tenantId.
  const tokenTenantId = authorizeService.tokenTenantId();
  const routeTenantId = findRouteTenantId(route);
  if (tokenTenantId && routeTenantId && routeTenantId.toLowerCase() !== tokenTenantId.toLowerCase()) {
    console.debug(`[AuthGuard] Tenant mismatch: token="${tokenTenantId}", route="${routeTenantId}" — attempting tenant switch`);
    // 1. In-place token exchange (RFC 8693): no reload, no login mask.
    if (await authorizeService.switchTenantByExchange(routeTenantId)) {
      authorizeService.consumeSwitchAttempted();
    } else {
      // 2. Fall back to the redirect (auth-code flow). switchTenant returns false if a switch was
      // already attempted (loop prevention). Use state.url (the router's target URL) — not
      // window.location.href which is still the current page during in-app navigation.
      const targetUrl = window.location.origin + state.url;
      if (authorizeService.switchTenant(routeTenantId, targetUrl)) {
        return false;
      }
    }
    // 3. Never continue with a token of another tenant (AB#6731): re-check after the attempt and
    // block with an explanation instead of letting the page issue requests that fail.
    const tokenAfter = authorizeService.tokenTenantId();
    if (tokenAfter && tokenAfter.toLowerCase() !== routeTenantId.toLowerCase()) {
      return mismatchTree(router, routeTenantId);
    }
  } else {
    // No mismatch — clear any leftover switch-attempted flag
    authorizeService.consumeSwitchAttempted();
  }

  // Use roles signal directly (synchronous)
  const userRoles = authorizeService.roles();
  const requiredRoles = route.data['roles'] as string[] | undefined;

  if (requiredRoles === undefined || requiredRoles === null) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.warn(`[AuthGuard] Route "${route.routeConfig?.path}" has no required roles defined — access granted to any authenticated user.`);
    }
    return true;
  }

  // Empty roles array (roles: []) means intentionally open to any authenticated user
  if (requiredRoles.length === 0) {
    return true;
  }

  if (!requiredRoles.some(role => userRoles.includes(role))) {
    // Navigate to the current tenant's home, not root ''.
    // Navigating to '' would redirect to a default tenant (e.g., octosystem),
    // causing a tenant mismatch → switchTenant → redirect loop.
    const tenantHome = routeTenantId ? `/${routeTenantId}` : '';
    await router.navigate([tenantHome]);
    return false;
  }

  return true;
};

/**
 * Guard for child routes. Delegates to authorizeGuard.
 *
 * @example
 * ```typescript
 * {
 *   path: 'parent',
 *   canActivateChild: [authorizeChildGuard],
 *   children: [
 *     { path: 'child', component: ChildComponent, data: { roles: ['RequiredRole'] } }
 *   ]
 * }
 * ```
 */
export const authorizeChildGuard: CanActivateFn = authorizeGuard;

/**
 * Guard for lazy-loaded routes. Checks if user is authenticated.
 * Replaces the deprecated canLoad guard.
 *
 * @example
 * ```typescript
 * {
 *   path: 'lazy',
 *   loadChildren: () => import('./lazy/lazy.routes'),
 *   canMatch: [authorizeMatchGuard]
 * }
 * ```
 */
export const authorizeMatchGuard: CanMatchFn = (_route, segments) => {
  const authorizeService = inject(AuthorizeService);

  // Use signal directly (synchronous)
  const isAuthenticated = authorizeService.isAuthenticated();

  if (!isAuthenticated) {
    // The first URL segment is typically the tenantId (e.g., /:tenantId/...)
    const tenantId = segments.length > 0 ? segments[0].path : undefined;
    authorizeService.login(tenantId);
    return false;
  }

  return true;
};

/**
 * Guard that always allows deactivation.
 * Use this as a placeholder or override in specific routes.
 *
 * @example
 * ```typescript
 * { path: 'form', component: FormComponent, canDeactivate: [authorizeDeactivateGuard] }
 * ```
 */
export const authorizeDeactivateGuard = () => true;
