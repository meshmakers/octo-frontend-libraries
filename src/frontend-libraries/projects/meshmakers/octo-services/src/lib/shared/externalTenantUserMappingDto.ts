export interface ExternalTenantUserMappingDto {
  id?: string;
  sourceTenantId: string;
  sourceUserId: string;
  sourceUserName: string;
  roleIds: string[];
  groupNames: string[];
}

export interface CreateExternalTenantUserMappingDto {
  sourceTenantId: string;
  sourceUserId: string;
  sourceUserName: string;
  roleIds?: string[];
  /**
   * Ids of groups of the **current** tenant the mapping becomes a member of (AB#8343). Optional:
   * `IdentityService.createExternalTenantUserMapping` does not send the field when it is `null` or
   * `undefined`. An identity service without AB#8343 ignores it and stores the mapping without groups.
   * The system-tenant route `adminProvisioning/{t}` does not read it — use
   * `createAdminProvisioningWithGroups` there.
   */
  groupIds?: string[] | null;
}

/**
 * Body of `POST {tenant}/v1/externalTenantUserMappings/sourceUserLookup` (AB#8341, contract
 * `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md` §2.1).
 */
export interface SourceUserLookupRequestDto {
  /** A registry ancestor of the current tenant, or a tenant whose allow-list contains it (AB#8345). */
  sourceTenantId: string;
  /**
   * The exact user name or exact e-mail address of the user in the source tenant (case-insensitive,
   * no prefix or wildcard matching). Personal data: never log it.
   */
  identifier: string;
}

/** Answer of a successful source user lookup. Carries no e-mail address and no phone number. */
export interface SourceUserLookupResultDto {
  /** Echo of the request. */
  sourceTenantId: string;
  /** Use as `sourceUserId` of the mapping. */
  userId: string;
  /** Use as `sourceUserName` of the mapping. */
  userName: string;
  /** For display only. */
  displayName?: string | null;
}
