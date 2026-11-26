import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WindowService } from '@progress/kendo-angular-dialog';
import { MeshBoardPersistenceService, PersistedMeshBoard, PersistedWidget } from './meshboard-persistence.service';
import { WidgetRegistryService } from './widget-registry.service';
import { registerDefaultWidgets } from '../registrations/default-widget-registrations';
import { GetDashboardsDtoGQL } from '../graphQL/getDashboards';
import { GetDashboardWithWidgetsDtoGQL } from '../graphQL/getDashboardWithWidgets';
import { CreateDashboardDtoGQL } from '../graphQL/createDashboard';
import { UpdateDashboardDtoGQL } from '../graphQL/updateDashboard';
import { CreateDashboardWidgetDtoGQL } from '../graphQL/createDashboardWidget';
import { UpdateDashboardWidgetDtoGQL } from '../graphQL/updateDashboardWidget';
import { DeleteEntitiesDtoGQL } from '../graphQL/deleteEntities';
import { AnyWidgetConfig, MeshBoardConfig, WidgetType } from '../models/meshboard.models';

/**
 * Board name / description and widget title / explanation per language survive saving and loading.
 * The board export / import carries the stored Dashboard description and widget `Config` strings
 * unchanged, so save -> load also stands for export -> import. Boards stored before these fields
 * existed load and re-encode unchanged.
 */
