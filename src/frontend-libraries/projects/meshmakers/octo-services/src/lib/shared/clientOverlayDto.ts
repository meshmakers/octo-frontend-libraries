/**
 * Result of a "clean overlay URIs" call (AB#4209, deliverable 7).
 *
 * Mirrors the identity-service `CleanOverlayEntriesResultDto`: the endpoint strips every
 * `Source` starting with `overlay:` (or matching a specific `overlay:<name>` when a name was
 * supplied) from every blueprint-managed client's RedirectUris / PostLogoutRedirectUris /
 * AllowedCorsOrigins lists. `base` and `api` sourced entries are always preserved.
 */
export interface CleanOverlayEntriesResultDto {
  /** Overlay name filter that was applied, or null when every `overlay:*` source was targeted. */
  overlayName?: string | null;
  /** Number of clients that had at least one matching entry removed. */
  clientsAffected: number;
  /** Total number of URI entries removed across every list across every client. */
  totalEntriesRemoved: number;
  /** Per-client breakdown; clients with zero removals are omitted. */
  clientResults: CleanOverlayEntriesClientResultDto[];
}

/** Per-client breakdown of removed overlay entries. */
export interface CleanOverlayEntriesClientResultDto {
  clientId: string;
  redirectUrisRemoved: number;
  postLogoutRedirectUrisRemoved: number;
  allowedCorsOriginsRemoved: number;
}
