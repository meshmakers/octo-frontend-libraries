import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LineChartWidgetComponent, MAX_CONCURRENT_DOWNSAMPLING, MAX_DOWNSAMPLE_POINTS } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartQuerySeries, LineChartWidgetConfig, PersistentQueryDataSource } from '../../models/meshboard.models';

/**
 * AB#8994: a resolution-aware line chart sends at most MAX_CONCURRENT_DOWNSAMPLING transient
 * downsampling requests at a time, caps its point target at MAX_DOWNSAMPLE_POINTS, shows a failed
 * series as a per-series hint and drops the results of a superseded load.
 *
 * Fixture: ten series groups (`g0` … `g9`), one source entity each (`e0` … `e9`).
 */

const GROUPS = Array.from({ length: 10 }, (_, i) => `g${i}`);
const ENTITIES = GROUPS.map((_, i) => `e${i}`);
const BUCKETS = ['2026-11-08T00:00:00Z', '2026-11-09T00:00:00Z'];

interface PendingCall {
  rtIds: string[] | undefined;
  resolve(rows: QueryResultRow[]): void;
  reject(reason: unknown): void;
}

/** Downsampling bins of the given members; the value is the member number + 1 (`e3` → 4). */
function bins(rtIds: string[] | undefined): QueryResultRow[] {
  const members = rtIds ?? ENTITIES;
  const value = members.reduce((sum, rtId) => sum + Number(rtId.slice(1)) + 1, 0);
  return BUCKETS.map(timestamp => ({
    __typename: 'StreamDataTransientQueryRow',
    rtId: members.join(','),
    timestamp: timestamp as unknown as Date,
    cells: [{ attributePath: 'timestamp', value: timestamp }, { attributePath: 'amountvalue_sum', value }]
  }));
}

