/*
 * Public API Surface of @meshmakers/octo-meshboard
 */

// Models
export * from './lib/models/meshboard.models';

// Widget Interface
export * from './lib/widgets/widget.interface';

// Shared Utilities
export type {
  RuntimeEntityItem,
  PersistentQueryItem,
  QueryColumnItem,
  CategoryValueItem
} from './lib/utils/runtime-entity-data-sources';
export {
  RuntimeEntitySelectDataSource,
  RuntimeEntityDialogDataSource
} from './lib/utils/runtime-entity-data-sources';

// Description codec: the encoded settings blob (variables, time filter,
// navigation pin, …) that MeshBoards persist in their description field
export {
  MESHBOARD_DESCRIPTION_MARKER,
  splitEncodedDescription,
  joinEncodedDescription,
  readMeshBoardNavigation,
  withMeshBoardNavigation,
  normalizeNavigation,
  compareMeshBoardNavigation
} from './lib/utils/meshboard-description-codec';
export type { EncodedDescription } from './lib/utils/meshboard-description-codec';

// Status table of well-known state names, labels and theme colours shared by charts and hosts
// (e.g. the Refinery Studio Data Explorer enum chips)
export {
  STATE_STATUS_BY_KEY,
  categoryStatus,
  humanizeCategory,
  statusColor,
  observeThemeChanges
} from './lib/utils/chart-categories';
export type { CategoryStatus } from './lib/utils/chart-categories';

// `?edit=1` opens a board in edit mode
export { MESHBOARD_EDIT_QUERY_PARAM } from './lib/utils/edit-mode-url';

// Header mode of an embedded board (input `headerMode` / route data `meshBoardHeaderMode`)
export type { MeshBoardHeaderMode } from './lib/utils/meshboard-header';
export { MESHBOARD_HEADER_MODE_ROUTE_DATA, isMeshBoardHeaderMode, resolveMeshBoardHeaderMode } from './lib/utils/meshboard-header';
// Outer frame of an embedded board (input `chrome` / route data `meshBoardChrome`)
export type { MeshBoardChrome } from './lib/utils/meshboard-chrome';
export { MESHBOARD_CHROME_ROUTE_DATA, isMeshBoardChrome, resolveMeshBoardChrome } from './lib/utils/meshboard-chrome';

// Query family classification (runtime vs stream-data persistent queries)
export type { QueryFamily, QueryKind, QueryClassification } from './lib/utils/query-family';
export { classifyQuery, queryFamily } from './lib/utils/query-family';

// Shared Components
export { QuerySelectorComponent } from './lib/components/query-selector/query-selector.component';
export { RuntimeEntitySelectorComponent } from './lib/components/runtime-entity-selector/runtime-entity-selector.component';
export type { RuntimeEntitySelectorValue } from './lib/components/runtime-entity-selector/runtime-entity-selector.component';
export { WidgetNotConfiguredComponent } from './lib/components/widget-not-configured/widget-not-configured.component';

// Services
export * from './lib/services/meshboard-state.service';
export * from './lib/services/meshboard-data.service';
export * from './lib/services/meshboard-persistence.service';
export * from './lib/services/widget-registry.service';
export * from './lib/services/widget-factory.service';
export * from './lib/services/edit-mode-state.service';
export * from './lib/services/meshboard-grid.service';
export * from './lib/services/query-executor.service';
export * from './lib/services/auto-refresh-timer.service';

// Widget Components - Export components with explicit names to avoid duplicates
export { EntityCardWidgetComponent } from './lib/widgets/entity-card-widget/entity-card-widget.component';
export { EntityCardConfigDialogComponent } from './lib/widgets/entity-card-widget/entity-card-config-dialog.component';
export type { EntityCardConfigResult } from './lib/widgets/entity-card-widget/entity-card-config-dialog.component';

export { KpiWidgetComponent } from './lib/widgets/kpi-widget/kpi-widget.component';
export { KpiConfigDialogComponent } from './lib/widgets/kpi-widget/kpi-config-dialog.component';
export type { KpiConfigResult, KpiDataSourceType } from './lib/widgets/kpi-widget/kpi-config-dialog.component';

