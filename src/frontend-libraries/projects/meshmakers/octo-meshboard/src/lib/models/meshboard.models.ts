/**
 * MeshBoard Widget Models
 * Defines the interfaces for MeshBoard widgets and their data sources
 */

import type { QueryFamily } from '../utils/query-family';

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
  /**
   * CK type of the entity. May contain a MeshBoard variable (e.g.
   * `$mp_rtCkTypeId`) which is resolved against the active variables before the
   * entity is fetched.
   */
  ckTypeId?: string;
  /**
   * Runtime id of the entity. May contain a MeshBoard variable (e.g. `$mp_rtId`)
   * which is resolved against the active variables before the entity is fetched.
   */
  rtId?: string;
  attributePaths?: string[];
  includeAssociations?: boolean;
  /**
   * Entity-selector binding: the `id` of a MeshBoard entity selector whose
   * current selection supplies this widget's entity. When set, the selector's
   * `selectedRtId` and the picked entity's CK type (`$<id>_rtCkTypeId`) override
   * `rtId`/`ckTypeId`, so the widget follows the asset picked at board level.
   * Absent ⇒ the literal (optionally variable-bearing) `rtId`/`ckTypeId` win.
   */
  entitySelectorId?: string;
}

/**
 * Static data source for demo/testing or variable-based display
 */
export interface StaticDataSource extends WidgetDataSource {
  type: 'static';
  data?: unknown;
}

/**
 * Data source that executes a persistent query by its rtId.
 *
 * Both runtime-data and stream-data persistent queries are referenced through
 * this single data-source type — switching between them is a configuration
 * change, not a different widget. The `queryFamily` discriminator lets the
 * widget pick the correct executor without an extra GraphQL round-trip; when
 * absent it is derived from the query's `queryCkTypeId` at load time.
 */
export interface PersistentQueryDataSource extends WidgetDataSource {
  type: 'persistentQuery';
  /** The rtId of the persistent query to execute */
  queryRtId: string;
  /** Display name of the query (for UI) */
  queryName?: string;
  /** Query family: 'runtime' or 'streamData'. Derived from queryCkTypeId when absent. */
  queryFamily?: QueryFamily;
  /**
   * Stream-data opt-out: when `true`, the MeshBoard time filter is NOT bound to
   * the query's `streamDataArgs.from/.to`, so the persistent query's intrinsic
   * time bounds win. Default (`false`/absent) auto-binds the active time filter.
   * Ignored for runtime queries (they don't consume `streamDataArgs`).
   */
  ignoreTimeFilter?: boolean;
  /**
   * Asset-scope binding: the `id` of an entity selector whose selection scopes
   * this widget's stream-data query. The selector resolves its picked entity to
   * a set of source rtIds (via its `childScope` one-hop, or the picked entity
   * itself when no childScope is configured); those rtIds are passed as the
   * query's `streamDataArgs.rtIds`, replacing the persisted RtIds at execution
   * time. Absent ⇒ the query runs with its persisted scope. Ignored for runtime
   * queries (the archive `rtIds` override is a stream-data concept).
   */
  entitySelectorId?: string;
  /**
   * Resolution-aware routing (AB#4290): when `true`, a stream-data chart resolves the
   * best archive/rollup for the visible time window + target point count via
   * `QueryExecutorService.resolveSeriesQuery` before querying, instead of always hitting
   * the persisted archive. The chart's value field doubles as the series' source path, and
   * `requiredAggregation` supplies the reducer. Ignored for runtime queries. Default
   * (absent/`false`) keeps the direct query.
   */
  resolutionAware?: boolean;
  /**
   * Optional OBIS-code filter forwarded to resolution-aware routing / the downsampling
   * query to narrow the series (e.g. `1.8.0` active-energy import). Stream-data only.
   */
  obisFilter?: string;
  /**
   * Resolution-aware routing (AB#4290): the aggregation the series must be reduced with
   * (`SUM` for additive energy, `MAX` for demand, …). Required when `resolutionAware` is on —
   * the resolver never guesses it. Matched against a rollup's stored aggregation function; it is
   * also the reducer applied by the downsampling query. Stream-data only.
   */
  requiredAggregation?: SeriesAggregationFunction;
}

