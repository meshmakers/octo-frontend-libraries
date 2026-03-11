import { ColumnDefinition } from '../list-view/list-view.model';
import { Observable } from 'rxjs';

/**
 * Query options for fetching data in the dialog
 */
export interface DialogFetchOptions {
  /** Number of items to skip (for paging) */
  skip: number;

  /** Number of items to take (page size) */
  take: number;

  /** Text search filter */
  textSearch: string | null;
}

/**
 * Result from fetching data
 */
export interface DialogFetchResult<T> {
  /** Data items */
  data: (T | null)[];

  /** Total count of items matching the filter */
  totalCount: number;
}

/**
 * Interface for entity selection dialog data sources.
 * Combines grid configuration, data fetching, and entity display.
 */
export interface EntitySelectDialogDataSource<T> {
  /**
   * Get column definitions for the grid display
   * @returns Array of column definitions
   */
  getColumns(): ColumnDefinition[];

  /**
   * Fetch data for the grid with paging and filtering
   * @param options Query options including skip, take, and textSearch
   * @returns Observable of fetch result with data and total count
   */
  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<T>>;

  /**
   * Get display text for an entity
   * @param entity The entity to display
   * @returns String representation of the entity
   */
  onDisplayEntity(entity: T): string;

  /**
   * Get unique identifier for an entity
   * @param entity The entity to get ID from
   * @returns Unique identifier for the entity
   */
  getIdEntity(entity: T): string;
}

/**
 * Options for opening the entity select dialog
 */
export interface EntitySelectDialogOptions<T> {
  /** Dialog title */
  title: string;

  /** Allow multiple selection */
  multiSelect?: boolean;

  /** Pre-selected entities */
  selectedEntities?: T[];

  /** Dialog width (default: 800) */
  width?: number;

  /** Dialog height (default: 600) */
  height?: number;

  /** Translatable messages for the dialog UI */
  messages?: Partial<EntitySelectDialogMessages>;
}

/**
 * Result returned from the entity select dialog
 */
export interface EntitySelectDialogResult<T> {
  /** Selected entities (single item array for single-select) */
  selectedEntities: T[];
}

/**
 * Translatable messages for the entity select dialog.
 */
export interface EntitySelectDialogMessages {
  /** Search textbox placeholder. Default: "Search..." */
  searchPlaceholder: string;
  /** Cancel button text. Default: "Cancel" */
  cancelButton: string;
  /** Confirm button text. Default: "OK" */
  confirmButton: string;
  /** Text appended to the count of selected items (e.g. "3 selected"). Default: "selected" */
  selectedSuffix: string;
  /** Pager: "items per page" label */
  pagerItemsPerPage: string;
  /** Pager: "of" label between current and total */
  pagerOf: string;
  /** Pager: "items" label */
  pagerItems: string;
  /** Pager: "Page" label */
  pagerPage: string;
  /** Pager: tooltip for first page button */
  pagerFirstPage: string;
  /** Pager: tooltip for last page button */
  pagerLastPage: string;
  /** Pager: tooltip for previous page button */
  pagerPreviousPage: string;
  /** Pager: tooltip for next page button */
  pagerNextPage: string;
}

export const DEFAULT_ENTITY_SELECT_DIALOG_MESSAGES: EntitySelectDialogMessages = {
  searchPlaceholder: 'Search...',
  cancelButton: 'Cancel',
  confirmButton: 'OK',
  selectedSuffix: 'selected',
  pagerItemsPerPage: 'items per page',
  pagerOf: 'of',
  pagerItems: 'items',
  pagerPage: 'Page',
  pagerFirstPage: 'Go to the first page',
  pagerLastPage: 'Go to the last page',
  pagerPreviousPage: 'Go to the previous page',
  pagerNextPage: 'Go to the next page',
};

/**
 * Translatable messages for the entity select input.
 */
export interface EntitySelectInputMessages {
  /** Autocomplete placeholder. Default: "Select an entity..." */
  placeholder: string;
  /** Advanced search link/button label. Default: "Advanced Search..." */
  advancedSearchLabel: string;
  /** Default dialog title. Default: "Select Entity" */
  dialogTitle: string;
  /** Template for "no results" message. Use {0} for the search term. Default: "No entities found for \"{0}\"" */
  noEntitiesFound: string;
  /** Template for minimum characters hint. Use {0} for the minimum count. Default: "Type at least {0} characters to search..." */
  minCharactersHint: string;
  /** Text appended to count for multi-select display (e.g. "3 selected"). Default: "selected" */
  selectedSuffix: string;
}

export const DEFAULT_ENTITY_SELECT_INPUT_MESSAGES: EntitySelectInputMessages = {
  placeholder: 'Select an entity...',
  advancedSearchLabel: 'Advanced Search...',
  dialogTitle: 'Select Entity',
  noEntitiesFound: 'No entities found for "{0}"',
  minCharactersHint: 'Type at least {0} characters to search...',
  selectedSuffix: 'selected',
};
