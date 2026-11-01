import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { ListViewComponent } from '@meshmakers/shared-ui';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { MeshBoardDataService } from '../services/meshboard-data.service';
import { QueryExecutionResult, QueryExecutorService, QueryResultRow } from '../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { GaugeWidgetComponent } from './gauge-widget/gauge-widget.component';
import { HeatmapWidgetComponent } from './heatmap-widget/heatmap-widget.component';
import { LineChartWidgetComponent } from './line-chart-widget/line-chart-widget.component';
import { PieChartWidgetComponent } from './pie-chart-widget/pie-chart-widget.component';
import {
  BarChartWidgetConfig,
  GaugeWidgetConfig,
  HeatmapWidgetConfig,
  LineChartWidgetConfig,
  PersistentQueryDataSource,
  PieChartWidgetConfig
} from '../models/meshboard.models';

/**
 * Widgets bound to an Integral (kWh) query read the `<attr>_integral` column for the board
 * window; an empty window delivers a null cell, which is "no data" — the widget shows its
 * empty state, never a misleading 0 (AB#7975). A real 0 stays 0.
 */
describe('widgets over an Integral column — empty window is no data, not 0 (AB#7975)', () => {
  const STREAM: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-int', queryFamily: 'streamData' };

  function row(cells: { attributePath: string; value: unknown }[], timestamp?: string): QueryResultRow {
    return { __typename: 'StreamDataQueryRow', rtId: 'rt-1', cells, ...(timestamp ? { timestamp: timestamp as unknown as Date } : {}) } as QueryResultRow;
  }

  function result(rows: QueryResultRow[]): QueryExecutionResult {
    return {
      family: 'streamData', queryRtId: 'q-int', associatedCkTypeId: null,
      columns: [{ attributePath: 'day' }, { attributePath: 'site' }, { attributePath: 'importpower_integral', aggregationType: 'INTEGRAL' }],
      rows, totalCount: rows.length, hasNextPage: false, endCursor: null
    };
  }

  describe('with the board state (gauge, bar chart, pie chart)', () => {
    let queryExecutor: { execute: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      queryExecutor = { execute: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          MeshBoardStateService,
          { provide: MeshBoardPersistenceService, useValue: {} },
          { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
          { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
          { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } },
          { provide: MeshBoardDataService, useValue: { fetchAggregations: vi.fn().mockResolvedValue(new Map()) } },
          { provide: QueryExecutorService, useValue: queryExecutor },
          { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
          { provide: SecretSafeAttributeNamesService, useValue: {} },
          { provide: ListViewComponent, useValue: {} }
        ]
      });
    });

    describe('gauge (aggregation mode)', () => {
      async function gaugeFor(value: unknown): Promise<GaugeWidgetComponent> {
        queryExecutor.execute.mockReturnValue(of(result([row([{ attributePath: 'importpower_integral', value }])])));
        const cmp = TestBed.createComponent(GaugeWidgetComponent).componentInstance;
        cmp.config = {
          id: 'g', type: 'gauge', title: 'Energie', col: 1, row: 1, colSpan: 1, rowSpan: 1,
          dataSource: STREAM, gaugeType: 'arc', min: 0, max: 100,
          queryMode: 'aggregation', queryValueField: 'importpower_integral'
        } as GaugeWidgetConfig;
        await (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();
        return cmp;
      }

      it('shows the integral of the window', async () => {
        const cmp = await gaugeFor(42.5);

        expect(cmp.hasValue()).toBe(true);
        expect(cmp.numericValue()).toBe(42.5);
      });

      it('shows its empty state for an empty window (null cell)', async () => {
        const cmp = await gaugeFor(null);

        expect(cmp.hasValue()).toBe(false);
        expect(cmp.formattedValue()).toBe('-');
      });

      it('keeps a real 0', async () => {
        const cmp = await gaugeFor(0);

        expect(cmp.hasValue()).toBe(true);
        expect(cmp.formattedValue()).toBe('0');
      });
    });

    describe('bar chart (kWh per day)', () => {
      async function barFor(rows: QueryResultRow[]): Promise<BarChartWidgetComponent> {
        queryExecutor.execute.mockReturnValue(of(result(rows)));
        const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
        cmp.config = {
          id: 'b', type: 'barChart', title: 'kWh je Tag', col: 1, row: 1, colSpan: 2, rowSpan: 2,
          dataSource: STREAM, chartType: 'column', categoryField: 'day',
          series: [{ field: 'importpower_integral', name: 'kWh' }]
        } as BarChartWidgetConfig;
        await (cmp as unknown as { loadData(): Promise<void> }).loadData();
        return cmp;
      }

      it('draws one bar per day and no bar for a day without data', async () => {
        const cmp = await barFor([
          row([{ attributePath: 'day', value: 'Mo' }, { attributePath: 'importpower_integral', value: 12.5 }]),
          row([{ attributePath: 'day', value: 'Di' }, { attributePath: 'importpower_integral', value: null }]),
          row([{ attributePath: 'day', value: 'Mi' }, { attributePath: 'importpower_integral', value: 0 }])
        ]);

        expect(cmp.categories()).toEqual(['Mo', 'Di', 'Mi']);
        expect(cmp.seriesData()[0].data).toEqual([12.5, null, 0]);
      });

      it('keeps a null day as no bar in dynamic series mode', async () => {
        queryExecutor.execute.mockReturnValue(of(result([
          row([{ attributePath: 'day', value: 'Mo' }, { attributePath: 'site', value: 'A' }, { attributePath: 'importpower_integral', value: null }]),
          row([{ attributePath: 'day', value: 'Mo' }, { attributePath: 'site', value: 'B' }, { attributePath: 'importpower_integral', value: 3 }])
        ])));
        const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
        cmp.config = {
          id: 'b', type: 'barChart', title: 'kWh je Tag', col: 1, row: 1, colSpan: 2, rowSpan: 2,
          dataSource: STREAM, chartType: 'column', categoryField: 'day',
          seriesGroupField: 'site', valueField: 'importpower_integral'
        } as BarChartWidgetConfig;
        await (cmp as unknown as { loadData(): Promise<void> }).loadData();

        expect(cmp.seriesData().map(s => s.data)).toEqual([[null], [3]]);
      });
    });

    describe('pie chart', () => {
      it('leaves out a slice without data instead of showing it as 0', async () => {
        queryExecutor.execute.mockReturnValue(of(result([
          row([{ attributePath: 'site', value: 'A' }, { attributePath: 'importpower_integral', value: 7 }]),
          row([{ attributePath: 'site', value: 'B' }, { attributePath: 'importpower_integral', value: null }])
        ])));
        const cmp = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
        cmp.config = {
          id: 'p', type: 'pieChart', title: 'Anteil', col: 1, row: 1, colSpan: 2, rowSpan: 2,
          dataSource: STREAM, chartType: 'pie', categoryField: 'site', valueField: 'importpower_integral'
        } as PieChartWidgetConfig;

        await (cmp as unknown as { loadPersistentQueryData(ds: PersistentQueryDataSource): Promise<void> }).loadPersistentQueryData(STREAM);

        const raw = (cmp as unknown as { _rawData(): { category: string; value: number }[] })._rawData();
        expect(raw).toEqual([{ category: 'A', value: 7 }]);
      });
    });
  });

  describe('line chart', () => {
    it('draws a gap for a bucket without data, not 0', () => {
      TestBed.configureTestingModule({
        imports: [LineChartWidgetComponent],
        providers: [
          { provide: QueryExecutorService, useValue: { execute: vi.fn() } },
          {
            provide: MeshBoardStateService,
            useValue: { timeZoneMode: vi.fn().mockReturnValue('utc'), getVariables: vi.fn().mockReturnValue([]) }
          },
          { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn() } }
        ]
      });
      const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'l', type: 'lineChart', title: 'kWh', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: STREAM, categoryField: 'day', seriesGroupField: 'site', valueField: 'importpower_integral'
      } as LineChartWidgetConfig;

      (cmp as unknown as { processData(rows: QueryResultRow[], downsample: boolean): void }).processData([
        row([{ attributePath: 'day', value: '2026-10-29T00:00:00Z' }, { attributePath: 'site', value: 'A' }, { attributePath: 'importpower_integral', value: 4 }]),
        row([{ attributePath: 'day', value: '2026-10-30T00:00:00Z' }, { attributePath: 'site', value: 'A' }, { attributePath: 'importpower_integral', value: null }]),
        row([{ attributePath: 'day', value: '2026-10-31T00:00:00Z' }, { attributePath: 'site', value: 'A' }, { attributePath: 'importpower_integral', value: 0 }])
      ], false);

      expect(cmp.seriesData()[0].data).toEqual([4, null, 0]);
    });
  });

  describe('heatmap (sum)', () => {
    it('skips a row without data instead of counting it as 0', async () => {
      const execute = vi.fn();
      TestBed.configureTestingModule({
        imports: [HeatmapWidgetComponent],
        providers: [
          {
            provide: MeshBoardStateService,
            useValue: {
              resolveStreamDataRtIds: vi.fn().mockReturnValue(undefined),
              resolveStreamDataScope: vi.fn().mockReturnValue({ kind: 'unscoped' }),
              resolveStreamDataTimeArgs: vi.fn().mockReturnValue(undefined),
              timeZoneMode: vi.fn().mockReturnValue('utc'),
              getVariables: vi.fn().mockReturnValue([])
            }
          },
          { provide: QueryExecutorService, useValue: { execute } },
          { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } }
        ]
      });
      const cmp = TestBed.createComponent(HeatmapWidgetComponent).componentInstance;
      const rows = [
        row([{ attributePath: 'importpower_integral', value: null }], '2026-10-28T08:10:00Z'),
        row([{ attributePath: 'importpower_integral', value: 2 }], '2026-10-28T08:20:00Z'),
        row([{ attributePath: 'importpower_integral', value: null }], '2026-10-28T09:10:00Z')
      ];
      execute.mockReturnValue(of({ rows, totalCount: rows.length }));
      cmp.config = {
        type: 'heatmap', dateField: 'timestamp', valueField: 'importpower_integral', aggregation: 'avg',
        colorScheme: 'green', dataSource: STREAM
      } as unknown as HeatmapWidgetConfig;

      await (cmp as unknown as { loadData(): Promise<void> }).loadData();

      const cell = (hour: string) => cmp.heatmapData().find(c => c.date === '2026-10-28' && c.hour === hour);
      // avg over the real rows only: the null row does not pull 08:00 down to 1.
      expect(cell('08:00')?.value).toBe(2);
      expect(cell('09:00')?.value ?? 0).toBe(0);
    });
  });
});
