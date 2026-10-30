import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { WindowStateService } from '@meshmakers/shared-ui';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { EntitySelectorConfig, MeshBoardConfig, RuntimeEntityData } from '../../models/meshboard.models';
import type { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Entity-selector scope resolution in the view (AB#7721): a pick that resolves to
 * zero rtIds or fails must become an EMPTY scope (no data, no query), never the
 * query's persisted scope; while it resolves the scope is pending.
 * Neutral fixtures only (Test/Site → Test/Device).
 */
describe('MeshBoardViewComponent — entity selector scope (AB#7721)', () => {
  const SITE_SELECTOR: EntitySelectorConfig = {
    id: 'site',
    label: 'Site',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: false,
    defaultRtId: 'site-1',
    childScope: { targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'in' }
  };

  const SITE_ENTITY: RuntimeEntityData = {
    rtId: 'site-1',
    ckTypeId: 'Test/Site',
    rtDisplayName: 'Site One',
    attributes: [],
    associations: []
  } as RuntimeEntityData;

  let state: MeshBoardStateService;
  let dataService: {
    fetchRuntimeEntity: ReturnType<typeof vi.fn>;
    fetchAssociationTargets: ReturnType<typeof vi.fn>;
  };

  function setup(selectors: EntitySelectorConfig[], queryParams: Record<string, string> = {}) {
    const config: MeshBoardConfig = {
      id: 'board-1',
      name: 'Scoped board',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      entitySelectors: selectors
    };
    const persistence = {
      getMeshBoards: vi.fn().mockResolvedValue([{ rtId: 'board-1', name: 'Scoped board', rtWellKnownName: 'scoped' }]),
      getMeshBoardWithWidgets: vi.fn().mockResolvedValue({ meshBoard: { rtId: 'board-1', name: 'Scoped board' }, widgets: [] }),
      toMeshBoardConfig: vi.fn().mockReturnValue(config)
    };
    dataService = {
      fetchRuntimeEntity: vi.fn().mockReturnValue(of(SITE_ENTITY)),
      fetchAssociationTargets: vi.fn().mockReturnValue(of([]))
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'scoped', meshBoardReadonly: true },
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
        MeshBoardStateService,
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardPersistenceService, useValue: persistence },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn().mockResolvedValue(true) } },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: MeshBoardVariableService, useValue: {} },
        {
          provide: EditModeStateService,
          useValue: { isEditMode: () => false, isSaving: () => false, reset: vi.fn(), hasUnsavedChanges: () => false }
        },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: dataService },
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

  function scope(): StreamDataScope {
    return state.resolveStreamDataScope('site', 'streamData');
  }

  it('turns a pick without child-scope targets into an empty scope and refreshes the widgets', async () => {
    const fixture = setup([SITE_SELECTOR]);
    const refresh = vi.spyOn(MeshBoardStateService.prototype, 'triggerRefresh');

    const el = await settle(fixture);

    expect(dataService.fetchAssociationTargets).toHaveBeenCalledWith('site-1', 'Test/Site', 'Test/Device', 'System/ParentChild', 'in');
    expect(scope()).toEqual({ kind: 'empty', reason: 'noTargets' });
    expect(refresh).toHaveBeenCalled();
    // "Nothing in scope" is not an error: no notice.
    expect(el.querySelector('.scope-resolution-errors')).toBeNull();
  });

  it('scopes to the resolved child rtIds', async () => {
    const fixture = setup([SITE_SELECTOR]);
    dataService.fetchAssociationTargets.mockReturnValue(of([{ rtId: 'dev-1' }, { rtId: 'dev-2' }]));

    await settle(fixture);

    expect(scope()).toEqual({ kind: 'scoped', rtIds: ['dev-1', 'dev-2'] });
  });

  it('turns a failed lookup into an empty scope, logs once and tells the user', async () => {
    const fixture = setup([SITE_SELECTOR]);
    dataService.fetchAssociationTargets.mockReturnValue(throwError(() => new Error('association fetch failed')));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const el = await settle(fixture);

    expect(scope()).toEqual({ kind: 'empty', reason: 'failed' });
    expect(error).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.scope-resolution-errors')?.textContent).toContain('Could not resolve the scope of "Site"');
  });

  it('turns a pick whose entity does not exist into a failed scope instead of waiting forever', async () => {
    const fixture = setup([SITE_SELECTOR]);
    dataService.fetchRuntimeEntity.mockReturnValue(of(null));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await settle(fixture);

    expect(scope()).toEqual({ kind: 'empty', reason: 'failed' });
    expect(dataService.fetchAssociationTargets).not.toHaveBeenCalled();
  });

  it('keeps the scope pending while the pick resolves, from the moment the board is loaded', async () => {
    const fixture = setup([SITE_SELECTOR]);
    const entity$ = new Subject<RuntimeEntityData>();
    dataService.fetchRuntimeEntity.mockReturnValue(entity$ as Observable<RuntimeEntityData>);

    await settle(fixture);
    expect(scope()).toEqual({ kind: 'pending' });

    const targets$ = new Subject<{ rtId: string }[]>();
    dataService.fetchAssociationTargets.mockReturnValue(targets$);
    entity$.next(SITE_ENTITY);
    entity$.complete();
    await fixture.whenStable();
    expect(scope()).toEqual({ kind: 'pending' });

    targets$.next([{ rtId: 'dev-1' }]);
    targets$.complete();
    await fixture.whenStable();
    expect(scope()).toEqual({ kind: 'scoped', rtIds: ['dev-1'] });
  });

  it('marks a URL pick pending as well, even without a defaultRtId', async () => {
    const fixture = setup([{ ...SITE_SELECTOR, defaultRtId: undefined }], { es_site: 'site-1' });
    dataService.fetchRuntimeEntity.mockReturnValue(new Subject<RuntimeEntityData>());

    await settle(fixture);

    expect(scope()).toEqual({ kind: 'pending' });
  });

  it('leaves a selector without pick and without defaultRtId unscoped (persisted scope)', async () => {
    const fixture = setup([{ ...SITE_SELECTOR, defaultRtId: undefined }]);

    await settle(fixture);

    expect(scope()).toEqual({ kind: 'unscoped' });
    expect(dataService.fetchRuntimeEntity).not.toHaveBeenCalled();
  });

  it('scopes to the picked entity itself when the selector has no childScope', async () => {
    const fixture = setup([{ ...SITE_SELECTOR, childScope: undefined }]);

    await settle(fixture);

    expect(scope()).toEqual({ kind: 'scoped', rtIds: ['site-1'] });
    expect(dataService.fetchAssociationTargets).not.toHaveBeenCalled();
  });

  it('ignores a slower resolution of an earlier pick', async () => {
    const fixture = setup([{ ...SITE_SELECTOR, defaultRtId: undefined }]);
    await settle(fixture);
    const view = fixture.componentInstance;

    const first$ = new Subject<{ rtId: string }[]>();
    const second$ = new Subject<{ rtId: string }[]>();
    dataService.fetchAssociationTargets.mockReturnValueOnce(first$).mockReturnValueOnce(second$);

    const firstPick = view.onEntitySelectorSelected({ selectorId: 'site', entity: { rtId: 'site-1', displayName: 'Site One' } } as never);
    await Promise.resolve();
    await Promise.resolve();
    const secondPick = view.onEntitySelectorSelected({ selectorId: 'site', entity: { rtId: 'site-2', displayName: 'Site Two' } } as never);
    await Promise.resolve();
    await Promise.resolve();

    second$.next([]);
    second$.complete();
    await secondPick;
    first$.next([{ rtId: 'dev-of-site-1' }]);
    first$.complete();
    await firstPick;

    expect(scope()).toEqual({ kind: 'empty', reason: 'noTargets' });
  });

  it('clears the scope when the pick is cleared', async () => {
    const fixture = setup([SITE_SELECTOR]);
    await settle(fixture);
    expect(scope()).toEqual({ kind: 'empty', reason: 'noTargets' });

    fixture.componentInstance.clearEntitySelector('site');

    expect(scope()).toEqual({ kind: 'unscoped' });
  });
});
