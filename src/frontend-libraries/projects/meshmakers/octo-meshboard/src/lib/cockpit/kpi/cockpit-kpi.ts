import { SystemCommunicationDeploymentStateDto } from '@meshmakers/octo-services';
import { isAdapterExpectedToRun, isAdapterOnline, summarizeAdapterOnline } from '../../utils/adapter-online';
import { buildHourlyHistogram, countPipelineExecutions, HourlyExecutionBucket, latestStatisticsUpdate, pipelineExecutionInputs, RawHourBucket } from '../../utils/pipeline-executions';
import { CockpitLinkTarget } from '../cockpit-host';
import { CockpitAdapterStates } from '../data/cockpit-adapter-states.service';

/** Status of a KPI tile, rendered as a chip (dot + label, never colour alone). */
export type CockpitKpiStatus = 'success' | 'warning' | 'error' | 'neutral';

/** One cockpit KPI (a widget tile, or a tile of the Studio's Home fallback strip). */
export interface CockpitKpi {
  id: string;
  label: string;
  /** Display value, already formatted (tabular numerals). */
  value: string;
  /** Secondary line under the value. */
  detail?: string;
  status: CockpitKpiStatus;
  statusLabel: string;
  /** Page the tile opens (resolved by the host). */
  link?: CockpitLinkTarget;
  /** Hourly values (oldest first) for the sparkline. */
  sparkline?: number[];
  /** Accessible summary of the sparkline, including failures. */
  sparklineLabel?: string;
}

/** A data flow of `cockpitDataFlowExecutions`: its child pipelines with statistics and latest execution. */
export interface CockpitDataFlowRow {
  children?: { items?: (unknown | null)[] | null } | null;
}

