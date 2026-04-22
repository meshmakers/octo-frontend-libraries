/**
 * View model for a DataPointMapping entity with resolved source/target information.
 * Used by the DataMappingOverviewComponent for display in the grid.
 */
export interface DataPointMappingOverviewItem {
  /** DataPointMapping entity rtId */
  rtId: string;
  /** Display name of the mapping */
  name: string;
  /** Whether the mapping is enabled */
  enabled: boolean;
  /** Source attribute path (e.g., "CurrentValue") */
  sourceAttributePath: string;
  /** mXparser expression for value transformation */
  mappingExpression: string;
  /** Target attribute path (e.g., "Temperature") */
  targetAttributePath: string;

  /** Source entity rtId (from MapsFrom association) */
  sourceRtId: string;
  /** Source entity CK type (e.g., "Loxone/Control") */
  sourceCkTypeId: string;
  /** Resolved source entity name (loaded separately) */
  sourceName: string;

  /** Target entity rtId (from MapsTo association) */
  targetRtId: string;
  /** Target entity CK type (e.g., "EnergyIQ/Space") */
  targetCkTypeId: string;
  /** Resolved target entity name (loaded separately) */
  targetName: string;

  /** Validation status computed client-side */
  validationStatus: 'valid' | 'warning' | 'error';
  /** Validation messages */
  validationMessages: ValidationMessage[];
}

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface MappingOverviewSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  disabled: number;
}
