/**
 * Pipeline execution counting shared by the cockpit widgets (AB#5558) and the
 * Refinery Studio (Data Flows list, data flow editor, adapter / data flow
 * detail pages): the 24 h hourly histogram behind every execution sparkline
 * and the execution counts over a set of pipelines. One implementation, so the
 * cockpit's "Pipeline executions 24 h" and the Data Flows list agree.
 */

/** One hour slot of the 24h execution histogram rendered by the sparkline. */
export interface HourlyExecutionBucket {
  /** UTC epoch ms of the hour start (aligned to the clock hour). */
  hourStart: number;
  ok: number;
  fail: number;
}

/** Raw server-side folded hour bucket (PipelineStatistics.HourlyBuckets, AB#4370). */
export interface RawHourBucket {
  hourStartAt?: string | Date | null;
  successCount?: number | null;
  failureCount?: number | null;
}

/** Number of hourly slots the sparkline renders. */
export const HISTOGRAM_HOURS = 24;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Options of {@link buildHourlyHistogram}. */
export interface HourlyHistogramOptions {
  /**
   * The statistics' `lastUpdatedAt` (for several pipelines the newest, see
   * {@link latestStatisticsUpdate}). The backend's windows are the clock hours ending with the
   * hour of its last sweep (AB#5583); when the browser clock is already in the next hour (or,
   * with clock skew, still in the previous one) the bars follow the statistics, so the 24 bars
   * sum to `last24Hours*`. Ignored when missing, invalid or more than an hour away from now
   * (stale statistics: the browser clock keeps the time axis honest).
   */
  anchor?: string | Date | number | null;
  /** "Now" in epoch ms (tests). */
  now?: number;
}

/**
 * Builds 24 contiguous hourly slots ending at the current clock hour from a flat
 * list of raw server buckets. Sparse backend buckets (only hours with executions
 * are stored) are gap-filled with zeros so the sparkline renders a continuous
 * time axis. Buckets outside the visible 24h window are ignored.
 *
 * Since AB#5583 the buckets hold every counted execution (folded and still
 * retained), so nothing is added to the current bar any more: seeding it with the
 * rolling last-hour counts double-counted the previous hour's tail. The legacy
 * numeric seed arguments are accepted for compatibility and ignored.
 */
export function buildHourlyHistogram(
  rawBuckets: (RawHourBucket | null)[] | null | undefined,
  options: HourlyHistogramOptions | number = {},
  _legacySeedFail?: number
): HourlyExecutionBucket[] {
  const opts: HourlyHistogramOptions = typeof options === 'number' ? {} : options;
  const now = opts.now ?? Date.now();
  // Floor to the start of the clock hour (UTC epoch aligns with the backend's UTC hourStartAt).
  const currentHourStart = histogramEndHour(now, opts.anchor);
  const oldestHourStart = currentHourStart - (HISTOGRAM_HOURS - 1) * HOUR_MS;

  const slots: HourlyExecutionBucket[] = [];
  const indexByHour = new Map<number, number>();
  for (let i = 0; i < HISTOGRAM_HOURS; i++) {
    const hourStart = oldestHourStart + i * HOUR_MS;
    indexByHour.set(hourStart, i);
    slots.push({hourStart, ok: 0, fail: 0});
  }

  for (const bucket of rawBuckets ?? []) {
    if (!bucket?.hourStartAt) continue;
    const hourStart = Math.floor(new Date(bucket.hourStartAt).getTime() / HOUR_MS) * HOUR_MS;
    const idx = indexByHour.get(hourStart);
    if (idx === undefined) continue; // outside the visible 24h window
    slots[idx].ok += bucket.successCount ?? 0;
    slots[idx].fail += bucket.failureCount ?? 0;
  }

  return slots;
}

/** Start of the histogram's last hour: the anchor's hour when it is less than an hour from now, else now's. */
function histogramEndHour(now: number, anchor: HourlyHistogramOptions['anchor']): number {
  const anchorMs = anchor === null || anchor === undefined ? NaN : new Date(anchor).getTime();
  const base = Number.isFinite(anchorMs) && Math.abs(now - anchorMs) < HOUR_MS ? anchorMs : now;
  return Math.floor(base / HOUR_MS) * HOUR_MS;
}

/** The newest `lastUpdatedAt` of several statistics (the anchor of a summed histogram), or null. */
export function latestStatisticsUpdate(statistics: ({ lastUpdatedAt?: string | Date | null } | null | undefined)[]): Date | null {
  let latest: Date | null = null;
  for (const stat of statistics) {
    if (!stat?.lastUpdatedAt) continue;
    const date = new Date(stat.lastUpdatedAt);
    if (Number.isFinite(date.getTime()) && (!latest || date > latest)) {
      latest = date;
    }
  }
  return latest;
}


