import { TimeRangeUtils } from '@meshmakers/shared-ui';
import {
  HeatmapAggregation,
  HeatmapTimeWindow,
  HeatmapWidgetConfig,
  MeshBoardTimeZoneMode,
  RelativeTimeUnit
} from '../../models/meshboard.models';
import { getZonedDateParts, zonedDateKey } from '../../utils/meshboard-datetime';

/**
 * Pure bucketing helpers of the heatmap widget (AB#7956): weighted mean, bucket-end shift,
 * DST-aware hour slots and the widget-level relative time window.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

const TIME_WINDOW_UNITS: readonly RelativeTimeUnit[] = ['hours', 'days', 'weeks', 'months'];

/** One row's contribution to a cell: the value and its weight (1 unless `weightedAvg`). */
export interface HeatmapEntry {
  value: number;
  weight: number;
}

/** Where an instant falls in the board's time zone. */
export interface HeatmapHourSlot {
  /** `yyyy-MM-dd` in the board's time zone */
  dateKey: string;
  /** Wall-clock hour 0-23 */
  hour: number;
  /** Wall-clock minute 0-59 */
  minute: number;
  /** True for the second occurrence of a wall-clock hour on a DST fall-back day */
  repeat: boolean;
}

/**
 * Resolves the day, hour and minute of an instant in the board's time zone. On a DST fall-back
 * day the repeated wall-clock hour (e.g. 02:00 CET after 02:00 CEST) is flagged as `repeat`, so
 * the day keeps 25 distinct hours instead of merging two real hours into one cell.
 */
export function heatmapHourSlot(date: Date, mode: MeshBoardTimeZoneMode): HeatmapHourSlot | null {
  const parts = getZonedDateParts(date, mode);
  if (!parts) return null;
  const dateKey = zonedDateKey(parts);
  const hourBefore = getZonedDateParts(new Date(date.getTime() - HOUR_MS), mode);
  const repeat = !!hourBefore && hourBefore.hour === parts.hour && zonedDateKey(hourBefore) === dateKey;
  return { dateKey, hour: parts.hour, minute: parts.minute, repeat };
}

/** Sortable slot index: `2 × hour`, `+1` for the repeated hour (sorts right after its hour). */
export function hourSlotIndex(slot: Pick<HeatmapHourSlot, 'hour' | 'repeat'>): number {
  return slot.hour * 2 + (slot.repeat ? 1 : 0);
}

/** Y-axis label of a slot index: `08:00`, or `02:00 (2)` for the repeated hour. */
export function hourSlotLabel(index: number): string {
  const label = Math.floor(index / 2).toString().padStart(2, '0') + ':00';
  return index % 2 === 1 ? `${label} (2)` : label;
}

/** The y-axis slots: the 24 hours plus every repeated hour that occurs in the data, in order. */
export function hourSlotIndices(used: Iterable<number>): number[] {
  const slots = new Set<number>(Array.from({ length: 24 }, (_, h) => h * 2));
  for (const index of used) slots.add(index);
  return Array.from(slots).sort((a, b) => a - b);
}

/**
 * Aggregates the entries of one cell. `weightedAvg` returns Σ value / Σ weight and `null` (empty
 * cell) when the cell has no rows or no weight; the other aggregations keep returning 0 for an
 * empty cell, as before.
 */
export function aggregateHeatmapEntries(entries: readonly HeatmapEntry[], aggregation: HeatmapAggregation | string): number | null {
  if (aggregation === 'weightedAvg') {
    let sum = 0;
    let weight = 0;
    for (const entry of entries) {
      sum += entry.value;
      weight += entry.weight;
    }
    return weight > 0 ? sum / weight : null;
  }
  if (entries.length === 0) return 0;
  switch (aggregation) {
    case 'sum':
      return entries.reduce((total, entry) => total + entry.value, 0);
    case 'avg':
      return entries.reduce((total, entry) => total + entry.value, 0) / entries.length;
    default:
      return entries.length;
  }
}

/** A finite number from a cell value, or `null` (missing, empty or not numeric). */
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Milliseconds to subtract from a row's date to reach its bucket start, or 0. Only when the date
 * marks the bucket end, a positive bucket width is set and no end field gives the start anyway.
 */
export function heatmapBucketShiftMs(config: Pick<HeatmapWidgetConfig, 'timestampIsBucketEnd' | 'bucketWidthMinutes' | 'dateEndField'>): number {
  if (!config.timestampIsBucketEnd || config.dateEndField) return 0;
  const width = config.bucketWidthMinutes;
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width * MINUTE_MS : 0;
}

/** True when the window has a positive integer value and a known unit. */
export function isValidHeatmapTimeWindow(window: HeatmapTimeWindow | null | undefined): window is HeatmapTimeWindow {
  return !!window
    && Number.isInteger(window.value)
    && window.value > 0
    && TIME_WINDOW_UNITS.includes(window.unit);
}

/**
 * The stream-data `{from, to}` of the widget's own window, or `undefined` when none is set.
 * Same rolling semantics as the board's relative time filter (`TimeRangeUtils.getRelativeRange`),
 * with `from` floored to the full hour so the first hour cell is complete.
 */
export function resolveHeatmapTimeWindow(window: HeatmapTimeWindow | null | undefined): { from: Date; to: Date } | undefined {
  if (!isValidHeatmapTimeWindow(window)) return undefined;
  const range = TimeRangeUtils.getRelativeRange(window.value, window.unit);
  return {
    from: new Date(Math.floor(range.from.getTime() / HOUR_MS) * HOUR_MS),
    to: range.to
  };
}

const UNIT_LABELS: Record<RelativeTimeUnit, [string, string]> = {
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months']
};

/** Badge text of the widget's own window, e.g. `Last 30 days`; `null` when none is set. */
export function heatmapTimeWindowLabel(window: HeatmapTimeWindow | null | undefined): string | null {
  if (!isValidHeatmapTimeWindow(window)) return null;
  const [singular, plural] = UNIT_LABELS[window.unit];
  return `Last ${window.value} ${window.value === 1 ? singular : plural}`;
}
