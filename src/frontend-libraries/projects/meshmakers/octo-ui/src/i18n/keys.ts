/**
 * Translation keys for runtime-browser components.
 * Translations in octo-ui i18n/*.json, loaded via HTTP. Use createMergedTranslateLoader in app config.
 * Keys use RuntimeBrowser_ prefix to avoid collision with app-specific keys.
 */
export const RUNTIME_BROWSER_KEYS = {
  // Main component
  Title: 'RuntimeBrowser_Title',
  BadgeLabel: 'RuntimeBrowser_BadgeLabel',
  TitlePrefix: 'RuntimeBrowser_TitlePrefix',
  Ready: 'RuntimeBrowser_Ready',

  // Placeholder / empty states
  SelectItem: 'RuntimeBrowser_SelectItem',
  NoPropertiesAvailable: 'RuntimeBrowser_NoPropertiesAvailable',

  // CK Model/Type details
  ConstructionKitModel: 'RuntimeBrowser_ConstructionKitModel',
  ConstructionKitModels: 'RuntimeBrowser_ConstructionKitModels',
  FullName: 'RuntimeBrowser_FullName',
  SemanticName: 'RuntimeBrowser_SemanticName',
  ModelName: 'RuntimeBrowser_ModelName',
  Version: 'RuntimeBrowser_Version',
  State: 'RuntimeBrowser_State',
  SelectTypeFromTree: 'RuntimeBrowser_SelectTypeFromTree',
  BrowseModelsAndTypes: 'RuntimeBrowser_BrowseModelsAndTypes',

  // Type metadata
  Type: 'RuntimeBrowser_Type',
  Abstract: 'RuntimeBrowser_Abstract',
  Final: 'RuntimeBrowser_Final',
  Base: 'RuntimeBrowser_Base',

  // Entity details
  RuntimeEntities: 'RuntimeBrowser_RuntimeEntities',
  RuntimeId: 'RuntimeBrowser_RuntimeId',
  TypeId: 'RuntimeBrowser_TypeId',
  EntityIdentifier: 'RuntimeBrowser_EntityIdentifier',
  WellKnownName: 'RuntimeBrowser_WellKnownName',

  // Entity detail view
  EntityInformation: 'RuntimeBrowser_EntityInformation',
  LoadingEntityDetails: 'RuntimeBrowser_LoadingEntityDetails',
  Retry: 'RuntimeBrowser_Retry',
  Attributes: 'RuntimeBrowser_Attributes',
  Associations: 'RuntimeBrowser_Associations',

  // Filters
  Direction: 'RuntimeBrowser_Direction',
  Role: 'RuntimeBrowser_Role',
  RelatedType: 'RuntimeBrowser_RelatedType',
  RelatedEntity: 'RuntimeBrowser_RelatedEntity',
  All: 'RuntimeBrowser_All',
  Inbound: 'RuntimeBrowser_Inbound',
  Outbound: 'RuntimeBrowser_Outbound',
  AllRoles: 'RuntimeBrowser_AllRoles',
  AllTypes: 'RuntimeBrowser_AllTypes',
  EntityId: 'RuntimeBrowser_EntityId',

  // Actions
  ViewDetails: 'RuntimeBrowser_ViewDetails',
  CopyToClipboard: 'RuntimeBrowser_CopyToClipboard',
  CopyEntityIdentifierToClipboard:
    'RuntimeBrowser_CopyEntityIdentifierToClipboard',
  GotoEntity: 'RuntimeBrowser_GotoEntity',
  Refresh: 'RuntimeBrowser_Refresh',
  Create: 'RuntimeBrowser_Create',
  Edit: 'RuntimeBrowser_Edit',
  Delete: 'RuntimeBrowser_Delete',

  // Entity editor
  CreateEntity: 'RuntimeBrowser_CreateEntity',
  UpdateEntity: 'RuntimeBrowser_UpdateEntity',
  Name: 'RuntimeBrowser_Name',
  RuntimeCkTypeId: 'RuntimeBrowser_RuntimeCkTypeId',
  TargetLocation: 'RuntimeBrowser_TargetLocation',
  RootLevel: 'RuntimeBrowser_RootLevel',
  EntityType: 'RuntimeBrowser_EntityType',
  SelectType: 'RuntimeBrowser_SelectType',
  SelectTypePrompt: 'RuntimeBrowser_SelectTypePrompt',
  Save: 'RuntimeBrowser_Save',
  Cancel: 'RuntimeBrowser_Cancel',

  // Geospatial
  Longitude: 'RuntimeBrowser_Longitude',
  Latitude: 'RuntimeBrowser_Latitude',
  ResetToInitialValue: 'RuntimeBrowser_ResetToInitialValue',

  // Attributes form
  AttributesFor: 'RuntimeBrowser_AttributesFor',

  // Notifications / errors
  CouldNotLoadEntityDetails: 'RuntimeBrowser_CouldNotLoadEntityDetails',
  FailedToLoadEntityDetails: 'RuntimeBrowser_FailedToLoadEntityDetails',
  CopiedToClipboard: 'RuntimeBrowser_CopiedToClipboard',
  FailedToCopyToClipboard: 'RuntimeBrowser_FailedToCopyToClipboard',
  DownloadNotAvailable: 'RuntimeBrowser_DownloadNotAvailable',
  FailedToLoadDownloadInfo: 'RuntimeBrowser_FailedToLoadDownloadInfo',
  MissingRequiredIdentifiers: 'RuntimeBrowser_MissingRequiredIdentifiers',
  FailedToCreateEntity: 'RuntimeBrowser_FailedToCreateEntity',
  FailedToUpdateEntity: 'RuntimeBrowser_FailedToUpdateEntity',

  // Goto dialog
  GoToEntityTitle: 'RuntimeBrowser_GoToEntityTitle',
  GoToEntityPrompt: 'RuntimeBrowser_GoToEntityPrompt',
  Go: 'RuntimeBrowser_Go',

  // Column display names
  Created: 'RuntimeBrowser_Created',
  Modified: 'RuntimeBrowser_Modified',
} as const;
