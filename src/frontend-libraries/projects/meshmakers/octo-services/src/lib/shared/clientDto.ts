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
}
