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
import { BUILDING, PRE_7915_DESCRIPTION, ROOM, SITE } from '../testing/entity-selector-scope-source.fixtures';

/**
 * Persistence and portability of the dependent selector's scope source
 * (AB#7915). Selectors live in the encoded Dashboard description; the "Manage
 * MeshBoards" export and import carry that description verbatim, so save,
 * reload and export/import all go through encode → description → decode.
 * Neutral fixtures only.
 */
describe('MeshBoardPersistenceService — dependent selector scope source (AB#7915)', () => {
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

  it('keeps the scope source through save and reload', async () => {
    await service.updateMeshBoard('board-1', board([
      { ...SITE, selectedRtId: 'site-1', selectedDisplayName: 'North Campus' },
      { ...ROOM, selectedRtId: 'room-2', selectedDisplayName: 'Room 2' }
    ]));
    const description = updateDashboard.mock.calls[0][0].variables.entities[0].item.description as string;

    const reloaded = service.toMeshBoardConfig(persisted(description), []);

    expect(reloaded.entitySelectors).toEqual([SITE, ROOM]);
  });

  it('round-trips a three-hop and a one-hop scope source through export and import', async () => {
    await service.createMeshBoard(board([SITE, ROOM, BUILDING]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;
    expect(exported).toContain('"scopeSource":{"selectorId":"site","path":['
      + '{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Building"},'
      + '{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Storey"},'
      + '{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Room"}]}');
    // One hop is still stored as a path.
    expect(exported).toContain('"scopeSource":{"selectorId":"site","path":[{"roleId":"System/ParentChild","direction":"in","targetCkTypeId":"Test/Building"}]}');

    const imported = service.toMeshBoardConfig(persisted(exported), []);

    expect(imported.entitySelectors).toEqual([SITE, ROOM, BUILDING]);
    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[1][0].variables.entities[0].description).toBe(exported);
  });

  it('writes the scope source only when set and stores only leader id and hops', async () => {
    const withExtras = {
      ...ROOM,
      scopeSource: { selectorId: 'site', path: [{ roleId: 'System/ParentChild', targetCkTypeId: 'Test/Room', editorKey: 7 }], draft: true }
    } as unknown as EntitySelectorConfig;
    await service.createMeshBoard(board([SITE, withExtras]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;

    expect(exported).not.toContain('editorKey');
    expect(exported).not.toContain('draft');
    expect(exported).toContain('"scopeSource":{"selectorId":"site","path":[{"roleId":"System/ParentChild","targetCkTypeId":"Test/Room"}]}');
    const imported = service.toMeshBoardConfig(persisted(exported), []);
    expect(imported.entitySelectors?.[0]).not.toHaveProperty('scopeSource');
  });

  it('imports a board exported before AB#7915 unchanged and re-encodes it byte-identically', async () => {
    const imported = service.toMeshBoardConfig(persisted(PRE_7915_DESCRIPTION), []);

    expect(imported.entitySelectors?.length).toBe(4);
    expect(imported.entitySelectors?.some(s => 'scopeSource' in s)).toBe(false);

    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe(PRE_7915_DESCRIPTION);
    await service.updateMeshBoard('board-1', imported);
    expect(updateDashboard.mock.calls[0][0].variables.entities[0].item.description).toBe(PRE_7915_DESCRIPTION);
  });
});
