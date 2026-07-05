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
 * Sanitizes field names for use as object keys.
 * Replaces dots with underscores so the value can be stored under a single key
 * without Kendo's dot-path navigation interpreting the dots as nested access.
 * Used when generating record keys, NOT for path comparison — use
 * {@link matchesAttributePath} for matching cell paths against widget configs.
 * @param fieldName The field name to sanitize
 * @returns Sanitized field name
 */
export function sanitizeFieldName(fieldName: string): string {
  return fieldName.replace(/\./g, '_');
}

/**
 * Strips a trailing aggregation function suffix from a path so the base path can
 * be compared independently of which aggregation produced it. The engine emits
 * cell paths like `meterreading_count` / `amountvalue_sum` for RT aggregation,
 * grouped aggregation, and stream-data variants.
 */
function stripAggregationFunctionSuffix(path: string): string {
  return path.replace(/_(?:count|sum|avg|min|max)$/i, '');
}

/**
 * Canonical key form: drop dot and underscore separators and lowercase the rest.
 * Lets us compare a widget config's stored field name (which may be
 * `meterReading`, `meter_reading`, or `amount_value`) against a cell path
 * (which may be wire-form `meterreading_count` or `amountvalue_sum`) on a
 * single common form.
 */
function toCanonicalAttributeKey(s: string): string {
  return s.replace(/[._]/g, '').toLowerCase();
}

/**
 * Detects whether a path ends with the engine's aggregation function suffix
 * (`_count`, `_sum`, `_avg`, `_min`, `_max`). Used to decide whether the loose
 * back-compat fallback in {@link matchesAttributePath} should fire.
 */
function hasAggregationFunctionSuffix(path: string): boolean {
  return /_(?:count|sum|avg|min|max)$/i.test(path);
}

/**
 * Returns true when a cell's `attributePath` refers to the same source attribute
 * as a widget config's stored field name. Handles three input shapes:
 *
 *  - Simple-query cells use the original CK attribute path (e.g. `meterReading`
 *    or `amount.value`).
 *  - RT aggregation cells use the engine's wire-form key with a function suffix
 *    (e.g. `meterreading_count`, `amountvalue_sum`).
 *  - RT grouping cells and stream-data cells use the same wire-form without a
 *    function suffix (e.g. `operatingstatus`).
 *
 * Widget configs typically store `sanitizeFieldName(originalPath)`, e.g.
 * `meterReading` or `amount_value`. This helper returns true when both refer
 * to the same source attribute, regardless of which form they're in.
 *
 * Exact `sanitizeFieldName` match wins (preserves behavior for simple queries
 * and stream-data widget configs that were saved with wire-form keys); the
 * canonical-form fallback unbreaks RT-aggregation / grouping widgets whose
 * configs were saved before the engine emitted wire-form keys.
 */
export function matchesAttributePath(cellPath: string | null | undefined, configField: string | null | undefined): boolean {
  if (!cellPath || !configField) return false;
  if (sanitizeFieldName(cellPath) === configField) return true;

  // Loose fallback for legacy configs saved with the original CK path before the engine
  // switched to wire-form column emission. Only fires when configField itself does NOT
  // carry an aggregation suffix — otherwise we would cross-match MIN against MAX cells
  // (both would canonicalise to the same base path).
  if (hasAggregationFunctionSuffix(configField)) return false;

  const cellBase = stripAggregationFunctionSuffix(cellPath);
  return toCanonicalAttributeKey(cellBase) === toCanonicalAttributeKey(configField);
}

/**
 * Finds the single cell in a row that a config field refers to, preferring an
 * exact `sanitizeFieldName` match over the loose canonical fallback of
 * {@link matchesAttributePath}.
 *
 * This disambiguation matters for grouping-aggregation results, where a group-by
 * cell (`state`) coexists with an aggregation cell over the same attribute
 * (`state_count`). A bare category config (`state`) loose-matches BOTH via the
 * canonical fallback; iterating cells and assigning on every match let the later
 * `state_count` cell overwrite the category with the raw count, so the pie/bar
 * legend showed the count instead of the enum label (AB#4293). Resolving each
 * field to its best cell — exact wins — keeps the group-by and aggregation cells
 * on their intended fields while still honouring the loose fallback for legacy
 * configs whose only matching cell is the wire-form aggregation column.
 */
export function findCellForField<T extends { attributePath?: string | null }>(
  cells: readonly (T | null | undefined)[],
  configField: string | null | undefined
): T | undefined {
  if (!configField) return undefined;

  let looseMatch: T | undefined;
  for (const cell of cells) {
    if (!cell?.attributePath) continue;
    if (sanitizeFieldName(cell.attributePath) === configField) return cell; // exact wins
    if (looseMatch === undefined && matchesAttributePath(cell.attributePath, configField)) {
      looseMatch = cell;
    }
  }
  return looseMatch;
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
    const cell = findCellForField(cells, valueField);
    if (cell) {
      return parseNumericValue(cell.value);
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

    const categoryCell = findCellForField(cells, categoryField);
    if (categoryCell && String(categoryCell.value) === categoryValue) {
      const valueCell = findCellForField(cells, valueField);
      return valueCell ? parseNumericValue(valueCell.value) : 0;
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

    const categoryCell = findCellForField(cells, categoryField);
    const categoryValue = categoryCell ? String(categoryCell.value ?? '') : '';

    const rowValues = new Map<string, number>();
    for (const seriesConfig of seriesConfigs) {
      const seriesCell = findCellForField(cells, seriesConfig.field);
      if (seriesCell) {
        rowValues.set(seriesConfig.field, parseNumericValue(seriesCell.value));
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

    const categoryCell = findCellForField(cells, categoryField);
    const seriesGroupCell = findCellForField(cells, seriesGroupField);
    const valueCell = findCellForField(cells, valueField);

    const categoryValue = categoryCell ? String(categoryCell.value ?? '') : '';
    const seriesGroupValue = seriesGroupCell ? String(seriesGroupCell.value ?? '') : '';
    const numericValue = valueCell ? parseNumericValue(valueCell.value) : 0;

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

    const categoryCell = findCellForField(cells, categoryField);
    const valueCell = findCellForField(cells, valueField);

    const categoryValue = categoryCell ? String(categoryCell.value ?? '') : '';
    const numericValue = valueCell ? parseNumericValue(valueCell.value) : 0;

    if (categoryValue) {
      result.push({
        category: categoryValue,
        value: numericValue
      });
    }
  }

  return result;
}

/**
 * Applies an optional scale factor to a query value (KPI `valueMultiplier`).
 * Only numeric values are scaled — strings (e.g. enum labels or error
 * placeholders) pass through unchanged, as does everything when no multiplier
 * is configured. Use case: cumulated energy from uniformly sampled power
 * (Σ(kW samples) × sampleIntervalHours → kWh); the factor is window-independent
 * because SUM is linear in the sample count.
 */
export function applyValueMultiplier(value: number | string, multiplier: number | undefined): number | string {
  if (typeof multiplier !== 'number' || typeof value !== 'number') {
    return value;
  }
  return value * multiplier;
}
