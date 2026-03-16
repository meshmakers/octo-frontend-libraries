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
 * Column info derived from query execution
 */
export interface QueryColumnItem {
  attributePath: string;
  attributeValueType: string;
}

/**
 * Category value item for grouped aggregation
 */
export interface CategoryValueItem {
  value: string;
  displayValue: string;
}
