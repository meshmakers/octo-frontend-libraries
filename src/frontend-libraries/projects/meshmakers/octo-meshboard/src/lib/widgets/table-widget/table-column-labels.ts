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
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keeps the usable entries of a per-language text map: culture keys with a non-empty string text.
 * Bad culture keys are reported; entries with a non-string text count as `malformed` (returned flag).
 */
function cleanLocalizedTexts(
  texts: Record<string, unknown>,
  unknownCultureKeys: string[]
): { texts: Record<string, string>; malformed: boolean } {
  const clean: Record<string, string> = {};
  let malformed = false;
  for (const [key, text] of Object.entries(texts)) {
    if (!isCultureKey(key)) {
      unknownCultureKeys.push(key);
      continue;
    }
    if (typeof text !== 'string' || text === '') {
      malformed = true;
      continue;
    }
    clean[key] = text;
  }
  return { texts: clean, malformed };
}

/**
 * The header text of a column: `titles[language]` (exact culture), then `titles[<language part>]`,
 * then `title`. Without a language (no `MESHBOARD_LANGUAGE`) it is always `title`, as before AB#7655.
 * Unknown culture keys are reported in `problems` and never matched.
 */
export function resolveColumnTitle(column: TableColumn, language: string | null, problems?: TableColumnLabelProblems): string {
  const titles: unknown = column.titles;
  if (titles === undefined || titles === null) {
    return column.title;
  }
  if (!isPlainObject(titles)) {
    return column.title;
  }
  const { texts } = cleanLocalizedTexts(titles, problems?.unknownCultureKeys ?? []);
  return pickLocalizedText(texts, language) ?? column.title;
}

/**
 * Resolves a column's `valueLabels` for the current language into a lookup by raw value (`"1"`,
 * `"2"`, ...). A label given per language follows the language (exact culture, then language part);
 * without a match that entry is left out, so the cell shows the raw value. Malformed entries and
 * unknown culture keys are ignored and reported in `problems`. Returns `null` when the column has no
 * usable `valueLabels` at all.
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
  let usable = 0;
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
      if (cleaned.malformed || Object.keys(label).length === 0) {
        report.malformedValueKeys.push(key);
        continue;
      }
      text = pickLocalizedText(cleaned.texts, language);
    } else {
      report.malformedValueKeys.push(key);
      continue;
    }
    usable++;
    if (text !== undefined) {
      resolved.set(key, { text, ...(color ? { color } : {}) });
    }
  }
  return usable > 0 ? resolved : null;
}

/** Whether a problems record holds anything worth a warning. */
export function hasLabelProblems(problems: TableColumnLabelProblems): boolean {
  return problems.unknownCultureKeys.length > 0 || problems.malformedValueKeys.length > 0;
}

/**
 * Columns the table config dialog saves (AB#7655 AC 6). The dialog edits which fields are shown,
 * not their presentation, so it must not erase hand-authored column properties (`titles`,
 * `valueLabels`, `width`, `format`, `statusMapping`, ...):
 * - same data source (same CK type / same persistent query): a field that stays selected keeps its
 *   existing column object as is; a newly selected field gets a fresh column with `defaultTitle(field)`;
 * - persistent query: the explicit columns are kept unchanged when the query did not change, else `[]`
 *   (columns are derived from the new query at run time).
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

/** Explicit columns of a persistent-query table after the dialog saved (see {@link mergeRuntimeEntityColumns}). */
export function mergePersistentQueryColumns(
  initialColumns: readonly TableColumn[] | undefined,
  sameQuery: boolean
): TableColumn[] {
  return sameQuery && initialColumns ? initialColumns.map(column => column) : [];
}
