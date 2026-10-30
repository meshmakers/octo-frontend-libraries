import { of, type Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { MAX_SCOPE_HOPS, type EntitySelectorConfig } from '../models/meshboard.models';
import type { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { isFollowerSelector } from './entity-selector-follow';
import { scopePlan, type NormalizedScopeHop } from './entity-selector-scope-path';
import type { EntitySelectorScopeState } from './stream-data-scope';

/**
 * Dependent entity selectors (AB#7915).
 *
 * A dependent selector (`scopeSource` set) keeps its own picker, but while its
 * leader has a pick the picker lists only the entities reached from that pick
 * through `scopeSource.path` — the *picker scope*. One level only: the leader
 * is neither a follower (AB#7722) nor itself dependent. Pure helpers, shared by
 * the view (runtime resolution), the toolbar and the specs.
 */

/** Why a selector's `scopeSource` cannot be used. */
export type ScopeSourceProblem =
  | 'follower'        // the selector itself follows another one (followers have no picker)
  | 'unknown'         // the leader id names no selector of the board
  | 'self'            // the leader is the selector itself
  | 'leaderFollower'  // the leader follows another selector
  | 'leaderDependent' // the leader is itself dependent (chain)
  | 'path';           // no hop, more than MAX_SCOPE_HOPS hops, or a hop without role / target type

/**
 * The scope source of a selector:
 * - `none`: the selector is not dependent.
 * - `source`: a valid leader plus the normalized hops (direction made explicit).
 * - `invalid`: the configuration cannot be used. At runtime the picker
 *   behaves as *failed* (lists nothing) and one warning is logged per board
 *   load; a follower with a `scopeSource` only warns (it has no picker).
 */
export type ScopeSourceResolution =
  | { kind: 'none' }
  | { kind: 'source'; leader: EntitySelectorConfig; hops: NormalizedScopeHop[] }
  | { kind: 'invalid'; problem: ScopeSourceProblem; leaderId: string; reason: string };

/** True when the selector declares a scope source (valid or not). */
export function hasScopeSource(selector: EntitySelectorConfig): boolean {
  return !!selector.scopeSource;
}

/** Resolves the leader and the hops of `selector`'s scope source among `selectors`. */
export function resolveScopeSource(
  selectors: readonly EntitySelectorConfig[],
  selector: EntitySelectorConfig
): ScopeSourceResolution {
  const source = selector.scopeSource;
  if (!source) {
    return { kind: 'none' };
  }
  const leaderId = typeof source.selectorId === 'string' ? source.selectorId : '';
  const invalid = (problem: ScopeSourceProblem, reason: string): ScopeSourceResolution =>
    ({ kind: 'invalid', problem, leaderId, reason });

  if (isFollowerSelector(selector)) {
    return invalid('follower', 'the selector follows another selector and has no picker');
  }
  if (!leaderId || leaderId === selector.id) {
    return leaderId
      ? invalid('self', 'the leader is the selector itself')
      : invalid('unknown', 'no leader selector is set');
  }
  const leader = selectors.find(s => s.id === leaderId);
  if (!leader) {
    return invalid('unknown', `the leader '${leaderId}' does not exist`);
  }
  if (isFollowerSelector(leader)) {
    return invalid('leaderFollower', `the leader '${leaderId}' follows another selector`);
  }
  if (hasScopeSource(leader)) {
    return invalid('leaderDependent', `the leader '${leaderId}' depends on another selector`);
  }
  const path = Array.isArray(source.path) ? source.path : [];
  if (path.length === 0) {
    return invalid('path', `the path needs 1 to ${MAX_SCOPE_HOPS} hops`);
  }
  // The path validation of AB#7723 (hop count, role and target per hop).
  const plan = scopePlan({ path });
  if (plan.kind !== 'path') {
    return invalid('path', plan.kind === 'invalid' ? plan.reason : `the path needs 1 to ${MAX_SCOPE_HOPS} hops`);
  }
  return { kind: 'source', leader, hops: plan.hops };
}

/**
 * The valid dependents of `leaderId`: selectors whose scope source names
 * `leaderId` and resolves to a usable leader and path.
 */
export function dependentsOf(
  selectors: readonly EntitySelectorConfig[],
  leaderId: string
): EntitySelectorConfig[] {
  return selectors.filter(s =>
    s.scopeSource?.selectorId === leaderId && resolveScopeSource(selectors, s).kind === 'source'
  );
}

/** Picker state of one selector, derived from its scope source and the stored picker scope. */
export type PickerScopeView =
  | { kind: 'unscoped' }
  | { kind: 'pending' }
  | { kind: 'scoped'; rtIds: string[] }
  | { kind: 'empty' }
  | { kind: 'failed' };

/**
 * How the selector's picker lists (toolbar):
 * - no scope source, a follower, or a leader without pick (no stored state) → `unscoped`, as before;
 * - an invalid scope source → `failed` (never the unscoped list);
 * - otherwise the stored picker scope: `pending`, `scoped` (≥1 rtId), `empty` or `failed`.
 */
export function pickerScopeView(
  selectors: readonly EntitySelectorConfig[],
  selector: EntitySelectorConfig,
  state: EntitySelectorScopeState | undefined
): PickerScopeView {
  const resolution = resolveScopeSource(selectors, selector);
  if (resolution.kind === 'none' || isFollowerSelector(selector)) {
    return { kind: 'unscoped' };
  }
  if (resolution.kind === 'invalid') {
    return { kind: 'failed' };
  }
  if (!state) {
    return { kind: 'unscoped' };
  }
  switch (state.status) {
    case 'pending':
      return { kind: 'pending' };
    case 'failed':
      return { kind: 'failed' };
    case 'resolved':
      return state.rtIds.length > 0 ? { kind: 'scoped', rtIds: state.rtIds } : { kind: 'empty' };
  }
}

/**
 * The name of the leader in the picker texts: the display name of its current
 * pick, else its label, else its id.
 */
export function leaderDisplayName(
  selectors: readonly EntitySelectorConfig[],
  selector: EntitySelectorConfig
): string {
  const leaderId = selector.scopeSource?.selectorId ?? '';
  const leader = selectors.find(s => s.id === leaderId);
  return leader?.selectedDisplayName || leader?.label || leaderId;
}

/** Empty-list text when the leader's pick reaches nothing of this type (wording agreed with the Studio PO). */
export function pickerScopeEmptyMessage(label: string, leaderName: string): string {
  return `No ${label || 'entity'} in ${leaderName}.`;
}

/** Text when the picker scope could not be resolved (wording agreed with the Studio PO). */
export function pickerScopeFailedMessage(label: string, leaderName: string): string {
  return `Could not load the ${label || 'entity'} of ${leaderName}.`;
}


type PickerFetch = GetEntitiesByCkTypeDtoGQL['fetch'];
type PickerFetchResult = ReturnType<PickerFetch>;

/** The result of a picker query that lists nothing (no request is sent). */
function emptyPickerResult(): PickerFetchResult {
  return of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } }) as unknown as PickerFetchResult;
}

