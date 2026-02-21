import { WidgetConfig, WidgetFilterConfig } from '../../models/meshboard.models';
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
