/**
 * MeshBoard Widget Models
 * Defines the interfaces for MeshBoard widgets and their data sources
 */

// ============================================================================
// Data Source Types
// ============================================================================

/**
 * All supported data source types
 */
export type DataSourceType =
  | 'runtimeEntity'
  | 'persistentQuery'
  | 'aggregation'
  | 'serviceCall'
  | 'constructionKitQuery'
  | 'static'
  | 'repeaterQuery';

/**
 * Base interface for all data sources
 */
export interface WidgetDataSource {
  type: DataSourceType;
}

/**
 * Data source that fetches a single runtime entity by ID
 */
export interface RuntimeEntityDataSource extends WidgetDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;
  rtId?: string;
  attributePaths?: string[];
  includeAssociations?: boolean;
}

/**
 * Static data source for demo/testing
 */
export interface StaticDataSource extends WidgetDataSource {
  type: 'static';
  data: unknown;
}

/**
 * Data source that executes a persistent query by its rtId
 */
export interface PersistentQueryDataSource extends WidgetDataSource {
  type: 'persistentQuery';
  /** The rtId of the persistent query to execute */
  queryRtId: string;
  /** Display name of the query (for UI) */
  queryName?: string;
}

/**
 * Aggregation types supported
 */
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';

/**
 * Single aggregation query configuration
 */
export interface AggregationQuery {
  /** Unique ID to reference this query result */
  id: string;
  /** The CK type to aggregate (e.g., 'ConstructionKit/CkType') */
  ckTypeId: string;
  /** Type of aggregation to perform */
  aggregation: AggregationType;
  /** Attribute to aggregate (required for sum/avg/min/max) */
  attribute?: string;
  /** Optional filter expression (deprecated, use filters instead) */
  filter?: string;
  /** Field filters for the aggregation query */
  filters?: WidgetFilterConfig[];
}

/**
 * Data source that performs aggregation queries (count, sum, avg, etc.)
 */
export interface AggregationDataSource extends WidgetDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}

/**
 * Service call types for status/health checks
 */
export type ServiceCallType = 'modelAvailable' | 'healthCheck';

/**
 * Data source that calls a service for status information
 */
export interface ServiceCallDataSource extends WidgetDataSource {
  type: 'serviceCall';
  /** Type of service call */
  callType: ServiceCallType;
  /** Model name for 'modelAvailable' check */
  modelName?: string;
  /** Service type for 'healthCheck' */
  serviceType?: 'identity' | 'asset-repository' | 'bot' | 'communication-controller' | 'mesh-adapter' | 'custom';
  /** Custom endpoint URL for custom health checks */
  customEndpoint?: string;
}

/**
 * Construction Kit query targets
 */
export type CkQueryTarget = 'models' | 'types' | 'attributes' | 'associationRoles' | 'enums' | 'records';

/**
 * Data source that queries Construction Kit data
 * Supports grouping for chart widgets (e.g., models grouped by state)
 */
export interface ConstructionKitQueryDataSource extends WidgetDataSource {
  type: 'constructionKitQuery';
  /** What to query from Construction Kit */
  queryTarget: CkQueryTarget;
  /** Field to group results by (for charts) */
  groupBy?: string;
  /** Field to use as value (for aggregations) */
  valueField?: string;
  /** Field to use as category/label */
  categoryField?: string;
}

/**
 * Data source for repeating widgets (Widget Group).
 * Fetches multiple items and renders a child widget for each.
 * Supports two modes:
 * 1. Query Mode: Execute a persistent query and get rows
 * 2. Entity Mode: Load entities by CK type with optional filters
 */
export interface RepeaterQueryDataSource extends WidgetDataSource {
  type: 'repeaterQuery';
  /** Execute a persistent query by its rtId (Query Mode) */
  queryRtId?: string;
  /** Display name of the query (for UI) */
  queryName?: string;
  /** Load entities by CK type (Entity Mode) */
  ckTypeId?: string;
  /** Filters for Entity Mode */
  filters?: WidgetFilterConfig[];
  /** Maximum number of items to render (default: 50) */
  maxItems?: number;
}

export type DataSource =
  | RuntimeEntityDataSource
  | StaticDataSource
  | PersistentQueryDataSource
  | AggregationDataSource
  | ServiceCallDataSource
  | ConstructionKitQueryDataSource
  | RepeaterQueryDataSource;

// ============================================================================
// Widget Types
// ============================================================================

