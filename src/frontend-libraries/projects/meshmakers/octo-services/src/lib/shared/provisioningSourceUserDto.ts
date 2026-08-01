/**
 * A candidate user from an ancestor (parent) tenant that can be provisioned as a cross-tenant
 * user in a target tenant. Returned by the admin-provisioning source-user search endpoint so the
 * Studio can offer a picker without exposing the parent tenant's full user directory.
 */
export interface ProvisioningSourceUserDto {
  sourceTenantId: string;
  userId: string;
  userName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}
