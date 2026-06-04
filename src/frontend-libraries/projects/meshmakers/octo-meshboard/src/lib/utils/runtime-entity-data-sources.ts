// Re-export from octo-services (moved there for reuse by octo-ui)
export {
  RuntimeEntitySelectDataSource,
  RuntimeEntityDialogDataSource
} from '@meshmakers/octo-services';
export type { RuntimeEntityItem } from '@meshmakers/octo-services';

/**
 * Persistent query item for selection in config dialogs
 */
export interface PersistentQueryItem {
  rtId: string;
  name: string;
  description?: string | null;
  queryCkTypeId?: string | null;
}

/**
 * Column info derived from query execution.
 *
 * `attributePath` is the verbatim engine-emitted column key — wire-form with function
 * suffix for aggregation columns (e.g. `meterreading_count`, `quantity_sum`), wire-form
 * without suffix for grouping columns (e.g. `operatingstatus`), or the original CK path
 * for simple-query columns. Picker UIs use it as both the displayed label and the stored
 * config value so MIN/MAX of the same source path produce two distinct entries instead
 * of two indistinguishable duplicates.
 */
export interface QueryColumnItem {
  attributePath: string;
  attributeValueType: string;
  aggregationType?: string | null;
}

/**
 * Category value item for grouped aggregation
 */
export interface CategoryValueItem {
  value: string;
  displayValue: string;
}
