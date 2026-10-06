import { Injectable, inject } from '@angular/core';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap, take } from 'rxjs/operators';
import { CockpitDataFlowExecutionsDtoGQL } from '../../graphQL/cockpitDataFlowExecutions';
import { CockpitContextService } from '../cockpit-context.service';
import { COCKPIT_ROLES } from '../cockpit-host';
import { CockpitAdapterStatesService } from '../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../data/cockpit-ck-model-states.service';
import { adapterKpi, ckModelKpi, CockpitDataFlowRow, CockpitKpi, executionKpi } from './cockpit-kpi';

/** Upper bound of data flows read for the executions KPI; beyond it the tile says "≥". */
export const COCKPIT_DATA_FLOW_LIMIT = 500;

/** The cockpit KPIs. */
export type CockpitKpiKind = 'adapterStatus' | 'ckModelState' | 'pipelineExecutions';

/** State of one KPI widget. */
export type CockpitKpiResult =
  | { state: 'loading' }
  /** The viewer lacks a role or the tenant a CK model; `reason` says which. */
  | { state: 'unavailable'; reason: string }
  | { state: 'error'; message: string }
  | { state: 'ready'; kpi: CockpitKpi };

interface KpiGate {
  roles: string[];
  models: string[];
  reason: string;
}

const COMMUNICATION_GATE: KpiGate = {
  roles: [COCKPIT_ROLES.CommunicationManagement],
  models: ['System.Communication'],
  reason: 'Needs the CommunicationManagement role and the System.Communication model.'
};

/** What each KPI needs — the same as the page its tile opens. */
export const COCKPIT_KPI_GATES: Record<CockpitKpiKind, KpiGate> = {
  adapterStatus: COMMUNICATION_GATE,
  pipelineExecutions: COMMUNICATION_GATE,
  ckModelState: { roles: [COCKPIT_ROLES.AdminPanelManagement], models: [], reason: 'Needs the AdminPanelManagement role.' }
};

/**
 * The cockpit KPIs (AB#5558, from the Home KPI strip of AB#5545): each KPI has its own gate and
 * query; a viewer without the gate gets `unavailable` and no request is sent.
 */
@Injectable({ providedIn: 'root' })
export class CockpitKpiService {
  private readonly context = inject(CockpitContextService);
  private readonly adapterStates = inject(CockpitAdapterStatesService);
  private readonly ckModelStates = inject(CockpitCkModelStatesService);
  private readonly dataFlowsGql = inject(CockpitDataFlowExecutionsDtoGQL);

  kpi(kind: CockpitKpiKind): Observable<CockpitKpiResult> {
    const gate = COCKPIT_KPI_GATES[kind];
    return defer(() => from(this.resolve(gate))).pipe(
      switchMap(tenantId => {
        if (tenantId === null) {
          return of<CockpitKpiResult>({ state: 'unavailable', reason: gate.reason });
        }
        return this.load(kind, tenantId).pipe(take(1), map((kpi): CockpitKpiResult => ({ state: 'ready', kpi })));
      }),
      catchError(error => {
        console.warn(`Cockpit: KPI '${kind}' failed`, error);
        return of<CockpitKpiResult>({ state: 'error', message: error instanceof Error ? error.message : 'The figure could not be loaded.' });
      }),
      startWith<CockpitKpiResult>({ state: 'loading' })
    );
  }

  /** The tenant when the viewer passes the gate, else `null`. */
  private async resolve(gate: KpiGate): Promise<string | null> {
    const tenantId = await this.context.tenantId();
    if (!tenantId || !(await this.context.allows(gate.roles, gate.models))) {
      return null;
    }
    return tenantId;
  }

  private load(kind: CockpitKpiKind, tenantId: string): Observable<CockpitKpi> {
    switch (kind) {
      case 'adapterStatus':
        return this.adapterStates.states(tenantId).pipe(map(adapterKpi));
      case 'ckModelState':
        return this.ckModelStates.counts(tenantId).pipe(map(ckModelKpi));
      case 'pipelineExecutions':
        return this.dataFlowsGql.fetch({ variables: { first: COCKPIT_DATA_FLOW_LIMIT }, fetchPolicy: 'network-only' }).pipe(
          map(result => {
            const connection = result.data?.runtime?.systemCommunicationDataFlow;
            const flows = (connection?.items ?? []).filter((row): row is NonNullable<typeof row> => !!row) as CockpitDataFlowRow[];
            return executionKpi(flows, Math.max(connection?.totalCount ?? flows.length, flows.length));
          })
        );
    }
  }
}
