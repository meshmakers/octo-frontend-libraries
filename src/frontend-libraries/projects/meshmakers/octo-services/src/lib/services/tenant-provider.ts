import { InjectionToken } from '@angular/core';

/**
 * Provider function type for getting the current tenant ID.
 * Apps must provide this for tenant-specific operations like export/import.
 *
 * @returns Promise resolving to the tenant ID or null if not available
 */
export type TenantIdProvider = () => Promise<string | null>;

/**
 * Injection token for providing the current tenant ID.
 * This is required for operations that need tenant context, such as:
 * - Exporting/importing runtime models
 * - Asset repository operations
 * - Job management
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
 * import { ActivatedRoute } from '@angular/router';
 * import { firstValueFrom } from 'rxjs';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     {
 *       provide: TENANT_ID_PROVIDER,
 *       useFactory: () => {
 *         const route = inject(ActivatedRoute);
 *         const configService = inject(CONFIGURATION_SERVICE);
 *         return async (): Promise<string | null> => {
 *           if (route.firstChild) {
 *             const params = await firstValueFrom(route.firstChild.params);
 *             const tenantId = params['tenantId'] as string;
 *             if (tenantId) {
 *               return tenantId;
 *             }
 *           }
 *           return configService.config?.systemTenantId ?? null;
 *         };
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export const TENANT_ID_PROVIDER = new InjectionToken<TenantIdProvider>('TENANT_ID_PROVIDER');
