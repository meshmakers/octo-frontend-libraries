import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartFormulaSeries, LineChartQuerySeries, LineChartWidgetConfig } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Formula series in the line chart (AB#7952): the EnergyIQ daily profile. Five hidden operand
 * query series (pv, gridImport, gridExport, batteryCharge, batteryDischarge) on four quarter-hour
 * buckets, formula series consumption (hidden) and pvDirect (stacked), PV of the primary query as a
 * line over the stack.
 */

const FROM = new Date('2026-10-20T10:00:00Z');
const TO = new Date('2026-10-20T11:00:00Z');
const T = ['2026-10-20T10:00:00', '2026-10-20T10:15:00', '2026-10-20T10:30:00', '2026-10-20T10:45:00'];

function dsRow(timestamp: string, value: number | null, column: string, group?: string): QueryResultRow {
  const cells = [{ attributePath: `${column}_avg`, value }];
  if (group) cells.push({ attributePath: 'obiscode_max', value: group as unknown as number });
  return { __typename: 'StreamDataQueryRow', rtId: 'r', timestamp: timestamp as unknown as Date, cells };
}

function rows(values: (number | null)[], column = 'value', group?: string): QueryResultRow[] {
  return values.map((v, i) => dsRow(T[i], v, column, group));
}

function result(r: QueryResultRow[]) {
  return of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows: r, totalCount: r.length, hasNextPage: false, endCursor: null });
}

function query(key: string, extra: Partial<LineChartQuerySeries> = {}): LineChartQuerySeries {
  return {
    kind: 'query', key, valueField: 'value', visible: false,
    dataSource: { type: 'persistentQuery', queryRtId: `q-${key}`, queryName: key, queryFamily: 'streamData' },
    ...extra
  };
}

function formula(key: string, f: string, extra: Partial<LineChartFormulaSeries> = {}): LineChartFormulaSeries {
  return { kind: 'formula', key, formula: f, ...extra };
}

// Operands per bucket (kW). gridImport has a gap in bucket 2.
const PV = [0, 2, 5, 6];
const GRID_IMPORT: (number | null)[] = [3, 1, null, 0];
const GRID_EXPORT = [0, 0, 1.5, 2];
const BATTERY_CHARGE = [0, 0.5, 1, 1.5];
const BATTERY_DISCHARGE = [0.5, 0, 0, 0];

const CONSUMPTION = formula('consumption', '${pv} + ${gridImport} - ${gridExport} - ${batteryCharge} + ${batteryDischarge}', { label: 'Consumption', visible: false });
const PV_DIRECT = formula('pvDirect', 'min(${pv} - ${gridExport} - ${batteryCharge}, ${consumption})', { label: 'PV direct' });

function profileConfig(overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
  return {
    id: 'w1', type: 'lineChart', title: 'Daily profile', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-primary', queryName: 'PV generation', queryFamily: 'streamData' },
    chartType: 'area', categoryField: 'timestamp', seriesGroupField: 'obisCode', valueField: 'power',
    stacked: true,
    primarySeries: { stacked: false },
    additionalSeries: [
      query('pv'), query('gridImport'), query('gridExport'), query('batteryCharge'), query('batteryDischarge'),
      PV_DIRECT, CONSUMPTION,
      formula('battery', '${batteryDischarge}', { label: 'Battery' }),
      formula('grid', '${gridImport}', { label: 'Grid' })
    ],
    ...overrides
  };
}

const ROWS: Record<string, QueryResultRow[] | Error> = {
  'q-primary': rows(PV, 'power', 'PV'),
  'q-pv': rows(PV),
  'q-gridImport': rows(GRID_IMPORT),
  'q-gridExport': rows(GRID_EXPORT),
  'q-batteryCharge': rows(BATTERY_CHARGE),
  'q-batteryDischarge': rows(BATTERY_DISCHARGE)
};

function setup(config: LineChartWidgetConfig, rowsByQuery: Record<string, QueryResultRow[] | Error> = ROWS) {
  const execute = vi.fn((_family: string, queryRtId: string, _options?: { streamDataArgs?: { from?: Date } }) => {
    const r = rowsByQuery[queryRtId];
    return r instanceof Error ? throwError(() => r) : result(r ?? []);
  });
  const timeArgs = { value: { from: FROM, to: TO } as { from: Date; to: Date } | undefined };
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
          resolveStreamDataScope: vi.fn((): StreamDataScope => ({ kind: 'unscoped' })),
          resolveStreamDataRtIds: vi.fn(() => undefined),
          resolveStreamDataTimeArgs: vi.fn(() => timeArgs.value),
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
  return {
    cmp, execute, timeArgs,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    render: async (): Promise<HTMLElement> => {
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.isLoading()).toBe(false));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }
  };
}

function seriesByName(cmp: LineChartWidgetComponent, name: string) {
  return cmp.seriesData().find(s => s.name === name);
}

