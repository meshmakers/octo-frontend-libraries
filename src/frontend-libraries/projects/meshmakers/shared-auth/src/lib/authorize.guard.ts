import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthorizeService } from './authorize.service';

/**
 * Handles authorization check for route activation.
 * Redirects to login if not authenticated, or to home if user lacks required roles.
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
export const authorizeGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const authorizeService = inject(AuthorizeService);
  const router = inject(Router);

  // Use signal directly (synchronous)
  const isAuthenticated = authorizeService.isAuthenticated();

  if (!isAuthenticated) {
    // Walk up the route tree to find the tenantId parameter
    let tenantId: string | undefined;
    let current: ActivatedRouteSnapshot | null = route;
    while (current) {
      if (current.params['tenantId']) {
        tenantId = current.params['tenantId'];
        break;
      }
      current = current.parent;
    }
    authorizeService.login(tenantId);
    return false;
  }

  // Use roles signal directly (synchronous)
  const userRoles = authorizeService.roles();
  const requiredRoles = route.data['roles'] as string[] | undefined;

  if (requiredRoles && !requiredRoles.some(role => userRoles.includes(role))) {
    await router.navigate(['']);
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
