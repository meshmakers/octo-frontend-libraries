import { WidgetConfig, WidgetFilterConfig } from '../../models/meshboard.models';
import type { QueryFamily } from '../../utils/query-family';
import type { ProcessWidgetSpecificConfig } from '@meshmakers/octo-process-diagrams';

/**
 * Process Widget Type identifier
 */
export const PROCESS_WIDGET_TYPE = 'process' as const;

/**
 * Mapping from diagram exposed property to runtime data source
 *
 * @example
 * ```typescript
 * // Map 'level' property to entity attribute
 * const mapping: DiagramPropertyMapping = {
 *   propertyId: 'level',
 *   sourceType: 'attribute',
 *   sourcePath: 'tankLevel'
 * };
 *
 * // Map 'temperature' property to query column
 * const mapping2: DiagramPropertyMapping = {
 *   propertyId: 'temperature',
 *   sourceType: 'column',
 *   sourcePath: 'current_temp'
 * };
 * ```
 */
export interface DiagramPropertyMapping {
  /**
   * The ID of the exposed property from the diagram's transformProperties
   */
  propertyId: string;

  /**
   * The source type for the property value
   * - 'attribute': Value from entity attribute path
   * - 'column': Value from query result column
   */
  sourceType: 'attribute' | 'column';

  /**
   * The path to the source value
   * - For 'attribute': entity attribute path (e.g., 'tankLevel', 'sensors.temperature')
   * - For 'column': query result column name (e.g., 'avg_temperature')
   */
  sourcePath: string;

  /**
   * Optional expression for value transformation/normalization.
   * Uses expr-eval syntax with 'value' as the input variable.
   *
   * @example
   * ```typescript
   * // Pass through raw value
   * expression: 'value'
   *
   * // Normalize 0-100 to 0-1
   * expression: 'value / 100'
   *
   * // Clamp to range
   * expression: 'clamp(value, 0, 100)'
   *
   * // Linear interpolation
   * expression: 'lerp(value, 0, 4096, 0, 100)'
   *
   * // Boolean threshold
   * expression: 'value > 50 ? 1 : 0'
   * ```
   */
  expression?: string;

  /**
   * Name of the {@link ProcessWidgetBinding} that supplies the value (AB#8023).
   * Absent ⇒ {@link DEFAULT_PROCESS_BINDING_NAME} — the implicit binding built
   * from the legacy single-binding fields. An unknown name is reported once in
   * the console and leaves the property at its default value.
   */
  bindingName?: string;

  /**
   * How a column value is reduced over all rows of the binding's selector scope
   * (AB#8024). Absent or `first` ⇒ the first row, exactly as before. `sum`,
   * `avg`, `min`, `max` reduce the numeric cells (null / non-numeric cells are
   * skipped; no numeric cell ⇒ no value). The mapping `expression` is applied to
   * the aggregated value. Only for `column` mappings of a persistent-query
   * binding and `number` properties; otherwise the validator reports it and the
   * widget falls back to `first`.
   */
  aggregate?: ProcessValueAggregate;
}

/**
 * Reduction of a mapped value over the rows of a query binding (AB#8024).
 */
export type ProcessValueAggregate = 'first' | 'sum' | 'avg' | 'min' | 'max';

/**
 * Name of the implicit binding a config without `bindings` is read as: the
 * legacy single-binding fields (`dataBindingMode`, `bindingCkTypeId`, …).
 * Mappings without `bindingName` refer to it.
 */
export const DEFAULT_PROCESS_BINDING_NAME = 'default' as const;

/**
 * One named data binding of a Process Widget (AB#8023).
 *
 * A widget can hold several bindings, each scoped by its own entity selector,
 * so one flow picture shows values of several CK types of the picked site.
 * Property mappings refer to a binding by {@link DiagramPropertyMapping.bindingName}.
 *
 * @example
 * ```yaml
 * bindings:
 *   - name: pv
 *     mode: persistentQuery
 *     queryRtId: 6650a1b2c3d4e5f601234567
 *     queryFamily: runtime
 *     entitySelectorId: pv
 *   - name: batterie
 *     mode: runtimeEntity
 *     ckTypeId: <domain-model>/Battery
 *     entitySelectorId: batterie   # no rtId: the selector's current entity is loaded
 * ```
 */
export interface ProcessWidgetBinding {
  /** Unique name within the widget; mappings refer to it. */
  name: string;

  /** What the binding loads: one runtime entity or the rows of a persistent query. */
  mode: Exclude<ProcessDataBindingMode, 'none'>;

  // --- Runtime entity ---

  /**
   * CK type of the bound entity (`runtimeEntity`). May be omitted when the
   * entity comes from an entity selector without `childScope` — the selector's
   * `ckTypeId` is used then.
   */
  ckTypeId?: string;

  /**
   * Fixed runtime ID (variables such as `${selectedEntity}` are resolved).
   * Absent ⇒ the current entity of `entitySelectorId` is loaded.
   */
  rtId?: string;

  // --- Persistent query ---

  /** Runtime ID of the persistent query (`persistentQuery`). */
  queryRtId?: string;

  /** Display name of the persistent query (for UI). */
  queryName?: string;

  /** Query family (`runtime` / `streamData`); looked up once when absent. */
  queryFamily?: QueryFamily;

