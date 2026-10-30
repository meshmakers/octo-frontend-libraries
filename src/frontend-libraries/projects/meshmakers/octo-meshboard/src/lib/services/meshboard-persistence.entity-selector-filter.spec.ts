import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MeshBoardPersistenceService, PersistedMeshBoard } from './meshboard-persistence.service';
import { WidgetRegistryService } from './widget-registry.service';
import { GetDashboardsDtoGQL } from '../graphQL/getDashboards';
import { GetDashboardWithWidgetsDtoGQL } from '../graphQL/getDashboardWithWidgets';
import { CreateDashboardDtoGQL } from '../graphQL/createDashboard';
import { UpdateDashboardDtoGQL } from '../graphQL/updateDashboard';
import { CreateDashboardWidgetDtoGQL } from '../graphQL/createDashboardWidget';
import { UpdateDashboardWidgetDtoGQL } from '../graphQL/updateDashboardWidget';
import { DeleteEntitiesDtoGQL } from '../graphQL/deleteEntities';
import { EntitySelectorConfig, MeshBoardConfig } from '../models/meshboard.models';
import { FILTERED_SYSTEMS, PRE_7724_DESCRIPTION } from '../testing/entity-selector-filter.fixtures';

/**
 * Persistence and portability of the selector picker filter (AB#7724). Selectors
 * live in the encoded Dashboard description; the "Manage MeshBoards" export and
 * import carry that description verbatim, so save, reload and export/import all
 * go through encode → description → decode. Neutral fixtures only.
 */
describe('MeshBoardPersistenceService — selector picker filter (AB#7724)', () => {
  let service: MeshBoardPersistenceService;
  let createDashboard: ReturnType<typeof vi.fn>;
  let updateDashboard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createDashboard = vi.fn().mockReturnValue(of({ data: { runtime: { systemUIDashboards: { create: [{ rtId: 'board-1' }] } } } }));
    updateDashboard = vi.fn().mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      providers: [
        MeshBoardPersistenceService,
        { provide: GetDashboardsDtoGQL, useValue: {} },
        { provide: GetDashboardWithWidgetsDtoGQL, useValue: {} },
        { provide: CreateDashboardDtoGQL, useValue: { mutate: createDashboard } },
        { provide: UpdateDashboardDtoGQL, useValue: { mutate: updateDashboard } },
        { provide: CreateDashboardWidgetDtoGQL, useValue: {} },
        { provide: UpdateDashboardWidgetDtoGQL, useValue: {} },
        { provide: DeleteEntitiesDtoGQL, useValue: {} },
        { provide: WidgetRegistryService, useValue: {} }
      ]
    });
    service = TestBed.inject(MeshBoardPersistenceService);
  });

  function board(selectors: EntitySelectorConfig[]): MeshBoardConfig {
    return {
      id: 'board-1',
      name: 'Site overview',
      description: 'Site overview',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      entitySelectors: selectors
    };
  }

  function persisted(description: string): PersistedMeshBoard {
    return {
      rtId: 'board-1',
      ckTypeId: 'System.UI/Dashboard',
      name: 'Site overview',
      description,
      columns: 6,
      rowHeight: 120,
      gap: 16
    };
  }

  it('keeps the filter rows through save and reload', async () => {
    await service.updateMeshBoard('board-1', board([{ ...FILTERED_SYSTEMS, selectedRtId: 'sys-1', selectedDisplayName: 'System One' }]));
    const description = updateDashboard.mock.calls[0][0].variables.entities[0].item.description as string;

    const reloaded = service.toMeshBoardConfig(persisted(description), []);

    expect(reloaded.entitySelectors).toEqual([FILTERED_SYSTEMS]);
  });

  it('round-trips the filter through export and import', async () => {
    await service.createMeshBoard(board([FILTERED_SYSTEMS]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;
    expect(exported).toContain('"filters":[{"attributePath":"systemType","operator":"EQUALS","comparisonValue":"Electrical"},'
      + '{"attributePath":"region","operator":"LIKE","comparisonValue":"$region"}]');

    const imported = service.toMeshBoardConfig(persisted(exported), []);

    expect(imported.entitySelectors).toEqual([FILTERED_SYSTEMS]);
    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[1][0].variables.entities[0].description).toBe(exported);
  });

  it('stores only the filter fields, no editor state, and omits an empty filter', async () => {
    const withEditorState = {
      ...FILTERED_SYSTEMS,
      filters: [{ attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical', id: 1, useVariable: false }]
    } as unknown as EntitySelectorConfig;
    await service.createMeshBoard(board([withEditorState, { ...FILTERED_SYSTEMS, id: 'none', filters: [] }]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;

    expect(exported).not.toContain('useVariable');
    expect(exported).not.toContain('"id":1');
    const imported = service.toMeshBoardConfig(persisted(exported), []);
    expect(imported.entitySelectors?.[1]).not.toHaveProperty('filters');
  });

  it('imports a board exported before AB#7724 unchanged and re-encodes it byte-identically', async () => {
    const imported = service.toMeshBoardConfig(persisted(PRE_7724_DESCRIPTION), []);

    expect(imported.entitySelectors?.length).toBe(3);
    expect(imported.entitySelectors?.some(s => 'filters' in s)).toBe(false);

    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe(PRE_7724_DESCRIPTION);
    await service.updateMeshBoard('board-1', imported);
    expect(updateDashboard.mock.calls[0][0].variables.entities[0].item.description).toBe(PRE_7724_DESCRIPTION);
  });
});
