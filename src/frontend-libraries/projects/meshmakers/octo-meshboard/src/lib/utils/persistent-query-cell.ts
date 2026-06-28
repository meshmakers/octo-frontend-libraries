/**
 * Shared helpers for per-cell persistent-query data sources used by the
 * aggregation-style widgets (stats-grid stat, summary-card tile).
 *
 * These mirror the KPI/gauge widget's value extraction, but operate on the
 * unified {@link QueryExecutionResult} returned by {@link QueryExecutorService}
 * (runtime OR stream-data) so a cell can switch family by configuration alone.
 */
import type { QueryExecutionResult } from '../services/query-executor.service';
import type { PersistentQueryCellSource } from '../models/meshboard.models';
import { matchesAttributePath, parseNumericValue } from './widget-data-utils';

/**
 * Row `__typename`s the value extraction recognises. Runtime queries
 * discriminate by kind; stream-data queries collapse every kind
 * (simple / aggregation / grouped / downsampling) into `StreamDataQueryRow`.
 */
const SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
  'RtAggregationQueryRow',
  'RtGroupingAggregationQueryRow',
  'StreamDataQueryRow'
]);

function extractAggregation(result: QueryExecutionResult, valueField?: string): number {
  const firstRow = result.rows.find(row => SUPPORTED_ROW_TYPES.has(row.__typename ?? ''));
  if (!firstRow) return 0;

  if (valueField) {
    for (const cell of firstRow.cells) {
      if (matchesAttributePath(cell.attributePath, valueField)) {
        return parseNumericValue(cell.value);
      }
    }
  }

  // Fallback: first cell value when no specific field is configured.
  return firstRow.cells.length > 0 ? parseNumericValue(firstRow.cells[0].value) : 0;
}

function extractGroupedAggregation(
  result: QueryExecutionResult,
  categoryField?: string,
  categoryValue?: string,
  valueField?: string
): number {
  if (!categoryField || !categoryValue || !valueField) return 0;

  for (const row of result.rows) {
    if (!SUPPORTED_ROW_TYPES.has(row.__typename ?? '')) continue;

    let categoryMatch = false;
    let value = 0;

    for (const cell of row.cells) {
      if (matchesAttributePath(cell.attributePath, categoryField) && String(cell.value) === categoryValue) {
        categoryMatch = true;
      }
      if (matchesAttributePath(cell.attributePath, valueField)) {
        value = parseNumericValue(cell.value);
      }
    }

    if (categoryMatch) return value;
  }

  return 0;
}

/**
 * Reduces a unified query result to the single numeric value a cell displays,
 * according to the source's `queryMode`. Mirrors the KPI widget extraction.
 */
export function extractPersistentQueryCellValue(
  result: QueryExecutionResult,
  source: PersistentQueryCellSource
): number {
  switch (source.queryMode ?? 'simpleCount') {
    case 'aggregation':
      return extractAggregation(result, source.queryValueField);
    case 'groupedAggregation':
      return extractGroupedAggregation(result, source.queryCategoryField, source.queryCategoryValue, source.queryValueField);
    case 'simpleCount':
    default:
      return result.totalCount;
  }
}
