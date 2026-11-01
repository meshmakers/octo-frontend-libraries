import {
  LineChartFormulaSeries,
  LineChartQuerySeries,
  LineChartSeriesDefinition,
  LineChartSeriesDisplayOptions
} from '../../models/meshboard.models';
import { FormulaEvaluator } from '../../utils/meshboard-formula';
import { evaluateSeriesFormulas, seriesFormulaOperands, validateSeriesFormulas } from '../../utils/meshboard-series-formula';
import { QueryResultRow } from '../../services/query-executor.service';
import { AlignedTimeSeries, TimeGridSeriesInput } from '../../utils/time-grid-alignment';
import { findCellForField, matchesAttributePath } from '../../utils/widget-data-utils';
import { toInstant } from '../../utils/meshboard-datetime';

/**
 * Pure helpers of the multi-source line chart (AB#7951): turn the rows of each source into
 * time-keyed series for {@link alignOnTimeGrid}, and label the aligned categories.
 */

/**
 * A per-source hint of a multi-source chart (AB#7951): a failed source, a source without data,
 * a source whose buckets do not sit on the chart's time grid, or a formula series whose operand
 * source failed (AB#7952).
 */
export interface LineChartSourceHint {
  kind: 'error' | 'noData' | 'misaligned' | 'dependency';
  sourceLabel: string;
  text: string;
}

/** Why a query source delivered no series (AB#7952: formula series that depend on it say so). */
export type LineChartSourceProblem = 'error' | 'misaligned' | 'noData';

/** A series as the chart draws it (multi-source path, AB#7952). */
export interface ComposedChartSeries {
  name: string;
  data: (number | null)[];
  unit?: string;
  /** Stacked with the other stacked series (only in a stacked area chart). */
  stacked: boolean;
  /** Drawn as a line over the stack (a non-stacked series of a stacked area chart). */
  asLine: boolean;
}

/** Suffix of the legend name of a formula series without any valid bucket. */
export const NO_DATA_LEGEND_SUFFIX = ' (no data)';

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

/** A formula series the widget can evaluate: valid key and a non-empty formula (validity is checked by the dialog). */
export function isCompleteFormulaSeries(def: LineChartSeriesDefinition): def is LineChartFormulaSeries {
  return def.kind === 'formula'
    && SERIES_KEY_PATTERN.test(def.key ?? '')
    && def.key !== PRIMARY_SOURCE_KEY
    && !!def.formula?.trim();
}

