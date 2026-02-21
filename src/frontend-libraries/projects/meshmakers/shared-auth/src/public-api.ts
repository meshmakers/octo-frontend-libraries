/*
 * Public API Surface of shared-auth
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthorizeService } from './lib/authorize.service';
import { provideOAuthClient } from 'angular-oauth2-oidc';

// Core services
export * from './lib/authorize.service';
export * from './lib/roles';

// Functional interceptor
export { authorizeInterceptor } from './lib/authorize.interceptor';

// Functional guards
export {
  authorizeGuard,
  authorizeChildGuard,
  authorizeMatchGuard,
  authorizeDeactivateGuard
} from './lib/authorize.guard';

// UI Components
export * from './lib/mm-login-app-bar-section/login-app-bar-section.component';

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
