import type { ListViewMessages } from '@meshmakers/shared-ui';
import type { CkTypeSelectorInputMessages } from '../ck-type-selector-input/ck-type-selector-input.messages';
import type { PropertyGridMessages } from '../property-grid/property-grid.messages';

/**
 * Translatable messages for the RuntimeBrowser components.
 * Pass translated strings to override the English defaults.
 */
export interface RuntimeBrowserMessages {
  /**
   * Messages forwarded to the embedded ck-type-selector-input
   * (rendered by the create-editor flow).
   */
  ckTypeSelectorInput?: Partial<CkTypeSelectorInputMessages>;

  /**
   * Messages forwarded to the embedded property-grid
   * (attributes tab in entity detail view).
   */
  propertyGrid?: Partial<PropertyGridMessages>;

  /**
   * Messages forwarded to the embedded list-view
   * (associations tab in entity detail view: column headers, pager,
   * Excel/PDF/Refresh tooltips).
   */
  listView?: Partial<ListViewMessages>;

  /** Header label for record card in attributes-group. Default: "Record" */
  recordLabel?: string;

  /** Back button on the standalone entity-detail page. Default: "Back" */
  back?: string;

  /** Hint above a RECORD_ARRAY tabstrip in attributes-group. */
  recordArrayHint?: string;
  /** Hint above an optional RECORD section in attributes-group. */
  recordHint?: string;
  /** "Add" button for RECORD_ARRAY items. Default: "Add" */
  addRecord?: string;
  /** "Remove" button for RECORD_ARRAY items. Default: "Remove" */
  removeRecord?: string;
  /** "Load" button for optional RECORD. Default: "Load" */
  loadRecord?: string;
  /** "Unload" button for optional RECORD. Default: "Unload" */
  unloadRecord?: string;
  /** Hint for GEO longitude input. */
  longitudeHint?: string;
  /** Hint for GEO latitude input. */
  latitudeHint?: string;

  /**
   * Drag-and-drop messages for the binary attribute drop zone
   * (forwarded to <kendo-fileselect-messages>).
   */
  dragDrop?: {
    /** Drop-zone hint label. Default: 'Drop files here to upload' */
    dropZone?: string;
    /** Error shown when a file exceeds the size limit. Default: 'File size too large.' */
    errorFileTooBig?: string;
    /** Error shown when the file extension is not allowed. Default: 'File type not allowed.' */
    errorInvalidType?: string;
    /** Error shown when file upload fails. Default: 'File failed to upload.' */
    errorUploadFailed?: string;
  };

  /**
   * Labels/tooltips for the binary reference (file picker) editor,
   * shown when a BINARY attribute is restored from stored base64 data.
   */
  binaryReference?: {
    /** Inline label text. Default: 'Preview (restored from stored data)' */
    label?: string;
    /** Tooltip on the label span. Default: 'Content and size are from stored data. File name is a placeholder because the original name is not stored.' */
    tooltip?: string;
  };

  /**
   * Labels/tooltips for the reference preview component,
   * shown when a BINARY_LINKED attribute is a synthetic reference file.
   */
  referencePreview?: {
    /** Inline label text. Default: 'Preview (reference file)' */
    label?: string;
    /** Tooltip on the label span. Default: 'Shows metadata of an existing file in the system; content is not loaded. Replace with a file to change.' */
    tooltip?: string;
  };

  /**
   * Generic error messages emitted by mm-attribute-field.
   */
  attributeField?: {
    /** Validation error shown below a field when it is invalid and dirty/touched. Default: 'This field is required or invalid.' */
    errorMessage?: string;
  };

