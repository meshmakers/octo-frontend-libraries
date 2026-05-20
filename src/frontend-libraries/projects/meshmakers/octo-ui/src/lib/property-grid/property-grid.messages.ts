/**
 * Translatable messages for PropertyGridComponent.
 */
export interface PropertyGridMessages {
  /** Placeholder for the search input. Default: "Search attributes..." */
  searchPlaceholder: string;
  /** Title of the Property column. Default: "Property" */
  columnPropertyTitle: string;
  /** Title of the Value column. Default: "Value" */
  columnValueTitle: string;
  /** Title of the Type column. Default: "Type" */
  columnTypeTitle: string;
  /** Tooltip on the read-only lock icon. Default: "Read-only" */
  readOnlyTooltip: string;
}

export const DEFAULT_PROPERTY_GRID_MESSAGES: PropertyGridMessages = {
  searchPlaceholder: 'Search attributes...',
  columnPropertyTitle: 'Property',
  columnValueTitle: 'Value',
  columnTypeTitle: 'Type',
  readOnlyTooltip: 'Read-only',
};
