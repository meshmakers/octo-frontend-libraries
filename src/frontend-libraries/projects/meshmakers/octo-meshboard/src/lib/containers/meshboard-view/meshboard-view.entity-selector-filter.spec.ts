import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { WindowStateService } from '@meshmakers/shared-ui';
import { of } from 'rxjs';
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
import { EntitySelectorToolbarComponent } from '../../components/entity-selector-toolbar/entity-selector-toolbar.component';

/**
 * Defaults and URL picks of a filtered selector (AB#7724): the picker filter
 * affects the listing only. A `defaultRtId` or an `es_<id>` URL pick is applied
 * exactly as before, even when the entity does not match the filter — the view
 * never queries the filter to validate a pick (the editor warns about a
 * non-matching default instead). Neutral fixtures only (Test/Site → Test/Device).
 */
describe('MeshBoardViewComponent — filtered selector defaults (AB#7724)', () => {
  /** A site picker that lists only sites of kind "Primary"; site-2 is not one. */
  const SITE: EntitySelectorConfig = {
    id: 'site',
    label: 'Site',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: true,
    filters: [{ attributePath: 'kind', operator: 'EQUALS', comparisonValue: 'Primary' }]
  };

  let pickerFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pickerFetch = vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } }));
  });

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
        MeshBoardVariableService,
        {
          provide: EditModeStateService,
          useValue: { isEditMode: () => false, isSaving: () => false, reset: vi.fn(), hasUnsavedChanges: () => false }
        },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: dataService },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: pickerFetch } },
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

  it('applies a defaultRtId that does not match the filter, as before', async () => {
    const fixture = setup([{ ...SITE, defaultRtId: 'site-2' }]);
    await settle(fixture);

    expect(state.getEntitySelector('site')?.selectedRtId).toBe('site-2');
    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['site-2'] });
    // No validation query against the filter.
    expect(pickerFetch).not.toHaveBeenCalled();
  });

  it('applies a URL pick that does not match the filter, as before', async () => {
    const fixture = setup([SITE], { es_site: 'site-2' });
    await settle(fixture);

    expect(state.getEntitySelector('site')?.selectedRtId).toBe('site-2');
    expect(scope('site')).toEqual({ kind: 'scoped', rtIds: ['site-2'] });
    expect(pickerFetch).not.toHaveBeenCalled();
  });

  it('hands the board variables to the toolbar for the picker filter', async () => {
    const fixture = setup([SITE]);
    await settle(fixture);

    const toolbar = fixture.debugElement.query(d => d.componentInstance instanceof EntitySelectorToolbarComponent)
      .componentInstance as EntitySelectorToolbarComponent;
    expect(toolbar.variables).toEqual(state.getVariables());
    expect(toolbar.getDialogTitle(SITE)).toBe('Select Site (filtered)');
  });
});