  title: string;
  badgeLabel: string;
  titlePrefix: string;
  ready: string;
  selectItem: string;
  noPropertiesAvailable: string;
  constructionKitModel: string;
  constructionKitModels: string;
  fullName: string;
  semanticName: string;
  modelName: string;
  version: string;
  state: string;
  selectTypeFromTree: string;
  browseModelsAndTypes: string;
  type: string;
  abstract: string;
  final: string;
  base: string;
  runtimeEntities: string;
  runtimeId: string;
  typeId: string;
  entityIdentifier: string;
  wellKnownName: string;
  entityInformation: string;
  loadingEntityDetails: string;
  retry: string;
  attributes: string;
  associations: string;
  direction: string;
  role: string;
  relatedType: string;
  relatedEntity: string;
  all: string;
  inbound: string;
  outbound: string;
  allRoles: string;
  allTypes: string;
  entityId: string;
  viewDetails: string;
  copyToClipboard: string;
  copyEntityIdentifierToClipboard: string;
  goToEntity: string;
  refresh: string;
  create: string;
  edit: string;
  delete: string;
  createEntity: string;
  updateEntity: string;
  name: string;
  runtimeCkTypeId: string;
  targetLocation: string;
  rootLevel: string;
  entityType: string;
  selectType: string;
  selectTypePrompt: string;
  save: string;
  cancel: string;
  longitude: string;
  latitude: string;
  resetToInitialValue: string;
  attributesFor: string;
  couldNotLoadEntityDetails: string;
  failedToLoadEntityDetails: string;
  entityNotFound?: string;
  entityIdInvalidFormat?: string;
  copiedToClipboard: string;
  failedToCopyToClipboard: string;
  downloadNotAvailable: string;
  failedToLoadDownloadInfo: string;
  missingRequiredIdentifiers: string;
  failedToCreateEntity: string;
  failedToUpdateEntity: string;
  goToEntityTitle: string;
  goToEntityPrompt: string;
  go: string;
  created: string;
  modified: string;
  dataMapping: string;
  mappingTarget: string;
  mappingSourceAttributePath: string;
  mappingTargetAttributePath: string;
  mappingExpression: string;
  mappingExpressionHint: string;
  selectTargetEntity: string;
  removeMapping: string;
  saveMapping: string;
  noMappingConfigured: string;
  mappingSaved: string;
  mappingRemoved: string;
  failedToSaveMapping: string;
  failedToLoadMapping: string;

  /** Toast text emitted when user tries to move a tree item INTO the root. */
  treeMoveToRootUnsupported?: string;
  /** Toast text emitted when user tries to drop a tree item directly ON the root node. */
  treeMoveOnRootUnsupported?: string;

  /** Card header prefix for each mapping card: "MAPPING N". Default: "MAPPING" */
  mappingHeader?: string;
  /** Label for the source data point row. Default: "Source Data Point" */
  mappingSourceDataPoint?: string;
  /** Label for the "Add Mapping" toolbar button. Default: "+ Add Mapping" */
  mappingAddMapping?: string;
  /** Label for the "Save All Mappings" button. Default: "Save All Mappings" */
  mappingSaveAll?: string;
  /** Placeholder shown when a target entity or attribute is not configured. Default: "(not set)" */
  mappingNotSet?: string;
  /** Label for the "Select..." / "Change..." picker buttons. Default: "Select..." */
  mappingSelect?: string;
  /** Empty-state hint shown when no mappings exist. Default: "No data point mappings configured yet." */
  mappingNoneConfigured?: string;

  /** Label before the tree perspective switcher (AB#4263). Default: "Perspective" */
  perspective?: string;
}

/**
 * Default English messages for the RuntimeBrowser components.
 */
