import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { registerProcessWidget } from './process-widget-registration';
import { AnyWidgetConfig, PersistentQueryDataSource, ProcessWidgetConfig, StatsGridWidgetConfig, SummaryCardWidgetConfig } from '../models/meshboard.models';

/**
 * AB#9094, AC2: `timeShift` survives save and load of the board config (round trip through the
 * widget registrations), as a board seed writes it; absent stays absent (existing boards encode
 * byte-identically); a stored count that is not a negative integer is no shift.
 */
describe('Default widget registrations — timeShift round trip (AB#9094 AC2)', () => {
  let registry: WidgetRegistryService;

  const SHIFT = { by: 'year', count: -1 };
  const QUERY: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-a22', queryName: 'a22', queryFamily: 'streamData' };
  const BASE = { title: 'W', col: 1, row: 1, colSpan: 2, rowSpan: 2, configurable: true };

  const WIDGETS: Record<string, AnyWidgetConfig> = {
    kpi: { ...BASE, id: 'kpi', type: 'kpi', dataSource: QUERY, valueAttribute: '', queryMode: 'simpleCount' } as AnyWidgetConfig,
    gauge: { ...BASE, id: 'gauge', type: 'gauge', dataSource: QUERY, gaugeType: 'arc', valueAttribute: '', min: 0, max: 100, queryMode: 'simpleCount' } as AnyWidgetConfig,
    table: { ...BASE, id: 'table', type: 'table', dataSource: QUERY, columns: [] } as AnyWidgetConfig,
    pieChart: { ...BASE, id: 'pie', type: 'pieChart', dataSource: QUERY, chartType: 'pie', categoryField: 'name', valueField: 'value' } as AnyWidgetConfig,
    barChart: { ...BASE, id: 'bar', type: 'barChart', dataSource: QUERY, chartType: 'column', categoryField: 'name', series: [{ field: 'value', name: 'Value' }] } as AnyWidgetConfig,
    lineChart: { ...BASE, id: 'line', type: 'lineChart', dataSource: QUERY, chartType: 'line', categoryField: 'timestamp', valueField: 'value' } as AnyWidgetConfig,
    heatmap: { ...BASE, id: 'heat', type: 'heatmap', dataSource: QUERY, dateField: 'timestamp', aggregation: 'count', colorScheme: 'green' } as unknown as AnyWidgetConfig
  };

  function stored(data: WidgetPersistenceData, widget: AnyWidgetConfig, config: unknown): PersistedWidgetData {
    return {
      rtId: widget.id, ckTypeId: 'System.UI/DashboardWidget', name: widget.title, type: widget.type,
      col: widget.col, row: widget.row, colSpan: widget.colSpan, rowSpan: widget.rowSpan,
      dataSourceType: data.dataSourceType === 'persistentQuery' ? 'systemQuery' : data.dataSourceType,
      dataSourceCkTypeId: data.dataSourceCkTypeId ?? null,
      dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(config)
    };
  }

  /** Loads the widget from a stored config to which `extra` keys were added, as a seed would write them. */
  function loadSeeded(widget: AnyWidgetConfig, extra: Record<string, unknown>): AnyWidgetConfig {
    const data = registry.serializeWidget(widget);
    return registry.deserializeWidget(stored(data, widget, { ...(data.config as Record<string, unknown>), ...extra }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
    registerProcessWidget(registry);
  });

  for (const [type, widget] of Object.entries(WIDGETS)) {
    describe(type, () => {
      it('loads a seeded timeShift and writes it back on save', () => {
        const loaded = loadSeeded(widget, { timeShift: SHIFT });

        expect((loaded.dataSource as PersistentQueryDataSource).timeShift).toEqual(SHIFT);
        expect(registry.serializeWidget(loaded).config).toEqual(expect.objectContaining({ timeShift: SHIFT }));
      });

      it('without timeShift writes no key and re-encodes byte-identically', () => {
        const existing = loadSeeded(widget, {});
        const persisted = registry.serializeWidget(existing);
        const loaded = loadSeeded(existing, {});

        expect(persisted.config).not.toHaveProperty('timeShift');
        expect(loaded.dataSource).not.toHaveProperty('timeShift');
        expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
      });

      it('drops a stored shift whose count is not a negative integer', () => {
        for (const timeShift of [{ by: 'year', count: 1 }, { by: 'year', count: 0 }, { by: 'period', count: -0.5 }, { by: 'month', count: -1 }, 'year']) {
          const loaded = loadSeeded(widget, { timeShift });

          expect(loaded.dataSource).not.toHaveProperty('timeShift');
          expect(registry.serializeWidget(loaded).config).not.toHaveProperty('timeShift');
        }
      });
    });
  }

  it('stats grid: a stat cell keeps its timeShift through save and load', () => {
    const widget = {
      ...BASE, id: 'stats', type: 'statsGrid', dataSource: { type: 'aggregation', queries: [] }, columns: 2,
      stats: [{ id: 's1', label: 'Last year', queryId: '', persistentQuerySource: { queryRtId: 'q-a22', queryFamily: 'streamData', queryMode: 'simpleCount', timeShift: SHIFT } }]
    } as unknown as StatsGridWidgetConfig;

    const loaded = loadSeeded(widget, {}) as StatsGridWidgetConfig;

    expect(loaded.stats[0].persistentQuerySource?.timeShift).toEqual(SHIFT);
  });

  it('summary card: a tile keeps its timeShift through save and load', () => {
    const widget = {
      ...BASE, id: 'summary', type: 'summaryCard', dataSource: { type: 'static' },
      tiles: [{ id: 't1', label: 'Last year', persistentQuerySource: { queryRtId: 'q-a22', queryFamily: 'streamData', queryMode: 'simpleCount', timeShift: SHIFT } }]
    } as unknown as SummaryCardWidgetConfig;

    const loaded = loadSeeded(widget, {}) as SummaryCardWidgetConfig;

    expect(loaded.tiles[0].persistentQuerySource?.timeShift).toEqual(SHIFT);
  });

  it('process widget: a binding keeps its timeShift through save and load; an invalid one is dropped', () => {
    const widget = {
      ...BASE, id: 'flow', type: 'process', dataSource: { type: 'static', data: null }, processDiagramRtId: 'd-1', propertyMappings: [],
      bindings: [
        { name: 'pv', mode: 'persistentQuery', queryRtId: 'q-a22', queryFamily: 'streamData', timeShift: SHIFT },
        { name: 'grid', mode: 'persistentQuery', queryRtId: 'q-a23', queryFamily: 'streamData', timeShift: { by: 'year', count: 2 } }
      ]
    } as unknown as ProcessWidgetConfig;

    const loaded = loadSeeded(widget, {}) as ProcessWidgetConfig;

    expect(loaded.bindings?.[0].timeShift).toEqual(SHIFT);
    expect(loaded.bindings?.[1]).not.toHaveProperty('timeShift');
  });

  it('process widget: a single binding named "default" keeps its timeShift through save and load', () => {
    const widget = {
      ...BASE, id: 'flow', type: 'process', dataSource: { type: 'static', data: null }, processDiagramRtId: 'd-1', propertyMappings: [],
      bindings: [{ name: 'default', mode: 'persistentQuery', queryRtId: 'q-a22', queryFamily: 'streamData', timeShift: SHIFT }]
    } as unknown as ProcessWidgetConfig;

    const loaded = loadSeeded(widget, {}) as ProcessWidgetConfig;

    expect(loaded.bindings).toEqual([expect.objectContaining({ name: 'default', timeShift: SHIFT })]);
  });

  it('process widget: a single "default" binding without a shift is still saved in the legacy shape', () => {
    const widget = {
      ...BASE, id: 'flow', type: 'process', dataSource: { type: 'static', data: null }, processDiagramRtId: 'd-1', propertyMappings: [],
      bindings: [{ name: 'default', mode: 'persistentQuery', queryRtId: 'q-a22', queryFamily: 'streamData' }]
    } as unknown as ProcessWidgetConfig;

    const config = registry.serializeWidget(widget).config as Record<string, unknown>;

    expect(config).not.toHaveProperty('bindings');
    expect(config).toEqual(expect.objectContaining({ dataBindingMode: 'persistentQuery', bindingQueryRtId: 'q-a22' }));
  });
});