export { EntityAssociationsWidgetComponent } from './lib/widgets/entity-associations-widget/entity-associations-widget.component';
export { AssociationsConfigDialogComponent } from './lib/widgets/entity-associations-widget/associations-config-dialog.component';
export type { AssociationsConfigResult } from './lib/widgets/entity-associations-widget/associations-config-dialog.component';
export { EntityDetailDialogComponent } from './lib/widgets/entity-associations-widget/entity-detail-dialog.component';

export { TableWidgetComponent } from './lib/widgets/table-widget/table-widget.component';
export { TableConfigDialogComponent } from './lib/widgets/table-widget/table-config-dialog.component';
export type { TableConfigResult } from './lib/widgets/table-widget/table-config-dialog.component';
export { TableWidgetDataSourceDirective } from './lib/widgets/table-widget/table-widget-data-source.directive';
export type { QueryColumn } from './lib/widgets/table-widget/table-widget-data-source.directive';

export { GaugeWidgetComponent } from './lib/widgets/gauge-widget/gauge-widget.component';
export { GaugeConfigDialogComponent } from './lib/widgets/gauge-widget/gauge-config-dialog.component';
export type { GaugeConfigResult } from './lib/widgets/gauge-widget/gauge-config-dialog.component';

export { PieChartWidgetComponent } from './lib/widgets/pie-chart-widget/pie-chart-widget.component';
export { PieChartConfigDialogComponent } from './lib/widgets/pie-chart-widget/pie-chart-config-dialog.component';
export type { PieChartConfigResult } from './lib/widgets/pie-chart-widget/pie-chart-config-dialog.component';

export { BarChartWidgetComponent } from './lib/widgets/bar-chart-widget/bar-chart-widget.component';
export { BarChartConfigDialogComponent } from './lib/widgets/bar-chart-widget/bar-chart-config-dialog.component';
export type { BarChartConfigResult } from './lib/widgets/bar-chart-widget/bar-chart-config-dialog.component';

export { LineChartWidgetComponent } from './lib/widgets/line-chart-widget/line-chart-widget.component';
export { LineChartConfigDialogComponent } from './lib/widgets/line-chart-widget/line-chart-config-dialog.component';
export type { LineChartConfigResult } from './lib/widgets/line-chart-widget/line-chart-config-dialog.component';

export { HeatmapWidgetComponent } from './lib/widgets/heatmap-widget/heatmap-widget.component';
export { HeatmapConfigDialogComponent } from './lib/widgets/heatmap-widget/heatmap-config-dialog.component';
export type { HeatmapConfigResult } from './lib/widgets/heatmap-widget/heatmap-config-dialog.component';

export { StatsGridWidgetComponent } from './lib/widgets/stats-grid-widget/stats-grid-widget.component';
export { StatsGridConfigDialogComponent } from './lib/widgets/stats-grid-widget/stats-grid-config-dialog.component';
export type { StatsGridConfigResult } from './lib/widgets/stats-grid-widget/stats-grid-config-dialog.component';

export { StatusIndicatorWidgetComponent } from './lib/widgets/status-indicator-widget/status-indicator-widget.component';
export { StatusIndicatorConfigDialogComponent } from './lib/widgets/status-indicator-widget/status-indicator-config-dialog.component';
export type { StatusIndicatorConfigResult } from './lib/widgets/status-indicator-widget/status-indicator-config-dialog.component';

export { ServiceHealthWidgetComponent } from './lib/widgets/service-health-widget/service-health-widget.component';
export { ServiceHealthConfigDialogComponent } from './lib/widgets/service-health-widget/service-health-config-dialog.component';
export type { ServiceHealthConfigResult } from './lib/widgets/service-health-widget/service-health-config-dialog.component';

export { WidgetGroupComponent } from './lib/widgets/widget-group/widget-group.component';
export { WidgetGroupConfigDialogComponent } from './lib/widgets/widget-group/widget-group-config-dialog.component';
export type { WidgetGroupConfigResult } from './lib/widgets/widget-group/widget-group-config-dialog.component';

export { MarkdownWidgetComponent } from './lib/widgets/markdown-widget/markdown-widget.component';
export { MarkdownConfigDialogComponent } from './lib/widgets/markdown-widget/markdown-config-dialog.component';
export type { MarkdownConfigResult } from './lib/widgets/markdown-widget/markdown-config-dialog.component';
export { LazyMarkdownComponent, loadNgxMarkdown } from './lib/components/lazy-markdown/lazy-markdown.component';

