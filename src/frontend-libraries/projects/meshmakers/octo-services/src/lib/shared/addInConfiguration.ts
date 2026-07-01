export interface AddInConfiguration {
  communicationServices: string;
  assetServices: string;
  botServices: string;
  meshAdapterUrl: string;
  /**
   * AI Adapter (octo-ai-services) public base URL. Surfaces the per-installation
   * AI service host so AI Console and the AgentConfig detail pages can build
   * tenant-scoped REST + SignalR URLs without inheriting from `meshAdapterUrl`
   * (the Mesh Adapter and the AI service ship as separate workloads).
   */
  aiServices: string;
  /**
   * Reporting service (octo-report-services) public base URL. Used to build the
   * tenant-scoped enable/disable REST endpoints for the reporting feature.
   */
  reportingServices: string;
  crateDbAdminUrl: string;
  issuer: string;
  grafanaUrl: string;
  systemTenantId: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}
