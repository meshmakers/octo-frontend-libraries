/**
 * Tracking row describing a `ClientCredentials` client that has been
 * auto-provisioned from a parent tenant into a specific child tenant.
 * Lives in the parent tenant's identity DB.
 */
export interface ClientMirrorDto {
  parentClientId: string;
  parentTenantId: string;
  childTenantId: string;
  provisionedAt: string;
  secretHashVersion: number;
}

/**
 * Result body for the backfill operation
 * (`POST .../{clientId}/mirrors/provisionInExistingTenants`).
 */
export interface ClientMirrorBackfillResponseDto {
  childTenantsConsidered: number;
  newlyProvisioned: number;
  alreadyPresent: number;
}

/**
 * Result body for a single-tenant manual provision operation
 * (`POST .../{clientId}/mirrors/provisionInTenant`).
 */
export interface ClientMirrorProvisionResponseDto {
  flaggedClientsConsidered: number;
  newlyProvisioned: number;
  alreadyPresent: number;
}