export { StatusListWidgetComponent } from './lib/widgets/status-list-widget/status-list-widget.component';
export { StatusListConfigDialogComponent } from './lib/widgets/status-list-widget/status-list-config-dialog.component';
export type { StatusListConfigResult } from './lib/widgets/status-list-widget/status-list-config-dialog.component';

export { SummaryCardWidgetComponent } from './lib/widgets/summary-card-widget/summary-card-widget.component';
export { SummaryCardConfigDialogComponent } from './lib/widgets/summary-card-widget/summary-card-config-dialog.component';
export type { SummaryCardConfigResult } from './lib/widgets/summary-card-widget/summary-card-config-dialog.component';

export { AlertBannerWidgetComponent } from './lib/widgets/alert-banner-widget/alert-banner-widget.component';
export { AlertBannerConfigDialogComponent } from './lib/widgets/alert-banner-widget/alert-banner-config-dialog.component';
export type { AlertBannerConfigResult } from './lib/widgets/alert-banner-widget/alert-banner-config-dialog.component';

export { AlertListWidgetComponent } from './lib/widgets/alert-list-widget/alert-list-widget.component';
export { AlertListConfigDialogComponent } from './lib/widgets/alert-list-widget/alert-list-config-dialog.component';
export type { AlertListConfigResult } from './lib/widgets/alert-list-widget/alert-list-config-dialog.component';

export { AiInsightsWidgetComponent } from './lib/widgets/ai-insights-widget/ai-insights-widget.component';
export { AiInsightsConfigDialogComponent } from './lib/widgets/ai-insights-widget/ai-insights-config-dialog.component';
export type { AiInsightsConfigResult } from './lib/widgets/ai-insights-widget/ai-insights-config-dialog.component';
export { AiInsightsService } from './lib/widgets/ai-insights-widget/ai-insights.service';

// Process Widget - Separate export for lazy loading of octo-process-diagrams
// To use ProcessWidget in MeshBoard:
// 1. Import provideProcessWidget from '@meshmakers/octo-meshboard'
// 2. Add provideProcessWidget() to your app providers
//
// For process diagram data operations, use the GraphQL services directly from '@meshmakers/octo-process-diagrams'
// ProcessDataService should be imported from there for lazy-loaded components
export { provideProcessWidget, registerProcessWidget } from './lib/registrations/process-widget-registration';

// Provider Functions
export {
  provideDefaultWidgets,
  registerDefaultWidgets,
  provideMeshBoard,
  provideWidgetRegistrations,
  MESHBOARD_OPTIONS,
  TENANT_ID_PROVIDER,
  MESHBOARD_TENANT_ID_PROVIDER  // @deprecated - use TENANT_ID_PROVIDER from @meshmakers/octo-services
} from './lib/registrations/default-widget-registrations';
export type { MeshBoardOptions, WidgetRegistration, TenantIdProvider } from './lib/registrations/default-widget-registrations';

// Entity Selector Components
export { EntitySelectorEditorComponent } from './lib/components/entity-selector-editor/entity-selector-editor.component';
export { EntitySelectorToolbarComponent } from './lib/components/entity-selector-toolbar/entity-selector-toolbar.component';
export type { EntitySelectorEvent, EntitySelectorClearEvent } from './lib/components/entity-selector-toolbar/entity-selector-toolbar.component';

// Container Components
export { MeshBoardViewComponent } from './lib/containers/meshboard-view/meshboard-view.component';

// Dialogs
export { MeshBoardSettingsDialogComponent, MeshBoardSettingsResult } from './lib/dialogs/meshboard-settings-dialog/meshboard-settings-dialog.component';
export { AddWidgetDialogComponent } from './lib/dialogs/add-widget-dialog/add-widget-dialog.component';
export { MeshBoardManagerDialogComponent } from './lib/dialogs/meshboard-manager-dialog/meshboard-manager-dialog.component';
export { EditWidgetDialogComponent } from './lib/dialogs/edit-widget-dialog/edit-widget-dialog.component';
export type { WidgetPositionUpdate } from './lib/dialogs/edit-widget-dialog/edit-widget-dialog.component';

