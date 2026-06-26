import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartWidgetConfig } from '../../models/meshboard.models';

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
      ['resolveStreamDataTimeArgs', 'resolveStreamDataRtIds', 'getVariables']);
    stateService.resolveStreamDataTimeArgs.and.returnValue(undefined);
    stateService.resolveStreamDataRtIds.and.returnValue(undefined);
    stateService.getVariables.and.returnValue([]);

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
