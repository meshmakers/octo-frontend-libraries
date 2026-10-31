import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { GaugeWidgetConfig } from '../models/meshboard.models';
import { GaugeConfigResult } from '../widgets/gauge-widget/gauge-config-dialog.component';

describe('Default widget registrations — gauge formula (AB#7950)', () => {
  let registry: WidgetRegistryService;

  function createGauge(overrides: Partial<GaugeWidgetConfig> = {}): GaugeWidgetConfig {
    return {
      id: 'gauge-1',
      rtId: 'gauge-1',
      type: 'gauge',
      title: 'Gauge',
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      configurable: true,
      gaugeType: 'arc',
      valueAttribute: 'level',
      min: 0,
      max: 100,
      showLabel: true,
      dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Type', rtId: 'rt-1' },
      ...overrides
    };
  }

  function toPersisted(data: WidgetPersistenceData, widget: GaugeWidgetConfig): PersistedWidgetData {
    return {
      rtId: widget.id,
      ckTypeId: 'System.UI/DashboardWidget',
      name: widget.title,
      type: 'gauge',
      col: widget.col,
      row: widget.row,
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan,
      dataSourceType: data.dataSourceType === 'persistentQuery' ? 'systemQuery' : data.dataSourceType,
      dataSourceCkTypeId: data.dataSourceCkTypeId ?? null,
      dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(data.config)
    };
  }

  function roundTrip(widget: GaugeWidgetConfig): GaugeWidgetConfig {
    return registry.deserializeWidget(toPersisted(registry.serializeWidget(widget), widget)) as GaugeWidgetConfig;
  }

  function applyResult(widget: GaugeWidgetConfig, result: Partial<GaugeConfigResult>): GaugeWidgetConfig {
    return registry.applyConfigResult(widget, {
      ckTypeId: '',
      valueAttribute: '',
      gaugeType: 'arc',
      ...result
    } as GaugeConfigResult) as GaugeWidgetConfig;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: WindowService, useValue: { open: vi.fn() } }]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('round-trips a formula gauge through dialog apply and persistence', () => {
    const applied = applyResult(createGauge({ filters: [{ attributePath: 'x', operator: 'EQUALS', comparisonValue: '1' }] }), {
      dataSourceType: 'formula',
      formula: 'max(0, min(100, (1 - ${import} / ${consumption}) * 100))',
      gaugeType: 'radial',
      min: 0,
      max: 100,
      suffix: ' %',
      ranges: [{ from: 0, to: 50, color: 'var(--kendo-color-error)' }]
    });

    expect(applied.dataSource).toEqual({ type: 'static' });
    expect(applied.valueMode).toBe('formula');
    expect(applied.filters).toBeUndefined();
    expect(applied.labelAttribute).toBeUndefined();

    const serialized = registry.serializeWidget(applied);
    expect(serialized.dataSourceType).toBe('static');

    const restored = roundTrip(applied);
    expect(restored.dataSource).toEqual({ type: 'static' });
    expect(restored.valueMode).toBe('formula');
    expect(restored.formula).toBe('max(0, min(100, (1 - ${import} / ${consumption}) * 100))');
    expect(restored.gaugeType).toBe('radial');
    expect(restored.suffix).toBe(' %');
    expect(restored.ranges).toEqual([{ from: 0, to: 50, color: 'var(--kendo-color-error)' }]);
  });

  it('opens the dialog of a formula gauge in formula mode', () => {
    const initial = registry.getInitialConfig(createGauge({ dataSource: { type: 'static' }, valueMode: 'formula', formula: '${a}' }));

    expect(initial['initialDataSourceType']).toBe('formula');
    expect(initial['initialFormula']).toBe('${a}');
    expect(initial['initialWidgetId']).toBe('gauge-1');
  });

  it('clears formula and valueMode when switching to a query', () => {
    const formulaGauge = createGauge({ dataSource: { type: 'static' }, valueMode: 'formula', formula: '${a}' });
    const applied = applyResult(formulaGauge, { dataSourceType: 'persistentQuery', queryRtId: 'q-1', queryMode: 'simpleCount' });

    expect(applied.valueMode).toBeUndefined();
    expect(applied.formula).toBeUndefined();
    expect(applied.dataSource.type).toBe('persistentQuery');
    expect(roundTrip(applied).formula).toBeUndefined();
  });

  it('clears formula and valueMode when switching to a runtime entity', () => {
    const formulaGauge = createGauge({ dataSource: { type: 'static' }, valueMode: 'formula', formula: '${a}' });
    const applied = applyResult(formulaGauge, { dataSourceType: 'runtimeEntity', ckTypeId: 'Test/Type', rtId: 'rt-2', valueAttribute: 'level' });

    expect(applied.valueMode).toBeUndefined();
    expect(applied.formula).toBeUndefined();
    expect(applied.dataSource).toEqual(expect.objectContaining({ type: 'runtimeEntity', rtId: 'rt-2' }));
  });

  describe('existing gauges load and encode unchanged (no migration)', () => {
    it('encodes a runtime-entity gauge exactly as before', () => {
      const serialized = registry.serializeWidget(createGauge());

      expect(serialized.dataSourceType).toBe('runtimeEntity');
      expect(JSON.stringify(serialized.config)).toBe(JSON.stringify({
        gaugeType: 'arc',
        valueAttribute: 'level',
        min: 0,
        max: 100,
        showLabel: true
      }));
    });

    it('encodes a query gauge without formula keys', () => {
      const widget = createGauge({
        valueAttribute: '',
        dataSource: { type: 'persistentQuery', queryRtId: 'q-1', queryName: 'Q' },
        queryMode: 'simpleCount'
      });
      const config = registry.serializeWidget(widget).config as Record<string, unknown>;

      expect(Object.keys(config)).not.toContain('valueMode');
      expect(Object.keys(config)).not.toContain('formula');
    });

    it('loads a gauge persisted before AB#7950 as before', () => {
      const legacy: PersistedWidgetData = {
        rtId: 'g-old',
        ckTypeId: 'System.UI/DashboardWidget',
        name: 'Old',
        type: 'gauge',
        col: 1,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        dataSourceType: 'runtimeEntity',
        dataSourceCkTypeId: 'Test/Type',
        dataSourceRtId: 'rt-1',
        config: JSON.stringify({ gaugeType: 'linear', valueAttribute: 'level', min: 10, max: 90 })
      };
      const widget = registry.deserializeWidget(legacy) as GaugeWidgetConfig;

      expect(widget.dataSource).toEqual(expect.objectContaining({ type: 'runtimeEntity', rtId: 'rt-1' }));
      expect(widget.valueMode).toBeUndefined();
      expect(widget.formula).toBeUndefined();
      expect(widget.gaugeType).toBe('linear');
      expect(widget.min).toBe(10);
    });
  });
});
