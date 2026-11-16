import { HttpContext } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { IConfigurationService } from '../services/configuration.service';

/**
 * Addressing a GraphQL operation to another tenant than the route tenant (AB#8985).
 *
 * The app's Apollo client addresses the tenant of the current route (`tenants/{tenantId}/GraphQL`). A parent tenant
 * administrator also calls a few CK methods on a child tenant (backup of a child tenant: `System.Bot/TenantRepository.Dump-1`
 * and `runtime.operations` of the child, allowed by the parent-tenant administration rule of AB#8986). Such an operation
 * keeps the app's client — and so its links (error link, authorization) — and only overrides the request URI with the
 * Apollo context key `uri`, which `apollo-angular`'s `HttpLink` prefers over the URI it was created with.
 *
 * A 403 of such a request (the tenant authorization middleware: "… is not an existing child tenant of it") is marked
 * caller-handled (`MM_CALLER_HANDLED_STATUSES`, Apollo context key `httpContext`), so the global HTTP error interceptor
 * shows no "Access denied" toast: the caller explains the refusal itself (one failing child must not produce a toast per
 * row of a list).
 *
 * Apollo deduplicates identical in-flight queries by document and variables only — not by `uri`. Reading
 * `runtime.operations` of two child tenants with the same variables at the same time would therefore send ONE request
 * and give both callers the first tenant's answer. The context turns deduplication off (`queryDeduplication: false`).
 */

/** HTTP statuses a request to another tenant leaves to the caller (see the module comment). */
export const TENANT_TARGET_CALLER_HANDLED_STATUSES: readonly number[] = [403];

/** URI of the GraphQL endpoint of `tenantId` under the asset repository base URL (`…/tenants/{tenantId}/GraphQL`). */
export function tenantGraphQlUri(assetServices: string | null | undefined, tenantId: string): string {
  return `${assetServices ?? ''}tenants/${encodeURIComponent(tenantId)}/GraphQL`;
}

/** Apollo operation context of {@link tenantGraphQlContext}. */
export interface TenantGraphQlContext {
  uri?: string;
  httpContext?: HttpContext;
  queryDeduplication?: boolean;
}

/**
 * Apollo operation context that sends the operation to the GraphQL endpoint of `tenantId` and leaves its 403 to the
 * caller; an empty object when no target tenant is given, so the operation goes to the route tenant exactly as before.
 *
 * @param configurationService The app's configuration (`assetServices`); without it the URI is relative.
 * @param tenantId The target tenant, e.g. a child tenant of the route tenant; `null`/`undefined`/empty = route tenant.
 */
export function tenantGraphQlContext(
  configurationService: IConfigurationService | null | undefined,
  tenantId: string | null | undefined
): TenantGraphQlContext {
  if (!tenantId) {
    return {};
  }
  return {
    uri: tenantGraphQlUri(configurationService?.config?.assetServices, tenantId),
    httpContext: new HttpContext().set(MM_CALLER_HANDLED_STATUSES, TENANT_TARGET_CALLER_HANDLED_STATUSES),
    queryDeduplication: false
  };
}
