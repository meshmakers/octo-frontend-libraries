import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { LineChartConfigDialogComponent } from './line-chart-config-dialog.component';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { LineChartWidgetConfig } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';
import { streamDataRowFieldValue, withStreamDataRowFields } from '../../utils/stream-data-row-fields';

/**
 * AB#8069: a new stream-data line chart can be completed in the dialog. Stream-data rows carry
 * their time stamp and source entity as row properties (`timestamp`, `rtId`), not as columns, so
 * the Field Mapping offers both, and the chart reads them from the row.
 */

describe('stream-data row fields (AB#8069)', () => {
  it('adds timestamp and rtId in front of the query columns, unless the query has them', () => {
    const cols = [{ attributePath: 'activePower', attributeValueType: 'DOUBLE', aggregationType: null }];
    expect(withStreamDataRowFields(cols).map(c => [c.attributePath, c.attributeValueType]))
      .toEqual([['timestamp', 'DATE_TIME'], ['rtId', 'STRING'], ['activePower', 'DOUBLE']]);
    const withOwn = [{ attributePath: 'Timestamp', attributeValueType: 'DATE_TIME' }, { attributePath: 'rtid', attributeValueType: 'STRING' }];
    expect(withStreamDataRowFields(withOwn)).toEqual(withOwn);
  });

  it('reads the row properties for timestamp / rtId only', () => {
    const t = new Date('2026-11-01T10:00:00Z');
    const row: QueryResultRow = { rtId: 'wb-1', timestamp: t, cells: [] };
    expect(streamDataRowFieldValue(row, 'timestamp')).toBe(t);
    expect(streamDataRowFieldValue(row, 'rtId')).toBe('wb-1');
    expect(streamDataRowFieldValue(row, 'RTID')).toBe('wb-1');
    expect(streamDataRowFieldValue(row, 'name')).toBeUndefined();
    expect(streamDataRowFieldValue({ cells: [] }, 'rtId')).toBeUndefined();
  });
});

describe('LineChartConfigDialogComponent — stream-data field mapping (AB#8069)', () => {
  let fixture: ComponentFixture<LineChartConfigDialogComponent>;
  let cmp: LineChartConfigDialogComponent;
  let fetchStreamDataColumns: ReturnType<typeof vi.fn>;
  let fetchRuntime: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchStreamDataColumns = vi.fn().mockResolvedValue([
      { attributePath: 'activePower', attributeValueType: 'DOUBLE', aggregationType: 'NONE' }
    ]);
    fetchRuntime = vi.fn(() => of({ data: { runtime: { runtimeQuery: { items: [{ columns: [
      { attributePath: 'name', attributeValueType: 'STRING', aggregationType: null },
      { attributePath: 'power', attributeValueType: 'DOUBLE', aggregationType: null }
    ] }] } } } }));
    TestBed.configureTestingModule({
      imports: [LineChartConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: { close: vi.fn() } },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns, resolveFamily: vi.fn() } },
        { provide: MeshBoardStateService, useValue: { getVariables: vi.fn(() => []), getEntitySelectors: vi.fn(() => []), resolveStreamDataTimeArgs: vi.fn(() => undefined) } },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: { fetch: fetchRuntime } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
    fixture = TestBed.createComponent(LineChartConfigDialogComponent);
    cmp = fixture.componentInstance;
  });

  async function newChart(ckTypeId: string): Promise<HTMLElement> {
    await cmp.ngOnInit();
    await cmp.onQuerySelected({ rtId: 'q-wallbox', name: 'Wallboxen', ckTypeId });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('a new stream-data chart offers timestamp as category and rtId as group field, and can be saved', async () => {
    const el = await newChart('System/SimpleSdQuery');
    expect(cmp.queryColumns.map(c => c.attributePath)).toEqual(['timestamp', 'rtId', 'activePower']);
    expect(cmp.nonNumericColumns.map(c => c.attributePath)).toEqual(['timestamp', 'rtId']);
    expect(cmp.numericColumns.map(c => c.attributePath)).toEqual(['activePower']);
    // The Field Mapping section renders (it needs at least one column).
    expect(el.textContent).toContain('Field Mapping');

    cmp.form.categoryField = 'timestamp';
    cmp.form.seriesGroupField = 'rtId';
    cmp.form.valueField = 'activePower';
    expect(cmp.isValid).toBe(true);
  });

  it('a runtime query gets no row fields (unchanged)', async () => {
    await newChart('System/SimpleRtQuery');
    expect(fetchStreamDataColumns).not.toHaveBeenCalled();
    expect(cmp.queryColumns.map(c => c.attributePath)).toEqual(['name', 'power']);
  });
});

