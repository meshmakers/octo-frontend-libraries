import type { QueryExecutionResult } from '../services/query-executor.service';
import type { QueryFamily } from './query-family';

/**
 * Resolution state of one entity selector's stream-data scope (AB#7721). Kept
 * transiently by `MeshBoardStateService`, written by the view while a pick is
 * resolved to its source rtIds.
 *
 * - `pending`: the pick is being resolved (childScope traversal, one hop or a path).
 * - `resolved`: the pick resolved to `rtIds` — possibly none.
 * - `failed`: the resolution threw (e.g. the association fetch failed).
 *
 * A selector without an entry has no active pick: bound widgets keep the
 * query's persisted scope.
 */
export type EntitySelectorScopeState =
  | { status: 'pending' }
  | { status: 'resolved'; rtIds: string[] }
  | { status: 'failed' };

/**
 * What a widget bound to an entity selector does with its persistent query —
 * stream data (AB#7721) and runtime queries (AB#7725). Returned by
 * `MeshBoardStateService.resolveEntitySelectorScope`.
 *
 * - `unscoped`: no binding or no active pick — query with the persisted scope
 *   (unchanged behaviour).
 * - `pending`: the scope is still resolving — show the loading state and send
 *   NO query; the view triggers a refresh once the scope is known.
 * - `scoped`: query restricted to `rtIds` on the server — stream data via
 *   `streamDataArgs.rtIds`, runtime queries (simple, aggregation, grouping) via
 *   the field filter `rtId IN (rtIds)` (`QueryExecutionOptions.scopeRtIds`).
 * - `empty`: the pick has nothing in scope (`noTargets`) or the lookup failed
 *   (`failed`) — show the no-data state and send NO query. Never fall back to
 *   the persisted scope: that would show rows of other entities.
 */
export type StreamDataScope =
  | { kind: 'unscoped' }
  | { kind: 'pending' }
  | { kind: 'scoped'; rtIds: string[] }
  | { kind: 'empty'; reason: 'noTargets' | 'failed' };

/**
 * The result a widget renders instead of executing its query when its scope is
 * `empty` (AB#7721). Shape-compatible with a real empty response, so each
 * widget's existing no-data rendering applies unchanged.
 */
export function emptyQueryExecutionResult(family: QueryFamily | undefined): QueryExecutionResult {
  return {
    family: family ?? 'streamData',
    queryRtId: null,
    associatedCkTypeId: null,
    columns: [],
    rows: [],
    totalCount: 0,
    hasNextPage: false,
    endCursor: null
  };
}