/**
 * The canonical aggregation functions a resolution-aware series can be reduced with
 * (AB#4290). Values match the backend `CkRollupFunction` / `AggregationType` GraphQL enums.
 */
export type SeriesAggregationFunction = 'AVG' | 'MIN' | 'MAX' | 'SUM' | 'COUNT';

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
  /** Query family for the repeater query: 'runtime' or 'streamData'. Derived from queryCkTypeId when absent. */
  queryFamily?: QueryFamily;
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
  | 'markdown'
  | 'statusList'
  | 'summaryCard'
  | 'alertBanner'
  | 'alertList'
  | 'aiInsights';

/**
 * Widget placement zone.
 * - 'grid': Rendered inside the Kendo TileLayout grid (default)
 * - 'banner': Rendered in the banner stack above the grid (full-width, no grid positioning)
 */
export type WidgetZone = 'grid' | 'banner';

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
  /** Hide widget chrome (title bar, border) in view mode */
  chromeless?: boolean;
  /** Which zone this widget is placed in (default: 'grid') */
  zone?: WidgetZone;
}

/**
 * Entity Card Widget - displays a single entity like a UML class diagram
 */
export interface EntityCardWidgetConfig extends WidgetConfig {
  type: 'entityCard';
  showHeader?: boolean;
  showAttributes?: boolean;
  attributeFilter?: string[];
  /** When true, attributes whose value is null/undefined/empty-string/empty-array/empty-object are hidden. */
  hideEmptyAttributes?: boolean;
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
 * Supports runtime entity data sources, persistent queries, and static/variable values
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
  /** Static value or variable expression (e.g., '${variableName}') for static data source */
  staticValue?: string;
  /** Comparison text displayed below the value in trend color (e.g., '+3,1% vs. Vorwoche'). Supports ${variables}. */
  comparisonText?: string;
  /**
   * Scale factor applied to a NUMERIC query value before display (non-numeric
   * values pass through unchanged). Use case: cumulated energy from uniformly
   * sampled power — a stream-data SUM aggregation over kW samples taken every
   * 10 s becomes kWh with `valueMultiplier: 10/3600 ≈ 0.0027778` (the factor is
   * window-independent because SUM is linear, so the KPI stays correct for any
   * dashboard time-filter range). Negate to display signed magnitudes (e.g.
   * battery discharge from a `< 0`-filtered SUM).
   */
  valueMultiplier?: number;
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

export interface TableColumnStatusIconMapping {
  icon: string;
  tooltip: string;
  color?: string;
}

export interface TableColumn {
  field: string;
  title: string;
  width?: number;
  dataType?: string;
  statusMapping?: Record<string, TableColumnStatusIconMapping>;
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
  /** Suffix appended to data labels (e.g. ' kW') */
  dataLabelSuffix?: string;
  /** Threshold-based per-bar coloring. Thresholds sorted ascending by value. */
  colorThresholds?: BarChartColorThreshold[];
  /** Default bar color when value exceeds all thresholds */
  defaultBarColor?: string;
}

/**
 * Color threshold for conditional bar coloring.
 * Values less than or equal to this threshold get the specified color.
 */
export interface BarChartColorThreshold {
  value: number;
  color: string;
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
  /**
   * Show the top-right data-count badge (`rows · pts`). Default `true`. When `false` the badge is
   * hidden — except when a resolution-aware warning is present, which always shows.
   */
  showDataBadge?: boolean;
  /** Field filters for data source */
  filters?: WidgetFilterConfig[];
  /** Title for the value axis (e.g. 'kW') */
  valueAxisTitle?: string;
  /** Horizontal reference/threshold lines displayed on the value axis */
  referenceLines?: ChartReferenceLine[];
}

/**
 * Configuration for a horizontal reference/threshold line on the chart value axis
 */
export interface ChartReferenceLine {
  /** Y-axis value where the line is drawn */
  value: number;
  /** Optional label displayed next to the line */
  label?: string;
  /** CSS color for the line (default: '#ef4444') */
  color?: string;
  /** Opacity 0-1 (default: 0.8) */
  opacity?: number;
}

// ============================================================================
// Heatmap Widget
// ============================================================================

/**
 * Color scheme options for heatmap
 */
export type HeatmapColorScheme = 'green' | 'redGreen' | 'blue' | 'heat';

/**
 * Heatmap coloring mode.
 * - `gradient` (default): relative coloring across the data's own min/max using the
 *   selected {@link HeatmapColorScheme}.
 * - `threshold`: absolute ok/warn/high bands around a target count per cell — green
 *   when the cell equals the target, amber below it (including empty cells), red above.
 */
export type HeatmapColorMode = 'gradient' | 'threshold';

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
  /** Color scheme for the heatmap (used in `gradient` color mode) */
  colorScheme: HeatmapColorScheme;
  /** Coloring mode — relative `gradient` (default) or absolute `threshold` bands */
  colorMode?: HeatmapColorMode;
  /**
   * Threshold mode: the expected value per cell. A cell equal to the target is green,
   * below it (including empty 0-cells) amber, above it red. When unset, the target is
   * auto-derived from the number of asset-scoped source rtIds (the `entitySelectorId`
   * binding) — e.g. the count of EnergyMeasurements under the picked MeteringPoint.
   */
  thresholdTarget?: number;
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
 * Query mode for a persistent-query cell source — how the single displayed value
 * is derived from the query result. Mirrors the KPI/gauge widget query modes.
 */
export type PersistentQueryCellMode = 'simpleCount' | 'aggregation' | 'groupedAggregation';

/**
 * A single-value data source backed by a persistent query (runtime OR stream-data).
 *
 * Used per-cell by aggregation-style widgets (stats-grid stat, summary-card tile)
 * as an alternative to their built-in runtime aggregation source. Switching a cell
 * between runtime and stream-data is a configuration change (the `queryFamily`
 * discriminator picks the executor), not a different widget — mirroring how the
 * KPI/gauge widgets consume {@link PersistentQueryDataSource}.
 */
export interface PersistentQueryCellSource {
  /** The rtId of the persistent query to execute. */
  queryRtId: string;
  /** Display name of the query (for UI). */
  queryName?: string;
  /** Query family: 'runtime' or 'streamData'. Derived from the query's CK type when absent. */
  queryFamily?: QueryFamily;
  /**
   * Stream-data opt-out: when `true`, the MeshBoard time filter is NOT bound to
   * the query's `streamDataArgs.from/.to`. Ignored for runtime queries.
   */
  ignoreTimeFilter?: boolean;
  /**
   * Asset-scope binding: the `id` of an entity selector whose selection scopes the
   * stream-data query via `streamDataArgs.rtIds`. Ignored for runtime queries.
   */
  entitySelectorId?: string;
  /** How to reduce the query result to one value. */
  queryMode: PersistentQueryCellMode;
  /** Value column for `aggregation` / `groupedAggregation` modes. */
  queryValueField?: string;
  /** Category column for `groupedAggregation` mode. */
  queryCategoryField?: string;
  /** Category value to match for `groupedAggregation` mode. */
  queryCategoryValue?: string;
  /** Field filters applied to the query rows. */
  filters?: WidgetFilterConfig[];
}

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
  /**
   * Reference to the aggregation query ID in the widget's `AggregationDataSource`.
   * Used when `persistentQuerySource` is absent (the default runtime aggregation).
   */
  queryId: string;
  /**
   * Optional per-stat persistent-query source (runtime or stream-data). When set,
   * it supersedes `queryId` / the aggregation source for this stat.
   */
  persistentQuerySource?: PersistentQueryCellSource;
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

// ============================================================================
// Status List Widget
// ============================================================================

/**
 * Widget that displays a list of items with colored status badges.
 * Typically used for compliance/regulatory status overviews.
 */
export interface StatusListWidgetConfig extends WidgetConfig {
  type: 'statusList';
  /** CK type to query entities from */
  ckTypeId: string;
  /** Attribute path for the item label (e.g. 'name') */
  labelField: string;
  /** Attribute path for the status value (e.g. 'complianceStatus') */
  statusField: string;
  /** Map of status enum values to badge colors and labels */
  statusColors?: Record<string, { color: string; label?: string }>;
}

// ============================================================================
// Summary Card Widget
// ============================================================================

/**
 * Widget that displays multiple data tiles from different entities/aggregations
 * in a compact card layout. Each tile independently fetches its value.
 */
export interface SummaryCardWidgetConfig extends WidgetConfig {
  type: 'summaryCard';
  /** Layout columns for the tiles grid (default: 2) */
  columns?: number;
  /** Individual data tiles */
  tiles: SummaryCardTile[];
}

export interface SummaryCardTile {
  id: string;
  label: string;
  prefix?: string;
  suffix?: string;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  size?: 'normal' | 'full';
  /** Fetch a single attribute from a runtime entity */
  entitySource?: {
    rtId: string;
    ckTypeId: string;
    attributePath: string;
  };
  /** Fetch an aggregated value (count/sum/avg) */
  aggregationSource?: {
    ckTypeId: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    attribute?: string;
    filters?: WidgetFilterConfig[];
  };
  /**
   * Fetch a single value from a persistent query (runtime or stream-data). When
   * set, it supersedes `entitySource` / `aggregationSource` for this tile.
   */
  persistentQuerySource?: PersistentQueryCellSource;
}

// ============================================================================
// Alert Banner Widget
// ============================================================================

export interface AlertBannerWidgetConfig extends WidgetConfig {
  type: 'alertBanner';
  /** CK type to query (default: System.Notification/StatefulEvent) */
  ckTypeId?: string;
  /** Rotation interval in ms (default: 5000) */
  rotationInterval?: number;
  /** Show severity icon (default: true) */
  showIcon?: boolean;
  /** Max alerts to fetch (default: 20) */
  maxAlerts?: number;
}

// ============================================================================
// Alert List Widget
// ============================================================================

export interface AlertListWidgetConfig extends WidgetConfig {
  type: 'alertList';
  /** CK type to query (default: System.Notification/StatefulEvent) */
  ckTypeId?: string;
  /** Show timestamp column (default: true) */
  showTimestamp?: boolean;
  /** Sort by severity descending (default: true) */
  sortBySeverity?: boolean;
  /** Max alerts to fetch (default: 50) */
  maxAlerts?: number;
}

// ============================================================================
// AI Insights Widget
// ============================================================================

export interface AiInsightsWidgetConfig extends WidgetConfig {
  type: 'aiInsights';
  /** Anthropic API key (demo only - use backend proxy in production) */
  apiKey?: string;
  /** Claude model (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Auto-refresh interval in seconds (0 = disabled, default: 0) */
  refreshInterval?: number;
  /** Max insights to generate (default: 4) */
  maxInsights?: number;
  /** Domain context hint (default: energy management) */
  domainContext?: string;
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
  | MarkdownWidgetConfig
  | StatusListWidgetConfig
  | SummaryCardWidgetConfig
  | AlertBannerWidgetConfig
  | AlertListWidgetConfig
  | AiInsightsWidgetConfig;

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
export type MeshBoardVariableSource = 'static' | 'timeFilter' | 'entitySelector';
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
  /** Which entity selector generated this variable (for entitySelector source) */
  entitySelectorId?: string;
}

/**
 * Error from resolving a runtime entity variable
 */
export interface VariableResolutionError {
  variableName: string;
  message: string;
  timestamp: Date;
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
 * Timezone basis the MeshBoard uses for BOTH the time-filter boundary
 * computation and the display of every datetime value across all widgets.
 *
 * - `'local'` (default): the browser's local timezone. "Year 2026" spans the
 *   local calendar year and datetime cells render in local wall-clock time.
 * - `'utc'`: UTC. "Year 2026" spans the UTC calendar year and datetime cells
 *   render in UTC.
 * - any **IANA time-zone id** (e.g. `'Europe/Vienna'`): "Year 2026" spans that
 *   zone's civil year (DST-correct, independent of the browser) and datetime
 *   cells render in that zone. This zone is also forwarded to the resolution-
 *   aware series query so calendar rollups are selected in it (AB#4190).
 *
 * Keeping filter and display on the same basis avoids the boundary artifact
 * where a local-year filter selects rows whose UTC timestamps fall in the
 * neighbouring calendar year. Mirrors shared-ui's `TimeRangeZone`. The
 * `(string & {})` member keeps the literals in autocomplete while accepting
 * an arbitrary IANA id.
 */
export type MeshBoardTimeZoneMode = 'local' | 'utc' | (string & {});

/** The board-level default timezone mode applied when none is persisted. */
export const DEFAULT_TIME_ZONE_MODE: MeshBoardTimeZoneMode = 'local';

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
// Entity Selector Types
// ============================================================================

/**
 * Maps an entity attribute to a MeshBoard variable.
 */
export interface EntitySelectorAttributeMapping {
  /** Attribute path on the entity (e.g., "contact.firstName") */
  attributePath: string;
  /** Variable name to populate (without $ prefix) */
  variableName: string;
  /** Attribute value type for variable type mapping */
  attributeValueType?: string;
}

/**
 * One-hop association traversal that turns a selected entity into the set of
 * source rtIds a stream-data widget should be scoped to.
 *
 * Use case: the user picks a `MeteringPoint`, but the stream-data archive is
 * keyed by its child `EnergyMeasurement` rtIds. The childScope describes that
 * single hop (target type + association role + direction); the selected
 * entity's children of `targetCkTypeId` reached via `roleId` become the scope
 * rtIds. When a selector has no childScope, the picked entity's own rtId is the
 * scope (direct keying).
 */
export interface EntitySelectorChildScope {
  /** CK type of the child entities that key the stream-data archive (e.g. EnergyMeasurement). */
  targetCkTypeId: string;
  /** Association role linking the selected entity to the children (e.g. "System/ParentChild"). */
  roleId: string;
  /**
   * Traversal direction from the selected (parent) entity to its children.
   * For `System/ParentChild` the child owns the association to its parent, so
   * the children are reached **inbound** — hence `'in'` is the default. Use
   * `'out'` only for custom roles modelled parent → child.
   */
  direction?: 'in' | 'out';
}

/**
 * Configuration for a single entity selector in the MeshBoard toolbar.
 * Each selector is bound to a CK type and populates variables from the selected entity.
 */
export interface EntitySelectorConfig {
  /** Stable ID for URL params (e.g., "mp") */
  id: string;
  /** Toolbar label (e.g., "Metering Point") */
  label: string;
  /** CK type to select from (rtCkTypeId) */
  ckTypeId: string;
  /** Maps entity attributes to MeshBoard variables */
  attributeMappings: EntitySelectorAttributeMapping[];
  /** Whether to show the selector in the toolbar (default: true) */
  showInToolbar?: boolean;
  /** Optional pre-selected entity rtId */
  defaultRtId?: string;
  /**
   * Optional one-hop traversal that resolves the picked entity to the child
   * source rtIds a stream-data widget scopes by. Absent ⇒ the picked entity's
   * own rtId is the scope. See {@link EntitySelectorChildScope}.
   */
  childScope?: EntitySelectorChildScope;
  /** Current selection (transient, not persisted) */
  selectedRtId?: string;
  /** Display name of the currently selected entity */
  selectedDisplayName?: string;
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
  /**
   * Timezone basis for time-filter boundaries and datetime display across all
   * widgets. `undefined` ⇒ {@link DEFAULT_TIME_ZONE_MODE} (`'local'`).
   */
  timeZoneMode?: MeshBoardTimeZoneMode;
  /** Entity selector configurations for the toolbar */
  entitySelectors?: EntitySelectorConfig[];
  /**
   * Auto-refresh interval in seconds. `undefined` or `0` disables auto-refresh.
   * When set, the view polls all widgets at this interval and pauses while the
   * tab is hidden. Stream-data and runtime widgets refresh identically.
   */
  autoRefreshSeconds?: number;
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
