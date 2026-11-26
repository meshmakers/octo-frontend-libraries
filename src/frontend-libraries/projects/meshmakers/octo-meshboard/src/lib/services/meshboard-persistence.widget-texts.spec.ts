import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WindowService } from '@progress/kendo-angular-dialog';
import { MeshBoardPersistenceService, PersistedMeshBoard, PersistedWidget } from './meshboard-persistence.service';
import { WidgetRegistryService, WIDGET_LOCALIZED_TEXT_KEYS } from './widget-registry.service';
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
 * AC 2: per-language widget texts are stored in the board configuration and come back after save
 * and reload; a widget without them stores the same config as before.
 */
describe('MeshBoardPersistenceService - widget texts per language beyond the title', () => {
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

  const DE = { 'de-AT': 'Deutsch' };

  it('keeps every widget-level per-language map of every widget type through save and reload', async () => {
    const maps = Object.fromEntries(WIDGET_LOCALIZED_TEXT_KEYS.map(key => [key, { 'de-AT': `${key} de` }]));
    const types = registry.getRegisteredWidgets().map(r => r.type);
    const widgets = types.map((type, index) => widgetOf(type, `local-${index}`, maps as Partial<AnyWidgetConfig>));

    const loaded = await saveAndLoad(board(widgets));

    for (const widget of loaded.widgets) {
      const stored = widget as unknown as Record<string, unknown>;
      expect({ type: widget.type, maps: Object.fromEntries(WIDGET_LOCALIZED_TEXT_KEYS.map(key => [key, stored[key]])) })
        .toEqual({ type: widget.type, maps });
    }
  });

  it('keeps the per-language texts of stats, tiles, statuses, series, reference lines, table extras and child templates', async () => {
    const widgets = [
      widgetOf('statsGrid', 'a', { stats: [{ label: 'Meters', labels: DE, prefixes: DE, suffixes: DE, queryId: 'q' }] } as Partial<AnyWidgetConfig>),
      widgetOf('summaryCard', 'b', { tiles: [{ id: 't', label: 'Meters', labels: DE, prefixes: DE, suffixes: DE }] } as Partial<AnyWidgetConfig>),
      widgetOf('statusList', 'c', { ckTypeId: 'System/Adapter', labelField: 'name', statusField: 'state', statusColors: { OK: { color: 'green', label: 'Ok', labels: DE } } } as Partial<AnyWidgetConfig>),
      widgetOf('barChart', 'd', {
        series: [{ field: 'energy', name: 'Energy', names: DE }],
        categoryLabels: { A: { 'de-AT': 'Kategorie A' }, B: 'B' }, seriesLabels: { S: { 'de-AT': 'Reihe S' } }
      } as Partial<AnyWidgetConfig>),
      widgetOf('lineChart', 'e', {
        referenceLines: [{ value: 5, label: 'Limit', labels: DE }],
        additionalSeries: [{ kind: 'formula', key: 'f', label: 'Formula', labels: DE, formula: '1' }],
        seriesLabels: { S: { 'de-AT': 'Reihe S' } }
      } as Partial<AnyWidgetConfig>),
      widgetOf('pieChart', 'f', { categoryLabels: { A: { 'de-AT': 'Kategorie A' } } } as Partial<AnyWidgetConfig>),
      widgetOf('table', 'g', {
        rowAction: { label: 'Details', labels: DE },
        valueMarkers: [{ field: 'm', tooltip: 'Manual', tooltips: DE }],
        columns: [{ field: 's', title: 'State', statusMapping: { ok: { icon: 'check-circle', tooltip: 'Fine', tooltips: DE } } }]
      } as Partial<AnyWidgetConfig>),
      widgetOf('widgetGroup', 'h', {
        childTemplate: { widgetType: 'kpi', titleTemplate: 'M', titleTemplates: DE, attributeMappings: {}, staticConfig: { suffixes: DE } }
      } as Partial<AnyWidgetConfig>)
    ];

    const loaded = await saveAndLoad(board(widgets));
    const at = (type: WidgetType, ...path: (string | number)[]): unknown =>
      path.reduce<unknown>((value, key) => (value as Record<string | number, unknown> | undefined)?.[key], loaded.widgets.find(w => w.type === type));

    expect(at('statsGrid', 'stats', 0)).toMatchObject({ labels: DE, prefixes: DE, suffixes: DE });
    expect(at('summaryCard', 'tiles', 0)).toMatchObject({ labels: DE, prefixes: DE, suffixes: DE });
    expect(at('statusList', 'statusColors', 'OK')).toMatchObject({ labels: DE });
    expect(at('barChart', 'series', 0)).toMatchObject({ names: DE });
    expect(at('barChart', 'categoryLabels')).toEqual({ A: { 'de-AT': 'Kategorie A' }, B: 'B' });
    expect(at('barChart', 'seriesLabels')).toEqual({ S: { 'de-AT': 'Reihe S' } });
    expect(at('lineChart', 'referenceLines', 0)).toMatchObject({ labels: DE });
    expect(at('lineChart', 'additionalSeries', 0)).toMatchObject({ labels: DE });
    expect(at('lineChart', 'seriesLabels')).toEqual({ S: { 'de-AT': 'Reihe S' } });
    expect(at('pieChart', 'categoryLabels')).toEqual({ A: { 'de-AT': 'Kategorie A' } });
    expect(at('table', 'rowAction')).toEqual({ label: 'Details', labels: DE });
    expect(at('table', 'valueMarkers', 0)).toMatchObject({ tooltips: DE });
    expect(at('table', 'columns', 0, 'statusMapping', 'ok')).toMatchObject({ tooltips: DE });
    expect(at('widgetGroup', 'childTemplate')).toMatchObject({ titleTemplates: DE, staticConfig: { suffixes: DE } });
  });

  it('stores a widget without per-language texts with the same config as before', async () => {
    const plain = widgetOf('kpi', 'local-1', { suffix: 'kWh' } as Partial<AnyWidgetConfig>);

    await service.createMeshBoard(board([plain]));

    const stored = JSON.parse(createWidgets.mock.calls[0][0].variables.entities[0].config as string) as Record<string, unknown>;
    for (const key of WIDGET_LOCALIZED_TEXT_KEYS) {
      expect(Object.keys(stored)).not.toContain(key);
    }
    expect(stored).toEqual(registry.serializeWidget(plain).config);
  });
});
