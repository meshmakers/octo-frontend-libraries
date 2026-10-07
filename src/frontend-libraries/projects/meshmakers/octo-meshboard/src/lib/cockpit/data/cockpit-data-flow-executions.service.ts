import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { CockpitDataFlowExecutionsDtoGQL } from '../../graphQL/cockpitDataFlowExecutions';
import { countPipelineExecutions, pipelineExecutionInputs } from '../../utils/pipeline-executions';

/** A data flow of `cockpitDataFlowExecutions`: its child pipelines with statistics and latest execution. */
export interface CockpitDataFlowRow {
  children?: { items?: (unknown | null)[] | null } | null;
}

/** The data flows read for the cockpit and how many the tenant has in total. */
export interface CockpitDataFlowExecutions {
  flows: CockpitDataFlowRow[];
  /** `totalCount` of the connection; larger than `flows.length` when the read was capped. */
  totalCount: number;
}

/** Executions of the last 24 hours, summed over the data flows read. */
export interface CockpitExecutionCounts {
  succeeded: number;
  failed: number;
}

/** Upper bound of data flows read for the executions KPI; beyond it the tile says "≥". */
export const COCKPIT_DATA_FLOW_LIMIT = 500;
/** Answers younger than this are shared between the "Pipeline executions 24 h" KPI and the attention list. */
const SHARE_MS = 10_000;

/**
 * The data flows behind the "Pipeline executions 24 h" KPI and the failed-executions provider of
 * the attention list (AB#5622). Both ask within the same board load, so one request per tenant
 * is shared for a few seconds. Keyed by tenant; a failed request is not kept, so the next board
 * load asks again.
 */
@Injectable({ providedIn: 'root' })
export class CockpitDataFlowExecutionsService {
  private readonly gql = inject(CockpitDataFlowExecutionsDtoGQL);
  private readonly shared = new Map<string, { at: number; flows: Observable<CockpitDataFlowExecutions> }>();

  executions(tenantId: string, now = Date.now()): Observable<CockpitDataFlowExecutions> {
    const cached = this.shared.get(tenantId);
    if (cached && now - cached.at <= SHARE_MS) {
      return cached.flows;
    }
    const entry: { at: number; flows: Observable<CockpitDataFlowExecutions> } = { at: now, flows: EMPTY };
    entry.flows = this.gql.fetch({ variables: { first: COCKPIT_DATA_FLOW_LIMIT }, fetchPolicy: 'network-only' }).pipe(
      map(result => {
        const connection = result.data?.runtime?.systemCommunicationDataFlow;
        const rows = (connection?.items ?? []).filter((row): row is NonNullable<typeof row> => !!row) as CockpitDataFlowRow[];
        return { flows: rows, totalCount: Math.max(connection?.totalCount ?? rows.length, rows.length) };
      }),
      // Drop only this request: a newer one for the tenant may have replaced it meanwhile.
      tap({ error: () => { if (this.shared.get(tenantId) === entry) { this.shared.delete(tenantId); } } }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.shared.set(tenantId, entry);
    return entry.flows;
  }
}

/**
 * Executions of the last 24 hours over all flows, counted exactly like the Studio's Data Flows
 * list (`countPipelineExecutions` per data flow), so the KPI, the attention list and the list agree.
 */
export function countFlowExecutions(flows: CockpitDataFlowRow[]): CockpitExecutionCounts {
  let succeeded = 0;
  let failed = 0;
  for (const flow of flows) {
    const inputs = pipelineExecutionInputs(flow.children?.items);
    if (inputs.length === 0) {
      continue;
    }
    const counts = countPipelineExecutions(inputs);
    succeeded += counts.success24h;
    failed += counts.failure24h;
  }
  return { succeeded, failed };
}
