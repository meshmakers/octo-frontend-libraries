export enum IdentityProviderType {
  Google = 0,
  Microsoft = 1,
  MicrosoftAzureAd = 2,
  MicrosoftActiveDirectory = 3,
  OpenLdap = 4,
  Facebook = 5
}

export interface IdentityProviderDto {
  $type?: number;
  rtId?: string;
  name?: string;
  description?: string;
  isEnabled: boolean;
  // OAuth fields (Google, Microsoft, Facebook, Azure Entra ID)
  clientId?: string;
  clientSecret?: string;
  // Azure Entra ID specific
  tenantId?: string;
  authority?: string;
  // LDAP fields (OpenLDAP, Microsoft AD)
  host?: string;
  port?: number;
  useTls?: boolean;
  userBaseDn?: string;
  userNameAttribute?: string;
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
  [IdentityProviderType.Facebook]: 'Facebook'
};
