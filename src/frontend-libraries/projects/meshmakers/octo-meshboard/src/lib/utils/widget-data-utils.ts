/**
 * Utility functions for widget data transformation.
 * These are pure functions extracted for testability.
 */

/**
 * Query row structure from GraphQL responses.
 */
export interface QueryRow {
  __typename?: string;
  cells?: {
    items?: (QueryCell | null)[] | null;
  } | null;
}

/**
 * Cell structure from GraphQL query responses.
 */
export interface QueryCell {
  attributePath?: string;
  value?: unknown;
}

/**
 * Query result structure from GraphQL responses.
 */
export interface QueryResult {
  rows?: {
    totalCount?: number;
    items?: (QueryRow | null)[] | null;
  } | null;
}

/**
 * Supported row types for query processing.
 */
export const SUPPORTED_ROW_TYPES = [
  'RtSimpleQueryRow',
  'RtAggregationQueryRow',
  'RtGroupingAggregationQueryRow'
];

/**
 * Sanitizes field names for comparison.
 * GraphQL attribute paths contain dots which are replaced with underscores.
 * @param fieldName The field name to sanitize
 * @returns Sanitized field name
 */
export function sanitizeFieldName(fieldName: string): string {
  return fieldName.replace(/\./g, '_');
}

/**
 * Parses a value to a number.
 * Returns 0 for NaN or non-numeric values.
 * @param value The value to parse
 * @returns Parsed numeric value or 0
 */
export function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extracts a single value from an aggregation query result.
 * Used for KPI widgets with 'aggregation' queryMode.
 * @param queryResult The query result containing rows
 * @param valueField Optional specific field to extract (uses first cell if not specified)
 * @returns The extracted numeric value
 */
export function extractAggregationValue(
  queryResult: QueryResult,
  valueField?: string
): number {
  const rows = queryResult.rows?.items ?? [];

  // Get the first supported row
  const firstRow = rows.find(row =>
    row && SUPPORTED_ROW_TYPES.includes(row.__typename ?? '')
  );

  if (!firstRow) return 0;

  const cells = firstRow.cells?.items ?? [];

  // Find the value field if specified
  if (valueField) {
    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = sanitizeFieldName(cell.attributePath);
      if (sanitizedPath === valueField) {
        return parseNumericValue(cell.value);
      }
    }
  }

  // Fallback: return first cell value
  const firstCell = cells.find(c => c !== null);
  return firstCell ? parseNumericValue(firstCell.value) : 0;
}

/**
 * Extracts a value from a grouped aggregation query result.
 * Used for KPI widgets with 'groupedAggregation' queryMode.
 * Finds the row where categoryField matches categoryValue and extracts valueField.
 * @param queryResult The query result containing rows
 * @param categoryField The field name to match against
 * @param categoryValue The value to match
 * @param valueField The field to extract the value from
 * @returns The extracted numeric value
 */
export function extractGroupedAggregationValue(
  queryResult: QueryResult,
  categoryField: string,
  categoryValue: string,
  valueField: string
): number {
  if (!categoryField || !categoryValue || !valueField) {
    return 0;
  }

  const rows = queryResult.rows?.items ?? [];

  // Find the row where category matches
  for (const row of rows) {
    if (!row || !SUPPORTED_ROW_TYPES.includes(row.__typename ?? '')) continue;

    const cells = row.cells?.items ?? [];

    let categoryMatch = false;
    let value = 0;

    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = sanitizeFieldName(cell.attributePath);

      if (sanitizedPath === categoryField && String(cell.value) === categoryValue) {
        categoryMatch = true;
      }

      if (sanitizedPath === valueField) {
        value = parseNumericValue(cell.value);
      }
    }

    if (categoryMatch) {
      return value;
    }
  }

  return 0;
}

/**
 * Series data structure for bar charts.
 */
export interface SeriesData {
  name: string;
  data: number[];
  color?: string;
}

/**
 * Series configuration for static series mode.
 */
export interface SeriesConfig {
  field: string;
  name?: string;
  color?: string;
}

/**
 * Result from processing bar chart data.
 */
export interface BarChartData {
  categories: string[];
  seriesData: SeriesData[];
}

/**
 * Processes bar chart data in Static Series Mode.
 * Each series in config corresponds to a separate numeric field.
 * @param rows The query rows to process
 * @param categoryField The field to use for categories
 * @param seriesConfigs The series configurations
 * @returns Processed bar chart data
 */
