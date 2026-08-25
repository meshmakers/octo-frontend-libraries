/**
 * Tenant-level Stream Data status as answered by the asset repository's
 * `GET {assetServices}{tenantId}/v1/streamdata/status` (mirrors `StreamDataStatusDto`).
 *
 * `instanceEnabled` is the deployment-wide kill switch (`StreamData:Enabled`);
 * `tenantEnabled` is the per-tenant flag and is always `false` when the instance
 * flag is off. The tenant flag — not the presence of the `System.StreamData` CK
 * model, which a disable keeps — is what the Tenant Features toggle reflects (AB#4255).
 */
export interface StreamDataStatus {
  instanceEnabled: boolean;
  tenantEnabled: boolean;
}
