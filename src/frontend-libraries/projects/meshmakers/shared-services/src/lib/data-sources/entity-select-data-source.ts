/**
 * Interface for entity selection data sources
 * Provides filtering and display functionality for entity autocomplete controls
 */
export interface EntitySelectResult<T> {
  /** Total number of entities matching the filter */
  totalCount: number;
  /** List of entities returned for this page */
  items: T[];
}

/**
 * Data source interface for entity selection components
 */
export interface EntitySelectDataSource<T> {
  /**
   * Filter entities based on search text
   * @param filter The search filter string
   * @param take Optional maximum number of results to return (default: 50)
   * @returns Promise resolving to filtered entities
   */
  onFilter: (filter: string, take?: number) => Promise<EntitySelectResult<T>>;

  /**
   * Get display text for an entity
   * @param entity The entity to display
   * @returns String representation of the entity
   */
  onDisplayEntity: (entity: T) => string;

  /**
   * Get unique identifier for an entity
   * @param entity The entity to get ID from
   * @returns Unique identifier for the entity
   */
  getIdEntity: (entity: T) => any;
}