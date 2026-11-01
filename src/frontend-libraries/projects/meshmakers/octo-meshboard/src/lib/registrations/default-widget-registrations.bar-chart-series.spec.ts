import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { BarChartWidgetConfig, LineChartFormulaSeries, LineChartQuerySeries } from '../models/meshboard.models';
import { BarChartConfigResult } from '../widgets/bar-chart-widget/bar-chart-config-dialog.component';

/** Bar chart persistence of query and formula series (AB#7953); existing bar charts encode byte-identically. */
describe('Default widget registrations — bar chart series (AB#7953)', () => {
  let registry: WidgetRegistryService;

  function staticChart(): BarChartWidgetConfig {
    return {
      id: 'bar-1', rtId: 'bar-1', type: 'barChart', title: 'Daily', col: 1, row: 1, colSpan: 2, rowSpan: 2, configurable: true,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryName: 'Grid daily', queryFamily: 'streamData', entitySelectorId: 'netz' },
      chartType: 'column', categoryField: 'day',
      series: [{ field: 'importEnergy', name: 'Import' }, { field: 'exportEnergy' }],
      showLegend: true, legendPosition: 'bottom', showDataLabels: false, valueScale: 0.001
    };
  }

  function dynamicChart(): BarChartWidgetConfig {
    return { ...staticChart(), series: [], seriesGroupField: 'billingType', valueField: 'quantity', dataSource: { type: 'persistentQuery', queryRtId: 'q-rt', queryFamily: 'runtime' } };
  }

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV', valueField: 'energy', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryName: 'PV daily', queryFamily: 'streamData', entitySelectorId: 'pv' }
  };
  const GRID_IMPORT: LineChartQuerySeries = {
    kind: 'query', key: 'gridImport', valueField: 'importEnergy', categoryField: 'day', visible: false,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryFamily: 'streamData', entitySelectorId: 'netz' }
  };
  const CONSUMPTION: LineChartFormulaSeries = { kind: 'formula', key: 'consumption', label: 'Consumption', formula: '${pv} + ${gridImport}' };

  function toPersisted(data: WidgetPersistenceData, widget: BarChartWidgetConfig, config: unknown = data.config): PersistedWidgetData {
    return {
      rtId: widget.id, ckTypeId: 'System.UI/DashboardWidget', name: widget.title, type: 'barChart',
      col: widget.col, row: widget.row, colSpan: widget.colSpan, rowSpan: widget.rowSpan,
      dataSourceType: data.dataSourceType === 'persistentQuery' ? 'systemQuery' : data.dataSourceType,
      dataSourceCkTypeId: data.dataSourceCkTypeId ?? null, dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(config)
    };
  }

  function roundTrip(widget: BarChartWidgetConfig): BarChartWidgetConfig {
    return registry.deserializeWidget(toPersisted(registry.serializeWidget(widget), widget)) as BarChartWidgetConfig;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it.each([['static', staticChart], ['dynamic', dynamicChart]] as const)(
    'a %s single-query chart encodes without the new keys and re-encodes byte-identically', (_mode, make) => {
      const widget = make();
      const persisted = registry.serializeWidget(widget);
      expect(persisted.config).not.toHaveProperty('additionalSeries');
      expect(persisted.config).not.toHaveProperty('primarySeries');
      const loaded = roundTrip(widget);
      expect(loaded).not.toHaveProperty('additionalSeries');
      expect(loaded).not.toHaveProperty('primarySeries');
      expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
    });

  it('a config stored before AB#7953 loads and re-encodes byte-identically', () => {
    const stored = JSON.stringify({
      chartType: 'stackedColumn', categoryField: 'month', series: [{ field: 'revenue', name: 'Revenue' }],
      showLegend: true, legendPosition: 'right', showDataLabels: true, queryName: 'Revenue', queryRtId: 'q1', queryFamily: 'runtime', filters: []
    });
    const loaded = registry.deserializeWidget({
      rtId: 'w1', ckTypeId: 'System.UI/DashboardWidget', name: 'Revenue', type: 'barChart', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSourceType: 'systemQuery', dataSourceCkTypeId: null, dataSourceRtId: 'q1', config: stored
    }) as BarChartWidgetConfig;
    expect(loaded).not.toHaveProperty('additionalSeries');
    const reEncoded = registry.serializeWidget(loaded).config as Record<string, unknown>;
    expect(reEncoded).not.toHaveProperty('additionalSeries');
    expect(reEncoded).not.toHaveProperty('primarySeries');
  });

  it('round-trips query series (with category field), formula series, visible and the hidden primary', () => {
    const widget: BarChartWidgetConfig = { ...staticChart(), additionalSeries: [PV, GRID_IMPORT, CONSUMPTION], primarySeries: { visible: false } };
    const loaded = roundTrip(widget);
    expect(loaded.additionalSeries).toEqual([PV, GRID_IMPORT, CONSUMPTION]);
    expect(loaded.primarySeries).toEqual({ visible: false });
    expect(loaded.valueScale).toBe(0.001);
  });

  it('drops unknown kinds and keeps only primary visible=false', () => {
    const widget = staticChart();
    const data = registry.serializeWidget(widget);
    const config = {
      ...(data.config as Record<string, unknown>),
      additionalSeries: [PV, { kind: 'script', key: 'later' }, { kind: 'query', key: 'x' }],
      primarySeries: { stacked: false }
    };
    const loaded = registry.deserializeWidget(toPersisted(data, widget, config)) as BarChartWidgetConfig;
    expect(loaded.additionalSeries).toEqual([PV]);
    expect(loaded).not.toHaveProperty('primarySeries');
  });

  it('applies the dialog result: series and hidden primary set, empty ones cleared', () => {
    const registration = registry.getRegistration('barChart')!;
    const apply = (w: BarChartWidgetConfig, r: BarChartConfigResult): BarChartWidgetConfig =>
      registration.applyConfigResult!(w, r as never) as BarChartWidgetConfig;
    const base: BarChartConfigResult = {
      ckTypeId: '', rtId: '', queryRtId: 'q-grid', queryName: 'Grid daily', queryFamily: 'streamData', entitySelectorId: 'netz',
      chartType: 'column', categoryField: 'day', series: staticChart().series, showLegend: true, legendPosition: 'bottom', showDataLabels: false
    };
    const withSeries = apply(staticChart(), { ...base, additionalSeries: [PV, CONSUMPTION], primarySeries: { visible: false } });
    expect(withSeries.additionalSeries).toEqual([PV, CONSUMPTION]);
    expect(withSeries.primarySeries).toEqual({ visible: false });

    const cleared = apply(withSeries, { ...base, additionalSeries: [] });
    expect(cleared.additionalSeries).toBeUndefined();
    expect(cleared.primarySeries).toBeUndefined();

    const initial = registration.getInitialConfig!(withSeries) as Record<string, unknown>;
    expect(initial['initialAdditionalSeries']).toEqual([PV, CONSUMPTION]);
    expect(initial['initialPrimarySeries']).toEqual({ visible: false });
  });
});
