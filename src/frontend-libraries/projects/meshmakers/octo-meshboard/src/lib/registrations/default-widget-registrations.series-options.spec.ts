import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { AnyWidgetConfig, BarChartWidgetConfig, LineChartFormulaSeries, LineChartQuerySeries, LineChartWidgetConfig } from '../models/meshboard.models';
import { LineChartConfigResult } from '../widgets/line-chart-widget/line-chart-config-dialog.component';

/** Persistence of the per-series options and the fixed bucket size (AB#8046). */
describe('Default widget registrations — series options (AB#8046)', () => {
  let registry: WidgetRegistryService;

  const LINE: LineChartWidgetConfig = {
    id: 'line-1', rtId: 'line-1', type: 'lineChart', title: 'Tagesprofil',
    col: 1, row: 1, colSpan: 4, rowSpan: 2, configurable: true,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryName: 'Netz', queryFamily: 'streamData', entitySelectorId: 'netz' },
    chartType: 'area', categoryField: 'timestamp', seriesGroupField: 'rtId', valueField: 'power',
    showLegend: true, legendPosition: 'bottom', showMarkers: false, showDataBadge: true
  };

  const CHARGE: LineChartQuerySeries = {
    kind: 'query', key: 'charge', valueField: 'chargingPower', visible: false, missingValues: 'carryForward', carryForwardLookbackMinutes: 720,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-bat', queryFamily: 'streamData', entitySelectorId: 'batterie' }
  };
  const PV_LINE: LineChartFormulaSeries = { kind: 'formula', key: 'pvLine', formula: '${charge}', stacked: false, color: '#8A5300', dashType: 'dash' };

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

  function roundTrip<T extends AnyWidgetConfig>(widget: T): T {
    return registry.deserializeWidget(toPersisted(registry.serializeWidget(widget), widget)) as T;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('a chart without the new options encodes without them (byte-identical round trip)', () => {
    const persisted = registry.serializeWidget(LINE);
    expect(persisted.config).not.toHaveProperty('bucketMinutes');
    const loaded = roundTrip(LINE);
    expect(loaded).not.toHaveProperty('bucketMinutes');
    expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
  });

  it('round-trips bucketMinutes, series options and the primary options', () => {
    const widget: LineChartWidgetConfig = {
      ...LINE, stacked: true, bucketMinutes: 15,
      additionalSeries: [CHARGE, PV_LINE],
      primarySeries: { visible: false, missingValues: 'zero', dashType: 'dot' }
    };
    const loaded = roundTrip(widget);
    expect(loaded.bucketMinutes).toBe(15);
    expect(loaded.additionalSeries).toEqual([CHARGE, PV_LINE]);
    expect(loaded.primarySeries).toEqual({ visible: false, missingValues: 'zero', dashType: 'dot' });
  });

  it('drops an unsupported bucket size and default / unknown primary options on load', () => {
    const data = registry.serializeWidget(LINE);
    const config = {
      ...(data.config as Record<string, unknown>),
      bucketMinutes: 7,
      primarySeries: { missingValues: 'gap', dashType: 'solid', color: '#fff', carryForwardLookbackMinutes: 60 }
    };
    const loaded = registry.deserializeWidget(toPersisted(data, LINE, config)) as LineChartWidgetConfig;
    expect(loaded.bucketMinutes).toBeUndefined();
    expect(loaded.primarySeries).toBeUndefined();
  });

  it('dialog result: bucketMinutes is applied and passed back to the dialog', () => {
    const registration = registry.getRegistration('lineChart')!;
    const applied = registration.applyConfigResult!(LINE, {
      queryRtId: 'q-grid', queryName: 'Netz', queryFamily: 'streamData', chartType: 'area', categoryField: 'timestamp',
      seriesGroupField: 'rtId', valueField: 'power', showLegend: true, legendPosition: 'bottom', showMarkers: false,
      showDataBadge: true, bucketMinutes: 15
    } as LineChartConfigResult as never) as LineChartWidgetConfig;
    expect(applied.bucketMinutes).toBe(15);
    const initial = registration.getInitialConfig!(applied) as Record<string, unknown>;
    expect(initial['initialBucketMinutes']).toBe(15);
  });

  it('bar chart: series options pass through, primary keeps visible and missingValues', () => {
    const bar: BarChartWidgetConfig = {
      id: 'bar-1', rtId: 'bar-1', type: 'barChart', title: 'Tageswerte', col: 1, row: 1, colSpan: 4, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData' },
      chartType: 'column', categoryField: 'timestamp', series: [{ field: 'energy', name: 'PV' }],
      additionalSeries: [{ ...CHARGE, categoryField: 'timestamp', asLine: true, secondaryAxis: true, color: '#2563EB', dashType: 'dot' }],
      primarySeries: { visible: false, missingValues: 'zero' }
    };
    const loaded = roundTrip(bar);
    expect(loaded.additionalSeries).toEqual(bar.additionalSeries);
    expect(loaded.primarySeries).toEqual({ visible: false, missingValues: 'zero' });
  });
});
