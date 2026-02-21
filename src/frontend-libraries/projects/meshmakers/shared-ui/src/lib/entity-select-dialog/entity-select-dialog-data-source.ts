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
  getIdEntity(entity: T): any;
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
}

/**
 * Result returned from the entity select dialog
 */
export interface EntitySelectDialogResult<T> {
  /** Selected entities (single item array for single-select) */
  selectedEntities: T[];
}
