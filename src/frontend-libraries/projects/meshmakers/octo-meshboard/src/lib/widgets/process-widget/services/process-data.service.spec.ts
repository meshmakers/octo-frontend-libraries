import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GetProcessDiagramDtoGQL, GetProcessDiagramsDtoGQL, CreateProcessDiagramDtoGQL, UpdateProcessDiagramDtoGQL } from '@meshmakers/octo-process-diagrams';
import { ProcessDataService } from './process-data.service';
import { QueryExecutorService, QueryExecutionResult } from '../../../services/query-executor.service';
import { MeshBoardStateService } from '../../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../../services/meshboard-variable.service';
import { MeshBoardDataService } from '../../../services/meshboard-data.service';
import { ProcessWidgetConfig } from '../process-widget-config.model';

/**
 * Covers the stream-data path of the Process Widget's persistent-query binding
 * (AB#4187): the bound query is routed through QueryExecutorService with the
 * persisted family, the MeshBoard time filter / entity-selector scope are bound
 * into streamDataArgs, and the unified result is mapped to QueryResultData.
 */
describe('ProcessDataService — stream-data query binding', () => {
  let service: ProcessDataService;
  let queryExecutor: MockedObject<QueryExecutorService>;
  let stateService: MockedObject<MeshBoardStateService>;
  let variableService: MockedObject<MeshBoardVariableService>;

  function sdResult(): QueryExecutionResult {
    return {
      family: 'streamData',
      queryRtId: 'q1',
      associatedCkTypeId: null,
      columns: [{ attributePath: 'amount.value', attributeValueType: 'Double' }],
      rows: [
        {
          __typename: 'StreamDataQueryRow',
          rtId: 'entity-1',
          cells: [
            { attributePath: 'window_start', value: '2026-01-01T00:00:00Z' },
            { attributePath: 'amount.value', value: 42 }
          ]
        }
      ],
      totalCount: 1,
      hasNextPage: false,
      endCursor: null
    };
  }

  function baseConfig(): ProcessWidgetConfig {
    return {
      id: 'w1',
      type: 'process',
      title: 'Process',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSource: { type: 'static', data: null },
      fitToBounds: true,
      allowZoom: false,
      allowPan: false,
      showToolbar: false,
      initialZoom: 1,
      dataBindingMode: 'persistentQuery',
      bindingQueryRtId: 'q1',
      bindingQueryFamily: 'streamData'
    };
  }

  beforeEach(() => {
    queryExecutor = {
      execute: vi.fn().mockName('QueryExecutorService.execute')
    } as unknown as MockedObject<QueryExecutorService>;
    queryExecutor.execute.mockReturnValue(of(sdResult()) as ReturnType<QueryExecutorService['execute']>);

    stateService = {
      resolveStreamDataTimeArgs: vi.fn().mockName('MeshBoardStateService.resolveStreamDataTimeArgs'),
      resolveStreamDataRtIds: vi.fn().mockName('MeshBoardStateService.resolveStreamDataRtIds'),
      getVariables: vi.fn().mockName('MeshBoardStateService.getVariables')
    } as unknown as MockedObject<MeshBoardStateService>;
    stateService.resolveStreamDataTimeArgs.mockReturnValue(undefined);
    stateService.resolveStreamDataRtIds.mockReturnValue(undefined);
    stateService.getVariables.mockReturnValue([]);

    variableService = {
      convertToFieldFilterDto: vi.fn().mockName('MeshBoardVariableService.convertToFieldFilterDto')
    } as unknown as MockedObject<MeshBoardVariableService>;
    variableService.convertToFieldFilterDto.mockReturnValue(undefined);

    const gqlStub = {} as unknown;

    TestBed.configureTestingModule({
      providers: [
        ProcessDataService,
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: variableService },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: GetProcessDiagramDtoGQL, useValue: gqlStub },
        { provide: GetProcessDiagramsDtoGQL, useValue: gqlStub },
        { provide: CreateProcessDiagramDtoGQL, useValue: gqlStub },
        { provide: UpdateProcessDiagramDtoGQL, useValue: gqlStub }
      ]
    });

    service = TestBed.inject(ProcessDataService);
  });

  it('routes the bound query through the executor with the persisted family', async () => {
    const result = await service.loadBoundData(baseConfig());

    expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
    const args = vi.mocked(queryExecutor.execute).mock.lastCall!;
    expect(args[0]).toBe('streamData');
    expect(args[1]).toBe('q1');

    expect(result?.type).toBe('query');
    const rows = result?.queryResult?.rows ?? [];
    expect(rows.length).toBe(1);
    // Cells are mapped from the unified QueryCell[] into a Map keyed by attributePath.
    expect(rows[0].cells.get('amount.value')).toBe(42);
    expect(result?.queryResult?.totalCount).toBe(1);
  });

  it('binds the active time filter and asset scope into streamDataArgs', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');
    stateService.resolveStreamDataTimeArgs.mockReturnValue({ from, to });
    stateService.resolveStreamDataRtIds.mockReturnValue(['rt-1', 'rt-2']);

    const config = baseConfig();
    config.bindingEntitySelectorId = 'mp';

    await service.loadBoundData(config);

    expect(stateService.resolveStreamDataRtIds).toHaveBeenCalledWith('mp');
    const opts = vi.mocked(queryExecutor.execute).mock.lastCall![2];
    expect(opts?.streamDataArgs).toEqual({ from, to, rtIds: ['rt-1', 'rt-2'] });
  });

  it('honors the time-filter opt-out', async () => {
    const config = baseConfig();
    config.bindingIgnoreTimeFilter = true;

    await service.loadBoundData(config);

    expect(stateService.resolveStreamDataTimeArgs).toHaveBeenCalledWith(true);
    // No time args and no rtIds → no streamDataArgs override.
    const opts = vi.mocked(queryExecutor.execute).mock.lastCall![2];
    expect(opts?.streamDataArgs).toBeUndefined();
  });

  it('still maps a runtime query result (no streamDataArgs)', async () => {
    queryExecutor.execute.mockReturnValue(of({
      ...sdResult(),
      family: 'runtime',
      rows: [
        {
          __typename: 'RtSimpleQueryRow',
          rtId: 'e-9',
          ckTypeId: 'OctoSdk/Thing',
          cells: [{ attributePath: 'amount.value', value: 7 }]
        }
      ]
    }) as ReturnType<QueryExecutorService['execute']>);

    const config = baseConfig();
    config.bindingQueryFamily = 'runtime';

    const result = await service.loadBoundData(config);

    const opts = vi.mocked(queryExecutor.execute).mock.lastCall![2];
    expect(opts?.streamDataArgs).toBeUndefined();
    expect(result?.queryResult?.rows[0].cells.get('amount.value')).toBe(7);
    expect(result?.queryResult?.rows[0].rtId).toBe('e-9');
  });
});
