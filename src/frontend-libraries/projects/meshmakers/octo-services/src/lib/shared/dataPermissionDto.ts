/**
 * A data policy (AB#4972): binds a data permission to CK types with actions, scope and
 * enforcement mode.
 */
export interface DataPolicyDto {
  id?: string;
  /** CK type ids (or collection roots) the policy targets; derived types inherit. */
  targetCkTypeIds: string[];
  /** Granted actions: Read, Write, Delete. */
  actions: string[];
  /** "All" or "OwnedOnly" (restricted to entities created by the caller). */
  scope: string;
  /** "Enforce" or "AuditOnly" (violations only logged - migration mode). */
  enforcementMode: string;
}

/**
 * A data permission (AB#4972) with its policies and role grants.
 */
export interface DataPermissionDto {
  id?: string;
  /** Dot-namespaced permission id, e.g. "accounting.documents". */
  permissionId: string;
  description?: string;
  /** Names of the roles the permission is granted to. */
  grantedRoleNames: string[];
  policies: DataPolicyDto[];
}
