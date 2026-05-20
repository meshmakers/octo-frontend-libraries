export interface ClientDto {
  isEnabled: boolean;
  clientId: string;
  clientName: string;
  clientUri: string;
  clientSecret: string;
  requireClientSecret: boolean;
  allowedGrantTypes: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedCorsOrigins: string[];
  allowedScopes: string[];
  isOfflineAccessEnabled: boolean;

  /**
   * When true and this is a ClientCredentials client living in a parent tenant,
   * every new child tenant gets a mirror of this client auto-provisioned.
   * Enables a single ClientCredentials identity (typically a CI/CD agent) to
   * reach every tenant on the instance without per-tenant manual setup.
   * Optional — backend treats absence as "do not modify" on PUT.
   */
  autoProvisionInChildTenants?: boolean;
}
