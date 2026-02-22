export interface TableColumn {
  displayName?: string | null;
  dataKey: string;
  templateName?: string;
  sortingDisabled?: boolean;
}

export function getDisplayName(column: TableColumn): string {
  return column.displayName ?? column.dataKey;
}

export function getDataKey(column: TableColumn): string {
  return column.dataKey;
}

export type ColumnDefinition = string | TableColumn;
