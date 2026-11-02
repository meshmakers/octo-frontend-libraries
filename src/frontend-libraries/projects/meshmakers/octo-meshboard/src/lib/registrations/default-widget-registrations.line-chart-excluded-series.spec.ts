import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { AnyWidgetConfig, LineChartWidgetConfig } from '../models/meshboard.models';
import { LineChartConfigResult } from '../widgets/line-chart-widget/line-chart-config-dialog.component';

/**
 * Persistence of `excludedSeriesGroupValues` (AB#8128). Board export / import carries the widget's
 * persisted config string unchanged, so the save → load round trip below is also the export → import one.
 */
describe('Default widget registrations — excluded series group values (AB#8128)', () => {
  let registry: WidgetRegistryService;

  const LINE: LineChartWidgetConfig = {
    id: 'line-1', rtId: 'line-1', type: 'lineChart', title: 'Energy over time',
    col: 1, row: 5, colSpan: 4, rowSpan: 2, configurable: true,
    dataSource: {
      type: 'persistentQuery', queryRtId: 'q-energy', queryName: 'energy_measurements', queryFamily: 'streamData',
      resolutionAware: true, requiredAggregation: 'SUM', aggregateSeriesByGroup: true
    },
    chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value', unitField: 'amount.unit',
    showLegend: true, legendPosition: 'right', showMarkers: false, showDataBadge: true
  };

  function toPersisted(data: WidgetPersistenceData, widget: AnyWidgetConfig, config: unknown = data.config): PersistedWidgetData {
    return {
      rtId: widget.id, ckTypeId: 'System.UI/DashboardWidget', name: widget.title, type: widget.type,
      col: widget.col, row: widget.row, colSpan: widget.colSpan, rowSpan: widget.rowSpan,
      dataSourceType: data.dataSourceType === 'persistentQuery' ? 'systemQuery' : data.dataSourceType,
      dataSourceCkTypeId: data.dataSourceCkTypeId ?? null,
      dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(config)
    };
  }

  function roundTrip(widget: LineChartWidgetConfig): LineChartWidgetConfig {
    return registry.deserializeWidget(toPersisted(registry.serializeWidget(widget), widget)) as LineChartWidgetConfig;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('a chart without the key encodes without it and loads unchanged (byte-identical)', () => {
    const persisted = registry.serializeWidget(LINE);
    expect(persisted.config).not.toHaveProperty('excludedSeriesGroupValues');
    const loaded = roundTrip(LINE);
    expect(loaded).not.toHaveProperty('excludedSeriesGroupValues');
    expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
  });

  it('an empty list is not written', () => {
    expect(registry.serializeWidget({ ...LINE, excludedSeriesGroupValues: [] }).config).not.toHaveProperty('excludedSeriesGroupValues');
  });

  it('survives save and reload (and board export / import)', () => {
    const loaded = roundTrip({ ...LINE, excludedSeriesGroupValues: ['1-1:2.9.0 G.03R'] });
    expect(loaded.excludedSeriesGroupValues).toEqual(['1-1:2.9.0 G.03R']);
  });

  it('keeps values exactly as stored, drops non-strings, empty strings and duplicates on load', () => {
    const data = registry.serializeWidget(LINE);
    const config = { ...(data.config as Record<string, unknown>), excludedSeriesGroupValues: [' G.03R ', 'g.03r', '', 7, null, ' G.03R '] };
    const loaded = registry.deserializeWidget(toPersisted(data, LINE, config)) as LineChartWidgetConfig;
    expect(loaded.excludedSeriesGroupValues).toEqual([' G.03R ', 'g.03r']);
  });

  it('ignores a key that is not a list', () => {
    const data = registry.serializeWidget(LINE);
    const config = { ...(data.config as Record<string, unknown>), excludedSeriesGroupValues: '1-1:2.9.0 G.03R' };
    const loaded = registry.deserializeWidget(toPersisted(data, LINE, config)) as LineChartWidgetConfig;
    expect(loaded).not.toHaveProperty('excludedSeriesGroupValues');
  });

  it('config dialog round trip: passed to the dialog and applied from its result', () => {
    const registration = registry.getRegistration('lineChart')!;
    const widget = { ...LINE, excludedSeriesGroupValues: ['1-1:2.9.0 G.03R'] };
    const initial = registration.getInitialConfig!(widget) as Record<string, unknown>;
    expect(initial['initialExcludedSeriesGroupValues']).toEqual(['1-1:2.9.0 G.03R']);

    const result = {
      queryRtId: 'q-energy', queryName: 'energy_measurements', queryFamily: 'streamData', resolutionAware: true, requiredAggregation: 'SUM',
      chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value',
      showLegend: true, legendPosition: 'right', showMarkers: false, showDataBadge: true
    } as LineChartConfigResult;
    const applied = registration.applyConfigResult!(widget, { ...result, excludedSeriesGroupValues: ['1-1:2.9.0 G.03R', '1-1:1.9.0 G.01'] } as never) as LineChartWidgetConfig;
    expect(applied.excludedSeriesGroupValues).toEqual(['1-1:2.9.0 G.03R', '1-1:1.9.0 G.01']);

    const cleared = registration.applyConfigResult!(widget, result as never) as LineChartWidgetConfig;
    expect(cleared.excludedSeriesGroupValues).toBeUndefined();
    expect(registry.serializeWidget(cleared).config).not.toHaveProperty('excludedSeriesGroupValues');
  });
});