function config(ds: Partial<PersistentQueryDataSource> = {}, overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
  return {
    id: 'w1', type: 'lineChart', title: 'Load per group', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: {
      type: 'persistentQuery', queryRtId: 'q-load', queryFamily: 'streamData', resolutionAware: true,
      requiredAggregation: 'SUM', aggregateSeriesByGroup: true, ...ds
    },
    chartType: 'line', categoryField: 'window_start', seriesGroupField: 'group', valueField: 'amount.value',
    ...overrides
  };
}

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function setup(cfg: LineChartWidgetConfig, opts: { width?: number; pin?: string[] | null } = {}) {
  const pending: PendingCall[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const qe = {
    execute: vi.fn(() => of({
      family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [],
      rows: [], totalCount: 0, hasNextPage: false, endCursor: null
    })),
    fetchQueryArchive: vi.fn().mockResolvedValue({ archiveRtId: 'archive-raw-15min', ckTypeId: 'System/Entity', rtIds: opts.pin ?? null }),
    resolveSeriesQuery: vi.fn().mockResolvedValue({
      archiveRtId: 'rollup-1h', effectiveBucketMs: 3_600_000, points: 168,
      reducingFunction: 'SUM', signal: null, actualPoints: null, diagnostic: null
    }),
    downsampleByArchive: vi.fn((params: { rtIds?: string[] }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<QueryResultRow[]>((resolve, reject) => {
        pending.push({
          rtIds: params.rtIds,
          resolve: rows => { inFlight--; resolve(rows); },
          reject: reason => { inFlight--; reject(reason); }
        });
      });
    }),
    fetchEntityGroups: vi.fn(async () => new Map(GROUPS.map((g, i) => [g, [ENTITIES[i]]]))),
    fetchSeriesLabels: vi.fn(async (_ck: string, rtIds: string[]) => new Map(rtIds.map(rtId => [rtId, `g${rtId.slice(1)}`])))
  };
  const stateService = {
    resolveStreamDataScope: vi.fn(() => ({ kind: 'unscoped' })),
    resolveStreamDataRtIds: vi.fn(() => undefined),
    resolveStreamDataTimeArgs: vi.fn(() => ({ from: new Date('2026-11-08T00:00:00Z'), to: new Date('2026-11-15T00:00:00Z') })),
    resolveStreamDataTimeZone: vi.fn(() => 'UTC'),
    timeZoneMode: vi.fn(() => 'utc'),
    getVariables: vi.fn(() => [])
  };
  TestBed.configureTestingModule({
    imports: [LineChartWidgetComponent],
    providers: [
      { provide: QueryExecutorService, useValue: qe },
      { provide: MeshBoardStateService, useValue: stateService },
      { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
    ]
  });
  const fixture = TestBed.createComponent(LineChartWidgetComponent);
  if (opts.width !== undefined) {
    Object.defineProperty(fixture.nativeElement, 'offsetWidth', { value: opts.width, configurable: true });
  }
  const cmp = fixture.componentInstance;
  cmp.config = cfg;
  return {
    fixture, cmp, qe, pending,
    maxInFlight: () => maxInFlight,
    inFlight: () => inFlight,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    limit: () => (cmp as unknown as { computeDownsampleLimit(): number }).computeDownsampleLimit(),
    resolutionTarget: () => (cmp as unknown as { resolutionTargetPoints(): number }).resolutionTargetPoints(),
    series: () => Object.fromEntries(cmp.seriesData().map(s => [s.name, s.data]))
  };
}

type Setup = ReturnType<typeof setup>;

/** Answers the pending calls one by one (`answer` decides per call) until the load settles. */
async function drain(s: Setup, load: Promise<void>, answer: (call: PendingCall) => void = c => c.resolve(bins(c.rtIds))): Promise<void> {
  let settled = false;
  void load.then(() => { settled = true; });
  for (let i = 0; i < 100 && !settled; i++) {
    await flush();
    const next = s.pending.shift();
    if (next) answer(next);
  }
  await load;
}

describe('LineChartWidgetComponent downsampling concurrency (AB#8994)', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('the request limit is 3 and the resolver point cap 500', () => {
    expect(MAX_CONCURRENT_DOWNSAMPLING).toBe(3);
    expect(MAX_DOWNSAMPLE_POINTS).toBe(500);
  });

  it('group mode with 10 groups: never more than 3 requests pending, all 10 complete and render', async () => {
    const s = setup(config());
    const load = s.load();
    await flush();
    expect(s.inFlight()).toBe(3);

    await drain(s, load);

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(10);
    expect(s.maxInFlight()).toBe(MAX_CONCURRENT_DOWNSAMPLING);
    expect(Object.keys(s.series()).sort()).toEqual([...GROUPS].sort());
    expect(s.cmp.error()).toBeNull();
    expect(s.cmp.sourceHints()).toEqual([]);
  });

  it('per-rtId mode with 10 sources: never more than 3 requests pending, all 10 complete', async () => {
    const s = setup(config({ aggregateSeriesByGroup: false }), { pin: ENTITIES });

    await drain(s, s.load());

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(10);
    expect(s.maxInFlight()).toBe(MAX_CONCURRENT_DOWNSAMPLING);
    expect(Object.keys(s.series()).sort()).toEqual([...GROUPS].sort());
  });

  it('a rejected request does not stop the queue: one per-series hint, the other 9 series render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const s = setup(config());

    await drain(s, s.load(), call => call.rtIds?.[0] === 'e4'
      ? call.reject(new Error('Request timed out after 30 s'))
      : call.resolve(bins(call.rtIds)));

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(10);
    expect(Object.keys(s.series()).sort()).toEqual(GROUPS.filter(g => g !== 'g4').sort());
    expect(s.cmp.error()).toBeNull();
    expect(s.cmp.sourceHints()).toEqual([{
      kind: 'error', sourceLabel: 'g4', text: 'Could not load g4: timeout', title: 'Request timed out after 30 s'
    }]);
  });

  it('renders the per-series hint with the error detail as its title', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const s = setup(config());

    const answer = (call: PendingCall): void => call.rtIds?.[0] === 'e7'
      ? call.reject(new Error('CrateDB pool exhausted'))
      : call.resolve(bins(call.rtIds));
    // The first detectChanges runs ngAfterViewInit, which starts its own load; the explicit load
    // below supersedes it, so only its result is rendered.
    s.fixture.detectChanges();
    await drain(s, s.load(), answer);
    s.fixture.detectChanges();

    const hint = s.fixture.nativeElement.querySelector('.source-hint.error') as HTMLElement;
    expect(hint.textContent).toContain('Could not load g7: request failed');
    expect(hint.getAttribute('title')).toBe('CrateDB pool exhausted');
  });

  it('shows the widget error only when every series fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const s = setup(config());

    await drain(s, s.load(), call => call.reject(new Error('down')));

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(10);
    expect(s.cmp.error()).toBe('Failed to load data');
  });

  it('a reload while requests are queued drops the old queue and applies only the new results', async () => {
    const s = setup(config());
    const first = s.load();
    await flush();
    expect(s.pending).toHaveLength(3);
    const oldCalls = s.pending.splice(0, s.pending.length);

    // Reload with fewer groups; the 7 queued requests of the first load must never be sent.
    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g0', ['e0']], ['g1', ['e1']]]));
    const second = s.load();
    await flush();
    // The three requests of the first load still occupy every slot.
    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(3);

    // Answer the old in-flight requests with stale data; their slots go to the new load.
    for (const call of oldCalls) call.resolve(bins(['e9']));
    await drain(s, second);
    await first;

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(5);
    expect(s.maxInFlight()).toBe(MAX_CONCURRENT_DOWNSAMPLING);
    expect(Object.keys(s.series()).sort()).toEqual(['g0', 'g1']);
    expect(s.series()['g0']).toEqual([1, 1]);
  });

  it('a superseded load that finishes last does not overwrite the newer result', async () => {
    const s = setup(config());
    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g0', ['e0']]]));
    const first = s.load();
    await flush();
    const oldCall = s.pending.shift()!;

    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g1', ['e1']]]));
    const second = s.load();
    await drain(s, second);
    oldCall.resolve(bins(['e0']));
    await first;

    expect(Object.keys(s.series())).toEqual(['g1']);
  });
});

