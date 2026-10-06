import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { SystemCommunicationConfigurationStateDto, SystemCommunicationDeploymentStateDto } from '@meshmakers/octo-services';
import { CockpitAdapterStatesDtoGQL, CockpitAdapterStatesQueryDto } from '../../graphQL/cockpitAdapterStates';
import { isAdapterAtRest, isAdapterExpectedToRun, isAdapterOnline } from '../../utils/adapter-online';

/** One adapter row of `cockpitAdapterStates`. */
export type CockpitAdapterState = NonNullable<NonNullable<NonNullable<NonNullable<CockpitAdapterStatesQueryDto['runtime']>['systemCommunicationAdapter']>['items']>[number]>;

/** The adapters read for the cockpit and how many the tenant has in total. */
export interface CockpitAdapterStates {
  states: CockpitAdapterState[];
  /** `totalCount` of the connection; larger than `states.length` when the read was capped. */
  totalCount: number;
}

/** Upper bound of adapters read; beyond it the KPI and findings say "≥" / "first N". */
export const COCKPIT_ADAPTER_LIMIT = 500;
/** Answers younger than this are shared between the "Adapter status" KPI and the attention list. */
const SHARE_MS = 10_000;
/** A running adapter offline for longer than this is reported (ui-concept §5.5). */
export const ADAPTER_OFFLINE_GRACE_MS = 10 * 60 * 1000;

/**
 * The adapter states behind the "Adapter status" KPI and the adapters provider of the attention
 * list. Both ask within the same board load, so one request per tenant is shared for a few
 * seconds. Keyed by tenant: the service is a root singleton and a tenant switch must never show
 * the previous tenant's adapters.
 */
@Injectable({ providedIn: 'root' })
export class CockpitAdapterStatesService {
  private readonly gql = inject(CockpitAdapterStatesDtoGQL);
  private readonly shared = new Map<string, { at: number; states: Observable<CockpitAdapterStates> }>();

  states(tenantId: string, now = Date.now()): Observable<CockpitAdapterStates> {
    const cached = this.shared.get(tenantId);
    if (cached && now - cached.at <= SHARE_MS) {
      return cached.states;
    }
    const states = this.gql.fetch({ variables: { first: COCKPIT_ADAPTER_LIMIT }, fetchPolicy: 'network-only' }).pipe(
      map(result => {
        const connection = result.data?.runtime?.systemCommunicationAdapter;
        const rows = (connection?.items ?? []).filter((row): row is CockpitAdapterState => !!row);
        return { states: rows, totalCount: Math.max(connection?.totalCount ?? rows.length, rows.length) };
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.shared.set(tenantId, { at: now, states });
    return states;
  }
}

/** Adapters whose deployment or configuration failed. */
export function adaptersInError<T extends Pick<CockpitAdapterState, 'deploymentState' | 'configurationState'>>(states: T[]): T[] {
  return states.filter(state => state.deploymentState === SystemCommunicationDeploymentStateDto.ErrorDto
    || state.configurationState === SystemCommunicationConfigurationStateDto.ErrorDto);
}

/**
 * Adapters expected to run that have not been online for the grace period (Helm-deployed and
 * edge/local alike, see `utils/adapter-online.ts`); on-demand adapters at rest are not reported.
 */
export function adaptersOffline<T extends Pick<CockpitAdapterState, 'communicationState' | 'deploymentState' | 'lifecycleState' | 'communicationStateTimestamp'>>(states: T[], now: number): T[] {
  return states.filter(state => {
    if (!isAdapterExpectedToRun(state) || isAdapterOnline(state) || isAdapterAtRest(state)) {
      return false;
    }
    const since = state.communicationStateTimestamp ? new Date(state.communicationStateTimestamp).getTime() : NaN;
    return Number.isNaN(since) || now - since > ADAPTER_OFFLINE_GRACE_MS;
  });
}
