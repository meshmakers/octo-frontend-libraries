import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartFormulaSeries, LineChartQuerySeries, LineChartWidgetConfig } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Per-series options of the line chart (AB#8046) on the EnergyIQ day profile (AB#7944):
 * missing values as 0 (Fusch has no battery) or carried forward (on-change signals), the fixed
 * bucket size, colour / line style, and no chart-level hints for hidden series.
 */

const FROM = new Date('2026-10-20T10:00:00Z');
const TO = new Date('2026-10-20T11:00:00Z');
const BUCKETS = ['2026-10-20T10:00:00', '2026-10-20T10:15:00', '2026-10-20T10:30:00', '2026-10-20T10:45:00'];

function dsRow(timestamp: string, value: number | null, column = 'value', group?: string): QueryResultRow {
  const cells = [{ attributePath: `${column}_avg`, value }];
  if (group) cells.push({ attributePath: 'obiscode_max', value: group as unknown as number });
  return { __typename: 'StreamDataQueryRow', rtId: 'r', timestamp: timestamp as unknown as Date, cells };
}

function rows(values: (number | null)[], column = 'value', group?: string): QueryResultRow[] {
  return values.map((v, i) => dsRow(BUCKETS[i], v, column, group)).filter((_, i) => values[i] !== undefined);
}

function result(r: QueryResultRow[]) {
  return of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows: r, totalCount: r.length, hasNextPage: false, endCursor: null });
}

function query(key: string, extra: Partial<LineChartQuerySeries> = {}): LineChartQuerySeries {
  return {
    kind: 'query', key, valueField: 'value', visible: false,
    dataSource: { type: 'persistentQuery', queryRtId: `q-${key}`, queryName: key, queryFamily: 'streamData', entitySelectorId: key },
    ...extra
  };
}

function formula(key: string, f: string, extra: Partial<LineChartFormulaSeries> = {}): LineChartFormulaSeries {
  return { kind: 'formula', key, formula: f, ...extra };
}

/** The AB#7944 board: balance formulas, primary hidden. */
function profile(overrides: Partial<LineChartWidgetConfig> = {}, operands: Partial<Record<string, Partial<LineChartQuerySeries>>> = {}): LineChartWidgetConfig {
  return {
    id: 'w1', type: 'lineChart', title: 'Tagesprofil', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-primary', queryName: 'Netz', queryFamily: 'streamData', entitySelectorId: 'netz' },
    chartType: 'area', categoryField: 'timestamp', seriesGroupField: 'obisCode', valueField: 'power',
    stacked: true,
    primarySeries: { visible: false },
    additionalSeries: [
      query('pv', operands['pv']), query('import', operands['import']), query('export', operands['export']),
      query('charge', operands['charge']), query('discharge', operands['discharge']),
      formula('pvDirect', 'max(0, ${pv} - ${export} - ${charge})', { label: 'direkt aus PV' }),
      formula('battery', '${discharge}', { label: 'aus Batterie' }),
      formula('grid', '${import}', { label: 'aus Netz' }),
      formula('consumption', '${import} - ${export} + ${pv} + ${discharge} - ${charge}', { label: 'Verbrauch', visible: false }),
      formula('pvLine', '${pv}', { label: 'PV-Erzeugung', stacked: false, color: '#8A5300', dashType: 'dash' })
    ],
    ...overrides
  };
}

const PV = [2, 4, 5, 3];
const IMPORT = [1, 0, 0, 0.5];
const EXPORT = [0, 1, 2, 0];

interface SetupOptions {
  rows?: Record<string, QueryResultRow[] | Error>;
  emptyScopes?: string[];
  window?: { from: Date; to: Date };
  /** Rows a look-back request (to = window start) of a query returns. */
  lookback?: Record<string, QueryResultRow[]>;
}