/** Counts of `cockpitCkModelStates`. */
export interface CockpitCkModelCounts {
  total: number;
  available: number;
  importing: number;
  resolveFailed: number;
  /** Full names of (the first) models in ResolveFailed. */
  resolveFailedNames: string[];
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');

/** "1,284". */
export function formatCount(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** "based on the first 500 of 620 adapters" when a read was capped, else undefined. */
export function truncationNote(read: number, total: number, noun: string): string | undefined {
  return total > read ? `based on the first ${formatCount(read)} of ${formatCount(total)} ${noun}` : undefined;
}

/**
 * "Adapter status x / y" with the one adapter online rule (`utils/adapter-online.ts`): y counts
 * the adapters expected to run — Helm-deployed, online edge/local ones and registered adapters
 * without a Helm chart — x those online. On-demand adapters at rest are offline on purpose and do
 * not warn.
 */
export function adapterKpi({ states, totalCount }: CockpitAdapterStates): CockpitKpi {
  const summary = summarizeAdapterOnline(states);
  const expected = states.filter(isAdapterExpectedToRun);
  const online = expected.filter(isAdapterOnline);
  const offline = summary.offline;
  const outsideHelm = online.filter(state => state.deploymentState !== SystemCommunicationDeploymentStateDto.DeployedDto);
  const notExpected = states.length - expected.length;
  const truncated = totalCount > states.length;

  const details: string[] = [];
  if (summary.resting > 0) {
    details.push(`${summary.resting} hibernated`);
  }
  if (outsideHelm.length > 0) {
    details.push(`${outsideHelm.length} edge / local`);
  }
  if (notExpected > 0) {
    details.push(`${notExpected} not deployed`);
  }
  if (details.length === 0 && expected.length === 1) {
    details.push(expected[0].name || String(expected[0].rtId));
  }
  const note = truncationNote(states.length, totalCount, 'adapters');
  if (note) {
    details.push(note);
  }

  let status: CockpitKpiStatus;
  let statusLabel: string;
  if (expected.length === 0) {
    status = 'neutral';
    statusLabel = states.length === 0 ? 'No adapters' : 'None deployed';
  } else if (offline > 0) {
    status = 'warning';
    statusLabel = `${truncated ? '≥ ' : ''}${offline} offline`;
  } else {
    status = 'success';
    statusLabel = 'All online';
  }

  return {
    id: 'adapters-online',
    label: 'Adapters online',
    value: `${formatCount(online.length)} / ${truncated ? '≥ ' : ''}${formatCount(expected.length)}`,
    detail: details.join(' · ') || undefined,
    status,
    statusLabel,
    link: { kind: 'adapters' }
  };
}

/**
 * "Pipeline executions 24 h", computed exactly like the Studio's Data Flows list
 * (`countPipelineExecutions` per data flow, the hourly histogram per flow anchored on the newest
 * statistics update, AB#5583), then summed over the flows — so the cockpit and the list agree.
 */
export function executionKpi(flows: CockpitDataFlowRow[], totalCount = flows.length): CockpitKpi {
  let ok = 0;
  let failed = 0;
  const slots: HourlyExecutionBucket[][] = [];
  // One time axis for all flows (the bars are summed per index): the newest statistics update.
  const anchor = latestStatisticsUpdate(flows.flatMap(flow => pipelineExecutionInputs(flow.children?.items).map(input => input.statistics)));
  for (const flow of flows) {
    const inputs = pipelineExecutionInputs(flow.children?.items);
    if (inputs.length === 0) {
      continue;
    }
    const counts = countPipelineExecutions(inputs);
    ok += counts.success24h;
    failed += counts.failure24h;
    const buckets: RawHourBucket[] = [];
    for (const input of inputs) {
      for (const bucket of input.statistics?.hourlyBuckets ?? []) {
        if (bucket) {
          buckets.push(bucket);
        }
      }
    }
    slots.push(buildHourlyHistogram(buckets, { anchor: anchor ?? undefined }));
  }
  const sparkline = slots.length > 0
    ? slots[0].map((_, index) => slots.reduce((sum, flowSlots) => sum + flowSlots[index].ok + flowSlots[index].fail, 0))
    : [];
  const total = ok + failed;
  const peak = Math.max(0, ...sparkline);
  const truncated = totalCount > flows.length;
  const atLeast = truncated ? '≥ ' : '';
  const details = [total === 0 ? 'No executions in the last 24 hours' : `${formatCount(ok)} succeeded`];
  const note = truncationNote(flows.length, totalCount, 'data flows');
  if (note) {
    details.push(note);
  }

  return {
    id: 'pipeline-executions',
    label: 'Pipeline executions 24 h',
    value: `${atLeast}${formatCount(total)}`,
    detail: details.join(' · '),
    status: total === 0 ? 'neutral' : failed > 0 ? 'error' : 'success',
    statusLabel: total === 0 ? 'Idle' : failed > 0 ? `${atLeast}${formatCount(failed)} failed` : 'No failures',
    link: { kind: 'dataFlows' },
    sparkline: peak > 0 ? sparkline : undefined,
    sparklineLabel: peak > 0
      ? `Executions per hour over the last 24 hours, peak ${formatCount(peak)}; ${formatCount(total)} executions, ${formatCount(failed)} failed`
      : undefined
  };
}

/**
 * "CK model state": models available of all installed models. ResolveFailed is an error (the
 * data is intact, but the types are not served), importing is shown as progress.
 */
export function ckModelKpi(counts: CockpitCkModelCounts): CockpitKpi {
  const details: string[] = [];
  if (counts.importing > 0) {
    details.push(`${formatCount(counts.importing)} importing`);
  }
  if (counts.resolveFailed > 0 && counts.resolveFailedNames.length > 0) {
    const shown = counts.resolveFailedNames.slice(0, 2).join(', ');
    const rest = counts.resolveFailed - Math.min(2, counts.resolveFailedNames.length);
    details.push(rest > 0 ? `${shown} and ${rest} more` : shown);
  }
  let status: CockpitKpiStatus;
  let statusLabel: string;
  if (counts.total === 0) {
    status = 'neutral';
    statusLabel = 'No models';
  } else if (counts.resolveFailed > 0) {
    status = 'error';
    statusLabel = `${formatCount(counts.resolveFailed)} ResolveFailed`;
  } else if (counts.importing > 0) {
    status = 'warning';
    statusLabel = 'Importing';
  } else {
    status = 'success';
    statusLabel = 'All available';
  }
  return {
    id: 'ck-model-state',
    label: 'CK models available',
    value: `${formatCount(counts.available)} / ${formatCount(counts.total)}`,
    detail: details.join(' · ') || undefined,
    status,
    statusLabel,
    link: { kind: 'ckModels' }
  };
}

/** SVG paths of a sparkline in a `width` × `height` box (line, filled area, last point). */
export interface SparklineGeometry {
  line: string;
  area: string;
  lastX: number;
  lastY: number;
}

/** Scales the values to the box; the tallest value touches the top padding. */
export function sparklineGeometry(values: number[], width = 120, height = 36, padding = 3): SparklineGeometry | null {
  if (values.length < 2) {
    return null;
  }
  const max = Math.max(...values, 0);
  const step = width / (values.length - 1);
  const usable = height - 2 * padding;
  const points = values.map((value, index) => {
    const x = round(index * step);
    const y = round(max > 0 ? height - padding - (value / max) * usable : height - padding);
    return { x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const last = points[points.length - 1];
  return { line, area: `${line} L${last.x} ${height} L0 ${height} Z`, lastX: last.x, lastY: last.y };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
