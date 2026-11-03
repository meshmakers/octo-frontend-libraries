/**
 * Request body of the administrator password reset `POST {tenant}/v1/users/ResetPassword`.
 * The new password travels only in the body: the identity service refuses it as a URL query parameter,
 * because URLs end up in request logs, traces and proxy access logs.
 */
export interface ResetUserPasswordRequestDto {
  userName: string;
  password: string;
}
