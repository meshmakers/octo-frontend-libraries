export enum IdentityProviderType {
  Google = 0,
  Microsoft = 1,
  MicrosoftAzureAd = 2,
  MicrosoftActiveDirectory = 3,
  OpenLdap = 4,
  Facebook = 5,
  OctoTenant = 6
}

export interface IdentityProviderDto {
  $type?: number;
  rtId?: string;
  name?: string;
  description?: string;
  isEnabled: boolean;
  // OAuth fields (Google, Microsoft, Facebook, Azure Entra ID)
  clientId?: string;
  /**
   * WRITE-ONLY (AB#5528 / AB#5542, handover §4): always `null` in GET / POST / PUT responses.
   * Send it only when the user typed a new value — POST requires it; on PUT a non-empty value
   * rotates, `null` / `""` / omitted keep the stored secret. There is no clear (the secret is required).
   */
  clientSecret?: string | null;
  /** Whether a client secret is stored and readable (omitted when null). */
  clientSecretIsSet?: boolean;
  /** A secret is stored, but its key id is unknown in this environment → re-entry needed (§8). */
  clientSecretKeyMissing?: boolean;
  /** When the current client secret was set (ISO-8601), null / omitted for legacy values (§8). */
  clientSecretSetAt?: string | null;
  // Azure Entra ID specific
  tenantId?: string;
  authority?: string;
  // LDAP fields (OpenLDAP, Microsoft AD)
  host?: string;
  port?: number;
  useTls?: boolean;
  userBaseDn?: string;
  userNameAttribute?: string;
  // Login configuration
  allowSelfRegistration?: boolean;
  defaultGroupRtId?: string;
  // OctoTenant fields
  parentTenantId?: string;
}

export interface IdentityProvidersResult {
  identityProviders?: IdentityProviderDto[];
}

export const IDENTITY_PROVIDER_TYPE_LABELS: Record<number, string> = {
  [IdentityProviderType.Google]: 'Google',
  [IdentityProviderType.Microsoft]: 'Microsoft',
  [IdentityProviderType.MicrosoftAzureAd]: 'Azure Entra ID',
  [IdentityProviderType.MicrosoftActiveDirectory]: 'Microsoft Active Directory',
  [IdentityProviderType.OpenLdap]: 'OpenLDAP',
  [IdentityProviderType.Facebook]: 'Facebook',
  [IdentityProviderType.OctoTenant]: 'Octo Tenant'
};
