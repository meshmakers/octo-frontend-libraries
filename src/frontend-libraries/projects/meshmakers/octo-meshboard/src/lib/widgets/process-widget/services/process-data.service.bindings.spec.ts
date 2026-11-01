import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { GetProcessDiagramDtoGQL, GetProcessDiagramsDtoGQL, CreateProcessDiagramDtoGQL, UpdateProcessDiagramDtoGQL } from '@meshmakers/octo-process-diagrams';
import { ProcessDataService } from './process-data.service';
import { QueryExecutorService, QueryExecutionResult } from '../../../services/query-executor.service';
import { MeshBoardStateService } from '../../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../../services/meshboard-variable.service';
import { MeshBoardDataService } from '../../../services/meshboard-data.service';
import { ProcessWidgetBinding, ProcessWidgetConfig } from '../process-widget-config.model';
import { EntitySelectorConfig, RuntimeEntityData } from '../../../models/meshboard.models';
import { StreamDataScope } from '../../../utils/stream-data-scope';

/**
 * Several named bindings per Process Widget (AB#8023): each binding follows its
 * own entity selector, all load in parallel, a pending / empty / failing
 * binding never blocks or contaminates the others.
 */
describe('ProcessDataService — named bindings (AB#8023)', () => {
  let service: ProcessDataService;
  let queryExecutor: MockedObject<QueryExecutorService>;
  let stateService: MockedObject<MeshBoardStateService>;
  let dataService: MockedObject<MeshBoardDataService>;

  /** Scope per selector id; a missing entry is `unscoped`. */
  let scopes: Record<string, StreamDataScope>;
  let selectors: EntitySelectorConfig[];

  function rtResult(queryRtId: string, value: number, rows = 1): QueryExecutionResult {
    return {
      family: 'runtime',
      queryRtId,
      associatedCkTypeId: null,
      columns: [{ attributePath: 'power', attributeValueType: 'Double' }],
      rows: Array.from({ length: rows }, (_, i) => ({
        __typename: 'RtSimpleQueryRow',
        rtId: `${queryRtId}-row-${i}`,
        cells: [{ attributePath: 'power', value: value + i }]
      })),
      totalCount: rows,
      hasNextPage: false,
      endCursor: null
    } as unknown as QueryExecutionResult;
  }

  function entity(rtId: string, soc: number): RuntimeEntityData {
    return {
      rtId,
      ckTypeId: 'Test/Battery',
      attributes: [{ attributeName: 'stateOfCharge', value: soc }]
    } as unknown as RuntimeEntityData;
  }

  function query(name: string, selectorId: string): ProcessWidgetBinding {
    return { name, mode: 'persistentQuery', queryRtId: `q-${name}`, queryFamily: 'runtime', entitySelectorId: selectorId };
  }

  /** The EnergyIQ flow: five followers of the site selector. */
  function energyFlowConfig(): ProcessWidgetConfig {
    return {
      id: 'flow',
      type: 'process',
      title: 'Energiefluss',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSource: { type: 'static', data: null },
      bindings: [
        query('netz', 'netz'),
        query('pv', 'pv'),
        { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' },
        query('wallboxen', 'wallboxen'),
        query('geraete', 'geraete')
      ],
      propertyMappings: [
        { propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
        { propertyId: 'pv', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
        { propertyId: 'soc', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie' }
      ]
    };
  }

  /** Runtime query results keyed by query rtId and the scope it was sent with. */
  function executeByScope(values: Record<string, number>): void {
    queryExecutor.execute.mockImplementation(((_family: unknown, queryRtId: string, opts?: { scopeRtIds?: string[] }) => {
      const key = `${queryRtId}@${(opts?.scopeRtIds ?? []).join(',')}`;
      if (!(key in values)) {
        return throwError(() => new Error(`unexpected query ${key}`));
      }
      return of(rtResult(queryRtId, values[key]));
    }) as unknown as QueryExecutorService['execute']);
  }

  beforeEach(() => {
    scopes = {};
    selectors = [];

    queryExecutor = {
      execute: vi.fn().mockName('QueryExecutorService.execute')
    } as unknown as MockedObject<QueryExecutorService>;

    stateService = {
      resolveStreamDataTimeArgs: vi.fn().mockReturnValue(undefined),
      resolveStreamDataRtIds: vi.fn((id?: string) => {
        const scope = id ? scopes[id] : undefined;
        return scope?.kind === 'scoped' ? scope.rtIds : undefined;
      }),
      resolveStreamDataScope: vi.fn((id?: string) => (id && scopes[id]) || { kind: 'unscoped' }),
      resolveEntitySelectorScope: vi.fn((id?: string) => (id && scopes[id]) || { kind: 'unscoped' }),
      getVariables: vi.fn().mockReturnValue([]),
      getConfig: vi.fn(() => ({ entitySelectors: selectors }))
    } as unknown as MockedObject<MeshBoardStateService>;

    dataService = {
      fetchEntityWithAssociations: vi.fn().mockName('MeshBoardDataService.fetchEntityWithAssociations')
    } as unknown as MockedObject<MeshBoardDataService>;

    const gqlStub = {} as unknown;

    TestBed.configureTestingModule({
      providers: [
        ProcessDataService,
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined), resolveVariables: vi.fn((s: string) => s) } },
        { provide: MeshBoardDataService, useValue: dataService },
        { provide: GetProcessDiagramDtoGQL, useValue: gqlStub },
        { provide: GetProcessDiagramsDtoGQL, useValue: gqlStub },
        { provide: CreateProcessDiagramDtoGQL, useValue: gqlStub },
        { provide: UpdateProcessDiagramDtoGQL, useValue: gqlStub }
      ]
    });

    service = TestBed.inject(ProcessDataService);
  });

  it('loads every binding from its own selector scope', async () => {
    scopes = {
      netz: { kind: 'scoped', rtIds: ['grid-firmian'] },
      pv: { kind: 'scoped', rtIds: ['pv-firmian'] },
      batterie: { kind: 'scoped', rtIds: ['bat-firmian'] },
      wallboxen: { kind: 'scoped', rtIds: ['wb-1', 'wb-2'] },
      geraete: { kind: 'scoped', rtIds: ['dev-1'] }
    };
    executeByScope({
      'q-netz@grid-firmian': 2.5,
      'q-pv@pv-firmian': 14.4,
      'q-wallboxen@wb-1,wb-2': 11,
      'q-geraete@dev-1': 0.7
    });
    dataService.fetchEntityWithAssociations.mockReturnValue(of(entity('bat-firmian', 63)));

    const results = await service.loadBindings(energyFlowConfig());

    expect([...results.keys()]).toEqual(['netz', 'pv', 'batterie', 'wallboxen', 'geraete']);
    expect(results.get('netz')?.queryResult?.rows[0].cells.get('power')).toBe(2.5);
    expect(results.get('pv')?.queryResult?.rows[0].cells.get('power')).toBe(14.4);
    expect(results.get('wallboxen')?.queryResult?.rows[0].cells.get('power')).toBe(11);
    expect(results.get('geraete')?.queryResult?.rows[0].cells.get('power')).toBe(0.7);
    expect(results.get('batterie')?.entity?.rtId).toBe('bat-firmian');
    expect(dataService.fetchEntityWithAssociations).toHaveBeenCalledWith('bat-firmian', 'Test/Battery');
    for (const [name, result] of results) {
      expect(result.bindingName).toBe(name);
      expect(result.error).toBeUndefined();
    }
  });

  it('starts all bindings before any of them finished (parallel load)', async () => {
    scopes = { netz: { kind: 'scoped', rtIds: ['g'] }, pv: { kind: 'scoped', rtIds: ['p'] } };
    const started: string[] = [];
    const release: (() => void)[] = [];
    queryExecutor.execute.mockImplementation(((_f: unknown, queryRtId: string) => {
      started.push(queryRtId);
      return new Observable<QueryExecutionResult>(sub => {
        release.push(() => {
          sub.next(rtResult(queryRtId, 1));
          sub.complete();
        });
      });
    }) as unknown as QueryExecutorService['execute']);

    const config = energyFlowConfig();
    config.bindings = [query('netz', 'netz'), query('pv', 'pv')];
    const pending = service.loadBindings(config);
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual(['q-netz', 'q-pv']);
    release.forEach(r => r());
    const results = await pending;
    expect(results.size).toBe(2);
  });

  it('switching the leader re-queries every binding with the new scope and keeps no old value', async () => {
    scopes = {
      netz: { kind: 'scoped', rtIds: ['grid-firmian'] },
      pv: { kind: 'scoped', rtIds: ['pv-firmian'] },
      batterie: { kind: 'scoped', rtIds: ['bat-firmian'] }
    };
    executeByScope({ 'q-netz@grid-firmian': 2.5, 'q-pv@pv-firmian': 14.4 });
    dataService.fetchEntityWithAssociations.mockImplementation((rtId: string) => of(entity(rtId, rtId === 'bat-firmian' ? 63 : 20)));
    const config = energyFlowConfig();
    config.bindings = config.bindings!.slice(0, 3);

    const first = await service.loadBindings(config);
    expect(first.get('pv')?.queryResult?.rows[0].cells.get('power')).toBe(14.4);

    // Firmianstraße → Fusch: Fusch has a grid meter and a battery but no PV.
    scopes = {
      netz: { kind: 'scoped', rtIds: ['grid-fusch'] },
      pv: { kind: 'empty', reason: 'noTargets' },
      batterie: { kind: 'scoped', rtIds: ['bat-fusch'] }
    };
    executeByScope({ 'q-netz@grid-fusch': 4.1 });

    const second = await service.loadBindings(config);
    expect(second.get('netz')?.queryResult?.rows[0].cells.get('power')).toBe(4.1);
    expect(second.get('pv')?.queryResult?.rows).toEqual([]);
    expect(second.get('pv')?.error).toBeUndefined();
    expect(second.get('batterie')?.entity?.rtId).toBe('bat-fusch');
    // The empty PV scope sent no query.
    expect(vi.mocked(queryExecutor.execute).mock.calls.filter(c => c[1] === 'q-pv').length).toBe(1);
  });

  it('a pending binding is marked pending, the others load', async () => {
    scopes = { netz: { kind: 'scoped', rtIds: ['g'] }, pv: { kind: 'pending' }, batterie: { kind: 'pending' } };
    executeByScope({ 'q-netz@g': 2.5 });
    const config = energyFlowConfig();
    config.bindings = config.bindings!.slice(0, 3);

    const results = await service.loadBindings(config);

    expect(results.get('netz')?.queryResult?.rows.length).toBe(1);
    expect(results.get('pv')?.pending).toBe(true);
    expect(results.get('batterie')?.pending).toBe(true);
    expect(dataService.fetchEntityWithAssociations).not.toHaveBeenCalled();
  });

  it('a failing binding carries its error and name, the others still load', async () => {
    scopes = { netz: { kind: 'scoped', rtIds: ['g'] }, pv: { kind: 'scoped', rtIds: ['p'] } };
    queryExecutor.execute.mockImplementation(((_f: unknown, queryRtId: string) =>
      queryRtId === 'q-pv' ? throwError(() => new Error('Query failed')) : of(rtResult(queryRtId, 2.5))
    ) as unknown as QueryExecutorService['execute']);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const config = energyFlowConfig();
    config.bindings = [query('netz', 'netz'), query('pv', 'pv')];

    const results = await service.loadBindings(config);

    expect(results.get('netz')?.queryResult?.rows[0].cells.get('power')).toBe(2.5);
    expect(results.get('pv')).toEqual(expect.objectContaining({ bindingName: 'pv', type: 'query', error: 'Query failed' }));
  });

  describe('runtime entity binding without rtId', () => {
    function single(binding: ProcessWidgetBinding): ProcessWidgetConfig {
      return { ...energyFlowConfig(), bindings: [binding], propertyMappings: [] };
    }

    it('loads the current entity of the selector', async () => {
      scopes = { site: { kind: 'scoped', rtIds: ['site-fusch'] } };
      dataService.fetchEntityWithAssociations.mockReturnValue(of(entity('site-fusch', 1)));

      const results = await service.loadBindings(single({ name: 'site', mode: 'runtimeEntity', ckTypeId: 'Test/Site', entitySelectorId: 'site' }));

      expect(dataService.fetchEntityWithAssociations).toHaveBeenCalledWith('site-fusch', 'Test/Site');
      expect(results.get('site')?.entity?.rtId).toBe('site-fusch');
    });

    it('takes the CK type from a selector without child scope', async () => {
      selectors = [{ id: 'site', label: 'Standort', ckTypeId: 'Test/Site', attributeMappings: [] }];
      scopes = { site: { kind: 'scoped', rtIds: ['site-fusch'] } };
      dataService.fetchEntityWithAssociations.mockReturnValue(of(entity('site-fusch', 1)));

      await service.loadBindings(single({ name: 'site', mode: 'runtimeEntity', entitySelectorId: 'site' }));

      expect(dataService.fetchEntityWithAssociations).toHaveBeenCalledWith('site-fusch', 'Test/Site');
    });

    it('gives no entity for an empty scope or a selector without pick', async () => {
      scopes = { site: { kind: 'empty', reason: 'noTargets' } };
      const binding: ProcessWidgetBinding = { name: 'site', mode: 'runtimeEntity', ckTypeId: 'Test/Site', entitySelectorId: 'site' };

      const empty = await service.loadBindings(single(binding));
      scopes = {};
      const unscoped = await service.loadBindings(single(binding));

      for (const result of [empty.get('site'), unscoped.get('site')]) {
        expect(result?.entity).toBeUndefined();
        expect(result?.error).toBeUndefined();
        expect(result?.pending).toBeUndefined();
      }
      expect(dataService.fetchEntityWithAssociations).not.toHaveBeenCalled();
    });

    it('with neither rtId nor selector gives no value and reports the config error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const results = await service.loadBindings(single({ name: 'site', mode: 'runtimeEntity', ckTypeId: 'Test/Site' }));

      expect(results.get('site')?.entity).toBeUndefined();
      expect(results.get('site')?.error).toBe('Runtime entity binding needs an rtId or an entity selector');
      expect(dataService.fetchEntityWithAssociations).not.toHaveBeenCalled();
    });

    it('a fixed rtId wins over the selector', async () => {
      scopes = { site: { kind: 'scoped', rtIds: ['site-fusch'] } };
      dataService.fetchEntityWithAssociations.mockReturnValue(of(entity('site-fixed', 1)));

      await service.loadBindings(single({ name: 'site', mode: 'runtimeEntity', ckTypeId: 'Test/Site', rtId: 'site-fixed', entitySelectorId: 'site' }));

      expect(dataService.fetchEntityWithAssociations).toHaveBeenCalledWith('site-fixed', 'Test/Site');
    });
  });

  describe('legacy single-binding config', () => {
    function legacy(): ProcessWidgetConfig {
      return {
        ...energyFlowConfig(),
        bindings: undefined,
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'q-legacy',
        bindingQueryFamily: 'runtime',
        bindingEntitySelectorId: 'site',
        propertyMappings: [{ propertyId: 'grid', sourceType: 'column', sourcePath: 'power' }]
      };
    }

    it('is read as one binding named default with the same query as before', async () => {
      scopes = { site: { kind: 'scoped', rtIds: ['s1'] } };
      executeByScope({ 'q-legacy@s1': 3 });

      const results = await service.loadBindings(legacy());
      const legacyResult = await service.loadBoundData(legacy());

      expect([...results.keys()]).toEqual(['default']);
      expect(results.get('default')?.queryResult?.rows[0].cells.get('power')).toBe(3);
      expect(legacyResult?.queryResult?.rows[0].cells.get('power')).toBe(3);
      const opts = vi.mocked(queryExecutor.execute).mock.calls[0][2];
      expect(opts).toEqual(expect.objectContaining({ first: 1000, scopeRtIds: ['s1'] }));
    });

    it('loads nothing without a binding mode', async () => {
      const config = { ...legacy(), dataBindingMode: 'none' as const };

      expect((await service.loadBindings(config)).size).toBe(0);
      expect(await service.loadBoundData(config)).toBeNull();
      expect(queryExecutor.execute).not.toHaveBeenCalled();
    });
  });
});
