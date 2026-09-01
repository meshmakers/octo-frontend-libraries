/**
 * Aggregate tenant feature status as answered by the asset repository's
 * `GET {assetServices}{tenantId}/v1/features/status` (mirrors `TenantFeaturesStatusDto`,
 * AB#4884). The per-capability `tenantEnabled` flags come from the same source the
 * tenant delete/detach guard evaluates (AB#4255) — not from CK model presence, which
 * a disable deliberately keeps. Replaces the former `streamdata/status` endpoint.
 *
 * Whether a capability's service is installed at all is NOT part of this status
 * (except Stream Data's `instanceEnabled` kill switch, which lives in the asset
 * repository): consumers read it from the `_configuration` document, where an empty
 * service URL means "not part of this installation".
 */
export interface TenantFeaturesStatus {
  streamData: StreamDataFeatureState;
  communication: TenantFeatureState;
  reporting: TenantFeatureState;
  aiServices: TenantFeatureState;
}

/** Enabled-state of one capability for the tenant. */
export interface TenantFeatureState {
  tenantEnabled: boolean;
}

/**
 * Stream Data adds the deployment-wide `StreamData:Enabled` kill switch. The tenant
 * flag is reported regardless, so a tenant left enabled on an installation without
 * stream data shows as exactly that (it still blocks tenant delete/detach).
 */
export interface StreamDataFeatureState {
  instanceEnabled: boolean;
  tenantEnabled: boolean;
}
