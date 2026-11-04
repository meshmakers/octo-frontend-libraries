import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OctoErrorLink } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { QueryExecutorService } from '../services/query-executor.service';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { ExecuteStreamDataQueryDtoGQL } from '../graphQL/executeStreamDataQuery';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { ResolveSeriesQueryDtoGQL } from '../graphQL/resolveSeriesQuery';
import { GetStreamDataQueryArchiveDtoGQL } from '../graphQL/getStreamDataQueryArchive';
import { TransientDownsamplingDtoGQL } from '../graphQL/transientDownsampling';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { COLUMN_PROBE_FALLBACK_MS } from '../utils/column-probe-window';
import { BarChartConfigDialogComponent } from './bar-chart-widget/bar-chart-config-dialog.component';
import { GaugeConfigDialogComponent } from './gauge-widget/gauge-config-dialog.component';
import { HeatmapConfigDialogComponent } from './heatmap-widget/heatmap-config-dialog.component';
import { KpiConfigDialogComponent } from './kpi-widget/kpi-config-dialog.component';
import { LineChartConfigDialogComponent } from './line-chart-widget/line-chart-config-dialog.component';
import { PieChartConfigDialogComponent } from './pie-chart-widget/pie-chart-config-dialog.component';
import { TableConfigDialogComponent } from './table-widget/table-config-dialog.component';
import { WidgetGroupConfigDialogComponent } from './widget-group/widget-group-config-dialog.component';

/**
 * Every widget config dialog that binds to a persisted stream-data query lists the
 * `<attr>_integral` column of an Integral query (AB#7975). An Integral over a raw archive
 * refuses to run without from/to, so the window-less column probe fails and the dialog
 * must retry with the board window (24 h without a time filter) — and that expected first
 * failure must not reach the global error toast (AB#7985).
 *
 * The dialogs run against the real {@link QueryExecutorService}; only the GraphQL fetch is
 * mocked. Each dialog is created without its template (prototype + the injected fields it
 * uses), because only the column loading is under test.
 */

interface Window { from: Date; to: Date }

interface DialogCase {
  name: string;
  /** Creates the dialog with the executor and the board state it injects. */
  create: (executor: QueryExecutorService, state: { resolveStreamDataTimeArgs: () => Window | undefined }) => object;
  /** Runs the dialog's column loading for a stream-data query and returns the listed paths. */
  listColumns: (dialog: object, rtId: string) => Promise<string[]>;
}

interface ColumnItem { attributePath: string }
interface ChartDialog { fetchColumnsForFamily(family: string, rtId: string): Promise<ColumnItem[]> }

/** The chart-style dialogs share `fetchColumnsForFamily(family, rtId)`; they differ in the state field name. */
function chartDialog(name: string, ctor: { prototype: object }, stateField: 'stateService' | 'meshBoardStateService'): DialogCase {
  return {
    name,
    create: (executor, state) => Object.assign(Object.create(ctor.prototype) as object, { queryExecutor: executor, [stateField]: state }),
    listColumns: async (dialog, rtId) =>
      (await (dialog as ChartDialog).fetchColumnsForFamily('streamData', rtId)).map(c => c.attributePath)
  };
}

const dialogs: DialogCase[] = [
  chartDialog('gauge', GaugeConfigDialogComponent, 'meshBoardStateService'),
  chartDialog('bar chart', BarChartConfigDialogComponent, 'stateService'),
  chartDialog('pie chart', PieChartConfigDialogComponent, 'stateService'),
  chartDialog('line chart', LineChartConfigDialogComponent, 'stateService'),
  chartDialog('heatmap', HeatmapConfigDialogComponent, 'stateService'),
  chartDialog('widget group', WidgetGroupConfigDialogComponent, 'meshBoardStateService'),
  chartDialog('KPI', KpiConfigDialogComponent, 'meshBoardStateService'),
  {
    name: 'table',
    create: (executor, state) => Object.assign(Object.create(TableConfigDialogComponent.prototype) as object, {
      queryExecutor: executor,
      stateService: state,
      selectedPersistentQuery: { rtId: 'q-int', name: 'Energie je Tag', ckTypeId: 'System/GroupingAggregationSdQuery' },
      queryFieldsLoad: null
    }),
    listColumns: async (dialog, rtId) =>
      (await (dialog as { loadQueryFields(rtId: string): Promise<string[] | null> }).loadQueryFields(rtId)) ?? []
  }
];

