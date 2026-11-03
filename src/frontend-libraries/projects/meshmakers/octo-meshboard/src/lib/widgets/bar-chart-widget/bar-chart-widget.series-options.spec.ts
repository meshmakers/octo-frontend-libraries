import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChartComponent } from '@progress/kendo-angular-charts';
import { of } from 'rxjs';
import { BarChartWidgetComponent } from './bar-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { BarChartType, BarChartWidgetConfig, LineChartFormulaSeries, LineChartQuerySeries } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Per-series options of the bar chart (AB#8046): grid import drawn as a line over the daily bars
 * (Energiebilanz wireframe, AB#7945), on a second axis, with colour and line style; missing values
 * as 0 / carried forward per category; no chart-level hints for hidden sources.
 */

const D = ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'];

function sdRow(timestamp: string, value: number | null): QueryResultRow {
  return { __typename: 'StreamDataQueryRow', timestamp: timestamp as unknown as Date, cells: [{ attributePath: 'energy', value }] };
}

function result(rows: QueryResultRow[]) {
  return of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null });
}

function query(key: string, extra: Partial<LineChartQuerySeries> = {}): LineChartQuerySeries {
  return {
    kind: 'query', key, label: key, valueField: 'energy', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: `q-${key}`, queryName: key, queryFamily: 'streamData', entitySelectorId: key },
    ...extra
  };
}

function formula(key: string, f: string, extra: Partial<LineChartFormulaSeries> = {}): LineChartFormulaSeries {
  return { kind: 'formula', key, formula: f, ...extra };
}

function config(chartType: BarChartType, additional: BarChartWidgetConfig['additionalSeries'], extra: Partial<BarChartWidgetConfig> = {}): BarChartWidgetConfig {
  return {
    id: 'w1', type: 'barChart', title: 'Tageswerte', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-primary', queryName: 'PV', queryFamily: 'streamData', entitySelectorId: 'netz' },
    chartType, categoryField: 'timestamp',
    series: [{ field: 'energy', name: 'PV' }],
    additionalSeries: additional,
    ...extra
  };
}

const ROWS: Record<string, QueryResultRow[]> = {
  'q-primary': [sdRow(D[0], 5), sdRow(D[1], 8), sdRow(D[2], 6)],
  'q-import': [sdRow(D[0], 3), sdRow(D[2], 4)],
  'q-charge': [sdRow(D[0], 1)]
};

function setup(cfg: BarChartWidgetConfig, scopes: Record<string, StreamDataScope> = {}) {
  TestBed.configureTestingModule({
    imports: [BarChartWidgetComponent],
    providers: [
      { provide: QueryExecutorService, useValue: { execute: vi.fn((_f: string, rtId: string) => result(ROWS[rtId] ?? [])) } },
      {
        provide: MeshBoardStateService,
        useValue: {
          resolveStreamDataScope: vi.fn((id?: string): StreamDataScope => (id && scopes[id]) || { kind: 'unscoped' }),
          resolveStreamDataRtIds: vi.fn(() => undefined),
          resolveStreamDataTimeArgs: vi.fn(() => ({ from: new Date(D[0]), to: new Date('2026-10-04T00:00:00Z') })),
          timeZoneMode: vi.fn(() => 'utc'),
          getVariables: vi.fn(() => [])
        }
      },
      { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
    ]
  });
  const fixture = TestBed.createComponent(BarChartWidgetComponent);
  const cmp = fixture.componentInstance;
  cmp.config = cfg;
  return {
    cmp,
    fixture,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    render: async (): Promise<HTMLElement> => {
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.isLoading()).toBe(false));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }
  };
}

function series(cmp: BarChartWidgetComponent, name: string) {
  return cmp.seriesData().find(s => s.name === name);
}

