export interface AdminPanelConfigurationDto {
  communicationServices: string;
  assetServices: string;
  botServices: string;
  meshAdapterUrl: string;
  grafanaUrl: string;
  crateDbAdminUrl: string;
  issuer: string;
  systemTenantId: string;
}