/**
 * A picker query that never sends a request and lists nothing — the picker of
 * a dependent selector whose scope is empty or failed (AB#7915). Never the
 * unscoped list.
 */
export function withoutListing(gql: GetEntitiesByCkTypeDtoGQL): GetEntitiesByCkTypeDtoGQL {
  const wrapped = Object.create(gql) as GetEntitiesByCkTypeDtoGQL;
  wrapped.fetch = (() => emptyPickerResult()) as PickerFetch;
  return wrapped;
}

/**
 * A picker query for a dependent selector whose scope is still resolving
 * (AB#7915): a fetch waits — the picker shows its loading state — until
 * `settled$` delivers the query to use once the scope is known (scoped, or
 * `null` for "list nothing"), and then sends exactly that query. No request is
 * sent while the scope is pending, so the picker never shows the unscoped list.
 */
export function deferredPickerQuery(
  gql: GetEntitiesByCkTypeDtoGQL,
  settled$: Observable<GetEntitiesByCkTypeDtoGQL | null>
): GetEntitiesByCkTypeDtoGQL {
  const wrapped = Object.create(gql) as GetEntitiesByCkTypeDtoGQL;
  wrapped.fetch = ((options: Parameters<PickerFetch>[0]) => settled$.pipe(
    take(1),
    switchMap(query => query ? query.fetch(options) : emptyPickerResult())
  )) as PickerFetch;
  return wrapped;
}