/** Display name of a series: its label, else its key. */
export function querySeriesLabel(def: LineChartSeriesDefinition): string {
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
 * Validation message of each series row of the config dialog (query and formula rows, AB#7951 /
 * AB#7952), `null` when the row is valid. Keys must match {@link SERIES_KEY_PATTERN} and be unique
 * across all rows; query rows need a query and a value field; formula rows are validated like the
 * KPI formula field (syntax, unknown keys — every series key is an available name) and must not be
 * part of a circular reference.
 */
export function querySeriesErrors(
  series: readonly LineChartSeriesDefinition[],
  evaluator?: FormulaEvaluator
): (string | null)[] {
  const counts = new Map<string, number>();
  for (const s of series) {
    const key = s.key?.trim() ?? '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = [...counts.keys()];
  const formulaRows = series
    .map((s, index) => ({ s, index }))
    .filter((r): r is { s: LineChartFormulaSeries; index: number } => r.s.kind === 'formula');
  const formulaResults = evaluator
    ? validateSeriesFormulas(formulaRows.map(r => ({ key: r.s.key?.trim() ?? '', formula: r.s.formula ?? '' })), keys, evaluator)
    : [];
  const formulaErrorByIndex = new Map<number, string | null>();
  formulaRows.forEach((r, i) => {
    const result = formulaResults[i];
    formulaErrorByIndex.set(r.index, result && !result.valid ? (result.error ?? 'Invalid formula') : null);
  });

  return series.map((s, index) => {
    const key = s.key?.trim() ?? '';
    if (!key) return 'Enter a key.';
    if (!SERIES_KEY_PATTERN.test(key) || key === PRIMARY_SOURCE_KEY) {
      return 'The key may contain letters, digits and _ and must not start with a digit.';
    }
    if ((counts.get(key) ?? 0) > 1) return `The key "${key}" is used by another series.`;
    if (s.kind === 'formula') {
      if (!s.formula?.trim()) return 'Enter a formula.';
      return formulaErrorByIndex.get(index) ?? null;
    }
    if (!s.dataSource?.queryRtId) return 'Select a stream-data query.';
    if (!s.valueField) return 'Select a value field.';
    if (s.dataSource.resolutionAware && !s.dataSource.requiredAggregation) return 'Select the aggregation.';
    return null;
  });
}

/**
 * Composes the series the chart draws from the aligned grid (AB#7952):
 *
 * 1. Operands = the aligned query series by key (hidden ones included — they went through the
 *    alignment like every other series).
 * 2. Formula series are evaluated per bucket (`evaluateSeriesFormulas`: dependency order, null
 *    operand or non-finite result = gap).
 * 3. Order: primary series, then `additionalSeries` in their order; hidden series (`visible:
 *    false`, primary via `primary.visible`) are left out. In a stacked area chart a series with
 *    `stacked: false` is drawn as a line and moved behind the stacked ones, so it lies over the stack.
 * 4. Hints: a visible formula series that (directly or through other formulas) uses a failed or
 *    misaligned query source gets "depends on <source>, which failed"; a visible formula series without any
 *    valid bucket keeps its legend entry with the suffix " (no data)".
 */
export function composeChartSeries(args: {
  gridSeries: readonly AlignedTimeSeries[];
  length: number;
  definitions: readonly LineChartSeriesDefinition[];
  primary?: LineChartSeriesDisplayOptions;
  stackedChart: boolean;
  /** Problems of query sources by series key. */
  sourceProblems: ReadonlyMap<string, { label: string; problem: LineChartSourceProblem }>;
  evaluator: FormulaEvaluator;
}): { series: ComposedChartSeries[]; hints: LineChartSourceHint[] } {
  const { gridSeries, length, definitions, primary, stackedChart, sourceProblems, evaluator } = args;
  const formulas = definitions.filter(isCompleteFormulaSeries);
  const operands = new Map<string, (number | null)[]>();
  for (const s of gridSeries) {
    if (s.sourceKey !== PRIMARY_SOURCE_KEY) operands.set(s.sourceKey, s.data);
  }
  const evaluated = formulas.length > 0
    ? evaluateSeriesFormulas(formulas, operands, length, evaluator)
    : new Map<string, (number | null)[]>();

  const placement = (options: LineChartSeriesDisplayOptions | undefined): { stacked: boolean; asLine: boolean } => {
    const stacked = stackedChart && options?.stacked !== false;
    return { stacked, asLine: stackedChart && !stacked };
  };

  const series: ComposedChartSeries[] = [];
  if (primary?.visible !== false) {
    for (const s of gridSeries) {
      if (s.sourceKey === PRIMARY_SOURCE_KEY) series.push({ name: s.name, data: s.data, unit: s.unit, ...placement(primary) });
    }
  }

  const hints: LineChartSourceHint[] = [];
  const formulaByKey = new Map(formulas.map(f => [f.key, f]));
  for (const def of definitions) {
    if (def.kind === 'query') {
      if (def.visible === false || !isCompleteQuerySeries(def)) continue;
      const aligned = gridSeries.find(s => s.sourceKey === def.key);
      if (aligned) series.push({ name: aligned.name, data: aligned.data, unit: aligned.unit, ...placement(def) });
      continue;
    }
    if (!isCompleteFormulaSeries(def) || def.visible === false) continue;
    const label = querySeriesLabel(def);
    const failed = failedSourcesOf(def.key, formulaByKey, sourceProblems);
    for (const source of failed) {
      hints.push({
        kind: 'dependency',
        sourceLabel: label,
        text: `${label}: depends on ${source.label}, which ${source.problem === 'misaligned' ? 'is not on the chart\'s time grid' : 'failed'}`
      });
    }
    const data = evaluated.get(def.key) ?? new Array<number | null>(length).fill(null);
    const hasData = data.some(v => v !== null);
    series.push({ name: hasData ? label : `${label}${NO_DATA_LEGEND_SUFFIX}`, data, ...placement(def) });
  }

  // Lines over the stack come last, so Kendo draws them on top.
  return { series: [...series.filter(s => !s.asLine), ...series.filter(s => s.asLine)], hints };
}

/** Failed or misaligned query sources a formula series depends on, directly or through other formulas. */
function failedSourcesOf(
  key: string,
  formulaByKey: ReadonlyMap<string, LineChartFormulaSeries>,
  sourceProblems: ReadonlyMap<string, { label: string; problem: LineChartSourceProblem }>
): { label: string; problem: LineChartSourceProblem }[] {
  const out: { label: string; problem: LineChartSourceProblem }[] = [];
  const visited = new Set<string>();
  const stack = [key];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const formula = formulaByKey.get(current);
    if (formula) {
      stack.push(...seriesFormulaOperands(formula.formula).reverse());
      continue;
    }
    const problem = sourceProblems.get(current);
    if (problem && problem.problem !== 'noData') out.push(problem);
  }
  return out;
}
