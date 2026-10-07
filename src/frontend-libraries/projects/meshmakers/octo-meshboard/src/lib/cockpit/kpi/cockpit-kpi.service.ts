import { Injectable, inject } from '@angular/core';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap, take } from 'rxjs/operators';
import { CockpitContextService } from '../cockpit-context.service';
import { COCKPIT_ROLES } from '../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES, CockpitWidgetMessages, readCockpitMessagesSource, resolveCockpitWidgetMessages } from '../cockpit-messages';
import { CockpitAdapterStatesService } from '../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../data/cockpit-ck-model-states.service';
import { CockpitDataFlowExecutionsService } from '../data/cockpit-data-flow-executions.service';
import { adapterKpi, ckModelKpi, CockpitKpi, executionKpi } from './cockpit-kpi';

export { COCKPIT_DATA_FLOW_LIMIT } from '../data/cockpit-data-flow-executions.service';

/** What a tile shows when its query failed (details are logged, never shown). */
export const KPI_ERROR_TEXT = 'The figure could not be loaded.';

/** The cockpit KPIs. */
export type CockpitKpiKind = 'adapterStatus' | 'ckModelState' | 'pipelineExecutions';

/** State of one KPI widget. */
export type CockpitKpiResult =
  | { state: 'loading' }
  /**
   * The viewer lacks a role or the tenant a CK model. `reason` says which — meant for builders
   * only; `forBuilder: false` means the viewer is no builder and must see a neutral state.
   */
  | { state: 'unavailable'; reason: string; forBuilder: boolean }
  | { state: 'error'; message: string }
  | { state: 'ready'; kpi: CockpitKpi };

interface KpiGate {
  roles: string[];
  models: string[];
  /** English reason (the default of {@link reasonMessage}). */
  reason: string;
  /** Message member of the reason (AB#5622). */
  reasonMessage: 'kpiNeedsCommunication' | 'kpiNeedsAdminPanel';
}

const COMMUNICATION_GATE: KpiGate = {
  roles: [COCKPIT_ROLES.CommunicationManagement],
  models: ['System.Communication'],
  reason: 'Needs the CommunicationManagement role and the System.Communication model.',
  reasonMessage: 'kpiNeedsCommunication'
};

/** What each KPI needs — the same as the page its tile opens. */
export const COCKPIT_KPI_GATES: Record<CockpitKpiKind, KpiGate> = {
  adapterStatus: COMMUNICATION_GATE,
  pipelineExecutions: COMMUNICATION_GATE,
  ckModelState: { roles: [COCKPIT_ROLES.AdminPanelManagement], models: [], reason: 'Needs the AdminPanelManagement role.', reasonMessage: 'kpiNeedsAdminPanel' }
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
  private readonly dataFlowExecutions = inject(CockpitDataFlowExecutionsService);
  private readonly messagesSource = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });

  /**
   * The KPI's state. Texts (label, status, detail, reasons) come from `messages`, else from the
   * host's `COCKPIT_WIDGET_MESSAGES`, else English (AB#5622).
   */
  kpi(kind: CockpitKpiKind, messages?: CockpitWidgetMessages): Observable<CockpitKpiResult> {
    const gate = COCKPIT_KPI_GATES[kind];
    return defer(() => {
      const texts = messages ?? resolveCockpitWidgetMessages(readCockpitMessagesSource(this.messagesSource));
      return from(this.resolve(gate)).pipe(
        switchMap(access => {
          if (access.kind === 'noTenant') {
            return of<CockpitKpiResult>({ state: 'unavailable', reason: texts.noTenant, forBuilder: true });
          }
          if (access.kind === 'denied') {
            return of<CockpitKpiResult>({ state: 'unavailable', reason: texts[gate.reasonMessage], forBuilder: access.builder });
          }
          return this.load(kind, access.tenantId, texts).pipe(take(1), map((kpi): CockpitKpiResult => ({ state: 'ready', kpi })));
        }),
        catchError(error => {
          // Details go to the console only; the tile shows a generic text.
          console.warn(`Cockpit: KPI '${kind}' failed`, error);
          return of<CockpitKpiResult>({ state: 'error', message: texts.kpiLoadFailed });
        })
      );
    }).pipe(
      startWith<CockpitKpiResult>({ state: 'loading' })
    );
  }

  private async resolve(gate: KpiGate): Promise<{ kind: 'ok'; tenantId: string } | { kind: 'noTenant' } | { kind: 'denied'; builder: boolean }> {
    const tenantId = await this.context.tenantId();
    if (!tenantId) {
      return { kind: 'noTenant' };
    }
    if (!(await this.context.allows(gate.roles, gate.models))) {
      return { kind: 'denied', builder: await this.context.isBuilder() };
    }
    return { kind: 'ok', tenantId };
  }

  private load(kind: CockpitKpiKind, tenantId: string, texts: CockpitWidgetMessages): Observable<CockpitKpi> {
    switch (kind) {
      case 'adapterStatus':
        return this.adapterStates.states(tenantId).pipe(map(states => adapterKpi(states, texts)));
      case 'ckModelState':
        return this.ckModelStates.counts(tenantId).pipe(map(counts => ckModelKpi(counts, texts)));
      case 'pipelineExecutions':
        return this.dataFlowExecutions.executions(tenantId).pipe(map(({ flows, totalCount }) => executionKpi(flows, totalCount, texts)));
    }
  }
}
