import { Injectable, inject } from '@angular/core';
import { AssetRepoService } from '@meshmakers/octo-services';
import { defer, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Child tenants of the current tenant (the system tenant: every tenant of the installation). */
export interface CockpitChildTenants {
  total: number;
  /** Ids of the first tenants (for the detail line). */
  firstIds: string[];
}

/** Tenant ids read with the count. */
export const COCKPIT_CHILD_TENANT_IDS = 3;

/**
 * Child tenant count (AB#5558, system cockpit) from the asset repository's tenant list
 * (`GET {tenantId}/v1/tenants`, the Child Tenants page). The list only knows id and database —
 * there is no per-tenant state (enabled, mode, health) to group by.
 */
@Injectable({ providedIn: 'root' })
export class CockpitChildTenantsService {
  private readonly assetRepo = inject(AssetRepoService);

  childTenants(): Observable<CockpitChildTenants> {
    return defer(() => from(this.assetRepo.getTenants(0, COCKPIT_CHILD_TENANT_IDS))).pipe(map(result => {
      const ids = (result?.list ?? []).map(tenant => tenant?.tenantId).filter((id): id is string => !!id);
      return { total: Math.max(result?.totalCount ?? 0, ids.length), firstIds: ids };
    }));
  }
}
