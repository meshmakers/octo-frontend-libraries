import { formatDate, formatNumber } from '@angular/common';
import { TableColumn } from '../../models/meshboard.models';
import { isCultureKey, pickLocalizedText } from '../../utils/meshboard-language';

/**
 * Pure helpers for the per-language titles and value labels of table widget columns (AB#7655).
 * The table widget calls them inside its `listViewColumns` computed, so a change of the host
 * language (`MESHBOARD_LANGUAGE` signal) re-labels headers and cells without refetching data.
 */

/** A value label after validation and language resolution: what one cell shows. */
export interface ResolvedValueLabel {
  text: string;
  color?: string;
}

/** Problems found in one column's `titles` / `valueLabels`; each problematic entry is ignored. */
export interface TableColumnLabelProblems {
  /** Culture keys of `titles` or of a per-language `label` that are not culture codes (e.g. `german`, `de_AT`). */
  unknownCultureKeys: string[];
  /** `valueLabels` keys whose entry is malformed (no object, no usable `label`, non-string `color`). */
  malformedValueKeys: string[];
  /** `titles` keys with a non-string or empty text; `'*'` when `titles` itself is no object. */
  malformedTitleKeys?: string[];
  /** `valueLabels` together with `statusMapping`: the status icons are not shown (unsupported). */
  statusMappingIgnored?: boolean;
}

