import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartQuerySeries, LineChartWidgetConfig, PersistentQueryDataSource } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';
import { withoutExcludedSeriesGroups } from './line-chart-multi-source';

/**
 * Excluded series group values (AB#8128). Fixture: an energy community whose grid operator delivers
 * G.03R ("Eigendeckung", second copy) next to G.03 with identical values, plus G.01 and G.02.
 * Each OBIS code has one source entity (metering point register).
 */

const G01 = '1-1:1.9.0 G.01';
const G02 = '1-1:2.9.0 G.02';
const G03 = '1-1:2.9.0 G.03';
const G03R = '1-1:2.9.0 G.03R';
/** G.03R as a board author might type it: other case, a leading blank. Neither is the stored value. */
const G03R_MISSPELT = ['1-1:2.9.0 g.03r', ` ${G03R}`];

const ENTITY_OF: Record<string, string> = { [G01]: 'mp-g01', [G02]: 'mp-g02', [G03]: 'mp-g03', [G03R]: 'mp-g03r' };
const GROUP_OF: Record<string, string> = Object.fromEntries(Object.entries(ENTITY_OF).map(([g, e]) => [e, g]));

/** Bucket values per source entity (kWh per bucket); G.03R carries the same values as G.03. */
const VALUES: Record<string, number[]> = {
  'mp-g01': [12.5, 14.25, 9.75],
  'mp-g02': [3.5, 2.25, 4],
  'mp-g03': [8.75, 11.5, 6.25],
  'mp-g03r': [8.75, 11.5, 6.25]
};
const BUCKETS = ['2026-10-14T00:00:00Z', '2026-10-15T00:00:00Z', '2026-10-16T00:00:00Z'];

