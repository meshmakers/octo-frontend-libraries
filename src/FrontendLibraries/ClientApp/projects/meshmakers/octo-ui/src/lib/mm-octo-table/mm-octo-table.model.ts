export interface TableColumn {
  displayName?: string | null;
  dataKey: string;
}


export function getDisplayName(column: TableColumn): string {
  return column.displayName ?? column.dataKey;
}

export type ColumnDefinition =
  | string
  | TableColumn;
