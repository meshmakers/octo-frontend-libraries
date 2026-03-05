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
}
