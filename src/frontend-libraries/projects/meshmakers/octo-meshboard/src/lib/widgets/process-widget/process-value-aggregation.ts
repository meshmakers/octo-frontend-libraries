import type { ProcessValueAggregate } from './process-widget-config.model';
import type { QueryResultData } from './services/process-data.service';

/**
 * Aggregation of a mapped Process Widget value over all rows of a query
 * binding's selector scope (AB#8024): `first` (default, the first row as
 * before), `sum`, `avg`, `min`, `max`.
 *
 * Aggregation works on **query bindings only**: a runtime-entity binding loads
 * a single entity, so there is nothing to aggregate. To aggregate over all
 * entities of a scope, bind a runtime persistent query with the entity
 * selector instead.
 */

/** All aggregates a mapping may name. */
export const PROCESS_VALUE_AGGREGATES: readonly ProcessValueAggregate[] = ['first', 'sum', 'avg', 'min', 'max'];

/** `true` when the aggregate reduces several rows (anything but `first`/absent). */
export function isReducingAggregate(aggregate: ProcessValueAggregate | undefined): boolean {
  return aggregate !== undefined && aggregate !== 'first';
}

/**
 * Reads one cell of a query row: the column name, or its sanitized form
 * (dots → underscores) as the query service delivers nested paths.
 */
function cellValue(cells: Map<string, unknown>, columnName: string): unknown {
  return cells.get(columnName) ?? cells.get(columnName.replace(/\./g, '_'));
}

/** A finite number from a cell, or `undefined` for null/undefined/non-numeric cells. */
function numericCell(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * The value of a column over the query rows.
 *
 * - `first` / absent: the cell of the first row, unchanged (today's behaviour).
 * - `sum`, `avg`, `min`, `max`: over the numeric cells; null, undefined and
 *   non-numeric cells are skipped. Zero rows or no numeric cell ⇒ `undefined`
 *   (the property keeps no value, not 0).
 */
export function aggregateQueryColumn(
  queryResult: QueryResultData,
  columnName: string,
  aggregate: ProcessValueAggregate | undefined
): unknown {
  const rows = queryResult.rows ?? [];
  if (rows.length === 0) {
    return undefined;
  }
  if (!isReducingAggregate(aggregate)) {
    return cellValue(rows[0].cells, columnName);
  }

  const numbers: number[] = [];
  for (const row of rows) {
    const n = numericCell(cellValue(row.cells, columnName));
    if (n !== undefined) {
      numbers.push(n);
    }
  }
  if (numbers.length === 0) {
    return undefined;
  }

  switch (aggregate) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return undefined;
  }
}

/**
 * `true` when a reducing aggregate ran over fewer rows than the scope holds
 * (`totalCount` > loaded rows) — the result is partial and worth a warning.
 */
export function isPartialAggregate(queryResult: QueryResultData): boolean {
  const loaded = queryResult.rows?.length ?? 0;
  return typeof queryResult.totalCount === 'number' && queryResult.totalCount > loaded;
}

/**
 * Why a mapping's aggregate cannot apply, or `undefined` when it can (or is
 * `first`/absent). A reducing aggregate needs a `number` property and a
 * persistent-query binding. The widget falls back to `first` in those cases.
 *
 * @param propertyType Type of the diagram's transform property, when known.
 * @param bindingMode  Mode of the mapping's binding, when known.
 */
export function processAggregateIssue(
  aggregate: ProcessValueAggregate | undefined,
  propertyType: string | undefined,
  bindingMode: 'runtimeEntity' | 'persistentQuery' | undefined
): string | undefined {
  if (aggregate === undefined) {
    return undefined;
  }
  if (!PROCESS_VALUE_AGGREGATES.includes(aggregate)) {
    return `Unknown aggregate '${String(aggregate)}'`;
  }
  if (!isReducingAggregate(aggregate)) {
    return undefined;
  }
  if (bindingMode === 'runtimeEntity') {
    return `Aggregate '${aggregate}' needs a persistent query binding; a runtime entity binding loads one entity`;
  }
  if (propertyType !== undefined && propertyType !== 'number') {
    return `Aggregate '${aggregate}' needs a number property, not '${propertyType}'`;
  }
  return undefined;
}
