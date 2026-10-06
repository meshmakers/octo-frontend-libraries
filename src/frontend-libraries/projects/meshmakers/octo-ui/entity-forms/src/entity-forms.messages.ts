/**
 * UI strings of the entity form components (`mm-entity-form`, `mm-entity-list`,
 * `mm-entity-page` and their field editors).
 *
 * Hosts pass a `Partial<EntityFormsMessages>` through the `messages` input; missing keys fall
 * back to {@link DEFAULT_ENTITY_FORMS_MESSAGES}. Strings containing `{name}` placeholders are
 * filled with {@link formatEntityFormsMessage}.
 */
export interface EntityFormsMessages {
  // --- Buttons / actions ---
  save: string;
  cancel: string;
  delete: string;
  new: string;
  edit: string;
  duplicate: string;
  export: string;
  close: string;
  apply: string;
  refresh: string;
  back: string;
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  select: string;
  clear: string;

  // --- Secrets ---
  /** Placeholder of a secret field whose value is set on the server. */
  secretSetPlaceholder: string;
  /** Placeholder of a secret field without a value on the server. */
  secretNotSetPlaceholder: string;
  /** Badge next to a secret field label. */
  secretBadge: string;
  /** Help text explaining write-only secrets. */
  secretHelp: string;
  /** Badge of a set secret without a timestamp (legacy value). */
  secretStatusSet: string;
  /** Badge of a set secret; `{setAt}` = formatted timestamp. */
  secretStatusSetAt: string;
  /** Badge of a secret without a value. */
  secretStatusNotSet: string;
  /** Badge of a stored secret whose key is not in this environment's key ring (re-entry needed). */
  secretStatusKeyMissing: string;
  /** Badge of a secret whose clear is staged for the next save. */
  secretStatusClearStaged: string;
  /** Button: stage clearing an optional secret. */
  secretClear: string;
  /** Button: undo a staged clear. */
  secretUndoClear: string;
  /** Note shown while a clear is staged. */
  secretClearStagedNote: string;
  /** Button: reveal the typed (unsaved) value. */
  secretShow: string;
  /** Button: mask the typed value again. */
  secretHide: string;
  /** Hint when secrets cannot be written (no key ring configured, Q17). */
  secretWritesDisabled: string;

  // --- Sections ---
  /** Default title of the section holding fields that the form does not list. */
  furtherAttributes: string;

  // --- Confirmations ---
  confirmDeleteTitle: string;
  /** `{name}` = display name of the entity. */
  confirmDeleteMessage: string;
  /** `{count}` = number of entities. */
  confirmDeleteManyMessage: string;
  unsavedChangesTitle: string;
  unsavedChangesMessage: string;
  discardChanges: string;
  keepEditing: string;

  // --- Notifications ---
  saveSuccess: string;
  saveError: string;
  createSuccess: string;
  deleteSuccess: string;
  deleteError: string;
  loadError: string;
  noChanges: string;

  // --- Empty / not found states ---
  emptyList: string;
  emptyRecords: string;
  emptyReferences: string;
  entityNotFound: string;
  formNotFound: string;
  noFieldsToShow: string;
  loading: string;

  // --- Validation ---
  validationRequired: string;
  /** `{min}` = minimum value. */
  validationMin: string;
  /** `{max}` = maximum value. */
  validationMax: string;
  /** `{pattern}` = regular expression. */
  validationPattern: string;
  validationEmail: string;
  validationUrl: string;
  validationJson: string;
  validationNumber: string;
  /** `{max}` = maximum number of selected entities. */
  validationMaxItems: string;
  formInvalid: string;

  // --- Editors ---
  unsupportedEditor: string;
  chipsPlaceholder: string;
  referencePlaceholder: string;
  enumPlaceholder: string;
  toggleOn: string;
  toggleOff: string;
  /** Warning on a record field that cannot be saved safely (sub-attribute name collides with a secret). */
  recordReadOnlyWarning: string;
  nestedRecordReadOnly: string;
  recordRowDialogTitleAdd: string;
  recordRowDialogTitleEdit: string;

  // --- List / page ---
  columnWellKnownName: string;
  columnName: string;
  columnChanged: string;
  columnCreated: string;
  columnType: string;
  columnActions: string;
  copyId: string;
  copyRtId: string;
  copyCkTypeId: string;
  copyRtCkTypeId: string;
  copyRtEntityId: string;
  copied: string;
  searchPlaceholder: string;
  selectSubtypeTitle: string;
  createTitle: string;
  /** `{name}` = display name of the entity. */
  editTitle: string;
  viewTitle: string;
  readOnlyNotice: string;
  singletonCreateHint: string;
}

