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
import { PRE_7723_DESCRIPTION, PRE_7723_SELECTORS, SITE_TO_DEVICES } from '../testing/entity-selector-scope-path.fixtures';

/**
 * Persistence and portability of the multi-hop child scope `path` (AB#7723).
 * Selectors live in the encoded Dashboard description; the "Manage MeshBoards"
 * export/import carries that description verbatim, so save, reload and
 * export/import all go through encode → description → decode. Neutral fixtures
 * only (Test/Site → Test/System → Test/Device).
 */
describe('MeshBoardPersistenceService — multi-hop child scope (AB#7723)', () => {
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

  it('keeps a multi-hop path through save and reload', async () => {
    await service.updateMeshBoard('board-1', board([{ ...SITE_TO_DEVICES, selectedRtId: 'site-1', selectedDisplayName: 'Site One' }]));
    const description = updateDashboard.mock.calls[0][0].variables.entities[0].item.description as string;

    const reloaded = service.toMeshBoardConfig(persisted(description), []);

    expect(reloaded.entitySelectors).toEqual([SITE_TO_DEVICES]);
  });

  it('round-trips a multi-hop path through export and import', async () => {
    await service.createMeshBoard(board([SITE_TO_DEVICES]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;
    expect(exported).toContain('"childScope":{"path":[{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/System"}');

    const imported = service.toMeshBoardConfig(persisted(exported), []);

    expect(imported.entitySelectors).toEqual([SITE_TO_DEVICES]);
    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[1][0].variables.entities[0].description).toBe(exported);
  });

  it('imports a board exported before AB#7723 unchanged and re-encodes it byte-identically', async () => {
    const imported = service.toMeshBoardConfig(persisted(PRE_7723_DESCRIPTION), []);

    expect(imported.entitySelectors).toEqual(PRE_7723_SELECTORS);
    expect(imported.entitySelectors?.some(s => s.childScope && 'path' in s.childScope)).toBe(false);

    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe(PRE_7723_DESCRIPTION);
    await service.updateMeshBoard('board-1', imported);
    expect(updateDashboard.mock.calls[0][0].variables.entities[0].item.description).toBe(PRE_7723_DESCRIPTION);
  });
});
