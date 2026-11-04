import type { ChartValueLabels } from '../models/meshboard.models';

/**
 * Display names for the raw values of a chart field (`categoryLabels` / `seriesLabels`).
 * Display only: the widgets group, filter and match on the raw value and rename at the very end.
 */

/**
 * Cleans a label map from a dialog or a persisted config: keeps the entries with a non-empty key and
 * a non-blank string name (the name is trimmed, the key is kept exactly as stored) and returns
 * `undefined` when nothing is left, so an empty map is never stored.
 */
export function normalizeChartValueLabels(labels: unknown): ChartValueLabels | undefined {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    return undefined;
  }
  const normalized: ChartValueLabels = {};
  for (const [rawValue, label] of Object.entries(labels as Record<string, unknown>)) {
    const text = typeof label === 'string' ? label.trim() : '';
    if (rawValue !== '' && text !== '') {
      normalized[rawValue] = text;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * The configured name of a raw value, `undefined` when there is none. Own keys only: a raw value such
 * as `constructor` must not find an inherited member of the map.
 */
export function configuredValueLabel(labels: ChartValueLabels | null | undefined, rawValue: string): string | undefined {
  if (!labels || !Object.prototype.hasOwnProperty.call(labels, rawValue)) {
    return undefined;
  }
  const label = labels[rawValue];
  return typeof label === 'string' && label !== '' ? label : undefined;
}

/**
 * The legend name of each raw series value. Chart series are keyed by their name, so a name that two
 * raw values share would merge or collide the two series; such a name is shown as `Name (raw value)`.
 * A unique name is used as it is, a raw value without an entry maps to itself.
 */
export function seriesLabelsByRawValue(rawValues: Iterable<string>, labels: ChartValueLabels | null | undefined): Map<string, string> {
  const unique = Array.from(new Set(rawValues));
  const nameOf = (raw: string): string => configuredValueLabel(labels, raw) ?? raw;

  const usage = new Map<string, number>();
  for (const raw of unique) {
    usage.set(nameOf(raw), (usage.get(nameOf(raw)) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const raw of unique) {
    const name = nameOf(raw);
    result.set(raw, name !== raw && (usage.get(name) ?? 0) > 1 ? `${name} (${raw})` : name);
  }
  return result;
}

/** One row of the label editor: a raw value and the name to show for it. `id` keeps the row stable while it is edited. */
export interface ValueLabelRow {
  id: number;
  value: string;
  label: string;
}

/** Editor rows of a label map, in the order the map lists them; ids start at `firstId`. */
export function toValueLabelRows(labels: ChartValueLabels | null | undefined, firstId = 1): ValueLabelRow[] {
  return Object.entries(normalizeChartValueLabels(labels) ?? {}).map(([value, label], index) => ({ id: firstId + index, value, label }));
}

/**
 * The label map of the editor rows. Only complete rows count (value and name both filled in, the
 * value trimmed); an unfinished row is skipped before it can replace a complete row of the same
 * value. Of two complete rows with the same value the later one wins. `undefined` when nothing is left.
 */
export function fromValueLabelRows(rows: readonly ValueLabelRow[] | null | undefined): ChartValueLabels | undefined {
  const labels: ChartValueLabels = {};
  for (const row of rows ?? []) {
    const value = (row.value ?? '').trim();
    const label = (row.label ?? '').trim();
    if (value !== '' && label !== '') {
      labels[value] = label;
    }
  }
  return normalizeChartValueLabels(labels);
}

/** Raw values that more than one complete row lists (trimmed; unfinished rows are ignored), each reported once. */
export function duplicateValueLabelValues(rows: readonly ValueLabelRow[] | null | undefined): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows ?? []) {
    const value = (row.value ?? '').trim();
    if (value === '' || (row.label ?? '').trim() === '') {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}
