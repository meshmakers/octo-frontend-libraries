// Note: This should eventually be imported from a shared location
// For now, we define our own enum that matches the GraphQL generated types
export enum AttributeValueTypeDto {
  BinaryDto = 'BINARY',
  BinaryLinkedDto = 'BINARY_LINKED',
  BooleanDto = 'BOOLEAN',
  DateTimeDto = 'DATE_TIME',
  DateTimeOffsetDto = 'DATE_TIME_OFFSET',
  DoubleDto = 'DOUBLE',
  EnumDto = 'ENUM',
  GeospatialPointDto = 'GEOSPATIAL_POINT',
  IntDto = 'INT',
  IntegerDto = 'INTEGER',
  Integer_64Dto = 'INTEGER_64',
  IntegerArrayDto = 'INTEGER_ARRAY',
  Int_64Dto = 'INT_64',
  IntArrayDto = 'INT_ARRAY',
  RecordDto = 'RECORD',
  RecordArrayDto = 'RECORD_ARRAY',
  StringDto = 'STRING',
  StringArrayDto = 'STRING_ARRAY',
  TimeSpanDto = 'TIME_SPAN'
}

/**
 * Represents a property item in the property grid
 */
export interface PropertyGridItem {
  /** Unique identifier for the property */
  id: string;
  /** Property name/key */
  name: string;
  /** Display name for the property (optional, falls back to name) */
  displayName?: string;
  /** Current value of the property */
  value: unknown;
  /** Data type of the property */
  type: AttributeValueTypeDto;
  /** Description/tooltip for the property */
  description?: string;
  /** Whether the property is read-only */
  readOnly?: boolean;
  /** Category for grouping properties */
  category?: string;
  /** Whether the property is required */
  required?: boolean;
  /** Custom validation rules */
  validators?: Record<string, unknown>[];
  /** Custom editor configuration */
  editorConfig?: Record<string, unknown>;
}

/**
 * Configuration options for the property grid
 */
export interface PropertyGridConfig {
  /** Whether the grid is in read-only mode */
  readOnlyMode?: boolean;
  /** Custom editors for specific types */
  customEditors?: Record<string, unknown>;
  /** Whether to show type icons */
  showTypeIcons?: boolean;
  /** Height of the grid */
  height?: string;
  /** Whether to show the search box */
  showSearch?: boolean;
}

/**
 * Event data for property changes
 */
export interface PropertyChangeEvent {
  /** The property that changed */
  property: PropertyGridItem;
  /** The old value */
  oldValue: unknown;
  /** The new value */
  newValue: unknown;
}

/**
 * Supported display modes for complex values
 */
export enum PropertyDisplayMode {
  /** Simple text representation */
  Text = 'text',
  /** JSON formatted display */
  Json = 'json',
  /** Custom template display */
  Custom = 'custom'
}

/**
 * Categories for default property grouping
 */
export enum DefaultPropertyCategory {
  General = 'General',
  System = 'System',
  Attributes = 'Attributes',
  Associations = 'Associations',
  Metadata = 'Metadata'
}

/**
 * Event data for binary download requests
 */
export interface BinaryDownloadEvent {
  /** The binary ID to download */
  binaryId: string;
  /** Optional filename for the download */
  filename?: string;
  /** Optional content type */
  contentType?: string;
  /** Optional download URI if already available */
  downloadUri?: string;
}