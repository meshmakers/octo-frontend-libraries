/**
 * Input data for the RuntimeEntityVariableDialog.
 */
export interface RuntimeEntityVariableDialogData {
  /** Pre-populated CK type ID for editing */
  entityCkTypeId?: string;
  /** Pre-populated entity runtime ID for editing */
  entityRtId?: string;
  /** Pre-populated entity display name for editing */
  entityDisplayName?: string;
  /** Pre-selected attribute mappings for editing */
  selectedAttributes?: RuntimeEntityVariableMapping[];
  /** Existing variable names (for duplicate detection) */
  existingVariableNames?: string[];
}

/**
 * A mapping from a variable name to an entity attribute path.
 */
export interface RuntimeEntityVariableMapping {
  name: string;
  attributePath: string;
  attributeValueType?: string;
}

/**
 * Result returned when the dialog is confirmed.
 */
export interface RuntimeEntityVariableDialogResult {
  entityCkTypeId: string;
  entityRtId: string;
  entityDisplayName: string;
  variables: RuntimeEntityVariableMapping[];
}