export function processStaticSeriesData(
  rows: QueryRow[],
  categoryField: string,
  seriesConfigs: SeriesConfig[]
): BarChartData {
  const categories: string[] = [];
  const seriesMap = new Map<string, number[]>();

  // Initialize series map from config
  for (const seriesConfig of seriesConfigs) {
    seriesMap.set(seriesConfig.field, []);
  }

  for (const row of rows) {
    if (!SUPPORTED_ROW_TYPES.includes(row.__typename ?? '')) continue;

    const cells = row.cells?.items ?? [];

    let categoryValue = '';
    const rowValues = new Map<string, number>();

    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = sanitizeFieldName(cell.attributePath);

      if (sanitizedPath === sanitizeFieldName(categoryField)) {
        categoryValue = String(cell.value ?? '');
      }

      // Check if this cell is one of our series fields
      for (const seriesConfig of seriesConfigs) {
        if (sanitizedPath === sanitizeFieldName(seriesConfig.field)) {
          rowValues.set(seriesConfig.field, parseNumericValue(cell.value));
        }
      }
    }

    if (categoryValue !== '') {
      categories.push(categoryValue);

      // Add values for each series
      for (const seriesConfig of seriesConfigs) {
        const value = rowValues.get(seriesConfig.field) ?? 0;
        seriesMap.get(seriesConfig.field)?.push(value);
      }
    }
  }

  // Convert to series data array
  const seriesData: SeriesData[] = seriesConfigs.map(seriesConfig => ({
    name: seriesConfig.name ?? seriesConfig.field,
    data: seriesMap.get(seriesConfig.field) ?? [],
    color: seriesConfig.color
  }));

  return { categories, seriesData };
}

/**
 * Processes bar chart data in Dynamic Series Mode.
 * Series are created dynamically from unique values of seriesGroupField.
 * @param rows The query rows to process
 * @param categoryField The field to use for categories
 * @param seriesGroupField The field to use for series grouping
 * @param valueField The field to use for values
 * @returns Processed bar chart data
 */
export function processDynamicSeriesData(
  rows: QueryRow[],
  categoryField: string,
  seriesGroupField: string,
  valueField: string
): BarChartData {
  // Build a map: category -> seriesGroup -> value
  const dataMap = new Map<string, Map<string, number>>();
  const allCategories = new Set<string>();
  const allSeriesGroups = new Set<string>();

  for (const row of rows) {
    if (!SUPPORTED_ROW_TYPES.includes(row.__typename ?? '')) continue;

    const cells = row.cells?.items ?? [];

    let categoryValue = '';
    let seriesGroupValue = '';
    let numericValue = 0;

    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = sanitizeFieldName(cell.attributePath);

      if (sanitizedPath === sanitizeFieldName(categoryField)) {
        categoryValue = String(cell.value ?? '');
      } else if (sanitizedPath === sanitizeFieldName(seriesGroupField)) {
        seriesGroupValue = String(cell.value ?? '');
      } else if (sanitizedPath === sanitizeFieldName(valueField)) {
        numericValue = parseNumericValue(cell.value);
      }
    }

    if (categoryValue && seriesGroupValue) {
      allCategories.add(categoryValue);
      allSeriesGroups.add(seriesGroupValue);

      if (!dataMap.has(categoryValue)) {
        dataMap.set(categoryValue, new Map());
      }
      dataMap.get(categoryValue)!.set(seriesGroupValue, numericValue);
    }
  }

  // Convert to arrays (maintain insertion order)
  const categories = Array.from(allCategories);
  const seriesGroups = Array.from(allSeriesGroups);

  // Build series data
  const seriesData: SeriesData[] = seriesGroups.map(seriesGroup => {
    const data = categories.map(category => {
      return dataMap.get(category)?.get(seriesGroup) ?? 0;
    });

    return {
      name: seriesGroup,
      data
    };
  });

  return { categories, seriesData };
}

/**
 * Pie chart data item.
 */
export interface PieChartDataItem {
  category: string;
  value: number;
}

/**
 * Processes pie chart data from query rows.
 * @param rows The query rows to process
 * @param categoryField The field to use for categories
 * @param valueField The field to use for values
 * @returns Array of pie chart data items
 */
export function processPieChartData(
  rows: QueryRow[],
  categoryField: string,
  valueField: string
): PieChartDataItem[] {
  const result: PieChartDataItem[] = [];

  for (const row of rows) {
    if (!SUPPORTED_ROW_TYPES.includes(row.__typename ?? '')) continue;

    const cells = row.cells?.items ?? [];

    let categoryValue = '';
    let numericValue = 0;

    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = sanitizeFieldName(cell.attributePath);

      if (sanitizedPath === sanitizeFieldName(categoryField)) {
        categoryValue = String(cell.value ?? '');
      } else if (sanitizedPath === sanitizeFieldName(valueField)) {
        numericValue = parseNumericValue(cell.value);
      }
    }

    if (categoryValue) {
      result.push({
        category: categoryValue,
        value: numericValue
      });
    }
  }

  return result;
}
