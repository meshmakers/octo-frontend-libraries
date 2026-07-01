export interface AdminPanelConfigurationDto {
  communicationServices: string;
  assetServices: string;
  botServices: string;
  meshAdapterUrl: string;
  /** AI Adapter public base URL. See {@link AddInConfiguration.aiServices}. */
  aiServices: string;
  /** Reporting service public base URL. See {@link AddInConfiguration.reportingServices}. */
  reportingServices: string;
  grafanaUrl: string;
  crateDbAdminUrl: string;
  issuer: string;
  systemTenantId: string;
}
