/**
 * A group defined in the target tenant, offered as an assignable option when creating a cross-tenant
 * user mapping. Assigning a group makes the mapping a GroupMember, so the user inherits the group's
 * roles — the idiomatic, group-based grant.
 */
export interface ProvisioningGroupDto {
  id: string;
  name: string;
  description?: string;
}

/**
 * Request to provision a cross-tenant user mapping and make it a member of the given target-tenant
 * groups (group-based role inheritance).
 */
export interface CreateExternalTenantUserGroupMappingDto {
  sourceTenantId: string;
  sourceUserId: string;
  sourceUserName: string;
  groupIds?: string[];
}
