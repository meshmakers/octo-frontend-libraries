/**
 * THE adapter online rule (AB#5545, moved here with the cockpit widgets in AB#5558). One definition
 * for the "Adapter status" cockpit widget and the adapters provider of the "Attention list", and —
 * re-exported by the Refinery Studio — for Integration › Overview, the pool detail page and the
 * adapter detail header:
 *
 * - **Online** — the adapter is connected right now: `communicationState === ONLINE`. Errors do not
 *   change this (a connected adapter with a configuration error is online *and* in error).
 * - **Expected to run** — the denominator of every "x / y online" counter: adapters the operator
 *   was asked to run (`deploymentState` `DEPLOYED`, `PENDING` or `ERROR` — a failed deployment is
 *   still supposed to run, it is counted as offline *and* reported as an error), every adapter
 *   online right now (edge / locally run adapters have no Helm deployment), and registered adapters without a Helm chart (`DISABLED` and not
 *   `UNREGISTERED` — run outside the operator, e.g. on an edge device). Undeployed Helm adapters
 *   and adapters that never connected are not expected to run, so they never count as "offline".
 *
 * Every online adapter is expected to run, so `online ≤ expected` always holds. On-demand adapters
 * at rest (hibernated, draining, waking) are expected to run but offline on purpose; counters show
 * them separately (`resting`) and do not warn about them.
 *
 * States are compared as GraphQL enum values, case-insensitively, so both the generated `*Dto`
 * enums (`'ONLINE'`) and plain strings work.
 */
export interface AdapterOnlineFields {
  communicationState?: string | null;
  deploymentState?: string | null;
  lifecycleState?: string | null;
}

const up = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();

export function isAdapterOnline(adapter: AdapterOnlineFields): boolean {
  return up(adapter.communicationState) === 'ONLINE';
}

export function isAdapterExpectedToRun(adapter: AdapterOnlineFields): boolean {
  const deployment = up(adapter.deploymentState);
  return deployment === 'DEPLOYED' || deployment === 'PENDING' || deployment === 'ERROR'
    || isAdapterOnline(adapter)
    || (deployment === 'DISABLED' && up(adapter.communicationState) !== 'UNREGISTERED');
}

/**
 * Hibernated, draining or waking on-demand adapters are offline on purpose (AB#4919). Only a
 * known non-running lifecycle state counts; a missing lifecycle state is not "at rest".
 */
export function isAdapterAtRest(adapter: AdapterOnlineFields): boolean {
  const lifecycle = up(adapter.lifecycleState);
  return lifecycle !== '' && lifecycle !== 'RUNNING';
}

export interface AdapterOnlineSummary {
  /** Adapters connected right now. */
  online: number;
  /** Adapters expected to run (the denominator). */
  expected: number;
  /** All adapters given. */
  total: number;
  /** Expected to run, offline, and at rest on purpose (on-demand). */
  resting: number;
  /** Expected to run, offline, and not at rest — these need attention. */
  offline: number;
}

export function summarizeAdapterOnline(adapters: readonly AdapterOnlineFields[]): AdapterOnlineSummary {
  let online = 0;
  let expected = 0;
  let resting = 0;
  for (const adapter of adapters) {
    if (!isAdapterExpectedToRun(adapter)) {
      continue;
    }
    expected++;
    if (isAdapterOnline(adapter)) {
      online++;
    } else if (isAdapterAtRest(adapter)) {
      resting++;
    }
  }
  return { online, expected, total: adapters.length, resting, offline: expected - online - resting };
}
