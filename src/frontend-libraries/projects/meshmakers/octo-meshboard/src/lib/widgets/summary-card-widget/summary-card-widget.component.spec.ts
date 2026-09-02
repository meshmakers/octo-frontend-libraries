import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SummaryCardWidgetComponent } from './summary-card-widget.component';
import { GetDashboardEntityDtoGQL } from '../../graphQL/getDashboardEntity';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { SummaryCardWidgetConfig, PersistentQueryCellSource } from '../../models/meshboard.models';

function sdRow(cells: Record<string, unknown>) {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'entity-1',
    cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value }))
  };
}

function execResult(rows: unknown[], total: number) {
  return {
    family: 'streamData', queryRtId: 'q1', associatedCkTypeId: null,
    columns: [], rows, totalCount: total, hasNextPage: false, endCursor: null
  };
}

describe('SummaryCardWidgetComponent — stream-data persistent-query tiles', () => {
  function create(source: PersistentQueryCellSource, rows: unknown[], total: number): SummaryCardWidgetComponent {
    const queryExecutor = {
      execute: vi.fn().mockName('QueryExecutorService.execute')
    };
    queryExecutor.execute.mockReturnValue(of(execResult(rows, total)) as ReturnType<QueryExecutorService['execute']>);

    const entityGQL = {
      fetch: vi.fn().mockName('GetDashboardEntityDtoGQL.fetch')
    };
    const dataService = {
      fetchAggregations: vi.fn().mockName('MeshBoardDataService.fetchAggregations')
    };

    const stateService = {
      resolveStreamDataTimeArgs: vi.fn().mockName('MeshBoardStateService.resolveStreamDataTimeArgs'),
      resolveStreamDataRtIds: vi.fn().mockName('MeshBoardStateService.resolveStreamDataRtIds'),
      getVariables: vi.fn().mockName('MeshBoardStateService.getVariables')
    };
    stateService.resolveStreamDataTimeArgs.mockReturnValue(undefined);
    stateService.resolveStreamDataRtIds.mockReturnValue(undefined);
    stateService.getVariables.mockReturnValue([]);

    const variableService = {
      convertToFieldFilterDto: vi.fn().mockName('MeshBoardVariableService.convertToFieldFilterDto')
    };
    variableService.convertToFieldFilterDto.mockReturnValue(undefined);

    TestBed.configureTestingModule({
      imports: [SummaryCardWidgetComponent],
      providers: [
        { provide: GetDashboardEntityDtoGQL, useValue: entityGQL },
        { provide: MeshBoardDataService, useValue: dataService },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: variableService }
      ]
    });

    const cmp = TestBed.createComponent(SummaryCardWidgetComponent).componentInstance;
    cmp.config = {
      id: 'w1', type: 'summaryCard', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'runtimeEntity' },
      columns: 2,
      tiles: [{ id: 't1', label: 'Metric', persistentQuerySource: source }]
    } as SummaryCardWidgetConfig;
    return cmp;
  }

  async function load(cmp: SummaryCardWidgetComponent): Promise<void> {
    await (cmp as unknown as {
      loadData(): Promise<void>;
    }).loadData();
  }

  it('renders totalCount for a simpleCount SD query', async () => {
    const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'simpleCount' }, [sdRow({ x: 1 })], 42);
    await load(cmp);
    expect(cmp.tileValues()[0].value).toBe('42');
  });

  it('renders the value field for an aggregation SD query', async () => {
    const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'aggregation', queryValueField: 'amountvalue_sum' }, [sdRow({ amountvalue_sum: 123 })], 1);
    await load(cmp);
    expect(cmp.tileValues()[0].value).toBe('123');
  });

  it('renders the matching category value for a groupedAggregation SD query', async () => {
    const cmp = create({
      queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'groupedAggregation',
      queryCategoryField: 'operatingstatus', queryCategoryValue: 'RUNNING', queryValueField: 'amountvalue_sum'
    }, [
      sdRow({ operatingstatus: 'STOPPED', amountvalue_sum: 5 }),
      sdRow({ operatingstatus: 'RUNNING', amountvalue_sum: 9 })
    ], 2);
    await load(cmp);
    expect(cmp.tileValues()[0].value).toBe('9');
  });

  it('passes asset-scope rtIds as streamDataArgs', async () => {
    const cmp = create({ queryRtId: 'q1', queryFamily: 'streamData', queryMode: 'simpleCount', entitySelectorId: 'mp' }, [], 3);
    const state = TestBed.inject(MeshBoardStateService) as MockedObject<MeshBoardStateService>;
    state.resolveStreamDataRtIds.mockReturnValue(['rt-1']);
    await load(cmp);
    const qe = TestBed.inject(QueryExecutorService) as MockedObject<QueryExecutorService>;
    const opts = vi.mocked(qe.execute).mock.lastCall![2];
    expect(opts?.streamDataArgs?.rtIds).toEqual(['rt-1']);
  });
});
