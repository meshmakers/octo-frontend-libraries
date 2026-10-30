import {
  MAX_SCOPE_HOPS,
  type EntitySelectorChildScope,
  type EntitySelectorScopeHop
} from '../models/meshboard.models';

/**
 * Multi-hop child scope of an entity selector (AB#7723).
 *
 * A child scope is either the original one-hop form (top-level
 * `targetCkTypeId` / `roleId` / `direction`) or an ordered `path` of hops. Pure
 * helpers shared by the view (runtime resolution), the selector editor and the
 * specs.
 */

/** A hop with its direction made explicit (`'in'` when the config omits it). */
export interface NormalizedScopeHop {
  roleId: string;
  direction: 'in' | 'out';
  targetCkTypeId: string;
}

/**
 * How a child scope resolves:
 * - `none`: no child scope — the picked entity's own rtId is the scope.
 * - `single`: the original one-hop form (top-level fields, no `path`). Resolved
 *   exactly as before AB#7723.
 * - `path`: a non-empty `path` (it wins over the top-level fields).
 * - `invalid`: a `path` with more than {@link MAX_SCOPE_HOPS} hops, or a hop
 *   without role or target type. At runtime this is a failed scope.
 */
export type ScopePlan =
  | { kind: 'none' }
  | { kind: 'single'; hop: NormalizedScopeHop }
  | { kind: 'path'; hops: NormalizedScopeHop[] }
  | { kind: 'invalid'; reason: string };

/** Turns a selector's child scope into its resolution plan. */
export function scopePlan(childScope: EntitySelectorChildScope | undefined): ScopePlan {
  if (!childScope) {
    return { kind: 'none' };
  }
  const path = childScope.path;
  if (Array.isArray(path) && path.length > 0) {
    if (path.length > MAX_SCOPE_HOPS) {
      return { kind: 'invalid', reason: `the path has ${path.length} hops (at most ${MAX_SCOPE_HOPS})` };
    }
    const hops: NormalizedScopeHop[] = [];
    for (let i = 0; i < path.length; i++) {
      const hop = normalizeHop(path[i]);
      if (!hop) {
        return { kind: 'invalid', reason: `hop ${i + 1} needs an association role and a target type` };
      }
      hops.push(hop);
    }
    return { kind: 'path', hops };
  }
  // Original one-hop form; incomplete top-level fields mean "no child scope",
  // exactly as before AB#7723.
  if (!childScope.targetCkTypeId || !childScope.roleId) {
    return { kind: 'none' };
  }
  return {
    kind: 'single',
    hop: {
      roleId: childScope.roleId,
      direction: childScope.direction ?? 'in',
      targetCkTypeId: childScope.targetCkTypeId
    }
  };
}

/** The hops of a child scope as the editor shows them (one-hop form = one hop). */
export function scopeHopsOf(childScope: EntitySelectorChildScope | undefined): EntitySelectorScopeHop[] {
  if (!childScope) {
    return [];
  }
  if (Array.isArray(childScope.path) && childScope.path.length > 0) {
    return childScope.path.map(h => ({ roleId: h.roleId, direction: h.direction ?? 'in', targetCkTypeId: h.targetCkTypeId }));
  }
  // Incomplete top-level fields are "no child scope" at runtime; show them as none.
  if (childScope.targetCkTypeId && childScope.roleId) {
    return [{ roleId: childScope.roleId, direction: childScope.direction ?? 'in', targetCkTypeId: childScope.targetCkTypeId }];
  }
  return [];
}

/**
 * Editor validation of a hop list: the message for the first hop without role
 * or target type, or for more than {@link MAX_SCOPE_HOPS} hops; `null` when the
 * list can be saved (an empty list = no child scope).
 */
