import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { WindowStateService } from '@meshmakers/shared-ui';
import { Observable, Subject, of } from 'rxjs';
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
import { EntitySelectorConfig, MeshBoardConfig, RuntimeEntityData, RuntimeEntityDataSource } from '../../models/meshboard.models';
import type { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Leader/follower entity selectors in the view (AB#7722): a hidden follower takes
 * its leader's pick, resolves its own child scope and mappings from it, follows
 * the AB#7721 scope contract (pending while the leader is pending, empty when the
 * pick has nothing on its path) and uses its own defaultRtId only while the leader
 * has no pick. Neutral fixtures only (Test/Site → Test/Device, Test/Sensor).
 */
describe('MeshBoardViewComponent — entity selector follow (AB#7722)', () => {
  const SITE: EntitySelectorConfig = {
    id: 'site',
    label: 'Site',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: true
  };
  const GRID: EntitySelectorConfig = {
    id: 'grid',
    label: 'Grid',
    ckTypeId: 'Test/Site',
    attributeMappings: [{ attributePath: 'name', variableName: 'gridSiteName' }],
    showInToolbar: false,
    followsSelectorId: 'site',
    childScope: { targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'in' }
  };
  const SENSORS: EntitySelectorConfig = {
    id: 'sensors',
    label: 'Sensors',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: false,
    followsSelectorId: 'site',
    childScope: { targetCkTypeId: 'Test/Sensor', roleId: 'System/ParentChild', direction: 'in' }
  };

  function siteEntity(rtId: string): RuntimeEntityData {
    return {
      rtId,
      ckTypeId: 'Test/Site',
      rtDisplayName: `Site ${rtId}`,
      attributes: [{ attributeName: 'name', value: `Name of ${rtId}` }],
      associations: []
    } as RuntimeEntityData;
  }

  /** Child rtIds per target type and picked site. */
  let targets: Record<string, Record<string, string[]>>;
  let state: MeshBoardStateService;
  let dataService: {
    fetchRuntimeEntity: ReturnType<typeof vi.fn>;
    fetchAssociationTargets: ReturnType<typeof vi.fn>;
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
    targets = {
      'Test/Device': { 'site-1': ['dev-1', 'dev-2'], 'site-2': [] },
      'Test/Sensor': { 'site-1': ['sen-1'], 'site-2': ['sen-2'] }
    };
    dataService = {
      fetchRuntimeEntity: vi.fn((ds: RuntimeEntityDataSource) => of(siteEntity(ds.rtId!))),
      fetchAssociationTargets: vi.fn((rtId: string, _ck: string, targetCkTypeId: string) =>
        of((targets[targetCkTypeId]?.[rtId] ?? []).map(id => ({ rtId: id }))))
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

  async function settle(fixture: ReturnType<typeof setup>): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function scope(selectorId: string): StreamDataScope {
    return state.resolveStreamDataScope(selectorId, 'streamData');
  }

  function variable(name: string): string | undefined {
    return state.getVariables().find(v => v.name === name)?.value;
  }

  async function pick(fixture: ReturnType<typeof setup>, rtId: string): Promise<void> {
    await fixture.componentInstance.onEntitySelectorSelected(
      { selectorId: 'site', entity: { rtId, displayName: `Site ${rtId}` } } as never
    );
  }

  it('resolves a hidden follower\'s child scope from the leader\'s pick and refreshes its widgets', async () => {
    const fixture = setup([SITE, GRID]);
    await settle(fixture);
    expect(scope('grid')).toEqual({ kind: 'unscoped' });
    const refresh = vi.spyOn(state, 'triggerRefresh').mockReturnValue(undefined);

    await pick(fixture, 'site-1');

    expect(dataService.fetchAssociationTargets)
      .toHaveBeenCalledWith('site-1', 'Test/Site', 'Test/Device', 'System/ParentChild', 'in');
    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
    // The leader itself has no childScope: its own pick is its scope.
    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['site-1'] });
    expect(state.getEntitySelector('grid')?.selectedRtId).toBe('site-1');
    expect(refresh).toHaveBeenCalled();
    // One entity fetch serves the leader and its followers.
    expect(dataService.fetchRuntimeEntity).toHaveBeenCalledTimes(1);
  });

  it('rescopes two followers with different target types from one pick', async () => {
    const fixture = setup([SITE, GRID, SENSORS]);
    await settle(fixture);

    await pick(fixture, 'site-1');
    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
    expect(scope('sensors')).toEqual({ kind: 'scoped', rtIds: ['sen-1'] });

    await pick(fixture, 'site-2');
    expect(scope('sensors')).toEqual({ kind: 'scoped', rtIds: ['sen-2'] });
  });

  it('shows no data for a follower whose path is empty at the picked entity (AB#7721 empty scope)', async () => {
    const fixture = setup([SITE, GRID, SENSORS]);
    await settle(fixture);

    await pick(fixture, 'site-2');

    expect(scope('grid')).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(scope('sensors')).toEqual({ kind: 'scoped', rtIds: ['sen-2'] });
  });

  it('produces the follower\'s attribute-mapping variables from the leader\'s picked entity', async () => {
    const fixture = setup([SITE, GRID]);
    await settle(fixture);

    await pick(fixture, 'site-1');

    expect(variable('gridSiteName')).toBe('Name of site-1');
    expect(variable('grid_rtId')).toBe('site-1');
    expect(variable('grid_rtCkTypeId')).toBe('Test/Site');
  });

  it('keeps a follower pending while its leader\'s pick is pending', async () => {
    const fixture = setup([{ ...SITE, defaultRtId: 'site-1' }, GRID]);
    const entity$ = new Subject<RuntimeEntityData>();
    dataService.fetchRuntimeEntity.mockReturnValue(entity$ as Observable<RuntimeEntityData>);

    await settle(fixture);
    expect(scope('site')).toEqual({ kind: 'pending' });
    expect(scope('grid')).toEqual({ kind: 'pending' });

    entity$.next(siteEntity('site-1'));
    entity$.complete();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
  });

  it('uses the follower\'s own defaultRtId while the leader has no pick', async () => {
    const fixture = setup([SITE, { ...GRID, defaultRtId: 'site-2', ckTypeId: 'Test/Stale' }]);

    await settle(fixture);

    // Fetched with the leader's CK type, not the stale stored one.
    expect(dataService.fetchRuntimeEntity).toHaveBeenCalledWith(expect.objectContaining({ ckTypeId: 'Test/Site', rtId: 'site-2' }));
    expect(scope('grid')).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(scope('site')).toEqual({ kind: 'unscoped' });
  });

  it('leaves a follower without defaultRtId unscoped while the leader has no pick', async () => {
    const fixture = setup([SITE, GRID]);

    await settle(fixture);

    expect(scope('grid')).toEqual({ kind: 'unscoped' });
    expect(dataService.fetchRuntimeEntity).not.toHaveBeenCalled();
  });

  it('prefers the leader\'s pick over the follower\'s defaultRtId', async () => {
    const fixture = setup([SITE, { ...GRID, defaultRtId: 'site-2' }], { es_site: 'site-1' });

    await settle(fixture);

    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
  });

  it('falls back to the follower\'s default, or to no scope, when the leader\'s pick is cleared', async () => {
    const fixture = setup([SITE, { ...GRID, defaultRtId: 'site-2' }, SENSORS], { es_site: 'site-1' });
    await settle(fixture);
    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });

    await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'site' });

    expect(scope('site')).toEqual({ kind: 'unscoped' });
    expect(scope('grid')).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(state.getEntitySelector('grid')?.selectedRtId).toBe('site-2');
    expect(scope('sensors')).toEqual({ kind: 'unscoped' });
    expect(state.getEntitySelector('sensors')?.selectedRtId).toBeUndefined();
    expect(variable('sensors_rtId')).toBeUndefined();
  });

  it('restores all followers from a URL that carries only the leader\'s es_ param', async () => {
    const fixture = setup([SITE, GRID, SENSORS], { es_site: 'site-1' });

    await settle(fixture);

    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
    expect(scope('sensors')).toEqual({ kind: 'scoped', rtIds: ['sen-1'] });
  });

  it('ignores an es_ param for a follower', async () => {
    const fixture = setup([SITE, GRID], { es_grid: 'site-1' });

    await settle(fixture);

    expect(scope('grid')).toEqual({ kind: 'unscoped' });
    expect(dataService.fetchRuntimeEntity).not.toHaveBeenCalled();
  });

  it('writes only the leader to the URL', async () => {
    const fixture = setup([SITE, GRID]);
    await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await pick(fixture, 'site-1');

    const urls = navigate.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('es_site=site-1'))).toBe(true);
    expect(urls.some(u => u.includes('es_grid'))).toBe(false);
  });

  it('renders no picker for a follower', async () => {
    const fixture = setup([SITE, GRID]);

    const el = await settle(fixture);

    expect(el.querySelectorAll('mm-entity-select-input').length).toBe(1);
  });

  it('treats an unknown leader as "leader has no pick" and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = setup([SITE, { ...GRID, followsSelectorId: 'gone', defaultRtId: 'site-1' }], { es_site: 'site-2' });

    await settle(fixture);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('\'grid\' follows \'gone\''));
    expect(scope('grid')).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
  });

  it('refuses to set or clear a follower directly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = setup([SITE, GRID]);
    await settle(fixture);

    await fixture.componentInstance.setEntitySelector('grid', 'site-1');
    fixture.componentInstance.clearEntitySelector('grid');

    expect(warn).toHaveBeenCalledWith('Entity selector \'grid\' follows \'site\' and cannot be set directly');
    expect(warn).toHaveBeenCalledWith('Entity selector \'grid\' follows \'site\' and cannot be cleared directly');
    expect(scope('grid')).toEqual({ kind: 'unscoped' });
  });

  it('ignores a slower resolution of an earlier leader pick for the follower', async () => {
    const fixture = setup([SITE, GRID]);
    await settle(fixture);
    const first$ = new Subject<RuntimeEntityData>();
    const second$ = new Subject<RuntimeEntityData>();
    dataService.fetchRuntimeEntity.mockReturnValueOnce(first$).mockReturnValueOnce(second$);

    const firstPick = pick(fixture, 'site-1');
    const secondPick = pick(fixture, 'site-2');
    second$.next(siteEntity('site-2'));
    second$.complete();
    await secondPick;
    first$.next(siteEntity('site-1'));
    first$.complete();
    await firstPick;

    expect(scope('grid')).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(variable('grid_rtId')).toBe('site-2');
  });
});
