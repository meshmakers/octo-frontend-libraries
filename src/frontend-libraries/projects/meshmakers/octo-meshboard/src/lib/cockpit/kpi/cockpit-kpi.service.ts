import { Injectable, Injector, inject } from '@angular/core';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap, take } from 'rxjs/operators';
import { CockpitContextService } from '../cockpit-context.service';
import { COCKPIT_ROLES } from '../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES, CockpitWidgetMessages, readCockpitMessagesSource, resolveCockpitWidgetMessages } from '../cockpit-messages';
import { CockpitAdapterStatesService } from '../data/cockpit-adapter-states.service';
import { CockpitCkModelStatesService } from '../data/cockpit-ck-model-states.service';
import { CockpitDataFlowExecutionsService } from '../data/cockpit-data-flow-executions.service';
import { CockpitBlueprintStatusService } from '../data/cockpit-blueprint-status.service';
import { CockpitChildTenantsService } from '../data/cockpit-child-tenants.service';
import { CockpitServiceHealthService } from '../data/cockpit-service-health.service';
import { COCKPIT_VERSION_SOURCE } from '../cockpit-host';
import { adapterKpi, blueprintUpdatesKpi, ckModelKpi, CockpitKpi, executionKpi, servicesHealthKpi, tenantCountKpi, versionKpi } from './cockpit-kpi';

export { COCKPIT_DATA_FLOW_LIMIT } from '../data/cockpit-data-flow-executions.service';

/** What a tile shows when its query failed (details are logged, never shown). */
export const KPI_ERROR_TEXT = 'The figure could not be loaded.';

/**
 * The cockpit KPIs. The last four are the system cockpit's (AB#5558): child tenants, blueprint
 * updates, platform service health and the host's version.
 */
export type CockpitKpiKind = 'adapterStatus' | 'ckModelState' | 'pipelineExecutions' | 'tenantCount' | 'blueprintUpdates' | 'servicesHealth' | 'versionInfo';

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
  reasonMessage: 'kpiNeedsCommunication' | 'kpiNeedsAdminPanel' | 'kpiNeedsTenantManagement' | 'notAvailable';
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
  ckModelState: { roles: [COCKPIT_ROLES.AdminPanelManagement], models: [], reason: 'Needs the AdminPanelManagement role.', reasonMessage: 'kpiNeedsAdminPanel' },
  // Same role as the Child Tenants page.
  tenantCount: { roles: [COCKPIT_ROLES.TenantManagement], models: [], reason: 'Needs the TenantManagement role.', reasonMessage: 'kpiNeedsTenantManagement' },
  // Same role as the Blueprints pages.
  blueprintUpdates: { roles: [COCKPIT_ROLES.AdminPanelManagement], models: [], reason: 'Needs the AdminPanelManagement role.', reasonMessage: 'kpiNeedsAdminPanel' },
  // The health endpoints and the health detail page are open to every signed-in user.
  servicesHealth: { roles: [], models: [], reason: '', reasonMessage: 'notAvailable' },
  versionInfo: { roles: [], models: [], reason: '', reasonMessage: 'notAvailable' }
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
  /** The system cockpit's data services are resolved on first use, so hosts without them need no providers. */
  private readonly injector = inject(Injector);
  private readonly versions = inject(COCKPIT_VERSION_SOURCE, { optional: true });
  private readonly messagesSource = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });

  /**
   * The KPI's state. Texts (label, status, detail, reasons) come from `messages`, else from the
   * host's `COCKPIT_WIDGET_MESSAGES`, else English (AB#5622).
   */
  kpi(kind: CockpitKpiKind, messages?: CockpitWidgetMessages): Observable<CockpitKpiResult> {
    const gate = COCKPIT_KPI_GATES[kind];
    return defer(() => {
      const texts = resolveCockpitWidgetMessages(messages ?? readCockpitMessagesSource(this.messagesSource));
      return from(this.resolve(gate)).pipe(
        switchMap(access => {
          if (access.kind === 'noTenant') {
            return of<CockpitKpiResult>({ state: 'unavailable', reason: texts.noTenant, forBuilder: true });
          }
          if (access.kind === 'denied') {
            return of<CockpitKpiResult>({ state: 'unavailable', reason: texts[gate.reasonMessage], forBuilder: access.builder });
          }
          if (kind === 'versionInfo' && !this.versions) {
            // Nothing to show without the host's versions: a quiet tile that collapses for non-builders.
            return of<CockpitKpiResult>({ state: 'unavailable', reason: texts.notAvailable, forBuilder: false });
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
      case 'tenantCount':
        return this.injector.get(CockpitChildTenantsService).childTenants().pipe(map(tenants => tenantCountKpi(tenants, texts)));
      case 'blueprintUpdates':
        return this.injector.get(CockpitBlueprintStatusService).status(tenantId).pipe(map(status => blueprintUpdatesKpi(status, texts)));
      case 'servicesHealth':
        return this.injector.get(CockpitServiceHealthService).services().pipe(map(services => servicesHealthKpi(services, texts)));
      case 'versionInfo':
        return defer(() => from(Promise.resolve(this.versions?.entries() ?? []))).pipe(map(entries => versionKpi(entries, texts)));
    }
  }
}