describe('BarChartWidgetComponent series options (AB#8046)', () => {
  it('draws a series as a line over the bars, with colour, line style and the second axis', async () => {
    const s = setup(config('column', [query('import', { asLine: true, secondaryAxis: true, color: '#2563EB', dashType: 'dot' })]));
    await s.load();
    const line = series(s.cmp, 'import')!;
    expect(line).toEqual(expect.objectContaining({ asLine: true, secondaryAxis: true, color: '#2563EB', dashType: 'dot' }));
    expect(line.data).toEqual([3, null, 4]);
    expect(series(s.cmp, 'PV')!.asLine).toBeUndefined();
    expect(s.cmp.hasSecondaryAxis()).toBe(true);
    expect(s.cmp.axisCrossingValues()).toEqual([0, Number.MAX_SAFE_INTEGER]);
    const el = await s.render();
    expect(el.querySelector('kendo-chart')).not.toBeNull();
  });

  it('without the second axis there is one value axis', async () => {
    const s = setup(config('stackedColumn', [query('import', { asLine: true })]));
    await s.load();
    expect(series(s.cmp, 'import')!.asLine).toBe(true);
    expect(series(s.cmp, 'import')!.secondaryAxis).toBeUndefined();
    expect(s.cmp.hasSecondaryAxis()).toBe(false);
    expect(s.cmp.axisCrossingValues()).toBeUndefined();
  });

  it('a horizontal bar chart ignores asLine (Kendo cannot mix lines with horizontal bars)', async () => {
    const s = setup(config('bar', [query('import', { asLine: true, secondaryAxis: true })]));
    await s.load();
    expect(series(s.cmp, 'import')!.asLine).toBeUndefined();
    expect(s.cmp.hasSecondaryAxis()).toBe(false);
  });

  it('colours a bar series', async () => {
    const s = setup(config('column', [query('import', { color: '#0F766E' })]));
    await s.load();
    expect(series(s.cmp, 'import')!.color).toBe('#0F766E');
    // Static primary series keep their configured colour / the Kendo palette (unchanged).
    expect(series(s.cmp, 'PV')!.color).toBeUndefined();
  });

  it('missing values as 0 and carried forward per category, also as formula operands', async () => {
    const s = setup(config('column', [
      query('import', { missingValues: 'zero', visible: false }),
      query('charge', { missingValues: 'carryForward', visible: false }),
      formula('importF', '${import}', { label: 'Import' }),
      formula('chargeF', '${charge}', { label: 'Charge' })
    ]));
    await s.load();
    expect(series(s.cmp, 'Import')!.data).toEqual([3, 0, 4]);
    expect(series(s.cmp, 'Charge')!.data).toEqual([1, 1, 1]);
  });

  it('an empty zero source gives zeros and no hint; hidden sources give no hint', async () => {
    const s = setup(config('column', [
      query('battery', { missingValues: 'zero' }),
      query('hidden', { visible: false })
    ]), { battery: { kind: 'empty', reason: 'noTargets' } as StreamDataScope, hidden: { kind: 'empty', reason: 'noTargets' } as StreamDataScope });
    await s.load();
    expect(series(s.cmp, 'battery')!.data).toEqual([0, 0, 0]);
    expect(s.cmp.sourceHints()).toEqual([]);
  });

  describe('value axis binding (AB#8234)', () => {
    // Every series must name an axis that exists. Binding '' (the old behaviour) detached the series
    // from the main value axis: it stayed at 0-1.2 while the bars were drawn far outside the plot.
    async function render(cfg: BarChartWidgetConfig) {
      const s = setup(cfg);
      await s.load();
      await s.render();
      const chart = s.fixture.debugElement.query(By.directive(ChartComponent)).componentInstance as unknown as {
        seriesComponents: { toArray(): { name: string; axis?: string }[] };
        configurationService: { store: { valueAxis: { name?: string }[] } };
      };
      return { series: chart.seriesComponents.toArray(), axes: chart.configurationService.store.valueAxis };
    }

    it('without a secondary axis every series is bound to the main axis (no axis name)', async () => {
      const r = await render(config('column', [query('import', { asLine: true })]));
      expect(r.axes).toHaveLength(1);
      const mainName = r.axes[0].name;
      expect(mainName).toBeTruthy();
      expect(r.series.map(i => i.name)).toEqual(['PV', 'import']);
      for (const item of r.series) {
        expect(item.axis).toBe(mainName);
      }
    });

    it('with a secondary-axis line only that series is bound to the named second axis', async () => {
      const r = await render(config('column', [query('import', { asLine: true, secondaryAxis: true })]));
      expect(r.axes).toHaveLength(2);
      const mainName = r.axes[0].name;
      expect(mainName).toBeTruthy();
      const secondaryName = r.axes[1].name;
      expect(secondaryName).toBeTruthy();
      const byName = (n: string) => r.series.find(i => i.name === n)!;
      expect(secondaryName).not.toBe(mainName);
      expect(byName('PV').axis).toBe(mainName);
      expect(byName('import').axis).toBe(secondaryName);
    });
  });
});