/** English defaults; hosts may override any key via the `messages` input. */
export const DEFAULT_ENTITY_FORMS_MESSAGES: EntityFormsMessages = {
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  new: 'New',
  edit: 'Edit',
  duplicate: 'Duplicate',
  export: 'Export',
  close: 'Close',
  apply: 'Apply',
  refresh: 'Refresh',
  back: 'Back',
  add: 'Add',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  select: 'Select',
  clear: 'Clear',

  secretSetPlaceholder: 'Leave empty to keep',
  secretNotSetPlaceholder: 'Not set',
  secretBadge: 'Secret',
  secretHelp: 'Write-only. The stored value is never shown; type a new value to replace it.',
  secretStatusSet: 'Set',
  secretStatusSetAt: 'Set · set at {setAt}',
  secretStatusNotSet: 'Not set',
  secretStatusKeyMissing: 'Key missing — re-enter',
  secretStatusClearStaged: 'Will be cleared',
  secretClear: 'Clear',
  secretUndoClear: 'Undo',
  secretClearStagedNote: 'The stored value is removed when you save.',
  secretShow: 'Show',
  secretHide: 'Hide',
  secretWritesDisabled: 'Secrets cannot be changed: no encryption key ring is configured for this environment.',

  furtherAttributes: 'Further attributes',

  confirmDeleteTitle: 'Delete entity',
  confirmDeleteMessage: 'Do you really want to delete "{name}"? This cannot be undone.',
  confirmDeleteManyMessage: 'Do you really want to delete {count} entities? This cannot be undone.',
  unsavedChangesTitle: 'Unsaved changes',
  unsavedChangesMessage: 'You have unsaved changes. Do you want to discard them?',
  discardChanges: 'Discard',
  keepEditing: 'Keep editing',

  saveSuccess: 'Changes saved.',
  saveError: 'The changes could not be saved.',
  createSuccess: 'Entity created.',
  deleteSuccess: 'Entity deleted.',
  deleteError: 'The entity could not be deleted.',
  loadError: 'The data could not be loaded.',
  noChanges: 'There are no changes to save.',

  emptyList: 'No entries yet.',
  emptyRecords: 'No entries.',
  emptyReferences: 'Nothing selected.',
  entityNotFound: 'The entity was not found.',
  formNotFound: 'No form is configured for this type.',
  noFieldsToShow: 'This form has no fields.',
  loading: 'Loading…',

  validationRequired: 'This field is required.',
  validationMin: 'The value must be at least {min}.',
  validationMax: 'The value must be at most {max}.',
  validationPattern: 'The value does not match the expected format.',
  validationEmail: 'Enter a valid email address.',
  validationUrl: 'Enter a valid URL.',
  validationJson: 'Enter valid JSON.',
  validationNumber: 'Enter a valid number.',
  validationMaxItems: 'Select at most {max} entries.',
  formInvalid: 'Please correct the highlighted fields.',

  unsupportedEditor: 'This value cannot be edited here.',
  chipsPlaceholder: 'Type a value and press Enter',
  referencePlaceholder: 'Search…',
  enumPlaceholder: 'Select…',
  toggleOn: 'Yes',
  toggleOff: 'No',
  recordReadOnlyWarning: 'This field is read-only here because one of its entries shares a name with a secret attribute.',
  nestedRecordReadOnly: 'Nested entries cannot be edited here.',
  recordRowDialogTitleAdd: 'Add entry',
  recordRowDialogTitleEdit: 'Edit entry',

  columnWellKnownName: 'Well-known name',
  columnName: 'Name',
  columnChanged: 'Changed',
  columnCreated: 'Created',
  columnType: 'Type',
  columnActions: 'Actions',
  copyId: 'Copy ID',
  copyRtId: 'RtId',
  copyCkTypeId: 'CkTypeId',
  copyRtCkTypeId: 'RtCkTypeId',
  copyRtEntityId: 'RtEntityId',
  copied: 'Copied to clipboard.',
  searchPlaceholder: 'Search…',
  selectSubtypeTitle: 'Select the type to create',
  createTitle: 'New entry',
  editTitle: 'Edit {name}',
  viewTitle: 'Details',
  readOnlyNotice: 'You can view this entry but not change it.',
  singletonCreateHint: 'This entry does not exist yet. Fill in the form to create it.',
};

/** Replaces `{key}` placeholders in a message with the given values. */
export function formatEntityFormsMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/** Merges host overrides over the English defaults. */
export function mergeEntityFormsMessages(overrides?: Partial<EntityFormsMessages> | null): EntityFormsMessages {
  return { ...DEFAULT_ENTITY_FORMS_MESSAGES, ...(overrides ?? {}) };
}
