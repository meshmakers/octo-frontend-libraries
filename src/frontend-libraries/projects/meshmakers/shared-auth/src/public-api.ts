/*
 * Public API Surface of shared-auth
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthorizeService } from './lib/authorize.service';
import { provideOAuthClient } from 'angular-oauth2-oidc';

// Core services
export * from './lib/authorize.service';
export * from './lib/roles';
export { TenantAwareOAuthStorage } from './lib/tenant-aware-oauth-storage';
export { decodeJwtPayload, tenantIdFromToken, allowedTenantsFromToken } from './lib/jwt-claims';

// Functional interceptor
export { authorizeInterceptor } from './lib/authorize.interceptor';

// Error classification for hosts that phrase the refusal themselves
export { authorizationRefusal } from './lib/authorization-refusal';
export type { AuthorizationRefusal } from './lib/authorization-refusal';

// Functional guards
export {
  authorizeGuard,
  authorizeChildGuard,
  authorizeMatchGuard,
  authorizeDeactivateGuard,
  TENANT_MISMATCH_PATH
} from './lib/authorize.guard';

// Blocking screen for a token of another tenant than the route (AB#6731); register on /:tenantId/tenant-mismatch
export { TenantMismatchComponent } from './lib/tenant-mismatch.component';

// UI Components (Kendo) - available via '@meshmakers/shared-auth/login-ui'
// import { LoginAppBarSectionComponent } from '@meshmakers/shared-auth/login-ui';

/**
 * Provides all shared-auth dependencies.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideHttpClient, withInterceptors } from '@angular/common/http';
 * import { provideMmSharedAuth, authorizeInterceptor } from '@meshmakers/shared-auth';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(withInterceptors([authorizeInterceptor])),
 *     provideMmSharedAuth(),
 *     // ... other providers
 *   ]
 * };
 * ```
 *
 * @remarks
 * Functional guards and interceptors don't need to be provided - they use inject() internally.
 * For the functional interceptor, use `provideHttpClient(withInterceptors([authorizeInterceptor]))`.
 */
export function provideMmSharedAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideOAuthClient(),
    AuthorizeService
  ]);
}

// Tenant topology client (AB#7053): which of the user's tenants lie below the app root
export { TenantTopologyService } from './lib/tenant-topology.service';
export type { TenantTopologyLoadOptions } from './lib/tenant-topology.service';
export {
  topologyLeaves,
  topologyDirectChildren,
  topologyTenantIds,
  knownTopology,
  unknownTopology
} from './lib/tenant-topology';
export type {
  TenantTopologyNode,
  TenantTopologyResult,
  TenantTopologyUnknownReason,
  KnownTenantTopology,
  UnknownTenantTopology
} from './lib/tenant-topology';