export function scopeHopsValidationError(hops: readonly EntitySelectorScopeHop[]): string | null {
  if (hops.length > MAX_SCOPE_HOPS) {
    return `At most ${MAX_SCOPE_HOPS} hops.`;
  }
  const index = hops.findIndex(h => !h.roleId?.trim() || !h.targetCkTypeId?.trim());
  return index < 0 ? null : `Hop ${index + 1} needs an association and a target type.`;
}

/**
 * The child scope the editor saves for a list of hops: none for zero hops, the
 * original top-level form for one hop (older library versions keep reading
 * it), and `path` only for two or more hops. Roles are trimmed.
 */
export function childScopeFromHops(hops: readonly EntitySelectorScopeHop[]): EntitySelectorChildScope | undefined {
  const clean = hops.map(h => ({
    roleId: h.roleId.trim(),
    direction: h.direction ?? 'in',
    targetCkTypeId: h.targetCkTypeId.trim()
  }));
  if (clean.length === 0) {
    return undefined;
  }
  if (clean.length === 1) {
    const [hop] = clean;
    return { targetCkTypeId: hop.targetCkTypeId, roleId: hop.roleId, direction: hop.direction };
  }
  return { path: clean };
}

/**
 * Fetches the targets of one hop for a batch of source entities: the rtIds
 * reached from `sourceRtIds` (all of CK type `sourceCkTypeId`) over the hop.
 * Duplicates are allowed; {@link resolveScopePath} de-duplicates.
 */
export type ScopeHopFetcher = (
  sourceRtIds: string[],
  sourceCkTypeId: string,
  hop: NormalizedScopeHop
) => Promise<string[]>;

/**
 * Resolves a scope path hop by hop from the picked entity: each hop is ONE
 * batched step over all entities the previous hop reached (the fetcher decides
 * how to batch), the source type of hop n is the target type of hop n-1, and
 * the result is the distinct rtIds of the last hop.
 *
 * - An empty hop ends the resolution: no further hop is requested and the
 *   scope is empty (AB#7721 empty-scope rule).
 * - A failing hop rejects; the caller turns that into a failed scope.
 * - `isCurrent` is checked after every hop: when a newer pick has started, the
 *   resolution stops and returns `null` (stale — must not be applied).
 */
export async function resolveScopePath(
  pickedRtId: string,
  pickedCkTypeId: string,
  hops: readonly NormalizedScopeHop[],
  fetchHop: ScopeHopFetcher,
  isCurrent: () => boolean = () => true
): Promise<string[] | null> {
  let sources = [pickedRtId];
  let sourceCkTypeId = pickedCkTypeId;
  for (const hop of hops) {
    const targets = await fetchHop(sources, sourceCkTypeId, hop);
    if (!isCurrent()) {
      return null;
    }
    sources = distinctRtIds(targets);
    if (sources.length === 0) {
      return [];
    }
    sourceCkTypeId = hop.targetCkTypeId;
  }
  return sources;
}

/** Non-empty rtIds in first-seen order, without duplicates. */
export function distinctRtIds(rtIds: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const id of rtIds) {
    const value = id === null || id === undefined ? '' : String(id);
    if (value.length > 0) {
      seen.add(value);
    }
  }
  return [...seen];
}

/** "Test/Site → Test/System → Test/Device" for the editor's path line. */
export function scopePathLabel(startCkTypeId: string, hops: readonly EntitySelectorScopeHop[]): string {
  return [startCkTypeId, ...hops.map(h => h.targetCkTypeId || '?')].join(' → ');
}

function normalizeHop(hop: EntitySelectorScopeHop | null | undefined): NormalizedScopeHop | null {
  const roleId = typeof hop?.roleId === 'string' ? hop.roleId.trim() : '';
  const targetCkTypeId = typeof hop?.targetCkTypeId === 'string' ? hop.targetCkTypeId.trim() : '';
  if (!roleId || !targetCkTypeId) {
    return null;
  }
  return { roleId, direction: hop?.direction === 'out' ? 'out' : 'in', targetCkTypeId };
}
