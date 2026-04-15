/**
 * Translatable messages for the RuntimeBrowser components.
 * Pass translated strings to override the English defaults.
 */
export interface RuntimeBrowserMessages {
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
}

/**
 * Default English messages for the RuntimeBrowser components.
 */
export const DEFAULT_RUNTIME_BROWSER_MESSAGES: RuntimeBrowserMessages = {
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
};
