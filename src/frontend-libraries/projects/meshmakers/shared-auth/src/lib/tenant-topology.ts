/**
 * Types, pure helpers and test helpers for the identity tenant-topology endpoint
 * `GET {issuer}/api/tenant-topology?scope={rootTenantId}` (AB#7044, client AB#7053).
 *
 * Nothing here talks to the network; see `TenantTopologyService` for the one method that does.
 */

/** One tenant below the scope that the signed-in user may use. */
export interface TenantTopologyNode {
  readonly tenantId: string;
  /** 1 = direct child of the scope. */
  readonly depth: number;
  /** The tenant itself has children (they are not listed). */
  readonly hasChildren: boolean;
}

/**
 * Why the topology is unknown. An app maps every one of them to the same degraded mode
 * ("token tenant only") and never issues another request; the reason is for diagnostics only.
 *
 * - `identity-too-old`: 404, the identity service predates the endpoint (cached for the session).
 * - `hierarchy-unreadable`: 503, identity could not read the whole hierarchy (fail closed, retry later).
 * - `unauthorized`: 401 or 403, the token is missing, expired, of the wrong kind or lacks the read scope.
 * - `network`: transport error, timeout or a gateway error (502/504/other 5xx).
 * - `rate-limited`: 429, the per-user rate limit of identity was hit (retry later, not cached).
 * - `invalid-response`: the body (or an unexpected status) does not match the contract.
 * - `not-configured`: no issuer, no access token, an invalid scope, or 400 from identity.
 */
export type TenantTopologyUnknownReason =
  | 'identity-too-old'
  | 'hierarchy-unreadable'
  | 'unauthorized'
  | 'network'
  | 'rate-limited'
  | 'invalid-response'
  | 'not-configured';

export interface KnownTenantTopology {
  readonly topologyKnown: true;
  readonly scope: string;
  readonly scopeHasChildren: boolean;
  readonly tenants: readonly TenantTopologyNode[];
}

export interface UnknownTenantTopology {
  readonly topologyKnown: false;
  readonly reason: TenantTopologyUnknownReason;
  readonly tenants: readonly [];
  readonly scopeHasChildren: null;
}

/** Result of `TenantTopologyService.load`. Discriminate on `topologyKnown`. */
export type TenantTopologyResult = KnownTenantTopology | UnknownTenantTopology;

/** Tenants without children of their own: the ones an app can work in. Empty when unknown. */
export function topologyLeaves(result: TenantTopologyResult): readonly TenantTopologyNode[] {
  return result.topologyKnown ? result.tenants.filter((t) => !t.hasChildren) : [];
}

/** Direct children of the scope (depth 1). Empty when unknown. */
export function topologyDirectChildren(result: TenantTopologyResult): readonly TenantTopologyNode[] {
  return result.topologyKnown ? result.tenants.filter((t) => t.depth === 1) : [];
}

/** All tenant ids of the result. Empty when unknown. */
export function topologyTenantIds(result: TenantTopologyResult): readonly string[] {
  return result.topologyKnown ? result.tenants.map((t) => t.tenantId) : [];
}

/** Test helper for app specs: a known topology. */
export function knownTopology(
  scope: string,
  nodes: readonly TenantTopologyNode[],
  scopeHasChildren: boolean = nodes.length > 0
): KnownTenantTopology {
  return { topologyKnown: true, scope, scopeHasChildren, tenants: nodes.map((n) => ({ ...n })) };
}

/** Test helper for app specs: an unknown topology with the given reason. */
export function unknownTopology(reason: TenantTopologyUnknownReason): UnknownTenantTopology {
  return { topologyKnown: false, reason, tenants: [], scopeHasChildren: null };
}
