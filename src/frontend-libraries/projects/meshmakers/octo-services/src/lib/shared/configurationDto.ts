
export interface ConfigurationDto {
  /**
   * URL of the platform-services backend (Phase 1+ of the platform-services
   * initiative). Preferred over {@link adminUri} — loaders should read this
   * field first and fall back to {@link adminUri} when it is absent (legacy
   * configs baked into older Office add-ins or PowerBI connectors).
   */
  platformUri?: string;

  /**
   * Legacy field name from when the configuration discovery endpoint was
   * hosted by `octo-frontend-admin-panel`. Kept for backward compatibility
   * with deployed clients (Office, PowerBI) until those are rebuilt against
   * the new `platformUri` field. New code MUST prefer `platformUri` over
   * `adminUri` and only fall back when `platformUri` is undefined.
   *
   * Will be removed in Phase 4 of the platform-services initiative.
   */
  adminUri: string;

  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}