export const DEFAULT_RUNTIME_BROWSER_MESSAGES: RuntimeBrowserMessages = {
  recordLabel: 'Record',
  back: 'Back',
  recordArrayHint:
    'Add records to this array. Remove to delete the selected record. Empty arrays are not saved.',
  recordHint:
    'Load attributes to edit this optional record. Unload to remove all data and clear validation.',
  addRecord: 'Add',
  removeRecord: 'Remove',
  loadRecord: 'Load',
  unloadRecord: 'Unload',
  longitudeHint:
    'The longitude of the point on the Earth surface (-180 to 180 degrees).',
  latitudeHint:
    'The latitude of the point on the Earth surface (-90 to 90 degrees).',
  title: 'Runtime Browser',
  badgeLabel: 'Entities & Data',
  titlePrefix: 'REPOSITORY',
  ready: 'READY',
  selectItem: 'Select an item from the tree to view its details',
  noPropertiesAvailable: 'No properties available for this entity',
  constructionKitModel: 'Construction Kit Model',
  constructionKitModels: 'Construction Kit Models',
  fullName: 'Full Name',
  semanticName: 'Semantic Name',
  modelName: 'Model Name',
  version: 'Version',
  state: 'State',
  selectTypeFromTree: 'Select a type from the tree to view its details.',
  browseModelsAndTypes:
    'Browse available construction kit models and their types.',
  type: 'Type',
  abstract: 'Abstract',
  final: 'Final',
  base: 'Base',
  runtimeEntities: 'Runtime Entities',
  runtimeId: 'Runtime ID',
  typeId: 'Type ID',
  entityIdentifier: 'Entity Identifier',
  wellKnownName: 'Well Known Name',
  entityInformation: 'Entity Information',
  loadingEntityDetails: 'Loading entity details...',
  retry: 'Retry',
  attributes: 'Attributes',
  associations: 'Associations',
  direction: 'Direction',
  role: 'Role',
  relatedType: 'Related Type',
  relatedEntity: 'Related Entity',
  all: 'All',
  inbound: 'Inbound',
  outbound: 'Outbound',
  allRoles: 'All roles',
  allTypes: 'All types',
  entityId: 'Entity ID',
  viewDetails: 'View Details',
  copyToClipboard: 'Copy to clipboard',
  copyEntityIdentifierToClipboard: 'Copy entity identifier to clipboard',
  goToEntity: 'Goto Entity',
  refresh: 'Refresh',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  createEntity: 'Create Entity',
  updateEntity: 'Update Entity',
  name: 'Name',
  runtimeCkTypeId: 'Runtime CK Type ID',
  targetLocation: 'Target Location',
  rootLevel: 'Root Level',
  entityType: 'Entity Type',
  selectType: 'Select Type...',
  selectTypePrompt:
    'Please select an Entity Type to configure attributes.',
  save: 'Save',
  cancel: 'Cancel',
  longitude: 'Longitude (X)',
  latitude: 'Latitude (Y)',
  resetToInitialValue: 'Reset to initial value',
  attributesFor: 'Attributes for',
  couldNotLoadEntityDetails: 'Could not load entity details',
  failedToLoadEntityDetails: 'Failed to load entity details',
  entityNotFound: 'Entity not found',
  entityIdInvalidFormat: 'Invalid entity ID format',
  copiedToClipboard: 'copied to clipboard',
  failedToCopyToClipboard: 'Failed to copy to clipboard',
  downloadNotAvailable: 'Download not available for this file',
  failedToLoadDownloadInfo: 'Failed to load download information',
  missingRequiredIdentifiers:
    'Missing required identifiers to create an entity.',
  failedToCreateEntity: 'Failed to create entity. Please try again.',
  failedToUpdateEntity: 'Failed to update entity. Please try again.',
  goToEntityTitle: 'Go to Entity',
  goToEntityPrompt: 'Enter entity identifier in format "ckTypeId@rtId":',
  go: 'Go',
  created: 'Created',
  modified: 'Modified',
  dataMapping: 'Data Mapping',
  mappingTarget: 'Target Entity',
  mappingSourceAttributePath: 'Source Attribute Path',
  mappingTargetAttributePath: 'Target Attribute Path',
  mappingExpression: 'Expression',
  mappingExpressionHint: 'Variable: value. Functions: abs(), min(), max(), round(). Ternary: value > 0 ? value : 0',
  selectTargetEntity: 'Select Target Entity...',
  removeMapping: 'Remove Mapping',
  saveMapping: 'Save Mapping',
  noMappingConfigured: 'No data mapping configured. Select a target entity to map this data point.',
  mappingSaved: 'Data mapping saved successfully',
  mappingRemoved: 'Data mapping removed',
  failedToSaveMapping: 'Failed to save data mapping',
  failedToLoadMapping: 'Failed to load data mapping',
  treeMoveToRootUnsupported: 'Moving item to the root of the tree is not supported',
  treeMoveOnRootUnsupported: 'Moving item on the root of the tree is not supported',
  mappingHeader: 'MAPPING',
  mappingSourceDataPoint: 'Source Data Point',
  mappingAddMapping: '+ Add Mapping',
  mappingSaveAll: 'Save All Mappings',
  mappingNotSet: '(not set)',
  mappingSelect: 'Select...',
  mappingNoneConfigured: 'No data point mappings configured yet.',
  perspective: 'Perspective',
};
