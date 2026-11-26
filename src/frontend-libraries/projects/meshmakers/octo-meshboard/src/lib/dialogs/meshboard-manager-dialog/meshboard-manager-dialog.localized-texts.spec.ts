import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { AssetRepoService, CkModelService, JobManagementService } from '@meshmakers/octo-services';
import { ConfirmationService, ImportStrategyDialogService } from '@meshmakers/shared-ui';
import { MeshBoardManagerDialogComponent } from './meshboard-manager-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService, PersistedMeshBoard } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardConfig } from '../../models/meshboard.models';
import { GetDashboardsDtoGQL } from '../../graphQL/getDashboards';
import { GetDashboardWithWidgetsDtoGQL } from '../../graphQL/getDashboardWithWidgets';
import { CreateDashboardDtoGQL } from '../../graphQL/createDashboard';
import { UpdateDashboardDtoGQL } from '../../graphQL/updateDashboard';
import { CreateDashboardWidgetDtoGQL } from '../../graphQL/createDashboardWidget';
import { UpdateDashboardWidgetDtoGQL } from '../../graphQL/updateDashboardWidget';
import { DeleteEntitiesDtoGQL } from '../../graphQL/deleteEntities';

/**
 * Renaming a board in "Manage MeshBoards" and saving the board settings keep the board names and
 * descriptions per language: a changed single name or description becomes the new fallback.
 */
describe('Board names and descriptions per language survive rename and settings', () => {
  const NAMES = { 'de-AT': 'Energiemengen-Statistik', 'en-GB': 'Energy quantity statistics' };
  const DESCRIPTIONS = { 'de-AT': 'Monatswerte', 'en-GB': 'Monthly values' };
  const STORED = 'Monthly values\n---MESHBOARD_VARIABLES---\n' + JSON.stringify({ names: NAMES, descriptions: DESCRIPTIONS });

  function persisted(description: string): PersistedMeshBoard {
    return { rtId: 'b1', ckTypeId: 'System.UI/Dashboard', name: 'Energy quantity statistics', description, columns: 6, rowHeight: 120, gap: 16 };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('rename keeps the per-language names and descriptions and stores the changed single texts as fallback', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [MeshBoardManagerDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DialogService, useValue: { open: vi.fn() } },
        {
          provide: MeshBoardStateService, useValue: {
            availableMeshBoards: signal([persisted(STORED)]),
            persistedMeshBoardId: signal<string | null>(null),
            refreshMeshBoardList: vi.fn().mockResolvedValue(undefined),
            renameMeshBoard: rename
          }
        },
        { provide: AssetRepoService, useValue: {} },
        { provide: JobManagementService, useValue: {} },
        { provide: ImportStrategyDialogService, useValue: {} },
        { provide: ConfirmationService, useValue: {} },
        { provide: MeshBoardPersistenceService, useValue: {} }
      ]
    });
    const dialog = TestBed.createComponent(MeshBoardManagerDialogComponent).componentInstance;
    const edit = dialog as unknown as { editingName: { set(v: string): void }; editingDescription: { set(v: string): void } };

    dialog.startEdit(persisted(STORED));
    edit.editingName.set('Energy statistics');
    edit.editingDescription.set('Values per month');
    await dialog.saveEdit();

    const [, name, description] = rename.mock.calls[0] as [string, string, string];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MeshBoardPersistenceService,
        { provide: WidgetRegistryService, useValue: {} },
        ...[GetDashboardsDtoGQL, GetDashboardWithWidgetsDtoGQL, CreateDashboardDtoGQL, UpdateDashboardDtoGQL, CreateDashboardWidgetDtoGQL, UpdateDashboardWidgetDtoGQL, DeleteEntitiesDtoGQL].map(token => ({ provide: token, useValue: {} }))
      ]
    });
    const reloaded = TestBed.inject(MeshBoardPersistenceService).toMeshBoardConfig({ ...persisted(description), name }, []);

    expect(reloaded.name).toBe('Energy statistics');
    expect(reloaded.description).toBe('Values per month');
    expect(reloaded.names).toEqual(NAMES);
    expect(reloaded.descriptions).toEqual(DESCRIPTIONS);
  });

  it('saving the board settings keeps the per-language names and descriptions', () => {
    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: {} },
        { provide: CkModelService, useValue: {} }
      ]
    });
    const state = TestBed.inject(MeshBoardStateService);
    const board: MeshBoardConfig = {
      id: 'b1', name: 'Energy quantity statistics', names: NAMES, description: 'Monthly values', descriptions: DESCRIPTIONS,
      columns: 6, rowHeight: 120, gap: 16, widgets: []
    };
    state.setConfig(board);

    state.updateSettings({ name: 'Energy statistics', description: 'Monthly values', columns: 6, rowHeight: 120, gap: 16 });

    const saved = state.getConfig();
    expect(saved.name).toBe('Energy statistics');
    expect(saved.names).toEqual(NAMES);
    expect(saved.descriptions).toEqual(DESCRIPTIONS);
  });
});
