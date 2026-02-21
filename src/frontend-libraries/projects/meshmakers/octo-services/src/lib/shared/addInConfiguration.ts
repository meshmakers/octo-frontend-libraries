export interface AddInConfiguration {
  communicationServices: string;
  assetServices: string;
  botServices: string;
  meshAdapterUrl: string;
  crateDbAdminUrl: string;
  issuer: string;
  grafanaUrl: string;
  systemTenantId: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}
