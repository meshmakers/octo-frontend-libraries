export interface AddInConfiguration {
  communicationServices: string;
  assetServices: string;
  botServices: string;
  meshAdapterUrl: string;
  /**
   * AI Adapter (octo-ai-services) public base URL. Surfaces the per-installation
   * AI service host so AI Console and the AgentConfig detail pages can build
   * tenant-scoped REST + SignalR URLs without inheriting from `meshAdapterUrl`
   * (the Mesh Adapter and the AI service ship as separate workloads). Empty when
   * the AI service is not part of this installation (AB#4884) — consumers must
   * treat that as "not installed" instead of calling a default host.
   */
  aiServices: string;
  /**
   * Reporting service (octo-report-services) public base URL. Used to build the
   * tenant-scoped enable/disable REST endpoints for the reporting feature. Empty
   * when reporting is not part of this installation (AB#4884) — consumers must
   * treat that as "not installed" instead of calling a default host.
   */
  reportingServices: string;
  /**
   * MCP service (octo-mcp-service) public base URL. Optional because older
   * platform-services deployments do not serve the `mcpServices` field yet —
   * consumers must hide MCP-dependent UI when it is absent.
   */
  mcpServices?: string;
  /**
   * Platform service (octo-platform-services) public base URL. Not part of the
   * `_configuration` payload (the service does not describe itself there) —
   * apps populate it from their bootstrap config's `platformUri`.
   */
  platformServices?: string;
  crateDbAdminUrl: string;
  issuer: string;
  grafanaUrl: string;
  systemTenantId: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}
