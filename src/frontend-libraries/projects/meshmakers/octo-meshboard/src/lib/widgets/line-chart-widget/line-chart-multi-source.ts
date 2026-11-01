import { LineChartQuerySeries, LineChartSeriesDefinition } from '../../models/meshboard.models';
import { QueryResultRow } from '../../services/query-executor.service';
import { TimeGridSeriesInput } from '../../utils/time-grid-alignment';
import { findCellForField, matchesAttributePath } from '../../utils/widget-data-utils';
import { toInstant } from '../../utils/meshboard-datetime';

/**
 * Pure helpers of the multi-source line chart (AB#7951): turn the rows of each source into
 * time-keyed series for {@link alignOnTimeGrid}, and label the aligned categories.
 */

/** Source key of the primary data source; series keys cannot clash with it (they start with a letter or `_`, never `__primary`). */
export const PRIMARY_SOURCE_KEY = '__primary';

/** Valid series key: letters, digits and `_`, starting with a letter or `_`. */
export const SERIES_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A query series the widget can load: key, query and value field set. */
export function isCompleteQuerySeries(def: LineChartSeriesDefinition): def is LineChartQuerySeries {
  return def.kind === 'query'
    && SERIES_KEY_PATTERN.test(def.key ?? '')
    && def.key !== PRIMARY_SOURCE_KEY
    && !!def.dataSource?.queryRtId
    && !!def.valueField;
}

/** Display name of a query series: its label, else its key. */
export function querySeriesLabel(def: LineChartQuerySeries): string {
  return def.label?.trim() || def.key;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}

/** Bucket start instant of a row: the downsampling bin / stream-data row timestamp, else the given category cell. */
function rowInstant(row: QueryResultRow, categoryField: string | undefined, useTimestamp: boolean): number | null {
  let raw: unknown = useTimestamp ? row.timestamp : undefined;
  if ((raw === undefined || raw === null) && categoryField) {
    raw = findCellForField(row.cells, categoryField)?.value;
  }
  const instant = toInstant(raw);
  return instant ? instant.getTime() : null;
}

/**
 * Value of a row for `valueField`. Downsampled rows carry `<field>_avg` / `_min` / `_max`: the
 * average (or an unsuffixed cell) is the value. Raw rows: the exact cell first (AB#4293 rule).
 * A null cell is "no data" (null), never 0.
 */
function rowValue(row: QueryResultRow, valueField: string, downsampled: boolean): number | null {
  if (downsampled) {
    const cell = row.cells.find(c => {
      const lower = c.attributePath.toLowerCase();
      return lower !== 'timestamp' && !lower.endsWith('_min') && !lower.endsWith('_max')
        && matchesAttributePath(c.attributePath, valueField);
    });
    return toNumberOrNull(cell?.value);
  }
  return toNumberOrNull(findCellForField(row.cells, valueField)?.value);
}

/**
 * Rows of the primary source → one series per `seriesGroupField` value, exactly the grouping of
 * the single-query chart (a later row of the same series and bucket wins).
 */
export function primaryRowsToSeries(
  rows: readonly QueryResultRow[],
  fields: { categoryField: string; seriesGroupField: string; valueField: string; unitField?: string },
  downsampled: boolean
): TimeGridSeriesInput[] {
  const series = new Map<string, { points: Map<number, number | null>; unit?: string }>();
  for (const row of rows) {
    const instant = rowInstant(row, downsampled ? undefined : fields.categoryField, downsampled);
    if (instant === null) continue;
    const group = findCellForField(row.cells, fields.seriesGroupField)?.value;
    if (group === null || group === undefined || String(group) === '') continue;
    const name = String(group);
    let entry = series.get(name);
    if (!entry) {
      entry = { points: new Map() };
      series.set(name, entry);
    }
    entry.points.set(instant, rowValue(row, fields.valueField, downsampled));
    if (fields.unitField) {
      const unit = findCellForField(row.cells, fields.unitField)?.value;
      if (unit !== null && unit !== undefined && String(unit) !== '') entry.unit = String(unit);
    }
  }
  return Array.from(series.entries()).map(([name, e]) => ({ name, points: e.points, unit: e.unit }));
}

/**
 * Rows of a query series → its one series. Several rows in one bucket (e.g. one per source entity
 * when the scope holds several) are summed; a bucket whose rows are all null stays null.
 */
export function queryRowsToSeries(
  rows: readonly QueryResultRow[],
  name: string,
  valueField: string,
  downsampled: boolean
): TimeGridSeriesInput {
  const points = new Map<number, number | null>();
  for (const row of rows) {
    const instant = rowInstant(row, 'timestamp', true);
    if (instant === null) continue;
    const value = rowValue(row, valueField, downsampled);
    const prev = points.get(instant);
    if (prev === undefined || prev === null) points.set(instant, value);
    else if (value !== null) points.set(instant, prev + value);
  }
  return { name, points };
}

/**
 * Category labels for aligned instants. A label that repeats (the doubled wall-clock hour of a
 * DST fall-back day) gets ` (2)`, ` (3)` …, so every bucket keeps its own category.
 */
export function uniqueCategoryLabels(instants: readonly number[], format: (instant: Date) => string): string[] {
  const seen = new Map<string, number>();
  return instants.map(t => {
    const label = format(new Date(t));
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n === 1 ? label : `${label} (${n})`;
  });
}

/**
 * Validation message of each query series row of the config dialog, `null` when the row is valid.
 * Keys must match {@link SERIES_KEY_PATTERN} and be unique; query and value field are required.
 */
export function querySeriesErrors(series: readonly LineChartQuerySeries[]): (string | null)[] {
  const counts = new Map<string, number>();
  for (const s of series) {
    const key = s.key?.trim() ?? '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return series.map(s => {
    const key = s.key?.trim() ?? '';
    if (!key) return 'Enter a key.';
    if (!SERIES_KEY_PATTERN.test(key) || key === PRIMARY_SOURCE_KEY) {
      return 'The key may contain letters, digits and _ and must not start with a digit.';
    }
    if ((counts.get(key) ?? 0) > 1) return `The key "${key}" is used by another series.`;
    if (!s.dataSource?.queryRtId) return 'Select a stream-data query.';
    if (!s.valueField) return 'Select a value field.';
    if (s.dataSource.resolutionAware && !s.dataSource.requiredAggregation) return 'Select the aggregation.';
    return null;
  });
}