function setup(config: LineChartWidgetConfig, options: SetupOptions = {}) {
  const rowsByQuery: Record<string, QueryResultRow[] | Error> = options.rows ?? {
    'q-primary': rows(IMPORT, 'power', 'Import'),
    'q-pv': rows(PV), 'q-import': rows(IMPORT), 'q-export': rows(EXPORT)
  };
  const window = options.window ?? { from: FROM, to: TO };
  const execute = vi.fn((_family: string, queryRtId: string, opts?: { streamDataArgs?: StreamDataExecutionArgs }) => {
    const args = opts?.streamDataArgs;
    if (args?.to && args.from && args.to.getTime() <= FROM.getTime()) return result(options.lookback?.[queryRtId] ?? []);
    const r = rowsByQuery[queryRtId];
    return r instanceof Error ? throwError(() => r) : result(r ?? []);
  });
  const empty = new Set(options.emptyScopes ?? []);
  TestBed.configureTestingModule({
    imports: [LineChartWidgetComponent],
    providers: [
      {
        provide: QueryExecutorService,
        useValue: { execute, downsampleByArchive: vi.fn(), resolveSeriesQuery: vi.fn(), fetchQueryArchive: vi.fn() }
      },
      {
        provide: MeshBoardStateService,
        useValue: {
          resolveStreamDataScope: vi.fn((id?: string): StreamDataScope =>
            (id && empty.has(id) ? { kind: 'empty', reason: 'noTargets' } : { kind: 'unscoped' }) as StreamDataScope),
          resolveStreamDataRtIds: vi.fn(() => undefined),
          resolveStreamDataTimeArgs: vi.fn((ignore?: boolean) => (ignore ? undefined : window)),
          resolveStreamDataTimeZone: vi.fn(() => 'UTC'),
          timeZoneMode: vi.fn(() => 'utc'),
          getVariables: vi.fn(() => [])
        }
      },
      { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
    ]
  });
  const fixture = TestBed.createComponent(LineChartWidgetComponent);
  const cmp = fixture.componentInstance;
  cmp.config = config;
  return { cmp, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
}

function data(cmp: LineChartWidgetComponent, name: string): (number | null)[] | undefined {
  return cmp.seriesData().find(s => s.name === name)?.data;
}

describe('LineChartWidgetComponent series options (AB#8046)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-21T00:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  describe('missing values as 0 (Fusch: no battery)', () => {
    const zero = { missingValues: 'zero' as const };

    it('without the option the battery formulas are gaps everywhere (AB#7952 gap rule)', async () => {
      const s = setup(profile(), { emptyScopes: ['charge', 'discharge'] });
      await s.load();
      expect(data(s.cmp, 'aus Batterie (no data)')).toEqual([null, null, null, null]);
      expect(data(s.cmp, 'direkt aus PV (no data)')).toEqual([null, null, null, null]);
    });

    it('with zero on charge/discharge: battery 0, PV direct defined, and PV direct + battery + grid = consumption', async () => {
      const cfg = profile({}, { charge: zero, discharge: zero });
      cfg.additionalSeries = cfg.additionalSeries!.map(d => (d.key === 'consumption' ? { ...d, visible: true } : d));
      const s = setup(cfg, { emptyScopes: ['charge', 'discharge'] });
      await s.load();

      expect(data(s.cmp, 'aus Batterie')).toEqual([0, 0, 0, 0]);
      const pvDirect = data(s.cmp, 'direkt aus PV')!;
      expect(pvDirect).toEqual([2, 3, 3, 3]);
      const grid = data(s.cmp, 'aus Netz')!;
      const consumption = data(s.cmp, 'Verbrauch')!;
      for (let i = 0; i < 4; i++) expect(pvDirect[i]! + 0 + grid[i]!).toBeCloseTo(consumption[i]!);
      // No "No data" hint for a zero-filled empty source.
      expect(s.cmp.sourceHints()).toEqual([]);
    });

    it('a zero source that fails stays a failure (dependency hint), never zeros', async () => {
      const s = setup(profile({}, { charge: zero, discharge: zero }), {
        rows: { 'q-primary': [], 'q-pv': rows(PV), 'q-import': rows(IMPORT), 'q-export': rows(EXPORT), 'q-discharge': new Error('timeout') },
        emptyScopes: ['charge']
      });
      await s.load();
      expect(data(s.cmp, 'aus Batterie (no data)')).toEqual([null, null, null, null]);
      expect(s.cmp.sourceHints().map(h => h.text)).toContain('aus Batterie: depends on discharge, which failed');
      // The failed source itself is hidden: no chart-level error hint for it (AB#8046).
      expect(s.cmp.sourceHints().some(h => h.kind === 'error')).toBe(false);
    });

    it('fills single missing buckets with 0 for display and as operand', async () => {
      const s = setup(profile({}, { import: zero }), {
        rows: { 'q-primary': [], 'q-pv': rows(PV), 'q-import': rows([1, null, 0, 0.5]), 'q-export': rows(EXPORT) },
        emptyScopes: ['charge', 'discharge']
      });
      await s.load();
      expect(data(s.cmp, 'aus Netz')).toEqual([1, 0, 0, 0.5]);
    });
  });

  describe('missing values carried forward (on-change signals)', () => {
    it('fills a flat period with the last value and seeds the window start from the look-back', async () => {
      // PV writes only on change: 10:15 → 4, then nothing; the last value before the window was 1.
      const cfg = profile({ bucketMinutes: 15 }, { pv: { missingValues: 'carryForward' }, charge: { missingValues: 'zero' }, discharge: { missingValues: 'zero' } });
      const s = setup(cfg, {
        rows: { 'q-primary': [], 'q-pv': [dsRow(BUCKETS[1], 4)], 'q-import': rows(IMPORT), 'q-export': rows([0, 0, 0, 0]) },
        emptyScopes: ['charge', 'discharge'],
        lookback: { 'q-pv': [dsRow('2026-10-20T08:00:00', 3), dsRow('2026-10-20T09:45:00', 1)] }
      });
      await s.load();

      expect(data(s.cmp, 'PV-Erzeugung')).toEqual([1, 4, 4, 4]);
      // One look-back request for the carry-forward series, ending at the window start, same bucket width.
      const lookback = s.execute.mock.calls.filter(c => c[1] === 'q-pv' && c[2]?.streamDataArgs?.to?.getTime() === FROM.getTime());
      expect(lookback.length).toBe(1);
      const args = lookback[0][2]!.streamDataArgs!;
      expect((args.to!.getTime() - args.from!.getTime()) / args.limit!).toBe(15 * 60_000);
      expect(args.from!.toISOString()).toBe('2026-10-19T10:00:00.000Z');
    });

    it('a look-back of 0 sends no look-back request; the start stays a gap until the first value', async () => {
      const s = setup(profile({ bucketMinutes: 15 }, { pv: { missingValues: 'carryForward', carryForwardLookbackMinutes: 0 } }), {
        rows: { 'q-primary': [], 'q-pv': [dsRow(BUCKETS[1], 4)], 'q-import': rows(IMPORT), 'q-export': rows(EXPORT) },
        emptyScopes: ['charge', 'discharge']
      });
      await s.load();
      expect(data(s.cmp, 'PV-Erzeugung')).toEqual([null, 4, 4, 4]);
      expect(s.execute.mock.calls.filter(c => c[1] === 'q-pv').length).toBe(1);
    });

    it('does not fill buckets after now', async () => {
      vi.setSystemTime(new Date('2026-10-20T10:20:00Z'));
      const s = setup(profile({ bucketMinutes: 15 }, { pv: { missingValues: 'carryForward' } }), {
        rows: { 'q-primary': [], 'q-pv': [dsRow(BUCKETS[0], 4)], 'q-import': rows(IMPORT), 'q-export': rows(EXPORT) },
        emptyScopes: ['charge', 'discharge']
      });
      await s.load();
      expect(data(s.cmp, 'PV-Erzeugung')).toEqual([4, 4, null, null]);
    });
  });

  describe('fixed bucket size', () => {
    it('snaps the window to whole buckets and sends limit = number of buckets to every source', async () => {
      const s = setup(profile({ bucketMinutes: 15 }), { window: { from: new Date('2026-10-20T10:07:00Z'), to: new Date('2026-10-20T10:52:00Z') } });
      await s.load();
      const calls = s.execute.mock.calls.filter(c => c[2]?.streamDataArgs?.limit);
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) {
        const a = c[2]!.streamDataArgs!;
        expect(a.from!.toISOString()).toBe('2026-10-20T10:00:00.000Z');
        expect(a.to!.toISOString()).toBe('2026-10-20T11:00:00.000Z');
        expect(a.limit).toBe(4);
      }
      expect(s.cmp.categories().length).toBe(4);
    });

    it('shows every bucket of the window, also those without data of any source', async () => {
      const s = setup(profile({ bucketMinutes: 15 }), {
        rows: { 'q-primary': [], 'q-pv': [dsRow(BUCKETS[1], 4)], 'q-import': [dsRow(BUCKETS[1], 1)], 'q-export': [dsRow(BUCKETS[1], 0)] },
        emptyScopes: ['charge', 'discharge']
      });
      await s.load();
      expect(s.cmp.categories().length).toBe(4);
      expect(data(s.cmp, 'aus Netz')).toEqual([null, 1, null, null]);
    });

    it('applies to a single-query chart too', async () => {
      const cfg: LineChartWidgetConfig = { ...profile({ bucketMinutes: 30 }), additionalSeries: undefined, primarySeries: undefined, stacked: undefined };
      const s = setup(cfg, { window: { from: new Date('2026-10-20T10:07:00Z'), to: new Date('2026-10-20T10:52:00Z') } });
      await s.load();
      const a = s.execute.mock.calls[0][2]!.streamDataArgs!;
      expect(a.from!.toISOString()).toBe('2026-10-20T10:00:00.000Z');
      expect(a.to!.toISOString()).toBe('2026-10-20T11:00:00.000Z');
      expect(a.limit).toBe(2);
    });

    it('without bucketMinutes the bucket count follows the chart width (unchanged)', async () => {
      const s = setup(profile());
      await s.load();
      const a = s.execute.mock.calls[0][2]!.streamDataArgs!;
      expect(a.from).toBe(FROM);
      expect(a.limit).toBe(750); // no measured width in jsdom → 1500 px / 2
    });
  });

  describe('style and hints', () => {
    it('applies colour and line style; other series keep the palette', async () => {
      const s = setup(profile({}, { charge: { missingValues: 'zero' }, discharge: { missingValues: 'zero' } }), { emptyScopes: ['charge', 'discharge'] });
      await s.load();
      const pvLine = s.cmp.seriesData().find(x => x.name === 'PV-Erzeugung')!;
      expect(pvLine.color).toBe('#8A5300');
      expect(pvLine.dashType).toBe('dash');
      expect(pvLine.asLine).toBe(true);
      const grid = s.cmp.seriesData().find(x => x.name === 'aus Netz')!;
      expect(grid.color).toMatch(/^#/);
      expect(grid.dashType).toBeUndefined();
    });

    it('a hidden primary series with an empty scope shows no "No data" hint', async () => {
      const s = setup(profile({}, { charge: { missingValues: 'zero' }, discharge: { missingValues: 'zero' } }), { emptyScopes: ['netz', 'charge', 'discharge'] });
      await s.load();
      expect(s.cmp.sourceHints()).toEqual([]);
    });

    it('a visible primary series with an empty scope still shows its hint (unchanged)', async () => {
      const s = setup(profile({ primarySeries: undefined }, { charge: { missingValues: 'zero' }, discharge: { missingValues: 'zero' } }), { emptyScopes: ['netz', 'charge', 'discharge'] });
      await s.load();
      expect(s.cmp.sourceHints().map(h => h.text)).toEqual(['No data for Netz']);
    });
  });
});