describe('LineChartWidgetComponent superseded and destroyed loads (AB#8994)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('destroying the widget drops its queued requests: none of them is sent', async () => {
    const s = setup(config());
    const load = s.load();
    await flush();
    expect(s.pending).toHaveLength(3);

    s.fixture.destroy();
    for (const call of s.pending.splice(0)) call.resolve(bins(call.rtIds));
    await load;
    await flush();

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(3);
  });

  it('a load superseded while it was still preparing sends no request', async () => {
    const s = setup(config());
    let releaseGroups!: () => void;
    s.qe.fetchEntityGroups.mockImplementationOnce(() => new Promise(resolve => {
      releaseGroups = () => resolve(new Map(GROUPS.map((g, i) => [g, [ENTITIES[i]]])));
    }));
    const first = s.load();
    await flush();
    expect(s.qe.downsampleByArchive).not.toHaveBeenCalled();

    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g0', ['e0']]]));
    const second = s.load();
    await drain(s, second);
    releaseGroups();
    await first;
    await flush();

    expect(s.qe.downsampleByArchive).toHaveBeenCalledTimes(1);
    expect(Object.keys(s.series())).toEqual(['g0']);
  });

  it('a resize that leaves the capped resolver target unchanged does not reload', async () => {
    const s = setup(config(), { width: 1500 });
    await drain(s, s.load());
    const cmp = s.cmp as unknown as { onResize(): void; resizeTimer?: unknown };

    Object.defineProperty(s.fixture.nativeElement, 'offsetWidth', { value: 1510, configurable: true });
    cmp.onResize();
    expect(cmp.resizeTimer).toBeUndefined();

    Object.defineProperty(s.fixture.nativeElement, 'offsetWidth', { value: 700, configurable: true });
    cmp.onResize();
    expect(cmp.resizeTimer).toBeDefined();
    clearTimeout(cmp.resizeTimer as ReturnType<typeof setTimeout>);
  });

  it('a plain downsampled chart still reloads on a material resize above 1000 px', async () => {
    const s = setup(config({ resolutionAware: false, aggregateSeriesByGroup: false }), { width: 1500 });
    await s.load();
    const cmp = s.cmp as unknown as { onResize(): void; resizeTimer?: unknown };

    Object.defineProperty(s.fixture.nativeElement, 'offsetWidth', { value: 2400, configurable: true });
    cmp.onResize();

    expect(cmp.resizeTimer).toBeDefined();
    clearTimeout(cmp.resizeTimer as ReturnType<typeof setTimeout>);
  });
});