describe('LineChartWidgetComponent formula series (AB#7952)', () => {
  it('evaluates every bucket from the operands of the same bucket; hidden operands are absent from the chart', async () => {
    const s = setup(profileConfig());
    await s.load();

    expect(s.cmp.categories().length).toBe(4);
    // Stacked series first in configured order, the non-stacked primary PV line last (drawn on top).
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['PV direct', 'Battery', 'Grid', 'PV']);

    const pvDirect = seriesByName(s.cmp, 'PV direct')!.data;
    for (let i = 0; i < 4; i++) {
      if (GRID_IMPORT[i] === null) {
        expect(pvDirect[i]).toBeNull();
        continue;
      }
      const consumption = PV[i] + (GRID_IMPORT[i] as number) - GRID_EXPORT[i] - BATTERY_CHARGE[i] + BATTERY_DISCHARGE[i];
      expect(pvDirect[i]).toBeCloseTo(Math.min(PV[i] - GRID_EXPORT[i] - BATTERY_CHARGE[i], consumption), 10);
    }
    expect(pvDirect).toEqual([0, 1.5, null, 2.5]);
    expect(seriesByName(s.cmp, 'Grid')!.data).toEqual([3, 1, null, 0]);
    expect(seriesByName(s.cmp, 'Battery')!.data).toEqual([0.5, 0, 0, 0]);
  });

  it('stacked area: formula series stack, a series with stacked=false is drawn as a line over the stack', async () => {
    const s = setup(profileConfig());
    await s.load();

    expect(s.cmp.missingValues()).toBe('gap');
    expect(s.cmp.seriesData().map(x => ({ name: x.name, stacked: x.stacked, asLine: x.asLine }))).toEqual([
      { name: 'PV direct', stacked: true, asLine: false },
      { name: 'Battery', stacked: true, asLine: false },
      { name: 'Grid', stacked: true, asLine: false },
      { name: 'PV', stacked: false, asLine: true }
    ]);
  });

  it('a line chart ignores per-series stacking', async () => {
    const s = setup(profileConfig({ chartType: 'line' }));
    await s.load();
    expect(s.cmp.seriesData().every(x => x.stacked === false && x.asLine === false)).toBe(true);
  });

  it('a gap shows "–" in the tooltip rows', async () => {
    const s = setup(profileConfig());
    await s.load();

    const rowsAtGap = s.cmp.tooltipRows(s.cmp.categories()[2]);
    expect(rowsAtGap.find(r => r.name === 'PV direct')?.text).toBe('–');
    expect(rowsAtGap.find(r => r.name === 'PV')?.text).toBe('5');
  });

  it('a failed operand source: the formula series says it depends on that source instead of disappearing', async () => {
    const s = setup(profileConfig(), { ...ROWS, 'q-gridExport': new Error('timeout') });
    await s.load();

    const texts = s.cmp.sourceHints().map(h => h.text);
    expect(texts).toContain('gridExport: Failed to load data (timeout)');
    expect(texts).toContain('PV direct: depends on gridExport, which failed');
    // Grid and Battery do not use gridExport.
    expect(texts.some(t => t.startsWith('Grid:') || t.startsWith('Battery:'))).toBe(false);
    // Hidden consumption depends on it too, but a hidden series gets no hint (pvDirect reports it through consumption).
    expect(texts.some(t => t.startsWith('Consumption:'))).toBe(false);
    // The series stays in the legend, with the "no data" hint.
    expect(s.cmp.seriesData().map(x => x.name)).toContain('PV direct (no data)');

    const el = await s.render();
    const rendered = Array.from(el.querySelectorAll('.source-hint')).map(h => h.textContent?.trim());
    expect(rendered).toContain('⚠ PV direct: depends on gridExport, which failed');
  });

  it('a formula series without any valid bucket keeps its legend entry with "(no data)"', async () => {
    const s = setup(profileConfig({ additionalSeries: [query('a'), formula('ratio', '${a} / 0', { label: 'Ratio' })] }), {
      'q-primary': rows(PV, 'power', 'PV'), 'q-a': rows([1, 2, 3, 4])
    });
    await s.load();
    expect(seriesByName(s.cmp, 'Ratio (no data)')?.data).toEqual([null, null, null, null]);
  });

  it('formula series follow the time filter without an extra query', async () => {
    const s = setup(profileConfig());
    await s.load();
    const queriesPerLoad = s.execute.mock.calls.length;
    expect(queriesPerLoad).toBe(6); // primary + five operands; formulas send nothing

    s.timeArgs.value = { from: new Date('2026-10-21T10:00:00Z'), to: new Date('2026-10-21T11:00:00Z') };
    await s.load();
    expect(s.execute.mock.calls.length).toBe(2 * queriesPerLoad);
    expect(s.execute.mock.calls.at(-1)?.[2]?.streamDataArgs?.from).toEqual(new Date('2026-10-21T10:00:00Z'));
  });

  it('a hidden primary series is left out of chart and legend', async () => {
    const s = setup(profileConfig({ primarySeries: { visible: false } }));
    await s.load();
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['PV direct', 'Battery', 'Grid']);
  });

  it('a chart with only formula series over query series takes the multi-source path', () => {
    const s = setup(profileConfig({ additionalSeries: [formula('x', '${pv}')] }));
    expect(s.cmp.hasAdditionalSeries()).toBe(true);
  });
});
