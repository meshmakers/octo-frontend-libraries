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
  MeshBoardConfig,
  RuntimeEntityData,
  RuntimeEntityDataSource
} from '../../models/meshboard.models';
import { BUILDING, ROOM, SITE, SITE_GRAPH, TO_ROOM } from '../../testing/entity-selector-scope-source.fixtures';

/**
 * Dependent selectors in the view (AB#7915): when the leader's pick resolves,
 * the view resolves each dependent's picker scope along `scopeSource.path`
 * (one batched request per hop, distinct rtIds of the last hop) and keeps it
 * in the state service. Pending, empty and failed states, invalid
 * configurations, stale leader picks and clearing are covered here; the
 * toolbar's queries in `entity-selector-toolbar.scope-source.spec.ts`.
 * Neutral fixtures only (Test/Site → Test/Building → Test/Storey → Test/Room).
 */
describe('MeshBoardViewComponent — dependent selector picker scope (AB#7915)', () => {
  function entity(rtId: string, ckTypeId: string): RuntimeEntityData {
    return { rtId, ckTypeId, rtDisplayName: `Name ${rtId}`, attributes: [], associations: [] } as unknown as RuntimeEntityData;
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
      fetchRuntimeEntity: vi.fn((ds: RuntimeEntityDataSource) => of(entity(ds.rtId!, ds.ckTypeId!))),
      fetchAssociationTargets: vi.fn(() =>
        of([])),
      fetchAssociationTargetRtIds: vi.fn((sources: string[], _ck: string, targetCkTypeId: string) =>
        of(sources.flatMap(s => SITE_GRAPH[targetCkTypeId]?.[s] ?? [])))
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

  async function pick(fixture: ReturnType<typeof setup>, rtId: string, selectorId = 'site'): Promise<void> {
    await fixture.componentInstance.onEntitySelectorSelected(
      { selectorId, entity: { rtId, displayName: `Name ${rtId}` } } as never
    );
  }

  it('resolves the distinct rooms of the picked site over three batched hops', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);
    expect(state.getPickerScopeState('room')).toBeUndefined();

    await pick(fixture, 'site-1');

    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: ['room-1', 'room-2', 'room-3', 'room-4'] });
    expect(dataService.fetchAssociationTargetRtIds.mock.calls).toEqual([
      [['site-1'], 'Test/Site', 'Test/Building', 'System/ParentChild', 'in'],
      [['bld-1', 'bld-2'], 'Test/Building', 'Test/Storey', 'System/ParentChild', 'in'],
      [['st-1', 'st-2', 'st-3'], 'Test/Storey', 'Test/Room', 'System/ParentChild', 'in']
    ]);
    // The leader's own widget scope is untouched (its own rtId).
    expect(state.resolveEntitySelectorScope('site')).toEqual({ kind: 'scoped', rtIds: ['site-1'] });
  });

  it('resolves a one-hop scope source the same way', async () => {
    const fixture = setup([SITE, BUILDING]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(state.getPickerScopeState('building')).toEqual({ status: 'resolved', rtIds: ['bld-1', 'bld-2'] });
    expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(1);
  });

  it('has no picker scope while the leader has no pick (lists unscoped)', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);

    expect(state.getPickerScopeState('room')).toBeUndefined();
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });

  it('is pending while a hop is resolving', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);
    const hop1$ = new Subject<string[]>();
    dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(hop1$);

    const picking = pick(fixture, 'site-4');
    expect(state.getPickerScopeState('room')).toEqual({ status: 'pending' });

    hop1$.next(['bld-4']);
    hop1$.complete();
    await picking;
    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: ['room-5'] });
  });

  it('is resolved empty when the pick reaches no room, and requests no further hop', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);

    await pick(fixture, 'site-3');

    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: [] });
    expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(1);
  });

  it('fails when a hop fails and logs one error', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);
    const error = vi.spyOn(console, 'error').mockReturnValue(undefined);
    dataService.fetchAssociationTargetRtIds
      .mockReturnValueOnce(of(['bld-1']))
      .mockReturnValueOnce(throwError(() => new Error('hop 2 failed')));

    await pick(fixture, 'site-1');

    expect(state.getPickerScopeState('room')).toEqual({ status: 'failed' });
    expect(error).toHaveBeenCalledTimes(1);
    // A failed picker scope is not a failed widget scope of the leader.
    expect(state.failedEntitySelectorScopeIds()).toEqual([]);
  });

  it.each([
    ['unknown leader', [{ ...ROOM, scopeSource: { selectorId: 'nope', path: [TO_ROOM] } }]],
    ['chained leader', [
      { ...SITE, scopeSource: { selectorId: 'other', path: [TO_ROOM] } },
      { ...SITE, id: 'other' },
      ROOM
    ]],
    ['follower with scope source', [SITE, { ...ROOM, followsSelectorId: 'site', ckTypeId: 'Test/Site' }]],
    ['more than 5 hops', [SITE, { ...ROOM, scopeSource: { selectorId: 'site', path: [TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM] } }]],
    ['hop without role', [SITE, { ...ROOM, scopeSource: { selectorId: 'site', path: [{ roleId: '', targetCkTypeId: 'Test/Room' }] } }]],
    ['hop without target type', [SITE, { ...ROOM, scopeSource: { selectorId: 'site', path: [{ roleId: 'System/ParentChild', targetCkTypeId: '' }] } }]]
  ])('invalid configuration (%s): failed picker scope, one warning, no request', async (_name, selectors) => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fixture = setup(selectors as EntitySelectorConfig[]);
    await settle(fixture);

    expect(state.getPickerScopeState('room')).toEqual({ status: 'failed' });
    const scopeWarnings = warn.mock.calls.filter(c => String(c[0]).includes("Entity selector 'room' depends on"));
    expect(scopeWarnings).toHaveLength(1);
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });

  it('leader pick S1 → S2: lists the S2 rooms and discards the late S1 resolution', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);
    const s1Hop1$ = new Subject<string[]>();
    dataService.fetchAssociationTargetRtIds.mockImplementationOnce(() => s1Hop1$);

    const firstPick = pick(fixture, 'site-1');
    await vi.waitFor(() => expect(dataService.fetchAssociationTargetRtIds).toHaveBeenCalledTimes(1));
    await pick(fixture, 'site-4');
    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: ['room-5'] });
    const callsAfterSecondPick = dataService.fetchAssociationTargetRtIds.mock.calls.length;

    s1Hop1$.next(['bld-1', 'bld-2']);
    s1Hop1$.complete();
    await firstPick;

    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: ['room-5'] });
    expect(dataService.fetchAssociationTargetRtIds.mock.calls.length).toBe(callsAfterSecondPick);
  });

  it('clearing the leader clears the picker scope (lists unscoped again)', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);
    await pick(fixture, 'site-1');

    await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'site' });

    expect(state.getPickerScopeState('room')).toBeUndefined();
  });

  it('a leader pick from the URL primes the picker scope pending on load and resolves it', async () => {
    const fixture = setup([SITE, ROOM], { es_site: 'site-4' });
    const hop1$ = new Subject<string[]>();
    dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(hop1$);
    fixture.detectChanges();
    await vi.waitFor(() => expect(state.getPickerScopeState('room')).toEqual({ status: 'pending' }));

    hop1$.next(['bld-4']);
    hop1$.complete();
    await settle(fixture);

    expect(state.getPickerScopeState('room')).toEqual({ status: 'resolved', rtIds: ['room-5'] });
  });

  it('a dependent pick does not resolve a picker scope and keeps its own widget scope', async () => {
    const fixture = setup([SITE, ROOM]);
    await settle(fixture);

    await pick(fixture, 'room-2', 'room');

    expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-2'] });
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });

  it('a board without scope sources resolves no picker scope', async () => {
    const fixture = setup([SITE, { ...ROOM, scopeSource: undefined }]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(state.pickerScopes()).toEqual({});
    expect(dataService.fetchAssociationTargetRtIds).not.toHaveBeenCalled();
  });
});
