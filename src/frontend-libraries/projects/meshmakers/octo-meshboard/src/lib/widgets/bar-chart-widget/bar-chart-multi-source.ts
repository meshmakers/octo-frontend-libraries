import { BarChartSeries } from '../../models/meshboard.models';
import { QueryResultRow } from '../../services/query-executor.service';
import { AlignedTimeSeries } from '../../utils/time-grid-alignment';
import { findCellForField } from '../../utils/widget-data-utils';
import { isIsoDateTime, toInstant } from '../../utils/meshboard-datetime';

/**
 * Pure helpers of the multi-source bar chart (AB#7953): turn the rows of each source into series
 * keyed by category value and match them on the union of categories. The aligned series have the
 * shape of the line chart's aligned series, so formula series, visibility and hints are composed by
 * the same `composeChartSeries` (AB#7952).
 */

/** A category value: its match key, its instant when it is a date-time, and the raw cell value. */
export interface CategoryValue {
  /** Match key: `t:<epoch ms>` for date-times (so `…T00:00:00Z` and `…T00:00:00.000Z` match), else `s:<text>`. */
  key: string;
  /** Epoch milliseconds when the value is a date-time, else `null`. */
  instant: number | null;
  raw: unknown;
}

/** The series of one source, keyed by category key. */
export interface CategorySeriesInput {
  name: string;
  values: Map<string, number | null>;
}

/** One source: its key and label, its categories in row order (distinct) and its series. */
export interface CategorySourceInput {
  sourceKey: string;
  sourceLabel: string;
  categories: CategoryValue[];
  series: CategorySeriesInput[];
}

/** The union of categories and every series aligned on it (`data[i]` = category `i`, missing = null). */
export interface CategoryAlignment {
  categories: CategoryValue[];
  series: AlignedTimeSeries[];
}

/** Category of a raw cell value; `null` for an empty value (the row is skipped, as today). */
export function categoryOf(raw: unknown): CategoryValue | null {
  if (raw === null || raw === undefined || String(raw) === '') return null;
  if (raw instanceof Date || isIsoDateTime(raw)) {
    const instant = toInstant(raw);
    if (instant) return { key: `t:${instant.getTime()}`, instant: instant.getTime(), raw };
  }
  return { key: `s:${String(raw)}`, instant: null, raw };
}

/**
 * Raw category value of a row: the cell of `categoryField` (exact match first, AB#4293). A
 * stream-data row carries its time stamp as row property, not as cell, so `timestamp` falls back
 * to `row.timestamp`.
 */
export function rowCategory(row: QueryResultRow, categoryField: string): CategoryValue | null {
  let raw: unknown = findCellForField(row.cells, categoryField)?.value;
  if ((raw === undefined || raw === null) && categoryField.toLowerCase() === 'timestamp') raw = row.timestamp;
  return categoryOf(raw);
}

/**
 * Bar value of a cell, as the single-query chart reads it: a number, `null` for a null cell ("no
 * data", AB#7975) and 0 for text that is not a number.
 */
export function toBarValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(n) ? 0 : n;
}

function scaled(value: number | null, valueScale: number): number | null {
  return value === null ? null : value * valueScale;
}

function addCategory(list: CategoryValue[], seen: Set<string>, category: CategoryValue): void {
  if (seen.has(category.key)) return;
  seen.add(category.key);
  list.push(category);
}

/**
 * Rows of the primary source → its series, exactly the grouping of the single-query chart:
 * static mode one series per configured value field (a missing cell is 0), dynamic mode one series
 * per `seriesGroupField` value (a combination missing in a category of this source is 0). A later
 * row of the same category wins. `valueScale` is applied to every value.
 */
export function primaryRowsToCategorySeries(
  rows: readonly QueryResultRow[],
  config: { categoryField: string; series?: BarChartSeries[]; seriesGroupField?: string; valueField?: string },
  valueScale: number
): { categories: CategoryValue[]; series: CategorySeriesInput[] } {
  const categories: CategoryValue[] = [];
  const seen = new Set<string>();

  if (config.seriesGroupField && config.valueField) {
    const groups = new Map<string, Map<string, number | null>>();
    for (const row of rows) {
      const category = rowCategory(row, config.categoryField);
      const groupCell = findCellForField(row.cells, config.seriesGroupField);
      const group = groupCell ? String(groupCell.value ?? '') : '';
      if (!category || !group) continue;
      addCategory(categories, seen, category);
      const valueCell = findCellForField(row.cells, config.valueField);
      const value = valueCell ? toBarValue(valueCell.value) : 0;
      let values = groups.get(group);
      if (!values) {
        values = new Map();
        groups.set(group, values);
      }
      values.set(category.key, scaled(value, valueScale));
    }
    const series = Array.from(groups.entries()).map(([name, values]) => {
      for (const c of categories) if (!values.has(c.key)) values.set(c.key, 0);
      return { name, values };
    });
    return { categories, series };
  }

  const fields = config.series ?? [];
  const series = fields.map(f => ({ name: f.name ?? f.field, values: new Map<string, number | null>() }));
  for (const row of rows) {
    const category = rowCategory(row, config.categoryField);
    if (!category) continue;
    addCategory(categories, seen, category);
    fields.forEach((f, i) => {
      const cell = findCellForField(row.cells, f.field);
      series[i].values.set(category.key, cell ? scaled(toBarValue(cell.value), valueScale) : 0);
    });
  }
  return { categories, series };
}

/**
 * Rows of a query series → its one series. Several rows in one category (e.g. one per source
 * entity when the scope holds several) are summed; a category whose rows are all null stays null.
 * `valueScale` is applied to the result.
 */
export function queryRowsToCategorySeries(
  rows: readonly QueryResultRow[],
  name: string,
  categoryField: string,
  valueField: string,
  valueScale: number
): { categories: CategoryValue[]; series: CategorySeriesInput } {
  const categories: CategoryValue[] = [];
  const seen = new Set<string>();
  const values = new Map<string, number | null>();
  for (const row of rows) {
    const category = rowCategory(row, categoryField);
    if (!category) continue;
    addCategory(categories, seen, category);
    const cell = findCellForField(row.cells, valueField);
    const value = cell ? toBarValue(cell.value) : null;
    const prev = values.get(category.key);
    if (prev === undefined || prev === null) values.set(category.key, value);
    else if (value !== null) values.set(category.key, prev + value);
  }
  for (const [key, v] of values) values.set(key, scaled(v, valueScale));
  return { categories, series: { name, values } };
}

/**
 * Matches the series of all sources per category value. Categories are the union over all sources:
 * in order of first appearance (primary source first, then the others in their order), and sorted
 * chronologically when every category is a date-time. A category a source lacks is `null` for
 * its series — no bar, never 0.
 */
export function alignOnCategories(sources: readonly CategorySourceInput[]): CategoryAlignment {
  const categories: CategoryValue[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const c of source.categories) addCategory(categories, seen, c);
  }
  if (categories.length > 0 && categories.every(c => c.instant !== null)) {
    categories.sort((a, b) => (a.instant as number) - (b.instant as number));
  }
  const series: AlignedTimeSeries[] = [];
  for (const source of sources) {
    for (const s of source.series) {
      series.push({
        sourceKey: source.sourceKey,
        name: s.name,
        data: categories.map(c => (s.values.has(c.key) ? (s.values.get(c.key) as number | null) : null))
      });
    }
  }
  return { categories, series };
}

/** Makes labels unique: a repeated label gets ` (2)`, ` (3)` …, so every category keeps its own slot. */
export function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map(label => {
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n === 1 ? label : `${label} (${n})`;
  });
}
