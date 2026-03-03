import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthorizeService } from './authorize.service';

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
export const authorizeGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
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
    // switchTenant returns false if a switch was already attempted (loop prevention).
    // Use state.url (the router's target URL) — not window.location.href which is
    // still the current page during in-app navigation (e.g., tenant switcher dropdown).
    const targetUrl = window.location.origin + state.url;
    if (authorizeService.switchTenant(routeTenantId, targetUrl)) {
      return false;
    }
    // Switch was skipped — fall through to role-based checks
    console.warn(`[AuthGuard] Tenant mismatch persists after switch attempt (token="${tokenTenantId}", route="${routeTenantId}"). Proceeding with current token.`);
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