/** Folded `PipelineStatistics` of one pipeline (AB#4370), as selected by the queries. */
export interface PipelineStatisticsInput {
  lastExecutionAt?: string | Date | null;
  /** When the backend last recomputed the statistics (its windows end with this hour, AB#5583). */
  lastUpdatedAt?: string | Date | null;
  lastHourSuccessCount?: number | null;
  lastHourFailureCount?: number | null;
  last24HoursSuccessCount?: number | null;
  last24HoursFailureCount?: number | null;
  lastHourAvgDurationMs?: number | null;
  last24HoursAvgDurationMs?: number | null;
  hourlyBuckets?: (RawHourBucket | null)[] | null;
}

/** The latest execution of one pipeline. */
export interface LatestExecutionInput {
  startedAt?: string | Date | null;
  status?: string | null;
}

/** One pipeline: its statistics and latest execution, both optional. */
export interface PipelineExecutionInput {
  statistics?: PipelineStatisticsInput | null;
  latestExecution?: LatestExecutionInput | null;
}

/** Execution counts summed over pipelines. */
export interface PipelineExecutionCounts {
  success24h: number;
  failure24h: number;
  success1h: number;
  failure1h: number;
  /** Most recent execution start over all pipelines. */
  latestExecution: Date | null;
  /** False when no pipeline had statistics or an execution. */
  hasData: boolean;
}

/** Child pipeline shape of the data-flow queries (`statisticsForPipeline` / `executedPipeline`). */
interface ChildPipelineShape {
  statisticsForPipeline?: { items?: (PipelineStatisticsInput | null)[] | null } | null;
  executedPipeline?: { items?: (LatestExecutionInput | null)[] | null } | null;
}

/** Reads statistics and latest execution from data-flow child pipelines (non-pipelines yield empty inputs). */
export function pipelineExecutionInputs(children: (unknown | null)[] | null | undefined): PipelineExecutionInput[] {
  return (children ?? []).filter(child => !!child).map(child => {
    const typed = child as ChildPipelineShape;
    return { statistics: typed.statisticsForPipeline?.items?.[0] ?? null, latestExecution: typed.executedPipeline?.items?.[0] ?? null };
  });
}

/**
 * The Data Flows list's execution counting, shared with the cockpit (AB#5545 / AB#5558) so both
 * show the same numbers: the statistics are the baseline, and a latest execution the statistics
 * cannot contain yet is counted in for immediate feedback (COMPLETED → success, FAILED → failure).
 * "Cannot contain yet" = started after the statistics' `lastUpdatedAt` (the backend's totals
 * include every execution it saw at that sweep, AB#5583) and after `lastExecutionAt`; without
 * `lastUpdatedAt` (older backends / queries) only `lastExecutionAt` is compared, as before.
 */
export function countPipelineExecutions(pipelines: PipelineExecutionInput[], now = Date.now()): PipelineExecutionCounts {
  const counts: PipelineExecutionCounts = { success24h: 0, failure24h: 0, success1h: 0, failure1h: 0, latestExecution: null, hasData: false };
  for (const { statistics: stat, latestExecution: latestExec } of pipelines) {
    if (stat) {
      counts.hasData = true;
      counts.success24h += stat.last24HoursSuccessCount ?? 0;
      counts.failure24h += stat.last24HoursFailureCount ?? 0;
      counts.success1h += stat.lastHourSuccessCount ?? 0;
      counts.failure1h += stat.lastHourFailureCount ?? 0;
    }
    if (latestExec?.startedAt) {
      const execDate = new Date(latestExec.startedAt);
      const coveredUntil = statisticsCoverage(stat);
      if (!counts.latestExecution || execDate > counts.latestExecution) {
        counts.latestExecution = execDate;
      }
      if (!coveredUntil || execDate > coveredUntil) {
        counts.hasData = true;
        const withinLastHour = execDate.getTime() > now - HOUR_MS;
        if (latestExec.status === 'COMPLETED') {
          counts.success24h++;
          if (withinLastHour) counts.success1h++;
        } else if (latestExec.status === 'FAILED') {
          counts.failure24h++;
          if (withinLastHour) counts.failure1h++;
        }
      }
    }
  }
  return counts;
}

/** Until when the statistics already count executions: the later of `lastUpdatedAt` and `lastExecutionAt`. */
function statisticsCoverage(stat: PipelineStatisticsInput | null | undefined): Date | null {
  let covered: Date | null = null;
  for (const value of [stat?.lastExecutionAt, stat?.lastUpdatedAt]) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isFinite(date.getTime()) && (!covered || date > covered)) {
      covered = date;
    }
  }
  return covered;
}