describe('LineChartWidgetComponent point-count cap (AB#8994)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  for (const [width, resolutionAware, plain] of [
    [2400, 500, 1200], [2000, 500, 1000], [1500, 500, 750], [1000, 500, 500], [998, 499, 499], [800, 400, 400], [60, 50, 50]
  ] as const) {
    it(`a ${width} px chart: resolver target ${resolutionAware}, plain downsampling limit ${plain}`, () => {
      const s = setup(config(), { width });
      expect(s.resolutionTarget()).toBe(resolutionAware);
      expect(s.limit()).toBe(plain);
    });
  }

  it('plain downsampling keeps its 4000 limit on very wide charts', () => {
    const s = setup(config(), { width: 10_000 });
    expect(s.limit()).toBe(4000);
    expect(s.resolutionTarget()).toBe(MAX_DOWNSAMPLE_POINTS);
  });

  it('a 7-day window on a 2000 px chart asks the resolver for at most 500 points (hourly rollup)', async () => {
    const s = setup(config(), { width: 2000 });

    await drain(s, s.load());

    const request = s.qe.resolveSeriesQuery.mock.calls[0][0] as { targetPoints: number; from: Date; to: Date };
    expect(request.targetPoints).toBe(500);
    // 7 days of a 15-min raw archive are 672 points; 500 < 672 makes the resolver pick the hourly rollup.
    expect((request.to.getTime() - request.from.getTime()) / (15 * 60_000)).toBe(672);
    expect(request.targetPoints).toBeLessThan(672);
  });

  it('a fixed bucket size keeps its own count on both paths', () => {
    const s = setup(config({}, { bucketMinutes: 15 }), { width: 2000 });
    expect(s.limit()).toBe(672);
    expect(s.resolutionTarget()).toBe(672);
  });

  it('plain stream-data downsampling is not capped at 500', async () => {
    const s = setup(config({ resolutionAware: false, aggregateSeriesByGroup: false }), { width: 2400 });

    await s.load();

    const args = s.qe.execute.mock.calls[0] as unknown as [string, string, { streamDataArgs?: { limit?: number } }];
    expect(args[2].streamDataArgs?.limit).toBe(1200);
    expect(s.qe.resolveSeriesQuery).not.toHaveBeenCalled();
  });
});

describe('LineChartWidgetComponent multi-source primary fan-out (AB#8994)', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('a failed primary group gives a per-series hint; the additional series and the other groups render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extra: LineChartQuerySeries = {
      kind: 'query', key: 'total', label: 'Total', valueField: 'amount.value',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-total', queryFamily: 'streamData', resolutionAware: true, requiredAggregation: 'SUM' }
    };
    const s = setup(config({}, { additionalSeries: [extra] }));
    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g0', ['e0']], ['g1', ['e1']], ['g2', ['e2']], ['g3', ['e3']]]));

    await drain(s, s.load(), call => call.rtIds?.[0] === 'e2'
      ? call.reject(new Error('timeout'))
      : call.resolve(bins(call.rtIds)));

    expect(s.maxInFlight()).toBeLessThanOrEqual(MAX_CONCURRENT_DOWNSAMPLING);
    expect(Object.keys(s.series()).sort()).toEqual(['Total', 'g0', 'g1', 'g3']);
    expect(s.cmp.error()).toBeNull();
    expect(s.cmp.sourceHints()).toEqual([
      { kind: 'error', sourceLabel: 'g2', text: 'Could not load g2: timeout', title: 'timeout' }
    ]);
  });

  it('every source failing puts the widget into its error state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extra: LineChartQuerySeries = {
      kind: 'query', key: 'total', label: 'Total', valueField: 'amount.value',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-total', queryFamily: 'streamData', resolutionAware: true, requiredAggregation: 'SUM' }
    };
    const s = setup(config({}, { additionalSeries: [extra] }));
    s.qe.fetchEntityGroups.mockResolvedValue(new Map([['g0', ['e0']], ['g1', ['e1']]]));

    await drain(s, s.load(), call => call.reject(new Error('down')));

    expect(s.cmp.error()).toBe('Failed to load data');
    expect(s.cmp.sourceHints()).toEqual([]);
  });

  it('the resize check keeps the counts the requests used, even if the width changed during the load', async () => {
    const extra: LineChartQuerySeries = {
      kind: 'query', key: 'total', label: 'Total', valueField: 'amount.value',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-total', queryFamily: 'streamData' }
    };
    const s = setup(config({ resolutionAware: false, aggregateSeriesByGroup: false }, { additionalSeries: [extra] }), { width: 800 });
    const load = s.load();
    // The chart is widened while the queries run.
    Object.defineProperty(s.fixture.nativeElement, 'offsetWidth', { value: 1600, configurable: true });
    await load;
    const cmp = s.cmp as unknown as { onResize(): void; resizeTimer?: unknown };

    const args = s.qe.execute.mock.calls[0] as unknown as [string, string, { streamDataArgs?: { limit?: number } }];
    expect(args[2].streamDataArgs?.limit).toBe(400);
    cmp.onResize();
    expect(cmp.resizeTimer).toBeDefined();
    clearTimeout(cmp.resizeTimer as ReturnType<typeof setTimeout>);
  });
});