// Cockpit widgets (AB#5558): attention list + platform KPIs, host services and shared rules
export * from './lib/cockpit/cockpit-host';
export { COCKPIT_WIDGET_MESSAGES, DEFAULT_COCKPIT_WIDGET_MESSAGES, resolveCockpitWidgetMessages, formatCockpitMessage } from './lib/cockpit/cockpit-messages';
export type { CockpitWidgetMessages, CockpitWidgetMessagesSource } from './lib/cockpit/cockpit-messages';
export { CockpitContextService } from './lib/cockpit/cockpit-context.service';
export * from './lib/cockpit/attention/attention.models';
export { CockpitAttentionService, selectProviders } from './lib/cockpit/attention/attention.service';
export type { AttentionProviderInfo, AttentionState } from './lib/cockpit/attention/attention.service';
export { CkModelsResolveFailedAttentionProvider } from './lib/cockpit/attention/providers/ck-models-resolve-failed.provider';
export { AdaptersAttentionProvider } from './lib/cockpit/attention/providers/adapters.provider';
export { UnregisteredPoolsAttentionProvider } from './lib/cockpit/attention/providers/unregistered-pools.provider';
export {
  FailedExecutionsAttentionProvider, COCKPIT_FAILED_EXECUTIONS_OPTIONS, DEFAULT_FAILED_EXECUTIONS_OPTIONS, failedExecutionsSeverity
} from './lib/cockpit/attention/providers/failed-executions.provider';
export type { FailedExecutionsAttentionOptions } from './lib/cockpit/attention/providers/failed-executions.provider';
export { FeaturesNotInstalledAttentionProvider, enabledButNotInstalled, isServiceConfigured } from './lib/cockpit/attention/providers/features-not-installed.provider';
export {
  CockpitAdapterStatesService, COCKPIT_ADAPTER_LIMIT, ADAPTER_OFFLINE_GRACE_MS, adaptersInError, adaptersOffline
} from './lib/cockpit/data/cockpit-adapter-states.service';
export type { CockpitAdapterState, CockpitAdapterStates } from './lib/cockpit/data/cockpit-adapter-states.service';
export { CockpitCkModelStatesService } from './lib/cockpit/data/cockpit-ck-model-states.service';
export { CockpitDataFlowExecutionsService, countFlowExecutions } from './lib/cockpit/data/cockpit-data-flow-executions.service';
export type { CockpitDataFlowExecutions, CockpitExecutionCounts } from './lib/cockpit/data/cockpit-data-flow-executions.service';
export * from './lib/cockpit/kpi/cockpit-kpi';
export { CockpitKpiService, COCKPIT_KPI_GATES, COCKPIT_DATA_FLOW_LIMIT, KPI_ERROR_TEXT } from './lib/cockpit/kpi/cockpit-kpi.service';
export type { CockpitKpiKind, CockpitKpiResult } from './lib/cockpit/kpi/cockpit-kpi.service';
export { AttentionListWidgetComponent, DEFAULT_ATTENTION_MAX_ITEMS } from './lib/cockpit/widgets/attention-list-widget.component';
export { AttentionListConfigDialogComponent } from './lib/cockpit/widgets/attention-list-config-dialog.component';
export type { AttentionListConfigResult } from './lib/cockpit/widgets/attention-list-config-dialog.component';
export { CockpitKpiWidgetComponent, kpiKindOf, NOT_AVAILABLE_TEXT } from './lib/cockpit/widgets/cockpit-kpi-widget.component';
export { CockpitKpiConfigDialogComponent } from './lib/cockpit/widgets/cockpit-kpi-config-dialog.component';
export type { CockpitKpiConfigResult } from './lib/cockpit/widgets/cockpit-kpi-config-dialog.component';
export { RecentItemsWidgetComponent, DEFAULT_RECENT_ITEMS_MAX, MAX_RECENT_ITEMS, recentRelativeTime } from './lib/cockpit/widgets/recent-items-widget.component';
export { RecentItemsConfigDialogComponent } from './lib/cockpit/widgets/recent-items-config-dialog.component';
export type { RecentItemsConfigResult } from './lib/cockpit/widgets/recent-items-config-dialog.component';
export { provideCockpitWidgets, registerCockpitWidgets, BUILT_IN_ATTENTION_PROVIDERS } from './lib/cockpit/cockpit-widget-registrations';

// Shared rules, also used by the Refinery Studio (one implementation)
export * from './lib/utils/adapter-online';
export * from './lib/utils/pipeline-executions';
