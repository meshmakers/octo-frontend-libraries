/** UI strings for the tree navigation settings editor. */
export interface TreeNavigationSettingsMessages {
  title: string;
  description: string;
  /** Shown when System.UI < 2.2.0 (the CK type is not installed on the tenant). */
  notInstalled: string;
  columnSourceType: string;
  columnRole: string;
  columnDisplayName: string;
  columnSortIndex: string;
  columnVisible: string;
  columnGrouped: string;
  columnIcon: string;
  columnActions: string;
  visibleAuto: string;
  visibleShow: string;
  visibleHide: string;
  groupedAuto: string;
  groupedGroup: string;
  groupedFlatten: string;
  sourceTypeHint: string;
  roleHint: string;
  addRule: string;
  removeRule: string;
  save: string;
  reload: string;
  export: string;
  import: string;
  empty: string;
  saveSuccess: string;
  saveError: string;
  loadError: string;
  exportNothing: string;
  exportError: string;
  importSuccess: string;
  importError: string;

  // --- Perspectives editor (AB#4263) ---
  perspectivesTitle: string;
  perspectivesDescription: string;
  columnKey: string;
  columnPerspectiveName: string;
  columnRootMode: string;
  columnRootType: string;
  columnPrimaryRole: string;
  columnPrimaryDirection: string;
  columnSecondaryRoles: string;
  rootModeSpatial: string;
  rootModeType: string;
  directionInbound: string;
  directionOutbound: string;
  secondaryRolesHint: string;
  addPerspective: string;
  perspectivesEmpty: string;
}

/** English defaults; hosts may override via the `messages` input. */
export const DEFAULT_TREE_NAVIGATION_SETTINGS_MESSAGES: TreeNavigationSettingsMessages =
  {
    title: 'Tree Navigation',
    description:
      'Per-tenant overrides for the entity trees (repository browser and data-mappings). Rules are applied on top of auto-discovered associations. Without any rule a role is shown with its default name, grouped (except System/ParentChild which is flattened).',
    notInstalled:
      'The System.UI construction kit model (>= 2.2.0) is not installed on this tenant, so tree navigation cannot be configured yet.',
    columnSourceType: 'Source type',
    columnRole: 'Role id',
    columnDisplayName: 'Label',
    columnSortIndex: 'Order',
    columnVisible: 'Visibility',
    columnGrouped: 'Grouping',
    columnIcon: 'Icon',
    columnActions: '',
    visibleAuto: 'Auto',
    visibleShow: 'Show',
    visibleHide: 'Hide',
    groupedAuto: 'Auto',
    groupedGroup: 'Group',
    groupedFlatten: 'Flatten',
    sourceTypeHint: '* matches every type',
    roleHint: 'e.g. EnergyIQ/SpaceSensors',
    addRule: 'Add rule',
    removeRule: 'Remove',
    save: 'Save',
    reload: 'Reload',
    export: 'Export',
    import: 'Import',
    empty: 'No rules yet — every association uses its defaults.',
    saveSuccess: 'Tree navigation configuration saved.',
    saveError: 'Failed to save the tree navigation configuration.',
    loadError: 'Failed to load the tree navigation configuration.',
    exportNothing: 'Save the configuration before exporting it.',
    exportError: 'Failed to export the tree navigation configuration.',
    importSuccess: 'Import completed successfully.',
    importError: 'Failed to import the tree navigation configuration.',
    perspectivesTitle: 'Tree perspectives',
    perspectivesDescription:
      'Switchable tree roots offered next to the built-in Spatial perspective. A Type perspective roots on all instances of a CK type and, at the root level, shows only its primary and secondary roles (deeper levels use auto-discovery).',
    columnKey: 'Key',
    columnPerspectiveName: 'Label',
    columnRootMode: 'Root',
    columnRootType: 'Root CK type',
    columnPrimaryRole: 'Primary role',
    columnPrimaryDirection: 'Direction',
    columnSecondaryRoles: 'Secondary roles',
    rootModeSpatial: 'Spatial',
    rootModeType: 'Type',
    directionInbound: 'Inbound',
    directionOutbound: 'Outbound',
    secondaryRolesHint: 'comma-separated role ids',
    addPerspective: 'Add perspective',
    perspectivesEmpty: 'No extra perspectives — only the built-in Spatial view.',
  };
