/**
 * One entry of the slim tenant user directory (`GET {tenant}/v1/users/directory`, AB#5859).
 *
 * Just enough to pick a colleague (e.g. a group member or an assignee) — deliberately no e-mail,
 * roles, groups or logins, because every signed-in user of the tenant may read it.
 */
export interface UserDirectoryEntryDto {
  /** The user's id (RtId) — the same value as `UserDto.userId` and the token's `sub`. */
  userId: string;
  /** "FirstName LastName" when either is set, otherwise the user name. */
  displayName: string;
}