/** An empty problems record. */
export function emptyLabelProblems(): TableColumnLabelProblems {
  return { unknownCultureKeys: [], malformedValueKeys: [], malformedTitleKeys: [], statusMappingIgnored: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keeps the usable entries of a per-language text map: culture keys with a non-empty string text.
 * Bad culture keys are reported; the keys of entries with a non-string or empty text are returned
 * as `malformedKeys`.
 */
function cleanLocalizedTexts(
  texts: Record<string, unknown>,
  unknownCultureKeys: string[]
): { texts: Record<string, string>; malformedKeys: string[] } {
  const clean: Record<string, string> = {};
  const malformedKeys: string[] = [];
  for (const [key, text] of Object.entries(texts)) {
    if (!isCultureKey(key)) {
      unknownCultureKeys.push(key);
      continue;
    }
    if (typeof text !== 'string' || text === '') {
      malformedKeys.push(key);
      continue;
    }
    clean[key] = text;
  }
  return { texts: clean, malformedKeys };
}

/**
 * The header text of a column: `titles` looked up with {@link pickLocalizedText} (exact culture,
 * then language part; a bare language takes the first key of that language), then `title`.
 * Without a language (no `MESHBOARD_LANGUAGE`) it is always `title`, as before AB#7655.
 * Unknown culture keys and malformed entries (non-string or empty text, a `titles` that is no
 * object) are reported in `problems` and never matched.
 */
export function resolveColumnTitle(column: TableColumn, language: string | null, problems?: TableColumnLabelProblems): string {
  const titles: unknown = column.titles;
  if (!isPlainObject(titles)) {
    if (titles !== undefined && titles !== null) {
      problems?.malformedTitleKeys?.push('*');
    }
    return column.title;
  }
  const { texts, malformedKeys } = cleanLocalizedTexts(titles, problems?.unknownCultureKeys ?? []);
  problems?.malformedTitleKeys?.push(...malformedKeys);
  return pickLocalizedText(texts, language) ?? column.title;
}

/**
 * Resolves a column's `valueLabels` for the current language into a lookup by raw value (`"1"`,
 * `"2"`, ...). A label given per language follows the language like `titles`; without a match that
 * entry is left out, so the cell shows the value in the column's normal rendering. Malformed
 * entries and unknown culture keys are ignored and reported in `problems`. Returns `null` when no
 * label applies for the current language (no usable `valueLabels`, or only per-language labels
 * without a match), so the column keeps its `dataType` / `format` rendering and the label resolver.
 */
export function resolveValueLabels(
  column: TableColumn,
  language: string | null,
  problems?: TableColumnLabelProblems
): ReadonlyMap<string, ResolvedValueLabel> | null {
  const valueLabels: unknown = column.valueLabels;
  if (valueLabels === undefined || valueLabels === null) {
    return null;
  }
  const report: TableColumnLabelProblems = problems ?? { unknownCultureKeys: [], malformedValueKeys: [] };
  if (!isPlainObject(valueLabels)) {
    report.malformedValueKeys.push('*');
    return null;
  }
  const resolved = new Map<string, ResolvedValueLabel>();
  for (const [key, entry] of Object.entries(valueLabels)) {
    if (!isPlainObject(entry)) {
      report.malformedValueKeys.push(key);
      continue;
    }
    const { label, color } = entry as { label?: unknown; color?: unknown };
    if (color !== undefined && typeof color !== 'string') {
      report.malformedValueKeys.push(key);
      continue;
    }
    let text: string | undefined;
    if (typeof label === 'string' && label !== '') {
      text = label;
    } else if (isPlainObject(label)) {
      const cleaned = cleanLocalizedTexts(label, report.unknownCultureKeys);
      if (cleaned.malformedKeys.length > 0 || Object.keys(label).length === 0) {
        report.malformedValueKeys.push(key);
        continue;
      }
      text = pickLocalizedText(cleaned.texts, language);
    } else {
      report.malformedValueKeys.push(key);
      continue;
    }
    if (text !== undefined) {
      resolved.set(key, { text, ...(color ? { color } : {}) });
    }
  }
  return resolved.size > 0 ? resolved : null;
}

/**
 * Text of a value-label cell whose value has no label: the value as the list view renders the
 * column's `dataType` - `numeric` with `format` like the `number` pipe, `iso8601` with `format`
 * like the `date` pipe (both with the app's `locale`), plain text through `textFormatter` (the
 * board's date-time formatter), anything else as string. A value the pipe cannot format shows as is.
 */
export function formatUnlabelledValue(
  value: unknown,
  column: Pick<TableColumn, 'dataType' | 'format'>,
  locale: string,
  textFormatter: (value: unknown) => string
): string {
  const format = column.format || undefined;
  try {
    switch (column.dataType) {
      case 'numeric': {
        const number = typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
        return Number.isFinite(number) ? formatNumber(number, locale, format) : String(value);
      }
      case 'iso8601':
        return typeof value === 'string' || typeof value === 'number' || value instanceof Date
          ? formatDate(value, format ?? 'mediumDate', locale)
          : String(value);
      case undefined:
      case 'text':
        return textFormatter(value);
      default:
        return String(value);
    }
  } catch {
    return String(value);
  }
}

/** Whether a problems record holds anything worth a warning. */
export function hasLabelProblems(problems: TableColumnLabelProblems): boolean {
  return problems.unknownCultureKeys.length > 0
    || problems.malformedValueKeys.length > 0
    || (problems.malformedTitleKeys?.length ?? 0) > 0
    || problems.statusMappingIgnored === true;
}

/**
 * Columns the table config dialog saves (AB#7655 AC 6). The dialog edits which fields are shown,
 * not their presentation, so it must not erase hand-authored column properties (`titles`,
 * `valueLabels`, `width`, `format`, `statusMapping`, ...):
 * - same data source (same CK type / same persistent query): a field that stays selected keeps its
 *   existing column object as is; a newly selected field gets a fresh column with `defaultTitle(field)`;
 * - persistent query: see {@link mergePersistentQueryColumns}.
 */
export function mergeRuntimeEntityColumns(
  selectedFields: readonly string[],
  initialColumns: readonly TableColumn[] | undefined,
  sameDataSource: boolean,
  defaultTitle: (field: string) => string
): TableColumn[] {
  const existing = new Map<string, TableColumn>();
  if (sameDataSource) {
    for (const column of initialColumns ?? []) {
      if (column && typeof column.field === 'string' && !existing.has(column.field)) {
        existing.set(column.field, column);
      }
    }
  }
  return selectedFields.map(field => existing.get(field) ?? { field, title: defaultTitle(field), width: undefined });
}

/**
 * Explicit columns of a persistent-query table after the dialog saved (AB#7655):
 * - a different query, or no explicit columns: `[]` (columns are derived from the query at run time);
 * - the same query with known `queryFields` (the columns the query returns now): the explicit columns
 *   whose field the query still returns, unchanged and in their order, followed by the query's other
 *   fields as derived columns (`defaultTitle(field)`, like the widget derives them);
 * - the same query, `queryFields` unknown (`null`, empty, or the lookup failed): the explicit columns unchanged.
 */
export function mergePersistentQueryColumns(
  initialColumns: readonly TableColumn[] | undefined,
  sameQuery: boolean,
  queryFields?: readonly string[] | null,
  defaultTitle: (field: string) => string = field => field
): TableColumn[] {
  if (!sameQuery || !initialColumns || initialColumns.length === 0) {
    return [];
  }
  if (!queryFields || queryFields.length === 0) {
    return [...initialColumns];
  }
  const returned = new Set(queryFields);
  const kept = initialColumns.filter(column => column && typeof column.field === 'string' && returned.has(column.field));
  const keptFields = new Set(kept.map(column => column.field));
  const added = [...returned]
    .filter(field => !keptFields.has(field))
    .map(field => ({ field, title: defaultTitle(field) }));
  return [...kept, ...added];
}
