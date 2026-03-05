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

/**
 * Translatable messages for the ListViewComponent.
 * Pass translated strings to override the English defaults.
 */
export interface ListViewMessages {
  /** Search input placeholder. Default: "Search in all columns..." */
  searchPlaceholder: string;
  /** Tooltip for "Show Row Filter" button. Default: "Show Row Filter" */
  showRowFilter: string;
  /** Tooltip for "Export to Excel" button. Default: "Export to Excel" */
  exportToExcel: string;
  /** Tooltip for "Export to PDF" button. Default: "Export to PDF" */
  exportToPdf: string;
  /** Tooltip for "Refresh Data" button. Default: "Refresh Data" */
  refreshData: string;
  /** Title for the actions command column. Default: "Actions" */
  actionsColumnTitle: string;
  /** PDF footer page template. Default: "Page {pageNum} of {totalPages}" */
  pdfPageTemplate: string;

  // Kendo Grid pager messages
  /** Pager: text after page size selector. Default: "items per page" */
  pagerItemsPerPage: string;
  /** Pager: "of" text between page number and total. Default: "of" */
  pagerOf: string;
  /** Pager: text after total count. Default: "items" */
  pagerItems: string;
  /** Pager: text before page input. Default: "Page" */
  pagerPage: string;
  /** Pager: first page button tooltip. Default: "Go to the first page" */
  pagerFirstPage: string;
  /** Pager: last page button tooltip. Default: "Go to the last page" */
  pagerLastPage: string;
  /** Pager: previous page button tooltip. Default: "Go to the previous page" */
  pagerPreviousPage: string;
  /** Pager: next page button tooltip. Default: "Go to the next page" */
  pagerNextPage: string;
  /** Grid: no records message. Default: "No records available." */
  noRecords: string;
}

/**
 * Default English messages for the ListViewComponent.
 */
export const DEFAULT_LIST_VIEW_MESSAGES: ListViewMessages = {
  searchPlaceholder: 'Search in all columns...',
  showRowFilter: 'Show Row Filter',
  exportToExcel: 'Export to Excel',
  exportToPdf: 'Export to PDF',
  refreshData: 'Refresh Data',
  actionsColumnTitle: 'Actions',
  pdfPageTemplate: 'Page {pageNum} of {totalPages}',
  pagerItemsPerPage: 'items per page',
  pagerOf: 'of',
  pagerItems: 'items',
  pagerPage: 'Page',
  pagerFirstPage: 'Go to the first page',
  pagerLastPage: 'Go to the last page',
  pagerPreviousPage: 'Go to the previous page',
  pagerNextPage: 'Go to the next page',
  noRecords: 'No records available.',
};
