import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CockpitCkModelStatesDtoGQL } from '../../graphQL/cockpitCkModelStates';
import { CockpitCkModelCounts } from '../kpi/cockpit-kpi';

/** Names of models in ResolveFailed fetched with the counts. */
export const RESOLVE_FAILED_NAMES_FETCHED = 10;
const SHARE_MS = 10_000;

/**
 * CK model counts per state (`cockpitCkModelStates`, one request with aliased counts), shared for
 * a few seconds per tenant between the "CK model state" KPI and the ResolveFailed provider of the
 * attention list.
 */
@Injectable({ providedIn: 'root' })
export class CockpitCkModelStatesService {
  private readonly gql = inject(CockpitCkModelStatesDtoGQL);
  private readonly shared = new Map<string, { at: number; counts: Observable<CockpitCkModelCounts> }>();

  counts(tenantId: string, now = Date.now()): Observable<CockpitCkModelCounts> {
    const cached = this.shared.get(tenantId);
    if (cached && now - cached.at <= SHARE_MS) {
      return cached.counts;
    }
    const counts = this.gql.fetch({ variables: { first: RESOLVE_FAILED_NAMES_FETCHED }, fetchPolicy: 'network-only' }).pipe(
      map(result => {
        const ck = result.data?.constructionKit;
        const names = (ck?.resolveFailed?.items ?? []).map(item => item?.id?.fullName).filter((name): name is string => !!name);
        return {
          total: ck?.all?.totalCount ?? 0,
          available: ck?.available?.totalCount ?? 0,
          importing: ck?.importing?.totalCount ?? 0,
          resolveFailed: Math.max(ck?.resolveFailed?.totalCount ?? 0, names.length),
          resolveFailedNames: names
        };
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.shared.set(tenantId, { at: now, counts });
    return counts;
  }
}
