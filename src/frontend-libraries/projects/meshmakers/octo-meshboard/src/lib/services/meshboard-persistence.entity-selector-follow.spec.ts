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

/**
 * Persistence and portability of `followsSelectorId` (AB#7722). A MeshBoard's
 * selectors live in the encoded Dashboard description; the "Manage MeshBoards"
 * export/import (deep-graph ZIP) carries that description verbatim, so saving,
 * re-loading and exporting/importing all go through encode → description →
 * decode. Neutral fixtures only (Test/Site → Test/Device).
 */
describe('MeshBoardPersistenceService — entity selector follow (AB#7722)', () => {
  /**
   * A Dashboard description as boards encode it before AB#7722 (one visible
   * selector, one hidden selector with a child scope). Must decode and re-encode
   * byte-identically.
   */
  const PRE_7722_DESCRIPTION = 'Site overview\n---MESHBOARD_VARIABLES---\n'
    + '{"entitySelectors":[{"id":"site","label":"Site","ckTypeId":"Test/Site","attributeMappings":[{"attributePath":"name","variableName":"siteName","attributeValueType":"STRING"}],"showInToolbar":true},'
    + '{"id":"devices","label":"Devices","ckTypeId":"Test/Site","attributeMappings":[],"showInToolbar":false,"defaultRtId":"site-1",'
    + '"childScope":{"targetCkTypeId":"Test/Device","roleId":"System/ParentChild","direction":"in"}}]}';

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

  const site: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: true };
  const grid: EntitySelectorConfig = {
    id: 'grid',
    label: 'Grid',
    ckTypeId: 'Test/Site',
    attributeMappings: [],
    showInToolbar: false,
    followsSelectorId: 'site',
    childScope: { targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'in' }
  };

  it('keeps followsSelectorId through save and reload', async () => {
    await service.updateMeshBoard('board-1', board([site, { ...grid, selectedRtId: 'site-1', selectedDisplayName: 'Site One' }]));
    const description = updateDashboard.mock.calls[0][0].variables.entities[0].item.description as string;

    const reloaded = service.toMeshBoardConfig(persisted(description), []);

    expect(reloaded.entitySelectors?.[1]).toEqual(grid);
  });

  it('round-trips followsSelectorId through export and import (description carried verbatim)', async () => {
    await service.createMeshBoard(board([site, grid]));
    const exported = createDashboard.mock.calls[0][0].variables.entities[0].description as string;

    // The deep-graph export writes the Dashboard entity's description into the
    // ZIP unchanged; the import creates the entity with the same string.
    const imported = service.toMeshBoardConfig(persisted(exported), []);

    expect(imported.entitySelectors).toEqual([site, grid]);
    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[1][0].variables.entities[0].description).toBe(exported);
  });

  it('imports a board exported before AB#7722 unchanged', async () => {
    const imported = service.toMeshBoardConfig(persisted(PRE_7722_DESCRIPTION), []);

    expect(imported.entitySelectors?.map(s => s.followsSelectorId)).toEqual([undefined, undefined]);
    expect(imported.entitySelectors?.some(s => 'followsSelectorId' in s)).toBe(false);

    await service.createMeshBoard(imported);
    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe(PRE_7722_DESCRIPTION);
  });
});