  /** Stream data: do not bind the MeshBoard time filter (see `bindingIgnoreTimeFilter`). */
  ignoreTimeFilter?: boolean;

  // --- Both modes ---

  /**
   * Id of the entity selector that scopes this binding: a query gets the
   * selector's resolved rtIds as scope, a runtime-entity binding without
   * `rtId` loads the selector's current entity. A pending scope keeps the
   * binding without value (the other bindings still render); an empty scope
   * gives no value, never a stale one.
   */
  entitySelectorId?: string;

  /** Field filters applied to the binding's query. */
  filters?: WidgetFilterConfig[];
}

/**
 * Data binding mode for Process Widget
 * - 'none': No data binding (static diagram)
 * - 'runtimeEntity': Bind to a runtime entity
 * - 'persistentQuery': Bind to a persistent query
 */
export type ProcessDataBindingMode = 'none' | 'runtimeEntity' | 'persistentQuery';

/**
 * Complete Process Widget configuration for MeshBoard integration
 *
 * Extends the base WidgetConfig with process-specific settings.
 *
 * @example
 * ```typescript
 * const widgetConfig: ProcessWidgetConfig = {
 *   id: 'widget-1',
 *   type: 'process',
 *   title: 'Water Treatment',
 *   col: 1,
 *   row: 1,
 *   colSpan: 4,
 *   rowSpan: 3,
 *   dataSource: { type: 'static', data: null },
 *   processDiagramRtId: '123-456-789',
 *   fitToBounds: true,
 *   dataBindingMode: 'runtimeEntity',
 *   bindingCkTypeId: 'System/Tank',
 *   bindingRtId: 'tank-001'
 * };
 * ```
 */
export interface ProcessWidgetConfig extends WidgetConfig, ProcessWidgetSpecificConfig {
  type: 'process';

  // ========================================
  // Data Binding Configuration
  // ========================================

  /**
   * Data binding mode (optional, defaults to 'none')
   */
  dataBindingMode?: ProcessDataBindingMode;

  // --- Runtime Entity Binding ---

  /**
   * CK Type ID for runtime entity binding
   * Required when dataBindingMode is 'runtimeEntity'
   */
  bindingCkTypeId?: string;

  /**
   * Runtime ID of the entity to bind to
   * Optional - if not set, query will return all entities of the type
   */
  bindingRtId?: string;

  // --- Persistent Query Binding ---

  /**
   * Runtime ID of the persistent query
   * Required when dataBindingMode is 'persistentQuery'
   */
  bindingQueryRtId?: string;

  /**
   * Display name of the persistent query (for UI)
   */
  bindingQueryName?: string;

  /**
   * Query family of the bound persistent query: `'runtime'` or `'streamData'`.
   * Derived from the query's `queryCkTypeId` when absent (one-time lookup by the
   * executor). Persisted so a stream-data binding picks the correct executor
   * without an extra round-trip — switching runtime ↔ stream-data is a config
   * change, not a different widget.
   */
  bindingQueryFamily?: QueryFamily;

  /**
   * Stream-data opt-out: when `true`, the MeshBoard time filter is NOT bound to
   * the bound query's `streamDataArgs.from/.to`, so the query's intrinsic time
   * bounds win. Default (absent/`false`) auto-binds the active time filter.
   * Ignored for runtime queries (they don't consume `streamDataArgs`).
   */
  bindingIgnoreTimeFilter?: boolean;

  /**
   * Asset-scope binding: the `id` of an entity selector whose selection scopes
   * the bound stream-data query. The selector's resolved source rtIds are passed
   * as `streamDataArgs.rtIds`, replacing the persisted scope at execution time.
   * Ignored for runtime queries.
   */
  bindingEntitySelectorId?: string;

  // --- Field Filters (for both modes) ---

  /**
   * Field filters applied to the data binding query
   * Works with both runtimeEntity and persistentQuery modes
   */
  bindingFilters?: WidgetFilterConfig[];

  // --- Property Mappings ---

  /**
   * Mappings from diagram exposed properties to runtime data sources.
   * Each mapping connects a diagram's transformProperty to either an
   * entity attribute path or a query result column.
   *
   * @example
   * ```typescript
   * propertyMappings: [
   *   { propertyId: 'level', sourceType: 'attribute', sourcePath: 'tankLevel' },
   *   { propertyId: 'temp', sourceType: 'column', sourcePath: 'avg_temperature' }
   * ]
   * ```
   */
  propertyMappings?: DiagramPropertyMapping[];

  // --- Several bindings (AB#8023) ---

  /**
   * Named data bindings, each with its own entity selector (AB#8023). When
   * present and non-empty they replace the legacy single-binding fields above
   * at runtime; a config without `bindings` is read as one implicit binding
   * named {@link DEFAULT_PROCESS_BINDING_NAME} built from the legacy fields.
   * Bindings load in parallel; a failing or pending binding does not block
   * the others.
   */
  bindings?: ProcessWidgetBinding[];
}

/**
 * Default configuration for a new Process Widget
 */
export const DEFAULT_PROCESS_WIDGET_CONFIG: Partial<ProcessWidgetConfig> = {
  type: 'process',
  fitToBounds: true,
  allowZoom: false,
  allowPan: false,
  showToolbar: false,
  initialZoom: 1
};