/** Day window on the raw archive, month and year windows on the hourly / daily rollups. */
const WINDOWS = [
  { name: 'day (raw archive)', from: '2026-10-15T00:00:00Z', to: '2026-10-16T00:00:00Z', archive: 'archive-raw' },
  { name: 'month (hourly rollup)', from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', archive: 'rollup-1h' },
  { name: 'year (daily rollup)', from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z', archive: 'rollup-1d' }
];

/** The transient downsampling answer: the bins of the summed members of `rtIds` (the server reduces over the group). */
function downsampledBins(rtIds: string[] | undefined): QueryResultRow[] {
  const members = rtIds ?? Object.keys(VALUES);
  return BUCKETS.map((timestamp, i) => ({
    __typename: 'StreamDataTransientQueryRow',
    rtId: members.join(','),
    timestamp: timestamp as unknown as Date,
    cells: [
      { attributePath: 'timestamp', value: timestamp },
      { attributePath: 'amountvalue_sum', value: members.reduce((sum, rtId) => sum + VALUES[rtId][i], 0) }
    ]
  }));
}

function config(ds: Partial<PersistentQueryDataSource>, overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
  return {
    id: 'w1', type: 'lineChart', title: 'Energy over time', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-energy', queryFamily: 'streamData', resolutionAware: true, requiredAggregation: 'SUM', ...ds },
    chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value',
    ...overrides
  };
}

interface Setup {
  cmp: LineChartWidgetComponent;
  qe: {
    downsampleByArchive: ReturnType<typeof vi.fn>;
    fetchEntityGroups: ReturnType<typeof vi.fn>;
    fetchQueryArchive: ReturnType<typeof vi.fn>;
  };
  load(): Promise<void>;
  /** Downsampled scopes in call order (sorted for comparison). */
  scopes(): (string[] | undefined)[];
  /** Series as drawn: name → values. */
  series(): Record<string, (number | null)[]>;
}

function setup(
  cfg: LineChartWidgetConfig,
  opts: {
    window?: typeof WINDOWS[number]; scope?: StreamDataScope; pin?: string[] | null; plainRows?: QueryResultRow[];
    /** Rows per persistent query rtId; queries not listed answer with `plainRows`. */
    rowsByQuery?: Record<string, QueryResultRow[]>;
  } = {}
): Setup {
  const window = opts.window ?? WINDOWS[0];
  const scope = opts.scope ?? { kind: 'unscoped' };
  const qe = {
    execute: vi.fn((_family: string, queryRtId: string) => {
      const rows = opts.rowsByQuery?.[queryRtId] ?? opts.plainRows ?? [];
      return of({
        family: 'streamData' as const, queryRtId, associatedCkTypeId: null, columns: [],
        rows, totalCount: rows.length, hasNextPage: false, endCursor: null
      });
    }),
    fetchQueryArchive: vi.fn().mockResolvedValue({ archiveRtId: 'archive-raw', ckTypeId: 'Basic.Energy/EnergyMeasurement', rtIds: opts.pin ?? null }),
    resolveSeriesQuery: vi.fn().mockResolvedValue({
      archiveRtId: window.archive, effectiveBucketMs: 86400000, points: 3,
      reducingFunction: 'SUM', signal: null, actualPoints: null, diagnostic: null
    }),
    downsampleByArchive: vi.fn(async (params: { rtIds?: string[] }) => downsampledBins(params.rtIds)),
    fetchEntityGroups: vi.fn(async (_ck: string, _field: string, restrict?: string[]) => {
      const groups = new Map<string, string[]>();
      for (const [group, rtId] of Object.entries(ENTITY_OF)) {
        if (!restrict || restrict.includes(rtId)) groups.set(group, [rtId]);
      }
      return groups;
    }),
    fetchSeriesLabels: vi.fn(async (_ck: string, rtIds: string[]) => new Map(rtIds.map(rtId => [rtId, GROUP_OF[rtId]])))
  };
  const stateService = {
    resolveStreamDataScope: vi.fn(() => scope),
    resolveStreamDataRtIds: vi.fn(() => scope.kind === 'scoped' ? scope.rtIds : undefined),
    resolveStreamDataTimeArgs: vi.fn(() => ({ from: new Date(window.from), to: new Date(window.to) })),
    resolveStreamDataTimeZone: vi.fn(() => 'Europe/Vienna'),
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
  const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
  cmp.config = cfg;
  return {
    cmp, qe,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    scopes: () => qe.downsampleByArchive.mock.calls.map(([p]) => (p as { rtIds?: string[] }).rtIds),
    series: () => Object.fromEntries(cmp.seriesData().map(s => [s.name, s.data]))
  };
}

async function loaded(cfg: LineChartWidgetConfig, opts: Parameters<typeof setup>[1] = {}): Promise<Setup> {
  const s = setup(cfg, opts);
  await s.load();
  return s;
}

describe('LineChartWidgetComponent excluded series group values (AB#8128)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('entity groups (aggregateSeriesByGroup)', () => {
    for (const window of WINDOWS) {
      it(`${window.name}: sends no downsampling call for G.03R, drops it from chart and legend, keeps every other series`, async () => {
        const before = await loaded(config({ aggregateSeriesByGroup: true }), { window });
        expect(Object.keys(before.series()).sort()).toEqual([G01, G02, G03, G03R]);
        const expected = before.series();
        TestBed.resetTestingModule();

        const s = await loaded(config({ aggregateSeriesByGroup: true }, { excludedSeriesGroupValues: [G03R] }), { window });

        expect(s.scopes()).not.toContainEqual(['mp-g03r']);
        expect(s.scopes()).toHaveLength(3);
        expect(s.series()).toEqual({ [G01]: expected[G01], [G02]: expected[G02], [G03]: expected[G03] });
        expect(s.cmp.error()).toBeNull();
      });
    }

    it('shows the no-data state, without any downsampling call, when every group is excluded', async () => {
      const s = await loaded(config({ aggregateSeriesByGroup: true }, { excludedSeriesGroupValues: [G01, G02, G03, G03R] }));

      expect(s.qe.downsampleByArchive).not.toHaveBeenCalled();
      expect(s.cmp.seriesData()).toEqual([]);
      expect(s.cmp.error()).toBeNull();
    });

    it('keeps the merged fallback when no group resolves at all: the exclusion matches nothing', async () => {
      const s = setup(config({ aggregateSeriesByGroup: true }, { excludedSeriesGroupValues: [G03R] }));
      s.qe.fetchEntityGroups.mockResolvedValue(new Map());

      await s.load();

      expect(s.scopes()).toEqual([undefined]);
    });

    it('keeps the merged fallback for charts without the key', async () => {
      const s = setup(config({ aggregateSeriesByGroup: true }));
      s.qe.fetchEntityGroups.mockResolvedValue(new Map());

      await s.load();

      expect(s.scopes()).toEqual([undefined]);
    });

    it('changes nothing for an excluded value that does not occur', async () => {
      const without = await loaded(config({ aggregateSeriesByGroup: true }));
      const expectedScopes = without.scopes();
      const expectedSeries = without.series();
      TestBed.resetTestingModule();

      const s = await loaded(config({ aggregateSeriesByGroup: true }, { excludedSeriesGroupValues: ['1-1:9.9.9 G.99'] }));

      expect(s.scopes()).toEqual(expectedScopes);
      expect(s.series()).toEqual(expectedSeries);
    });

    it('matches exactly on the stored value: other case or surrounding blanks exclude nothing', async () => {
      const s = await loaded(config({ aggregateSeriesByGroup: true }, { excludedSeriesGroupValues: G03R_MISSPELT }));

      expect(Object.keys(s.series()).sort()).toEqual([G01, G02, G03, G03R]);
    });

    it('applies the entity-selector scope to the remaining groups', async () => {
      const s = await loaded(
        config({ aggregateSeriesByGroup: true, entitySelectorId: 'meter' }, { excludedSeriesGroupValues: [G03R] }),
        { scope: { kind: 'scoped', rtIds: ['mp-g03', 'mp-g03r'] } }
      );

      expect(s.qe.fetchEntityGroups.mock.calls[0][2]).toEqual(['mp-g03', 'mp-g03r']);
      expect(s.scopes()).toEqual([['mp-g03']]);
      expect(Object.keys(s.series())).toEqual([G03]);
    });
  });

  describe('per-source fan-out (default resolution-aware)', () => {
    it('does not downsample a scoped source whose label is excluded; the other lines are unchanged', async () => {
      const pin = ['mp-g01', 'mp-g03', 'mp-g03r'];
      const before = await loaded(config({}), { pin });
      const expected = before.series();
      TestBed.resetTestingModule();

      const s = await loaded(config({}, { excludedSeriesGroupValues: [G03R] }), { pin });

      expect(s.scopes()).toEqual([['mp-g01'], ['mp-g03']]);
      expect(s.series()).toEqual({ [G01]: expected[G01], [G03]: expected[G03] });
    });

    it('without a scope: the merged series covers only the entities of the other values', async () => {
      const s = await loaded(config({}, { excludedSeriesGroupValues: [G03R] }));

      expect(s.scopes()).toHaveLength(1);
      expect([...s.scopes()[0]!].sort()).toEqual(['mp-g01', 'mp-g02', 'mp-g03']);
      expect(s.series()).toEqual({ obisCode: [24.75, 28, 20] });
    });

    it('without a scope and an excluded value that does not occur: one merged call over the whole archive', async () => {
      const s = await loaded(config({}, { excludedSeriesGroupValues: ['1-1:9.9.9 G.99'] }));

      expect(s.scopes()).toEqual([undefined]);
    });

    it('without a scope and no group resolved: one merged call over the whole archive', async () => {
      const s = setup(config({}, { excludedSeriesGroupValues: [G03R] }));
      s.qe.fetchEntityGroups.mockResolvedValue(new Map());

      await s.load();

      expect(s.scopes()).toEqual([undefined]);
    });

    it('without a scope and every value excluded: no downsampling call, no data', async () => {
      const s = await loaded(config({}, { excludedSeriesGroupValues: [G01, G02, G03, G03R] }));

      expect(s.qe.downsampleByArchive).not.toHaveBeenCalled();
      expect(s.cmp.seriesData()).toEqual([]);
    });

    it('scoped: other case or surrounding blanks exclude nothing, the G.03R source is still drawn', async () => {
      const pin = ['mp-g01', 'mp-g03', 'mp-g03r'];
      const s = await loaded(config({}, { excludedSeriesGroupValues: G03R_MISSPELT }), { pin });

      expect(s.scopes()).toEqual([['mp-g01'], ['mp-g03'], ['mp-g03r']]);
      expect(Object.keys(s.series()).sort()).toEqual([G01, G03, G03R]);
    });

    it('without a scope: other case or surrounding blanks exclude nothing, one merged call over the whole archive', async () => {
      const s = await loaded(config({}, { excludedSeriesGroupValues: G03R_MISSPELT }));

      expect(s.scopes()).toEqual([undefined]);
      expect(s.series()).toEqual({ obisCode: [33.5, 39.5, 26.25] });
    });

    it('an archive without a CK type cannot be grouped: one merged call over the whole archive, the exclusion is ignored', async () => {
      const s = setup(config({}, { excludedSeriesGroupValues: [G03R] }));
      s.qe.fetchQueryArchive.mockResolvedValue({ archiveRtId: 'archive-raw', ckTypeId: null, rtIds: null });

      await s.load();

      expect(s.scopes()).toEqual([undefined]);
      expect(s.qe.fetchEntityGroups).not.toHaveBeenCalled();
      expect(s.series()).toEqual({ obisCode: [33.5, 39.5, 26.25] });
    });

    it('without the key queries exactly as before: one merged call over the whole archive, no entity read', async () => {
      const s = await loaded(config({}));

      expect(s.scopes()).toEqual([undefined]);
      expect(s.qe.fetchEntityGroups).not.toHaveBeenCalled();
    });
  });

  describe('plain grouping (not resolution-aware)', () => {
    const rawRow = (windowStart: string, obis: string, value: number): QueryResultRow => ({
      __typename: 'StreamDataQueryRow', rtId: ENTITY_OF[obis], timestamp: windowStart as unknown as Date,
      cells: [
        { attributePath: 'window_start', value: windowStart },
        { attributePath: 'obisCode', value: obis },
        { attributePath: 'amount.value', value }
      ]
    });
    const rows = [G01, G03, G03R].flatMap(obis =>
      BUCKETS.map((b, i) => rawRow(b, obis, VALUES[ENTITY_OF[obis]][i])));
    const plain = (overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig =>
      config({ resolutionAware: false, requiredAggregation: undefined }, overrides);

    it('drops the rows of an excluded value before grouping: no legend entry, other series unchanged', async () => {
      const before = await loaded(plain(), { plainRows: rows });
      const expected = before.series();
      TestBed.resetTestingModule();

      const s = await loaded(plain({ excludedSeriesGroupValues: [G03R] }), { plainRows: rows });

      expect(s.series()).toEqual({ [G01]: expected[G01], [G03]: expected[G03] });
    });

    it('matches exactly on the stored value: other case or surrounding blanks exclude nothing', async () => {
      const s = await loaded(plain({ excludedSeriesGroupValues: G03R_MISSPELT }), { plainRows: rows });

      expect(Object.keys(s.series()).sort()).toEqual([G01, G03, G03R]);
    });

    it('all values excluded: the normal no-data state', async () => {
      const s = await loaded(plain({ excludedSeriesGroupValues: [G01, G03, G03R] }), { plainRows: rows });

      expect(s.cmp.seriesData()).toEqual([]);
      expect(s.cmp.error()).toBeNull();
    });

    it('in a chart with additional series: excluded from the primary query only, the additional series is untouched', async () => {
      const extra: LineChartQuerySeries = {
        kind: 'query', key: 'pv', label: 'PV', valueField: 'amount.value',
        dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData' }
      };
      // The PV query has its own rows; per bucket one of them carries the excluded group value.
      const pvRows = BUCKETS.flatMap((b, i) => [rawRow(b, G03R, i + 1), rawRow(b, G01, 10 * (i + 1))]);

      const s = await loaded(
        plain({ additionalSeries: [extra], excludedSeriesGroupValues: [G03R] }),
        { rowsByQuery: { 'q-energy': rows, 'q-pv': pvRows } }
      );

      expect(s.series()).toEqual({ [G01]: VALUES['mp-g01'], [G03]: VALUES['mp-g03'], PV: [11, 22, 33] });
    });
  });
});

describe('withoutExcludedSeriesGroups (AB#8128)', () => {
  it('reads the value from the cell, or from the stream-data row property', () => {
    const byCell: QueryResultRow = { __typename: 'StreamDataQueryRow', rtId: 'mp-g03r', cells: [{ attributePath: 'obisCode', value: G03R }] };
    const byRtId: QueryResultRow = { __typename: 'StreamDataQueryRow', rtId: 'mp-g03r', cells: [] };

    expect(withoutExcludedSeriesGroups([byCell], 'obisCode', new Set([G03R]))).toEqual([]);
    expect(withoutExcludedSeriesGroups([byRtId], 'rtId', new Set(['mp-g03r']))).toEqual([]);
    expect(withoutExcludedSeriesGroups([byRtId], 'rtId', new Set(['mp-g03']))).toEqual([byRtId]);
  });
});
