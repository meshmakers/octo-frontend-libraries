import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { WindowStateService } from '@meshmakers/shared-ui';
import { Subject, of, throwError } from 'rxjs';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import {
  EntitySelectorConfig,
  EntitySelectorScopeHop,
  MAX_SCOPE_HOPS,
  MeshBoardConfig,
  RuntimeEntityData,
  RuntimeEntityDataSource
} from '../../models/meshboard.models';
import type { StreamDataScope } from '../../utils/stream-data-scope';
import { PRE_7723_SELECTORS, SITE_TO_DEVICES } from '../../testing/entity-selector-scope-path.fixtures';

/**
 * Multi-hop child scope in the view (AB#7723): a path of association hops is
 * resolved hop by hop with one batched request per hop, the scope is the
 * distinct rtIds of the last hop, and the AB#7721 contract holds at every hop
 * (empty hop = empty scope, failed hop = failed scope, stale resolutions never
 * win). Existing one-hop boards resolve exactly as before. Neutral fixtures only
 * (Test/Site → Test/System → Test/Device → Test/Sensor).
 */
describe('MeshBoardViewComponent — multi-hop child scope (AB#7723)', () => {
  /** sourceRtId → target rtIds, per target type. dev-2 is reached through both systems. */
  const GRAPH: Record<string, Record<string, string[]>> = {
    'Test/System': { 'site-1': ['sys-1', 'sys-2'], 'site-2': [], 'site-3': ['sys-3'] },
    'Test/Device': { 'sys-1': ['dev-1', 'dev-2'], 'sys-2': ['dev-2', 'dev-3'], 'sys-3': [] },
    'Test/Sensor': { 'dev-1': ['sen-1'], 'dev-2': ['sen-1'], 'dev-3': ['sen-3'] }
  };
  const TO_SYSTEM: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/System' };
  const TO_DEVICE: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' };
  const TO_SENSOR: EntitySelectorScopeHop = { roleId: 'Test/Measures', direction: 'out', targetCkTypeId: 'Test/Sensor' };

  function siteEntity(rtId: string): RuntimeEntityData {
    return {
      rtId,
      ckTypeId: 'Test/Site',
      rtDisplayName: `Site ${rtId}`,
      attributes: [{ attributeName: 'name', value: `Name of ${rtId}` }],
      associations: []
    } as RuntimeEntityData;
  }

  function withPath(...path: EntitySelectorScopeHop[]): EntitySelectorConfig {
    return { ...SITE_TO_DEVICES, childScope: { path } };
  }

  let state: MeshBoardStateService;
  let dataService: {
    fetchRuntimeEntity: ReturnType<typeof vi.fn>;
    fetchAssociationTargets: ReturnType<typeof vi.fn>;
    fetchAssociationTargetRtIds: ReturnType<typeof vi.fn>;
  };

  function setup(selectors: EntitySelectorConfig[], queryParams: Record<string, string> = {}) {
    const config: MeshBoardConfig = {
      id: 'board-1',
      name: 'Site board',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      entitySelectors: selectors
    };
    const persistence = {
      getMeshBoards: vi.fn().mockResolvedValue([{ rtId: 'board-1', name: 'Site board', rtWellKnownName: 'site-board' }]),
      getMeshBoardWithWidgets: vi.fn().mockResolvedValue({ meshBoard: { rtId: 'board-1', name: 'Site board' }, widgets: [] }),
      toMeshBoardConfig: vi.fn().mockReturnValue(config)
    };
    dataService = {
      fetchRuntimeEntity: vi.fn((ds: RuntimeEntityDataSource) => of(siteEntity(ds.rtId!))),
      fetchAssociationTargets: vi.fn((rtId: string, _ck: string, targetCkTypeId: string) =>
        of((GRAPH[targetCkTypeId]?.[rtId] ?? []).map(id => ({ rtId: id })))),
      fetchAssociationTargetRtIds: vi.fn((sources: string[], _ck: string, targetCkTypeId: string) =>
        of(sources.flatMap(s => GRAPH[targetCkTypeId]?.[s] ?? [])))
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'site-board', meshBoardReadonly: true },
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap(queryParams)
      },
      parent: null,
      root: { firstChild: null }
    };
    TestBed.configureTestingModule({
      imports: [MeshBoardViewComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardPersistenceService, useValue: persistence },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn().mockResolvedValue(true) } },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: MeshBoardVariableService, useValue: { mapAttributeTypeToVariableType: () => 'string' } },
        {
          provide: EditModeStateService,
          useValue: { isEditMode: () => false, isSaving: () => false, reset: vi.fn(), hasUnsavedChanges: () => false }
        },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: dataService },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: () => of({ data: null }) } },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    return TestBed.createComponent(MeshBoardViewComponent);
  }

  async function settle(fixture: ReturnType<typeof setup>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function scope(selectorId: string): StreamDataScope {
    return state.resolveStreamDataScope(selectorId, 'streamData');
  }

  async function pick(fixture: ReturnType<typeof setup>, rtId: string): Promise<void> {
    await fixture.componentInstance.onEntitySelectorSelected(
      { selectorId: 'site', entity: { rtId, displayName: `Site ${rtId}` } } as never
    );
  }

  it('resolves a two-hop path to the distinct rtIds of the last hop, one batched request per hop', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2', 'dev-3'] });
    expect(dataService.fetchAssociationTargetRtIds.mock.calls).toEqual([
      [['site-1'], 'Test/Site', 'Test/System', 'System/ParentChild', 'in'],
      [['sys-1', 'sys-2'], 'Test/System', 'Test/Device', 'System/ParentChild', 'in']
    ]);
    expect(dataService.fetchAssociationTargets).not.toHaveBeenCalled();
  });

  it('resolves a three-hop path the same way', async () => {
    const fixture = setup([withPath(TO_SYSTEM, TO_DEVICE, TO_SENSOR)]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['sen-1', 'sen-3'] });
    expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(3);
    expect(dataService.fetchAssociationTargetRtIds)
      .toHaveBeenLastCalledWith(['dev-1', 'dev-2', 'dev-3'], 'Test/Device', 'Test/Sensor', 'Test/Measures', 'out');
  });

  it('requests no further hop and shows no data when hop 1 is empty', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);

    await pick(fixture, 'site-2');

    expect(scope('site')).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(1);
  });

  it('shows no data when a later hop is empty', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);

    await pick(fixture, 'site-3');

    expect(scope('site')).toEqual({ kind: 'empty', reason: 'noTargets' });
  });

  it('fails the scope when any hop fails', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);
    const error = vi.spyOn(console, 'error').mockReturnValue(undefined);
    dataService.fetchAssociationTargetRtIds
      .mockReturnValueOnce(of(['sys-1']))
      .mockReturnValueOnce(throwError(() => new Error('hop 2 failed')));

    await pick(fixture, 'site-1');

    expect(scope('site')).toEqual({ kind: 'empty', reason: 'failed' });
    expect(state.failedEntitySelectorScopeIds()).toEqual(['site']);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('fails the scope of an invalid path without sending a request', async () => {
    const fixture = setup([withPath(...Array.from({ length: MAX_SCOPE_HOPS + 1 }, () => TO_DEVICE))]);
    await settle(fixture);
    vi.spyOn(console, 'error').mockReturnValue(undefined);

    await pick(fixture, 'site-1');

    expect(scope('site')).toEqual({ kind: 'empty', reason: 'failed' });
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });

  it('stays pending until the last hop resolved', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);
    const hop2$ = new Subject<string[]>();
    dataService.fetchAssociationTargetRtIds
      .mockReturnValueOnce(of(['sys-1']))
      .mockReturnValueOnce(hop2$);

    const picking = pick(fixture, 'site-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(scope('site')).toEqual({ kind: 'pending' });

    hop2$.next(['dev-1']);
    hop2$.complete();
    await picking;
    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['dev-1'] });
  });

  it('never lets a slower resolution of an earlier pick override a newer one, and stops its remaining hops', async () => {
    const fixture = setup([SITE_TO_DEVICES]);
    await settle(fixture);
    const firstHop1$ = new Subject<string[]>();
    dataService.fetchAssociationTargetRtIds.mockImplementationOnce(() => firstHop1$);

    const firstPick = pick(fixture, 'site-1');
    // The first pick is waiting on its hop 1 when the second pick starts.
    await vi.waitFor(() => expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(1));
    await pick(fixture, 'site-3');
    expect(scope('site')).toEqual({ kind: 'empty', reason: 'noTargets' });
    const callsAfterSecondPick = dataService.fetchAssociationTargetRtIds.mock.calls.length;

    firstHop1$.next(['sys-1', 'sys-2']);
    firstHop1$.complete();
    await firstPick;

    expect(scope('site')).toEqual({ kind: 'empty', reason: 'noTargets' });
    // The stale pick requested no second hop.
    expect(dataService.fetchAssociationTargetRtIds.mock.calls.length).toBe(callsAfterSecondPick);
  });

  it('resolves a multi-hop path for a follower from its leader\'s pick', async () => {
    const leader: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: true };
    const follower: EntitySelectorConfig = {
      id: 'devices',
      label: 'Devices',
      ckTypeId: 'Test/Site',
      attributeMappings: [],
      showInToolbar: false,
      followsSelectorId: 'site',
      childScope: { path: [TO_SYSTEM, TO_DEVICE] }
    };
    const fixture = setup([leader, follower]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['site-1'] });
    expect(scope('devices')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2', 'dev-3'] });

    await pick(fixture, 'site-2');
    expect(scope('devices')).toEqual({ kind: 'empty', reason: 'noTargets' });
  });

  it('resolves a one-hop board exported before AB#7723 exactly as before', async () => {
    const fixture = setup(PRE_7723_SELECTORS);
    await settle(fixture);

    // The fixed "devices" selector resolved its default on load (one-hop form).
    expect(dataService.fetchAssociationTargets)
      .toHaveBeenCalledWith('sys-1', 'Test/System', 'Test/Device', 'System/ParentChild', 'in');
    expect(scope('devices')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });

    await pick(fixture, 'site-1');

    expect(dataService.fetchAssociationTargets)
      .toHaveBeenCalledWith('site-1', 'Test/Site', 'Test/System', 'System/ParentChild', 'in');
    expect(scope('systems')).toEqual({ kind: 'scoped', rtIds: ['sys-1', 'sys-2'] });
    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['site-1'] });
    // The one-hop form never goes through the batched multi-hop request.
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });
});
