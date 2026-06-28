import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartWidgetConfig } from '../../models/meshboard.models';
import { QueryModeDto } from '@meshmakers/octo-services';

function sdRow(windowStart: string, obis: string, value: number) {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'entity-1',
    cells: [
      { attributePath: 'window_start', value: windowStart },
      { attributePath: 'obisCode', value: obis },
      { attributePath: 'amount.value', value }
    ]
  };
}

describe('LineChartWidgetComponent dataInfo (load counter)', () => {
  function createWith(rows: unknown[], total: number): LineChartWidgetComponent {
    const queryExecutor = jasmine.createSpyObj<QueryExecutorService>('QueryExecutorService', ['execute']);
    queryExecutor.execute.and.returnValue(of({
      family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
      columns: [], rows, totalCount: total, hasNextPage: false, endCursor: null
    }) as ReturnType<QueryExecutorService['execute']>);

    const stateService = jasmine.createSpyObj<MeshBoardStateService>('MeshBoardStateService',
      ['resolveStreamDataTimeArgs', 'resolveStreamDataRtIds', 'getVariables', 'timeZoneMode']);
    stateService.resolveStreamDataTimeArgs.and.returnValue(undefined);
    stateService.resolveStreamDataRtIds.and.returnValue(undefined);
    stateService.getVariables.and.returnValue([]);
    stateService.timeZoneMode.and.returnValue('local');

    const variableService = jasmine.createSpyObj<MeshBoardVariableService>('MeshBoardVariableService',
      ['convertToFieldFilterDto']);
    variableService.convertToFieldFilterDto.and.returnValue(undefined);

    TestBed.configureTestingModule({
      imports: [LineChartWidgetComponent],
      providers: [
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: variableService }
      ]
    });

    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'w1', type: 'lineChart', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData' },
      categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value'
    } as LineChartWidgetConfig;
    return cmp;
  }

  it('reports loaded rows, distinct category points and totalCount', async () => {
    const cmp = createWith([
      sdRow('2026-01-01T00:00:00Z', '1-1:1.9.0 G.01', 1),
      sdRow('2026-01-01T00:15:00Z', '1-1:1.9.0 G.01', 2),
      sdRow('2026-01-01T00:30:00Z', '1-1:1.9.0 G.01', 3)
    ], 3);

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(cmp.dataInfo()).toEqual({ rows: 3, points: 3, total: 3 });
  });

  it('surfaces a data collapse: many rows but a single category point', async () => {
    // All three rows share the same timestamp — exactly the signature the
    // counter is meant to expose at a glance.
    const cmp = createWith([
      sdRow('2026-01-01T00:00:00Z', '1-1:1.9.0 G.01', 1),
      sdRow('2026-01-01T00:00:00Z', '1-1:1.9.0 G.01', 1),
      sdRow('2026-01-01T00:00:00Z', '1-1:1.9.0 G.01', 1)
    ], 3);

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    const info = cmp.dataInfo();
    expect(info?.rows).toBe(3);
    expect(info?.points).toBe(1);
  });
});

// A downsampled stream-data row: the bin time is the top-level timestamp and the value column
// comes back reduced to <field>_avg / _min / _max; the series column is reduced to <field>_max.
function dsRow(timestamp: string, obis: string, avg: number, min: number, max: number) {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'entity-1',
    timestamp,
    cells: [
      { attributePath: 'obiscode_max', value: obis },
      { attributePath: 'amountvalue_avg', value: avg },
      { attributePath: 'amountvalue_min', value: min },
      { attributePath: 'amountvalue_max', value: max }
    ]
  };
}

describe('LineChartWidgetComponent downsampling envelope (FE-3)', () => {
  function createDownsampled(rows: unknown[]): LineChartWidgetComponent {
    const queryExecutor = jasmine.createSpyObj<QueryExecutorService>('QueryExecutorService', ['execute']);
    queryExecutor.execute.and.returnValue(of({
      family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
      columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null
    }) as ReturnType<QueryExecutorService['execute']>);

    const stateService = jasmine.createSpyObj<MeshBoardStateService>('MeshBoardStateService',
      ['resolveStreamDataTimeArgs', 'resolveStreamDataRtIds', 'getVariables', 'timeZoneMode']);
    // A resolved time range is what flips the widget into downsampling mode.
    stateService.resolveStreamDataTimeArgs.and.returnValue({
      from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-12-31T00:00:00Z')
    });
    stateService.resolveStreamDataRtIds.and.returnValue(['entity-1']);
    stateService.getVariables.and.returnValue([]);
    stateService.timeZoneMode.and.returnValue('local');

    const variableService = jasmine.createSpyObj<MeshBoardVariableService>('MeshBoardVariableService',
      ['convertToFieldFilterDto']);
    variableService.convertToFieldFilterDto.and.returnValue(undefined);

    TestBed.configureTestingModule({
      imports: [LineChartWidgetComponent],
      providers: [
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: variableService }
      ]
    });

    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'w1', type: 'lineChart', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData' },
      categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value'
    } as LineChartWidgetConfig;
    return cmp;
  }

  it('requests downsampling with a pixel-sized limit when a time range is resolved', async () => {
    const cmp = createDownsampled([dsRow('2026-01-01T00:00:00Z', 'G.01', 2, 1, 9)]);
    const qe = TestBed.inject(QueryExecutorService) as jasmine.SpyObj<QueryExecutorService>;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    const opts = qe.execute.calls.mostRecent().args[2];
    expect(opts?.streamDataArgs?.queryMode).toBe(QueryModeDto.DownsamplingDto);
    expect(opts?.streamDataArgs?.limit).toBeGreaterThanOrEqual(50);
    expect(opts?.streamDataArgs?.limit).toBeLessThanOrEqual(4000);
  });

  it('uses the bin timestamp as category, _avg for the line and builds a min/max band', async () => {
    const cmp = createDownsampled([
      dsRow('2026-01-01T00:00:00Z', 'G.01', 2, 1, 9),
      dsRow('2026-01-01T06:00:00Z', 'G.01', 5, 3, 8)
    ]);

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(cmp.categories().length).toBe(2);
    const series = cmp.seriesData();
    expect(series.length).toBe(1);
    expect(series[0].data).toEqual([2, 5]);
    expect(series[0].band).toEqual([{ from: 1, to: 9 }, { from: 3, to: 8 }]);
  });
});