describe('Widget config dialogs list Integral columns (AB#7975, AB#7985)', () => {
  let fetch: ReturnType<typeof vi.fn>;
  let executor: QueryExecutorService;

  const boardWindow: Window = { from: new Date('2026-10-30T00:00:00Z'), to: new Date('2026-10-31T00:00:00Z') };
  const integralColumns = [
    { attributePath: 'day', attributeValueType: 'DATE_TIME', aggregationType: null },
    { attributePath: 'importpower_integral', attributeValueType: 'DOUBLE', aggregationType: 'INTEGRAL' }
  ];
  const integralRefusal = () => throwError(() => new Error('TimeWeightedAverage, StateDuration and Integral over a raw archive require From and To'));
  const withColumns = () => of({
    data: {
      streamData: {
        streamDataQuery: {
          items: [{
            queryRtId: 'q-int', associatedCkTypeId: null, columns: integralColumns,
            rows: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, items: [] }
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  });
  const call = (n: number) => fetch.mock.calls[n][0] as { variables: { arg?: { from?: Date; to?: Date } }; context?: Record<string, unknown> };
  const toastSuppressed = (n: number) => OctoErrorLink.isSilent({ getContext: () => call(n).context ?? {} } as never);

  beforeEach(() => {
    fetch = vi.fn();
    const unused = { fetch: vi.fn(() => throwError(() => new Error('unexpected GraphQL call in a column probe'))) };
    TestBed.configureTestingModule({
      providers: [
        QueryExecutorService,
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: ExecuteStreamDataQueryDtoGQL, useValue: { fetch } },
        { provide: ExecuteRuntimeQueryDtoGQL, useValue: unused },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: unused },
        { provide: ResolveSeriesQueryDtoGQL, useValue: unused },
        { provide: GetStreamDataQueryArchiveDtoGQL, useValue: unused },
        { provide: TransientDownsamplingDtoGQL, useValue: unused },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: unused }
      ]
    });
    executor = TestBed.inject(QueryExecutorService);
  });

  for (const d of dialogs) {
    describe(d.name, () => {
      it('lists the _integral column by retrying with the board window', async () => {
        fetch.mockReturnValueOnce(integralRefusal()).mockReturnValueOnce(withColumns());
        const dialog = d.create(executor, { resolveStreamDataTimeArgs: () => boardWindow });

        const paths = await d.listColumns(dialog, 'q-int');

        expect(paths).toContain('importpower_integral');
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(call(0).variables.arg).toBeUndefined();
        expect(call(1).variables.arg).toMatchObject({ from: boardWindow.from, to: boardWindow.to });
      });

      it('retries with the last 24 hours when the board has no time filter', async () => {
        fetch.mockReturnValueOnce(integralRefusal()).mockReturnValueOnce(withColumns());
        const dialog = d.create(executor, { resolveStreamDataTimeArgs: () => undefined });

        const paths = await d.listColumns(dialog, 'q-int');

        expect(paths).toContain('importpower_integral');
        const arg = call(1).variables.arg!;
        expect(arg.to!.getTime() - arg.from!.getTime()).toBe(COLUMN_PROBE_FALLBACK_MS);
      });

      it('raises no error toast for the refused window-less probe when the retry succeeds (AB#7985)', async () => {
        fetch.mockReturnValueOnce(integralRefusal()).mockReturnValueOnce(withColumns());
        const dialog = d.create(executor, { resolveStreamDataTimeArgs: () => boardWindow });

        await d.listColumns(dialog, 'q-int');

        expect(toastSuppressed(0)).toBe(true);
        expect(toastSuppressed(1)).toBe(false);
      });
    });
  }

  // Gauge and KPI load the category values of a grouped query by running it; a grouped
  // Integral query needs the same window retry as the column list (AB#7975 review).
  const withDayRows = () => of({
    data: {
      streamData: {
        streamDataQuery: {
          items: [{
            queryRtId: 'q-int', associatedCkTypeId: null, columns: integralColumns,
            rows: {
              totalCount: 2, pageInfo: { hasNextPage: false, endCursor: null },
              items: ['Mo', 'Di'].map(day => ({
                __typename: 'StreamDataQueryRow', rtId: 'rt-1', timestamp: null,
                cells: { items: [{ attributePath: 'day', value: day }, { attributePath: 'importpower_integral', value: 1 }] }
              }))
            }
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  });

  for (const [name, ctor] of [['gauge', GaugeConfigDialogComponent], ['KPI', KpiConfigDialogComponent]] as const) {
    it(`${name}: lists the category values of a grouped Integral query, silently probing first`, async () => {
      fetch.mockReturnValueOnce(integralRefusal()).mockReturnValueOnce(withDayRows());
      const dialog = Object.assign(Object.create(ctor.prototype) as object, {
        queryExecutor: executor,
        meshBoardStateService: { resolveStreamDataTimeArgs: () => boardWindow },
        selectedPersistentQuery: { rtId: 'q-int', name: 'Energie je Tag', ckTypeId: 'System/GroupingAggregationSdQuery' },
        categoryValues: []
      }) as unknown as { loadCategoryValuesForField(rtId: string, field: string): Promise<void>; categoryValues: { value: string }[] };

      await dialog.loadCategoryValuesForField('q-int', 'day');

      expect(dialog.categoryValues.map(v => v.value)).toEqual(['Mo', 'Di']);
      expect(toastSuppressed(0)).toBe(true);
      expect(call(1).variables.arg).toMatchObject({ from: boardWindow.from, to: boardWindow.to });
    });
  }
});