describe('MeshBoardPersistenceService - texts per language', () => {
  const NAMES = { 'de-AT': 'Energiemengen-Statistik', 'en-GB': 'Energy quantity statistics' };
  const DESCRIPTIONS = { 'de-AT': 'Monatswerte', 'en-GB': 'Monthly values' };
  const TITLES = { 'de-AT': 'Energiemengen', 'en-GB': 'Energy quantities' };
  const INFOS = { 'de-AT': 'Summe aller Zählpunkte', 'en-GB': 'Sum of all metering points' };

  /** A description as boards store it today: text plus a time filter blob, no per-language keys. */
  const LEGACY_DESCRIPTION = 'Monthly values\n---MESHBOARD_VARIABLES---\n'
    + '{"timeFilter":{"enabled":true,"selection":{"type":"month","year":2026,"month":9}}}';

  let service: MeshBoardPersistenceService;
  let registry: WidgetRegistryService;
  let createDashboard: ReturnType<typeof vi.fn>;
  let createWidgets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createDashboard = vi.fn().mockReturnValue(of({ data: { runtime: { systemUIDashboards: { create: [{ rtId: 'board-1' }] } } } }));
    createWidgets = vi.fn().mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      providers: [
        MeshBoardPersistenceService,
        { provide: WindowService, useValue: { open: vi.fn() } },
        { provide: GetDashboardsDtoGQL, useValue: {} },
        { provide: GetDashboardWithWidgetsDtoGQL, useValue: {} },
        { provide: CreateDashboardDtoGQL, useValue: { mutate: createDashboard } },
        { provide: UpdateDashboardDtoGQL, useValue: {} },
        { provide: CreateDashboardWidgetDtoGQL, useValue: { mutate: createWidgets } },
        { provide: UpdateDashboardWidgetDtoGQL, useValue: {} },
        { provide: DeleteEntitiesDtoGQL, useValue: {} }
      ]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
    service = TestBed.inject(MeshBoardPersistenceService);
  });

  function widgetOf(type: WidgetType, id: string, extra: Partial<AnyWidgetConfig> = {}): AnyWidgetConfig {
    return { ...registry.createWidget(type, { id, title: 'Energy quantities', col: 1, row: 1, colSpan: 2, rowSpan: 2 }), ...extra } as AnyWidgetConfig;
  }

  function board(widgets: AnyWidgetConfig[], extra: Partial<MeshBoardConfig> = {}): MeshBoardConfig {
    return { id: 'board-1', name: 'Energy quantity statistics', description: 'Monthly values', columns: 6, rowHeight: 120, gap: 16, widgets, ...extra };
  }

  /** Saves the board, then loads it back from what the backend received. */
  async function saveAndLoad(config: MeshBoardConfig): Promise<MeshBoardConfig> {
    await service.createMeshBoard(config);
    const dashboard = createDashboard.mock.calls[0][0].variables.entities[0] as { name: string; description: string };
    const widgetInputs = (createWidgets.mock.calls[0]?.[0].variables.entities ?? []) as Record<string, unknown>[];
    const persisted: PersistedMeshBoard = {
      rtId: 'board-1', ckTypeId: 'System.UI/Dashboard', name: dashboard.name, description: dashboard.description,
      columns: 6, rowHeight: 120, gap: 16
    };
    const widgets: PersistedWidget[] = widgetInputs.map((input, index) => ({
      rtId: `w-${index}`, ckTypeId: 'System.UI/DashboardWidget', name: input['name'] as string, type: input['type'] as string,
      col: input['col'] as number, row: input['row'] as number, colSpan: input['colSpan'] as number, rowSpan: input['rowSpan'] as number,
      dataSourceType: input['dataSourceType'] as string, dataSourceCkTypeId: input['dataSourceCkTypeId'] as string,
      dataSourceRtId: input['dataSourceRtId'] as string, config: input['config'] as string
    }));
    return service.toMeshBoardConfig(persisted, widgets);
  }

  it('keeps the widget titles and explanations per language of every widget type through save and reload', async () => {
    const types = registry.getRegisteredWidgets().map(r => r.type);
    const widgets = types.map((type, index) => widgetOf(type, `local-${index}`, { titles: TITLES, description: 'Sum of all metering points', descriptions: INFOS }));

    const loaded = await saveAndLoad(board(widgets));

    expect(loaded.widgets.length).toBe(types.length);
    for (const widget of loaded.widgets) {
      expect({ type: widget.type, titles: widget.titles, description: widget.description, descriptions: widget.descriptions })
        .toEqual({ type: widget.type, titles: TITLES, description: 'Sum of all metering points', descriptions: INFOS });
    }
  });

  it('keeps the board names and descriptions per language through save and reload, next to the other board settings', async () => {
    const loaded = await saveAndLoad(board([], {
      names: NAMES,
      descriptions: DESCRIPTIONS,
      timeFilter: { enabled: true, selection: { type: 'month', year: 2026, month: 9 } }
    }));

    expect(loaded.name).toBe('Energy quantity statistics');
    expect(loaded.names).toEqual(NAMES);
    expect(loaded.description).toBe('Monthly values');
    expect(loaded.descriptions).toEqual(DESCRIPTIONS);
    expect(loaded.timeFilter?.selection).toEqual({ type: 'month', year: 2026, month: 9 });
  });

  it('keeps the board names per language on a board that has no other encoded setting', async () => {
    const loaded = await saveAndLoad(board([], { names: NAMES }));

    expect(loaded.names).toEqual(NAMES);
    expect(loaded.description).toBe('Monthly values');
  });

  it('loads a board stored before per-language texts unchanged and stores it again byte-identically', async () => {
    const persisted: PersistedMeshBoard = {
      rtId: 'board-1', ckTypeId: 'System.UI/Dashboard', name: 'Energy quantity statistics', description: LEGACY_DESCRIPTION,
      columns: 6, rowHeight: 120, gap: 16
    };
    const loaded = service.toMeshBoardConfig(persisted, []);

    expect(loaded.description).toBe('Monthly values');
    expect('names' in loaded).toBe(false);
    expect('descriptions' in loaded).toBe(false);

    await service.createMeshBoard(loaded);
    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe(LEGACY_DESCRIPTION);
  });

  it('stores a board without any setting with its plain description, without an encoded settings block', async () => {
    await service.createMeshBoard(board([]));

    expect(createDashboard.mock.calls[0][0].variables.entities[0].description).toBe('Monthly values');
  });

  it('stores a widget without per-language texts with the same config as before', async () => {
    const plain = widgetOf('markdown', 'local-1');

    await service.createMeshBoard(board([plain]));

    const stored = JSON.parse(createWidgets.mock.calls[0][0].variables.entities[0].config as string) as Record<string, unknown>;
    expect(Object.keys(stored)).not.toContain('titles');
    expect(Object.keys(stored)).not.toContain('description');
    expect(Object.keys(stored)).not.toContain('descriptions');
    expect(stored).toEqual(registry.serializeWidget(plain).config);
  });
});
