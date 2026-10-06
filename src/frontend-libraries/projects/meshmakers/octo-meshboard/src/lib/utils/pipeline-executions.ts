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

/**
 * Builds 24 contiguous hourly slots ending at the current clock hour from a flat
 * list of raw server buckets. Sparse backend buckets (only hours with executions
 * are stored) are gap-filled with zeros so the sparkline renders a continuous
 * time axis. Buckets outside the visible 24h window are ignored.
 *
 * The current hour is seeded from the live 1h counts when its bucket is still
 * empty — i.e. those executions haven't been folded server-side yet (fold
 * threshold ~1h) — so a just-ran pipeline shows a recent bar instead of an
 * empty state, without double-counting once the fold catches up.
 */
export function buildHourlyHistogram(
  rawBuckets: (RawHourBucket | null)[] | null | undefined,
  seedCurrentHourOk = 0,
  seedCurrentHourFail = 0
): HourlyExecutionBucket[] {
  // Floor "now" to the start of the current clock hour (UTC epoch aligns with
  // the backend's UTC hourStartAt boundaries).
  const currentHourStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
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

  const current = slots[slots.length - 1];
  if (current && current.ok === 0 && current.fail === 0) {
    current.ok = seedCurrentHourOk;
    current.fail = seedCurrentHourFail;
  }

  return slots;
}


/** Folded `PipelineStatistics` of one pipeline (AB#4370), as selected by the queries. */
export interface PipelineStatisticsInput {
  lastExecutionAt?: string | Date | null;
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
 * show the same numbers: the folded statistics are the baseline, and a latest
 * execution newer than the statistics' `lastExecutionAt` is counted in for
 * immediate feedback (COMPLETED → success, FAILED → failure).
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
      const statsLastExecAt = stat?.lastExecutionAt ? new Date(stat.lastExecutionAt) : null;
      if (!counts.latestExecution || execDate > counts.latestExecution) {
        counts.latestExecution = execDate;
      }
      if (!statsLastExecAt || execDate > statsLastExecAt) {
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
