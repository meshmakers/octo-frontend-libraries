import {SVGIcon} from '@progress/kendo-svg-icons';

/**
 * Mapping configuration for a single status value to its visual representation
 */
export interface StatusIconMapping {
  /** The Kendo SVG icon to display */
  icon: SVGIcon;
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Optional CSS color for the icon (e.g., 'green', '#28a745', 'var(--success-color)') */
  color?: string;
}

/**
 * Maps enum/status values to their icon representations
 * Key is the enum value (e.g., 'OK', 'MAINTENANCE'), value is the visual config
 */
export type StatusMapping = Record<string, StatusIconMapping>;

/**
 * Configuration for a single field in a multi-field status icons column
 */
export interface StatusFieldConfig {
  /** The field name in the data object */
  field: string;
  /** Mapping of field values to icons */
  statusMapping: StatusMapping;
}

export interface TableColumn {
  displayName?: string | null;
  field: string;
  dataType?: 'text' | 'numeric' | 'boolean' | 'date' | 'iso8601' | 'bytes' | 'statusIcons' | 'cronExpression';
  format?: string;
  /**
   * Column width in pixels. If not set, the column will auto-size.
   */
  width?: number;
  /**
   * Status mapping for single-field statusIcons columns.
   * Use this when the column displays icons for a single field.
   */
  statusMapping?: StatusMapping;
  /**
   * Configuration for multi-field statusIcons columns.
   * Use this when multiple fields should be displayed as icons in a single column.
   * When set, 'field' is ignored and each entry in 'statusFields' defines its own field.
   */
  statusFields?: StatusFieldConfig[];
  /**
   * Whether sorting is enabled for this column.
   * When not set, inherits from the grid-level sortable setting.
   * Set to false to disable sorting for computed or client-side-only columns.
   */
  sortable?: boolean;
}

export type ColumnDefinition =
  | string
  | TableColumn;

export type ContextMenuType = 'contextMenu' | 'actionMenu';
