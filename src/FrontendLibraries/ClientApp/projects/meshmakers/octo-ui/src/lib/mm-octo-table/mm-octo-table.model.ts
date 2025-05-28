export interface TableColumn {
  displayName?: string | null;
  dataKey: string;
  templateName?: string;
  isVirtual?: boolean;
}

export function getDisplayName(column: TableColumn): string {
  return column.displayName ?? column.dataKey;
}

export type ColumnDefinition = string | TableColumn;
