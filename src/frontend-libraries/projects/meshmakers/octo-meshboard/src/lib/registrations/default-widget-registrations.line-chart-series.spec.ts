import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { LineChartQuerySeries, LineChartWidgetConfig } from '../models/meshboard.models';
import { LineChartConfigResult } from '../widgets/line-chart-widget/line-chart-config-dialog.component';

describe('Default widget registrations — line chart query series (AB#7951)', () => {
  let registry: WidgetRegistryService;

  /** A single-query line chart as saved before AB#7951 (the EnergyIQ shape). */
  function legacyChart(): LineChartWidgetConfig {
    return {
      id: 'line-1',
      rtId: 'line-1',
      type: 'lineChart',
      title: 'Grid',
      col: 1, row: 1, colSpan: 3, rowSpan: 2,
      configurable: true,
      dataSource: {
        type: 'persistentQuery', queryRtId: 'q-grid', queryName: 'Grid 5m', queryFamily: 'streamData',
        entitySelectorId: 'netz', resolutionAware: true, requiredAggregation: 'AVG'
      },
      chartType: 'area',
      categoryField: 'timestamp',
      seriesGroupField: 'rtId',
      valueField: 'importPower',
      showLegend: true,
      legendPosition: 'bottom',
      showMarkers: false,
      showDataBadge: true
    };
  }

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV generation', valueField: 'power',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryName: 'PV 5m', queryFamily: 'streamData', entitySelectorId: 'pv', resolutionAware: true, requiredAggregation: 'AVG' }
  };
  const BATTERY: LineChartQuerySeries = {
    kind: 'query', key: 'batteryDischarge', valueField: 'dischargePower',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-bat', queryFamily: 'streamData', entitySelectorId: 'batterie' }
  };

  function toPersisted(data: WidgetPersistenceData, widget: LineChartWidgetConfig, config: unknown = data.config): PersistedWidgetData {
    return {
      rtId: widget.id,
      ckTypeId: 'System.UI/DashboardWidget',
      name: widget.title,
      type: 'lineChart',
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
    TestBed.configureTestingModule({
      providers: [{ provide: WindowService, useValue: { open: vi.fn() } }]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('a single-query chart encodes without the new keys and loads unchanged', () => {
    const widget = legacyChart();
    const persisted = registry.serializeWidget(widget);

    expect(persisted.config).not.toHaveProperty('additionalSeries');
    expect(persisted.config).not.toHaveProperty('stacked');
    const loaded = roundTrip(widget);
    expect(loaded).not.toHaveProperty('additionalSeries');
    expect(loaded).not.toHaveProperty('stacked');
    // Re-encoding the loaded chart is byte-identical (no migration).
    expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
  });

  it('a config stored before AB#7951 loads and re-encodes byte-identically', () => {
    const stored = JSON.stringify({
      chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value',
      showLegend: true, legendPosition: 'right', showMarkers: false, queryName: 'Meter', queryRtId: 'q1',
      queryFamily: 'streamData', filters: []
    });
    const loaded = registry.deserializeWidget({
      rtId: 'w1', ckTypeId: 'System.UI/DashboardWidget', name: 'Meter', type: 'lineChart',
      col: 1, row: 1, colSpan: 2, rowSpan: 2, dataSourceType: 'systemQuery', dataSourceCkTypeId: null,
      dataSourceRtId: 'q1', config: stored
    }) as LineChartWidgetConfig;

    expect(loaded.additionalSeries).toBeUndefined();
    expect(loaded.stacked).toBeUndefined();
    const reEncoded = registry.serializeWidget(loaded).config as Record<string, unknown>;
    expect(reEncoded).not.toHaveProperty('additionalSeries');
    expect(reEncoded).not.toHaveProperty('stacked');
  });

  it('round-trips query series (order kept) and stacked through persistence', () => {
    const widget: LineChartWidgetConfig = { ...legacyChart(), additionalSeries: [PV, BATTERY], stacked: true };

    const loaded = roundTrip(widget);

    expect(loaded.additionalSeries).toEqual([PV, BATTERY]);
    expect(loaded.stacked).toBe(true);
  });

  it('drops stored series of an unknown kind or without a query (newer library, hand edits)', () => {
    const widget = legacyChart();
    const data = registry.serializeWidget(widget);
    const config = {
      ...(data.config as Record<string, unknown>),
      additionalSeries: [PV, { kind: 'formula', key: 'pvDirect', formula: '${pv}' }, { kind: 'query', key: 'x' }],
      stacked: 'yes'
    };

    const loaded = registry.deserializeWidget(toPersisted(data, widget, config)) as LineChartWidgetConfig;

    expect(loaded.additionalSeries).toEqual([PV]);
    expect(loaded.stacked).toBeUndefined();
  });

  it('dialog apply keeps the series and omits empty values', () => {
    const base = legacyChart();
    const result = (extra: Partial<LineChartConfigResult>): LineChartConfigResult => ({
      ckTypeId: '', rtId: '', queryRtId: 'q-grid', queryName: 'Grid 5m', queryFamily: 'streamData',
      chartType: 'area', categoryField: 'timestamp', seriesGroupField: 'rtId', valueField: 'importPower',
      showLegend: true, legendPosition: 'bottom', showMarkers: false, showDataBadge: true, ...extra
    });

    const withSeries = registry.applyConfigResult(base, result({ additionalSeries: [BATTERY, PV], stacked: true })) as LineChartWidgetConfig;
    expect(withSeries.additionalSeries).toEqual([BATTERY, PV]);
    expect(withSeries.stacked).toBe(true);

    const cleared = registry.applyConfigResult(withSeries, result({ additionalSeries: [], stacked: false })) as LineChartWidgetConfig;
    expect(cleared.additionalSeries).toBeUndefined();
    expect(cleared.stacked).toBeUndefined();
    expect(registry.serializeWidget(cleared).config).not.toHaveProperty('additionalSeries');
  });

  it('getInitialConfig hands the series and stacked to the dialog', () => {
    const widget: LineChartWidgetConfig = { ...legacyChart(), additionalSeries: [PV], stacked: true };
    const initial = registry.getRegistration('lineChart')!.getInitialConfig!(widget) as Record<string, unknown>;
    expect(initial['initialAdditionalSeries']).toEqual([PV]);
    expect(initial['initialStacked']).toBe(true);
  });
});