/**
 * Supported widget types
 */
export type WidgetType =
  | 'entityCard'
  | 'entityWithAssociations'
  | 'kpi'
  | 'table'
  | 'gauge'
  | 'pieChart'
  | 'barChart'
  | 'lineChart'
  | 'heatmap'
  | 'statsGrid'
  | 'statusIndicator'
  | 'serviceHealth'
  | 'process'
  | 'widgetGroup'
  | 'markdown';

/**
 * Base widget configuration
 */
export interface WidgetConfig {
  /** Local ID used for UI tracking (generated by WidgetFactoryService) */
  id: string;
  /** Backend-generated ID (rtId from GraphQL). Only set after persistence. */
  rtId?: string;
  type: WidgetType;
  title: string;
  dataSource: DataSource;
  // TileLayout positioning
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** Whether the widget supports data source configuration dialog */
  configurable?: boolean;
}

/**
 * Entity Card Widget - displays a single entity like a UML class diagram
 */
export interface EntityCardWidgetConfig extends WidgetConfig {
  type: 'entityCard';
  showHeader?: boolean;
  showAttributes?: boolean;
  attributeFilter?: string[];
  headerColor?: string;
}

/**
 * Entity with Associations Widget - displays entity with its relationships
 */
export interface EntityWithAssociationsWidgetConfig extends WidgetConfig {
  type: 'entityWithAssociations';
  showIncoming?: boolean;
  showOutgoing?: boolean;
  maxAssociations?: number;
  /** List of role IDs to filter (empty = show all) */
  roleFilter?: string[];
  /** Display mode: 'expandable' shows groups that can be expanded */
  displayMode?: 'count' | 'expandable';
  /** Attribute names to display for the source entity (e.g. ['name', 'status']) */
  entityAttributePaths?: string[];
  /** Attribute names to display for target entities (global for all targets) */
  targetAttributePaths?: string[];
}

/**
 * KPI query mode for persistent queries
 * - 'simpleCount': Use totalCount from simple query
 * - 'aggregation': Single value from aggregation query (1 row, 1 column)
 * - 'groupedAggregation': Value for a specific category from grouped aggregation
 */
export type KpiQueryMode = 'simpleCount' | 'aggregation' | 'groupedAggregation';

/**
 * KPI/Statistics Widget - displays a single value with label
 * Supports both runtime entity data sources and persistent queries
 */
