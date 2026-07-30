import {Type} from '@angular/core';
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

/**
 * Visual configuration for one possible value in a `badge` column. Lets host apps map enum-style
 * cell values onto a tinted text pill — e.g. health states, lifecycle statuses, severity levels —
 * without forcing every consumer to roll their own custom cell template.
 */
export interface BadgeMapping {
  /** Foreground text colour (CSS colour). Defaults to the host theme's `--badge-text-default`. */
  color?: string;
  /** Background colour (CSS colour). Defaults to the host theme's `--badge-bg-default`. */
  backgroundColor?: string;
  /** Border colour. Defaults to the resolved background. */
  borderColor?: string;
  /** Optional tooltip shown on hover. */
  tooltip?: string;
  /** Override the displayed label. When omitted, the cell renders the raw field value. */
  label?: string;
}

/** Maps an enum-style cell value to its badge appearance. Keys compared with the raw value via String(). */
export type BadgeMappingTable = Record<string, BadgeMapping>;

export interface TableColumn {
  displayName?: string | null;
  field: string;
  dataType?: 'text' | 'numeric' | 'numericRange' | 'boolean' | 'date' | 'iso8601' | 'bytes' | 'statusIcons' | 'cronExpression' | 'progressBar' | 'badge' | 'component';
  format?: string;
  /**
   * Column width in pixels. If not set, the column will auto-size.
   */
  width?: number;
  /**
   * Minimum width in pixels for auto-sized columns (columns without `width`).
   * Without it, fixed-width siblings can squeeze an auto column to zero on narrow
   * viewports. When the available space per auto column drops below this value, the
   * column is pinned to `minWidth` and the grid overflows into a horizontal scrollbar
   * instead of collapsing the column. Also applied as the Kendo `minResizableWidth`,
   * so user resizing cannot shrink the column below it either.
   */
  minWidth?: number;
  /**
   * Hides the column while the list view is narrower than this many pixels.
   * Measured against the component's own width (not the browser viewport), so the
   * column set also adapts when surrounding layout (drawer, split panes) takes space.
   * Use it to declare column priority: give low-value detail columns a breakpoint so
   * the identifying columns keep their room on small screens.
   */
  hideBelow?: number;
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
  /**
   * Whether filtering is enabled for this column.
   * When not set, defaults to true (filterable).
   * Set to false to hide the filter cell for this column when row filtering is active.
   */
  filterable?: boolean;
  /**
   * Default filter operator for the row filter.
   * For numeric columns, defaults to 'eq'. Set to 'gte' for range-style filtering.
   */
  filterOperator?: string;
  /**
   * Dropdown filter options for the row filter.
   * When set, the column's row filter renders a dropdown instead of a text input.
   * Each option has a display text and a value used for filtering.
   */
  filterOptions?: { text: string; value: string }[];
  /**
   * Mapping of raw cell values to badge appearances (only consulted for `dataType: 'badge'`).
   * Values not in the mapping fall back to the neutral default badge styling, so callers don't
   * have to handle every possible enum value explicitly.
   */
  badgeMapping?: BadgeMappingTable;
  /**
   * When true, values without a `badgeMapping` entry render an empty cell instead of the
   * neutral raw-value pill (only consulted for `dataType: 'badge'`). Use for flag-style
   * columns where only some values carry a badge — e.g. a boolean marker column that shows
   * a pill for `true` and nothing (rather than a "false" pill) for `false`.
   */
  badgeHideUnmapped?: boolean;
  /**
   * Optional callback that produces the cell's display string.
   * When set, this overrides the default rendering selected by `dataType`.
   * Filter/sort behaviour still follow `dataType` and the underlying `field` value,
   * so sorting on a numeric column with a currency formatter still sorts numerically.
   *
   * @example
   * ```ts
   * { field: 'grossTotal', dataType: 'numeric',
   *   formatter: (value) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
   *     .format(Number(value)) }
   * ```
   */
  formatter?: (value: unknown, item: unknown) => string;
  /**
   * When true, cell content is rendered on a single line and clipped with an ellipsis.
   * The full value is exposed via a native `title` tooltip on hover, so long strings
   * (e.g. error messages, log lines) stay readable without bloating row heights.
   * Intended for text-style cells; has no visual effect on columns whose content is
   * already a fixed-size widget (statusIcons, progressBar, badge, …).
   */
  truncate?: boolean;
  /**
   * Standalone component to instantiate inside the cell for `dataType: 'component'` columns.
   * The grid renders the component via `*ngComponentOutlet`, with `cellInputs` supplying
   * its `@Input()` bindings per row. Use this when the cell needs internal state
   * (polling, async data, animation) that a static formatter cannot provide.
   */
  cellComponent?: Type<unknown>;
  /**
   * Builds the `@Input()` bindings for the component instance from the row's data item.
   * Called once per row when the cell is rendered. Return values are forwarded verbatim
   * to `*ngComponentOutlet`'s `inputs` map (keyed by the @Input() property name).
   */
  cellInputs?: (item: unknown) => Record<string, unknown>;
}

export type ColumnDefinition =
  | string
  | TableColumn;

export type ContextMenuType = 'contextMenu' | 'actionMenu';

/**
 * Callback for applying CSS classes to individual grid rows based on data.
 * Mirrors Kendo Grid's RowClassFn signature.
 *
 * @example
 * ```typescript
 * rowClassFn = (context: { dataItem: any; index: number }) => ({
 *   'row-warning': context.dataItem.status === 'warn',
 *   'row-error': context.dataItem.status === 'error'
 * });
 * ```
 */
export type RowClassFn = (context: { dataItem: unknown; index: number }) => string | string[] | Set<string> | Record<string, boolean>;

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
  /** Tooltip for the "Reset Filters" button. Default: "Reset Filters" */
  resetFilters: string;
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
  resetFilters: 'Reset Filters',
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