describe('LineChartWidgetComponent — timestamp / rtId mapping on stream-data rows (AB#8069)', () => {
  const T = ['2026-11-01T10:00:00', '2026-11-01T10:15:00'];

  function row(timestamp: string, rtId: string, value: number, column: string): QueryResultRow {
    return { __typename: 'StreamDataQueryRow', rtId, timestamp: timestamp as unknown as Date, cells: [{ attributePath: column, value }] };
  }

  function setup(rows: QueryResultRow[], withTimeRange: boolean, extra: Partial<LineChartWidgetConfig> = {}) {
    const execute = vi.fn(() => of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null }));
    TestBed.configureTestingModule({
      imports: [LineChartWidgetComponent],
      providers: [
        { provide: QueryExecutorService, useValue: { execute, downsampleByArchive: vi.fn(), resolveSeriesQuery: vi.fn(), fetchQueryArchive: vi.fn() } },
        {
          provide: MeshBoardStateService, useValue: {
            resolveStreamDataScope: vi.fn((): StreamDataScope => ({ kind: 'unscoped' })),
            resolveStreamDataRtIds: vi.fn(() => undefined),
            resolveStreamDataTimeArgs: vi.fn(() => (withTimeRange ? { from: new Date('2026-11-01T10:00:00Z'), to: new Date('2026-11-01T10:30:00Z') } : undefined)),
            resolveStreamDataTimeZone: vi.fn(() => 'UTC'),
            timeZoneMode: vi.fn(() => 'utc'),
            getVariables: vi.fn(() => [])
          }
        },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
      ]
    });
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'w', type: 'lineChart', title: 'Wallboxen', col: 1, row: 1, colSpan: 3, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q', queryFamily: 'streamData' },
      chartType: 'line', categoryField: 'timestamp', seriesGroupField: 'rtId', valueField: 'activePower',
      ...extra
    };
    return { cmp, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
  }

  it('raw rows: one line per source entity on the row time stamps', async () => {
    const s = setup([row(T[0], 'wb-1', 1, 'activePower'), row(T[0], 'wb-2', 2, 'activePower'), row(T[1], 'wb-1', 3, 'activePower')], false);
    await s.load();
    expect(s.cmp.categories().length).toBe(2);
    expect(s.cmp.seriesData().map(x => [x.name, x.data])).toEqual([['wb-1', [1, 3]], ['wb-2', [2, null]]]);
  });

  it('downsampled rows: one line per source entity', async () => {
    const s = setup([row(T[0], 'wb-1', 1, 'activePower_avg'), row(T[1], 'wb-2', 4, 'activePower_avg')], true);
    await s.load();
    expect(s.cmp.seriesData().map(x => [x.name, x.data])).toEqual([['wb-1', [1, null]], ['wb-2', [null, 4]]]);
  });

  it('multi-source path: the primary series group by rtId too', async () => {
    const s = setup([row(T[0], 'wb-1', 1, 'activePower_avg'), row(T[1], 'wb-1', 2, 'activePower_avg')], true, {
      additionalSeries: [{ kind: 'formula', key: 'f', formula: '1' }]
    });
    await s.load();
    expect(s.cmp.seriesData().find(x => x.name === 'wb-1')?.data).toEqual([1, 2]);
  });
});