export interface KpiWidgetConfig extends WidgetConfig {
  type: 'kpi';
  /** Attribute path for runtime entity data source */
  valueAttribute: string;
  labelAttribute?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  /** Query mode when using persistent query data source */
  queryMode?: KpiQueryMode;
  /** Value field for aggregation/grouped queries */
  queryValueField?: string;
  /** Category field for grouped aggregation queries */
  queryCategoryField?: string;
  /** Selected category value for grouped aggregation queries */
  queryCategoryValue?: string;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

/**
 * Sorting configuration for table widget (JSON-compatible)
 */
export interface TableSortConfig {
  attributePath: string;
  sortOrder: string;
}

/**
 * Filter configuration for widgets (JSON-compatible)
 * Used by Table, KPI, Gauge, Pie Chart, Bar Chart widgets
 */
export interface WidgetFilterConfig {
  attributePath: string;
  operator: string;
  comparisonValue: string;
}

/**
 * @deprecated Use WidgetFilterConfig instead
 */
export type TableFilterConfig = WidgetFilterConfig;

/**
 * Table Widget - displays multiple entities in a table
 * Note: sorting and filters use simplified JSON-compatible types
 */
export interface TableWidgetConfig extends WidgetConfig {
  type: 'table';
  columns: TableColumn[];
  sorting?: TableSortConfig[];
  filters?: TableFilterConfig[];
  pageSize?: number;
  sortable?: boolean;
}

export interface TableColumn {
  field: string;
  title: string;
  width?: number;
}

/**
 * Gauge types available
 */
export type GaugeType = 'arc' | 'circular' | 'linear' | 'radial';

/**
 * Color range for gauge thresholds
 */
export interface GaugeRange {
  from: number;
  to: number;
  color: string;
}

/**
 * Gauge Widget - displays a numeric value as a gauge visualization
 * Supports Arc, Circular, Linear, and Radial gauge types from Kendo UI
 * Supports both runtime entity data sources and persistent queries
 */
export interface GaugeWidgetConfig extends WidgetConfig {
  type: 'gauge';
  /** The gauge visualization type */
  gaugeType: GaugeType;
  /** Attribute path to read the numeric value from (for runtime entity) */
  valueAttribute: string;
  /** Minimum value for the gauge scale */
  min?: number;
  /** Maximum value for the gauge scale */
  max?: number;
  /** Color ranges for thresholds (e.g., green/yellow/red zones) */
  ranges?: GaugeRange[];
  /** Show the value label on the gauge */
  showLabel?: boolean;
  /** Optional attribute for dynamic label */
  labelAttribute?: string;
  /** Prefix for value display (e.g., '$') */
  prefix?: string;
  /** Suffix for value display (e.g., '%', 'units') */
  suffix?: string;
  /** Reverse the gauge direction */
  reverse?: boolean;
  /** Query mode when using persistent query data source */
  queryMode?: KpiQueryMode;
  /** Value field for aggregation/grouped queries */
  queryValueField?: string;
  /** Category field for grouped aggregation queries */
  queryCategoryField?: string;
  /** Selected category value for grouped aggregation queries */
  queryCategoryValue?: string;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

/**
 * Pie Chart types available
 */
export type PieChartType = 'pie' | 'donut';

/**
 * Pie Chart Widget - displays data as a pie or donut chart
 * Works especially well with grouped aggregation queries
 */
export interface PieChartWidgetConfig extends WidgetConfig {
  type: 'pieChart';
  /** The chart visualization type */
  chartType: PieChartType;
  /** Field used for category labels (e.g., 'legalEntityType') */
  categoryField: string;
  /** Field used for values (e.g., 'meterReading') */
  valueField: string;
  /** Show labels on chart segments */
  showLabels?: boolean;
  /** Show the chart legend */
  showLegend?: boolean;
  /** Position of the legend */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

/**
 * Bar Chart types available
 * - column: Vertical bars (standard column chart)
 * - bar: Horizontal bars
 * - stackedColumn: Stacked vertical bars
 * - stackedBar: Stacked horizontal bars
 * - stackedColumn100: 100% stacked vertical bars
 * - stackedBar100: 100% stacked horizontal bars
 */
export type BarChartType = 'column' | 'bar' | 'stackedColumn' | 'stackedBar' | 'stackedColumn100' | 'stackedBar100';

/**
 * Series configuration for bar chart
 * Each series represents a set of values displayed as bars
 */
export interface BarChartSeries {
  /** Value field from query results */
  field: string;
  /** Display name for legend (defaults to field name) */
  name?: string;
  /** Optional custom color for this series */
  color?: string;
}

/**
 * Bar Chart Widget - displays data as bar or column charts
 * Supports multiple series for grouped/stacked visualization
 * Works especially well with grouped aggregation queries
 *
 * Two modes are supported:
 * 1. Static Series Mode: Define series[] with explicit field mappings
 * 2. Dynamic Series Mode: Use seriesGroupField + valueField to auto-create series from data
 */
export interface BarChartWidgetConfig extends WidgetConfig {
  type: 'barChart';
  /** The chart visualization type */
  chartType: BarChartType;
  /** Field used for category labels (X-axis for column, Y-axis for bar) */
  categoryField: string;
  /** Series configuration - each series becomes a set of bars (Static Series Mode) */
  series: BarChartSeries[];
  /**
   * Field used to group data into series (Dynamic Series Mode).
   * When set, unique values of this field become separate series.
   * Example: 'billingType' with values 'Credit'/'Debit' creates two series.
   */
  seriesGroupField?: string;
  /**
   * Value field when using seriesGroupField (Dynamic Series Mode).
   * The numeric field to display for each category/series combination.
   */
  valueField?: string;
  /** Show the chart legend */
  showLegend?: boolean;
  /** Position of the legend */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Show data labels on bars */
  showDataLabels?: boolean;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

// ============================================================================
// Line Chart Widget
// ============================================================================

/**
 * Line chart sub-types
 */
export type LineChartType = 'line' | 'area';

/**
 * Line Chart Widget - displays time-series data as a multi-series line chart
 * Supports dynamic series grouping and multiple Y-axes grouped by unit
 *
 * Typical use case: Query returns rows with a date field, a grouping field
 * (e.g., OBIS code), a numeric value, and optionally a unit.
 * Each unique group value becomes a separate line/series.
 * When a unit field is configured, series are grouped by unit onto separate Y-axes.
 */
export interface LineChartWidgetConfig extends WidgetConfig {
  type: 'lineChart';
  /** Chart sub-type */
  chartType: LineChartType;
  /** Date/time field for X-axis categories */
  categoryField: string;
  /** Field whose unique values create separate lines/series */
  seriesGroupField: string;
  /** Numeric field for Y-axis values */
  valueField: string;
  /** Optional field containing the unit string (enables multi-axis by unit) */
  unitField?: string;
  /** Show the chart legend */
  showLegend?: boolean;
  /** Position of the legend */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Show data point markers on lines */
  showMarkers?: boolean;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

// ============================================================================
// Heatmap Widget
// ============================================================================

/**
 * Color scheme options for heatmap
 */
export type HeatmapColorScheme = 'green' | 'redGreen' | 'blue' | 'heat';

/**
 * Client-side aggregation function for simple queries
 */
export type HeatmapAggregation = 'count' | 'sum' | 'avg';


/**
 * Heatmap Widget - displays data availability or density as a heatmap
 * X-axis: Date (day), Y-axis: Time slot (hour or 15-min interval), Color: aggregated value
 *
 * Supports three query modes:
 * 1. Simple query: Client-side aggregation (count/sum/avg) of raw rows into time slots
 * 2. Aggregation query: Pre-aggregated single values per time slot
 * 3. Grouped aggregation query: Pre-aggregated values grouped by time fields
 */
export interface HeatmapWidgetConfig extends WidgetConfig {
  type: 'heatmap';
  /** Field containing the datetime value (used to derive day and time slot) */
  dateField: string;
  /** Optional end-of-interval field (e.g. timeRange.to). When set, the interval width is auto-detected
   *  and sub-hour columns are shown (e.g. 00-15, 15-30, 30-45, 45-60 for 15-min data). */
  dateEndField?: string;
  /** Field containing the numeric value to aggregate (for sum/avg) */
  valueField?: string;
  /** Client-side aggregation function for simple queries */
  aggregation: HeatmapAggregation;
  /** Color scheme for the heatmap */
  colorScheme: HeatmapColorScheme;
  /** Show the chart legend */
  showLegend?: boolean;
  /** Position of the legend */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Number of decimal places for displayed values (default: 2) */
  decimalPlaces?: number;
  /** Use compact notation for large numbers (e.g. 32k, 1.5M) */
  compactNumbers?: boolean;
  /** Multiplier applied before formatting (e.g. 1000 when values are in k, to display as M) */
  valueMultiplier?: number;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
}

// ============================================================================
// Stats Grid Widget
// ============================================================================

/**
 * Color options for stat items
 */
export type StatColor = 'mint' | 'cyan' | 'violet' | 'toffee' | 'lilac' | 'bubblegum' | 'default';

/**
 * Single stat item configuration
 */
export interface StatItem {
  /** Display label */
  label: string;
  /** Reference to aggregation query ID */
  queryId: string;
  /** Color variant */
  color?: StatColor;
  /** Number format */
  format?: 'number' | 'percent' | 'currency';
  /** Prefix for display (e.g., '$') */
  prefix?: string;
  /** Suffix for display (e.g., '%') */
  suffix?: string;
}

/**
 * Stats Grid Widget - displays multiple KPIs in a grid layout
 * Uses AggregationDataSource for data
 */
export interface StatsGridWidgetConfig extends WidgetConfig {
  type: 'statsGrid';
  /** Stat items to display */
  stats: StatItem[];
  /** Number of columns in the grid (default: 3) */
  columns?: number;
}

// ============================================================================
// Status Indicator Widget
// ============================================================================

/**
 * Status Indicator Widget - displays a boolean status (ENABLED/DISABLED, etc.)
 * Uses ServiceCallDataSource for data
 */
export interface StatusIndicatorWidgetConfig extends WidgetConfig {
  type: 'statusIndicator';
  /** Label to show when status is true */
  trueLabel?: string;
  /** Label to show when status is false */
  falseLabel?: string;
  /** Custom true color (CSS color) */
  trueColor?: string;
  /** Custom false color (CSS color) */
  falseColor?: string;
}

// ============================================================================
// Service Health Widget
// ============================================================================

/**
 * Service Health Widget - displays health status with pulse animation
 * Uses ServiceCallDataSource with callType: 'healthCheck'
 */
export interface ServiceHealthWidgetConfig extends WidgetConfig {
  type: 'serviceHealth';
  /** Enable click to navigate to detail page */
  navigateOnClick?: boolean;
  /** Route to navigate to (relative to current route) */
  detailRoute?: string;
  /** Show pulse animation when healthy */
  showPulse?: boolean;
}

// ============================================================================
// Widget Group Widget
// ============================================================================

/**
 * Supported child widget types for Widget Group
 */
export type GroupChildWidgetType = 'kpi' | 'gauge' | 'entityCard';

/**
 * Layout options for Widget Group
 */
export type WidgetGroupLayout = 'grid' | 'horizontal' | 'vertical';

/**
 * Attribute mapping configuration for child widgets.
 * Maps data item attributes to child widget properties.
 */
export interface WidgetGroupAttributeMappings {
  /** Attribute path for the value (KPI/Gauge) */
  valueAttribute?: string;
  /** Attribute path for dynamic label */
  labelAttribute?: string;
  /** Attribute path for status (StatusIndicator) */
  statusAttribute?: string;
}

/**
 * Template for child widgets in a Widget Group.
 * Defines how each data item is rendered as a widget.
 */
export interface WidgetGroupChildTemplate {
  /** The widget type to render for each item */
  widgetType: GroupChildWidgetType;
  /**
   * Title template with variable substitution.
   * Available variables: $rtWellKnownName, $rtId, $ckTypeId, and any attribute with $attributeName
   */
  titleTemplate?: string;
  /** Maps data item attributes to widget properties */
  attributeMappings: WidgetGroupAttributeMappings;
  /** Static configuration merged into each child widget */
  staticConfig?: Partial<KpiWidgetConfig | GaugeWidgetConfig | EntityCardWidgetConfig>;
}

/**
 * Widget Group Widget - renders a widget for each item from a query or entity list.
 * Acts as a container that executes a query and dynamically creates child widgets.
 *
 * Example use case: Query returns 5 machines → 5 KPI widgets show each machine's status.
 *
 * Uses RepeaterQueryDataSource for data:
 * - Query Mode: Execute persistent query, render widget per row
 * - Entity Mode: Load entities by CK type, render widget per entity
 */
export interface WidgetGroupConfig extends WidgetConfig {
  type: 'widgetGroup';
  /** The data source that provides items to repeat */
  dataSource: RepeaterQueryDataSource;
  /** Template defining how each item is rendered as a widget */
  childTemplate: WidgetGroupChildTemplate;
  /** Layout mode for child widgets */
  layout: WidgetGroupLayout;
  /** Number of columns for grid layout (default: 4) */
  gridColumns?: number;
  /** Minimum width for child widgets in pixels (default: 150) */
  minChildWidth?: number;
  /** Gap between child widgets in pixels (default: 8) */
  gap?: number;
  /** Message to show when no items are returned */
  emptyMessage?: string;
}

// ============================================================================
// Markdown Widget
// ============================================================================

/**
 * Text alignment options for Markdown widget
 */
export type MarkdownTextAlign = 'left' | 'center' | 'right';

/**
 * Markdown Widget - displays formatted markdown content
 * Uses static data source since content is stored directly in config
 */
export interface MarkdownWidgetConfig extends WidgetConfig {
  type: 'markdown';
  /** The markdown content to display */
  content: string;
  /** Whether to resolve MeshBoard variables ($name or ${name}) in content */
  resolveVariables?: boolean;
  /** Custom padding (CSS value, default: 16px) */
  padding?: string;
  /** Text alignment (default: left) */
  textAlign?: MarkdownTextAlign;
}

// Process Widget Config is defined in the process-widget module
// Re-exported here for AnyWidgetConfig union
import type { ProcessWidgetConfig, DiagramPropertyMapping } from '../widgets/process-widget/process-widget-config.model';
export type { ProcessWidgetConfig, DiagramPropertyMapping };

export type AnyWidgetConfig =
  | EntityCardWidgetConfig
  | EntityWithAssociationsWidgetConfig
  | KpiWidgetConfig
  | TableWidgetConfig
  | GaugeWidgetConfig
  | PieChartWidgetConfig
  | BarChartWidgetConfig
  | LineChartWidgetConfig
  | HeatmapWidgetConfig
  | StatsGridWidgetConfig
  | StatusIndicatorWidgetConfig
  | ServiceHealthWidgetConfig
  | ProcessWidgetConfig
  | WidgetGroupConfig
  | MarkdownWidgetConfig;

// ============================================================================
// MeshBoard Variables
// ============================================================================

/**
 * Supported variable types
 */
export type MeshBoardVariableType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

/**
 * Source of the variable value (extensible for future dynamic variables)
 */
export type MeshBoardVariableSource = 'static' | 'timeFilter';
// Future: 'url' | 'user' | 'expression'

/**
 * MeshBoard variable definition
 */
export interface MeshBoardVariable {
  /** Unique variable name (without $ prefix) */
  name: string;
  /** Display label for UI */
  label?: string;
  /** Variable description */
  description?: string;
  /** Data type */
  type: MeshBoardVariableType;
  /** Value source (extensible) */
  source: MeshBoardVariableSource;
  /** Current value (as string for serialization) */
  value: string;
  /** Default value if no value is set */
  defaultValue?: string;
}

// ============================================================================
// MeshBoard Time Filter
// ============================================================================

/**
 * Supported time range types for the time filter
 */
export type TimeRangeType = 'year' | 'quarter' | 'month' | 'day' | 'relative' | 'custom';

/**
 * Time units for relative time ranges
 */
export type RelativeTimeUnit = 'hours' | 'days' | 'weeks' | 'months';

/**
 * Quarter number (1-4)
 */
export type Quarter = 1 | 2 | 3 | 4;

/**
 * Configuration for the time range picker component
 */
export interface TimeRangePickerConfig {
  /** Available range types to show. Defaults to all. */
  availableTypes?: TimeRangeType[];
  /** Minimum selectable year. */
  minYear?: number;
  /** Maximum selectable year. */
  maxYear?: number;
  /** Default relative time value. */
  defaultRelativeValue?: number;
  /** Default relative time unit. */
  defaultRelativeUnit?: RelativeTimeUnit;
  /** Show time in custom date pickers. */
  showTime?: boolean;
}

/**
 * The current selection state of the time range picker (for persistence)
 */
export interface TimeRangeSelection {
  type: TimeRangeType;
  year?: number;
  quarter?: Quarter;
  month?: number;
  /** Day of month (1-31), used with 'day' type */
  day?: number;
  /** Hour from (0-23), optional hour filter for 'day' type */
  hourFrom?: number;
  /** Hour to (1-24), optional hour filter for 'day' type. Exclusive upper bound. */
  hourTo?: number;
  relativeValue?: number;
  relativeUnit?: RelativeTimeUnit;
  customFrom?: string;  // ISO string for persistence
  customTo?: string;    // ISO string for persistence
}

/**
 * Time filter configuration for MeshBoard
 */
export interface MeshBoardTimeFilterConfig {
  /** Whether the time filter is enabled */
  enabled: boolean;
  /** Configuration for the time range picker */
  pickerConfig?: TimeRangePickerConfig;
  /** Default selection shown on initial load (configured in settings) */
  defaultSelection?: TimeRangeSelection;
  /** Current selection (for persistence of last-used state) */
  selection?: TimeRangeSelection;
}

// ============================================================================
// MeshBoard Configuration
// ============================================================================

/**
 * Complete MeshBoard configuration
 */
export interface MeshBoardConfig {
  id: string;
  name: string;
  description?: string;
  /** Well-known name for routing (e.g., 'cockpit', 'sales-dashboard') */
  rtWellKnownName?: string | null;
  columns: number;
  rowHeight: number;
  gap: number;
  /** MeshBoard-level variables that can be used in widget filters */
  variables?: MeshBoardVariable[];
  /** Optional time filter configuration */
  timeFilter?: MeshBoardTimeFilterConfig;
  widgets: AnyWidgetConfig[];
}

/** @deprecated Use MeshBoardConfig instead */
export type DashboardConfig = MeshBoardConfig;

// ============================================================================
// Runtime Entity Data (from GraphQL)
// ============================================================================

export interface EntityAttribute {
  attributeName: string;
  value: unknown;
}

export interface EntityAssociation {
  targetRtId: string;
  targetCkTypeId: string;
  originRtId: string;
  originCkTypeId: string;
  ckAssociationRoleId: string;
}

export interface RuntimeEntityData {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string;
  rtCreationDateTime?: string;
  rtChangedDateTime?: string;
  attributes: EntityAttribute[];
  associations: EntityAssociation[];
}