// A downsample bucket the backend produced but couldn't fill: the bin timestamp is set
// but every reduced value comes back null (happens when the requested bucket count meets
// or exceeds the number of distinct source timestamps).
function nullDsRow(timestamp: string) {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'entity-1',
    timestamp,
    cells: [
      { attributePath: 'obiscode_max', value: null },
      { attributePath: 'amountvalue_avg', value: null },
      { attributePath: 'amountvalue_min', value: null },
      { attributePath: 'amountvalue_max', value: null }
    ]
  };
}

describe('LineChartWidgetComponent downsampling null-bucket fallback', () => {
  function sdResult(rows: unknown[], total: number) {
    return of({
      family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
      columns: [], rows, totalCount: total, hasNextPage: false, endCursor: null
    }) as ReturnType<QueryExecutorService['execute']>;
  }

  function createWithResponses(responses: ReturnType<QueryExecutorService['execute']>[]): LineChartWidgetComponent {
    const queryExecutor = jasmine.createSpyObj<QueryExecutorService>('QueryExecutorService', ['execute']);
    queryExecutor.execute.and.returnValues(...responses);

    const stateService = jasmine.createSpyObj<MeshBoardStateService>('MeshBoardStateService',
      ['resolveStreamDataTimeArgs', 'resolveStreamDataRtIds', 'getVariables', 'timeZoneMode']);
    stateService.resolveStreamDataTimeArgs.and.returnValue({
      from: new Date('2026-06-02T22:00:00Z'), to: new Date('2026-06-03T22:00:00Z')
    });
    stateService.resolveStreamDataRtIds.and.returnValue(['entity-1']);
    stateService.getVariables.and.returnValue([]);
    stateService.timeZoneMode.and.returnValue('local');

    const variableService = jasmine.createSpyObj<MeshBoardVariableService>('MeshBoardVariableService',
      ['convertToFieldFilterDto']);
    variableService.convertToFieldFilterDto.and.returnValue(undefined);

    TestBed.configureTestingModule({
      imports: [LineChartWidgetComponent],
      providers: [
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: variableService }
      ]
    });

    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'w1', type: 'lineChart', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData' },
      categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value'
    } as LineChartWidgetConfig;
    return cmp;
  }

  it('refetches raw rows when downsampling returns rows but no plottable points', async () => {
    const cmp = createWithResponses([
      // 1st pass: downsampling — rows present, all values null → 0 plottable points
      sdResult([nullDsRow('2026-06-02T22:00:00Z'), nullDsRow('2026-06-02T22:01:10Z')], 2),
      // 2nd pass: raw fallback — real rows that plot
      sdResult([
        sdRow('2026-06-02T22:00:00Z', '1-1:1.9.0 G.01', 3.9),
        sdRow('2026-06-02T22:15:00Z', '1-1:1.9.0 G.01', 3.3)
      ], 192)
    ]);
    const qe = TestBed.inject(QueryExecutorService) as jasmine.SpyObj<QueryExecutorService>;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    // Two passes: downsample, then raw fallback.
    expect(qe.execute.calls.count()).toBe(2);
    const firstOpts = qe.execute.calls.first().args[2];
    expect(firstOpts?.streamDataArgs?.queryMode).toBe(QueryModeDto.DownsamplingDto);
    const lastOpts = qe.execute.calls.mostRecent().args[2];
    expect(lastOpts?.streamDataArgs?.queryMode).toBe(QueryModeDto.DefaultDto);
    expect(lastOpts?.streamDataArgs?.limit).toBeNull();
    expect(lastOpts?.first).toBe(5000);

    // Chart now plots, and the counter reports the real numbers (matching the table).
    expect(cmp.categories().length).toBe(2);
    expect(cmp.dataInfo()).toEqual({ rows: 2, points: 2, total: 192 });
  });

  it('does not refetch when downsampling already yields plottable points', async () => {
    const cmp = createWithResponses([
      sdResult([dsRow('2026-06-02T22:00:00Z', 'G.01', 2, 1, 9)], 1)
    ]);
    const qe = TestBed.inject(QueryExecutorService) as jasmine.SpyObj<QueryExecutorService>;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(qe.execute.calls.count()).toBe(1);
    expect(cmp.categories().length).toBe(1);
  });

  it('does not refetch when downsampling returns no rows at all', async () => {
    const cmp = createWithResponses([
      sdResult([], 0)
    ]);
    const qe = TestBed.inject(QueryExecutorService) as jasmine.SpyObj<QueryExecutorService>;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(qe.execute.calls.count()).toBe(1);
    expect(cmp.categories().length).toBe(0);
  });
});
