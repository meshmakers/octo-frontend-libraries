import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { KpiWidgetConfig, PieChartWidgetConfig } from '../models/meshboard.models';
import { PieChartConfigResult } from '../widgets/pie-chart-widget/pie-chart-config-dialog.component';
import { KpiConfigResult } from '../widgets/kpi-widget/kpi-config-dialog.component';

describe('Default widget registrations — KPI', () => {
  let registry: WidgetRegistryService;

  function createKpiWidget(overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id: 'kpi-1',
      rtId: 'kpi-1',
      type: 'kpi',
      title: 'KPI',
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      configurable: true,
      valueAttribute: '_count',
      dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Type', rtId: 'rt-1' },
      ...overrides
    };
  }

  function toPersisted(data: WidgetPersistenceData, widget: KpiWidgetConfig): PersistedWidgetData {
    return {
      rtId: widget.id,
      ckTypeId: 'System.UI/DashboardWidget',
      name: widget.title,
      type: 'kpi',
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

  function roundTrip(widget: KpiWidgetConfig): KpiWidgetConfig {
    const serialized = registry.serializeWidget(widget);
    return registry.deserializeWidget(toPersisted(serialized, widget)) as KpiWidgetConfig;
  }

  function applyResult(widget: KpiWidgetConfig, result: Partial<KpiConfigResult>): KpiWidgetConfig {
    return registry.applyConfigResult(widget, {
      ckTypeId: '',
      valueAttribute: '',
      ...result
    } as KpiConfigResult) as KpiWidgetConfig;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: WindowService, useValue: { open: vi.fn() } }]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  describe('comparisonText (AB#5366)', () => {
    it('keeps the comparison text of a static KPI through dialog apply and persistence', () => {
      const applied = applyResult(createKpiWidget(), {
        dataSourceType: 'static',
        staticValue: '42',
        comparisonText: 'vs. ${last}'
      });
      expect(applied.comparisonText).toBe('vs. ${last}');
      expect(roundTrip(applied).comparisonText).toBe('vs. ${last}');
    });

    it('keeps the comparison text of a persistent-query KPI', () => {
      const applied = applyResult(createKpiWidget(), {
        dataSourceType: 'persistentQuery',
        queryRtId: 'q-1',
        queryName: 'Query',
        queryMode: 'simpleCount',
        comparisonText: 'last week'
      });
      expect(applied.comparisonText).toBe('last week');
      const restored = roundTrip(applied);
      expect(restored.dataSource.type).toBe('persistentQuery');
      expect(restored.comparisonText).toBe('last week');
    });

    it('keeps the comparison text of a runtime-entity KPI', () => {
      const applied = applyResult(createKpiWidget(), {
        dataSourceType: 'runtimeEntity',
        ckTypeId: 'Test/Type',
        valueAttribute: '_count',
        comparisonText: 'total'
      });
      expect(applied.comparisonText).toBe('total');
      expect(roundTrip(applied).comparisonText).toBe('total');
    });

    it('clears the comparison text when the dialog returns none', () => {
      const applied = applyResult(createKpiWidget({ comparisonText: 'old' }), {
        dataSourceType: 'static',
        staticValue: '1'
      });
      expect(applied.comparisonText).toBeUndefined();
    });
  });

  describe('formula and output variable (AB#5364)', () => {
    it('round-trips a formula KPI with output variable and comparison text', () => {
      const applied = applyResult(createKpiWidget(), {
        dataSourceType: 'formula',
        formula: '(${a} - ${b}) / 1000',
        outputVariableName: 'delta',
        comparisonText: 'vs. ${last}'
      });
      expect(applied.dataSource).toEqual({ type: 'static' });
      expect(applied.valueMode).toBe('formula');

      const restored = roundTrip(applied);
      expect(restored.valueMode).toBe('formula');
      expect(restored.formula).toBe('(${a} - ${b}) / 1000');
      expect(restored.outputVariableName).toBe('delta');
      expect(restored.comparisonText).toBe('vs. ${last}');
    });

    it('opens the dialog of a formula KPI in formula mode', () => {
      const widget = createKpiWidget({ dataSource: { type: 'static' }, valueMode: 'formula', formula: '${a}', outputVariableName: 'x' });
      const initial = registry.getInitialConfig(widget);
      expect(initial['initialDataSourceType']).toBe('formula');
      expect(initial['initialFormula']).toBe('${a}');
      expect(initial['initialOutputVariableName']).toBe('x');
      expect(initial['initialWidgetId']).toBe('kpi-1');
    });

    it('round-trips the output variable of a query KPI', () => {
      const applied = applyResult(createKpiWidget(), {
        dataSourceType: 'persistentQuery',
        queryRtId: 'q-1',
        queryMode: 'simpleCount',
        outputVariableName: 'consumption'
      });
      const restored = roundTrip(applied);
      expect(restored.outputVariableName).toBe('consumption');
      expect(restored.valueMode).toBeUndefined();
    });

    it('drops the formula when switching back to a static value', () => {
      const formulaWidget = createKpiWidget({ dataSource: { type: 'static' }, valueMode: 'formula', formula: '${a}' });
      const applied = applyResult(formulaWidget, { dataSourceType: 'static', staticValue: '1' });
      expect(applied.valueMode).toBeUndefined();
      expect(applied.formula).toBeUndefined();
      expect(roundTrip(applied).valueMode).toBeUndefined();
    });
  });
});

describe('Default widget registrations — pie chart presentation (AB#5622)', () => {
  let registry: WidgetRegistryService;

  function pie(overrides: Partial<PieChartWidgetConfig> = {}): PieChartWidgetConfig {
    return {
      id: 'pie-1', rtId: 'pie-1', type: 'pieChart', title: 'Pie', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1' },
      chartType: 'donut', categoryField: 'state', valueField: 'count', showLabels: true, showLegend: false, legendPosition: 'right',
      ...overrides
    } as PieChartWidgetConfig;
  }

  function roundTrip(widget: PieChartWidgetConfig): PieChartWidgetConfig {
    const data = registry.serializeWidget(widget);
    return registry.deserializeWidget({
      rtId: widget.id, ckTypeId: 'System.UI/DashboardWidget', name: widget.title, type: 'pieChart',
      col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSourceType: data.dataSourceType === 'persistentQuery' ? 'systemQuery' : data.dataSourceType,
      dataSourceCkTypeId: data.dataSourceCkTypeId ?? null, dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(data.config)
    }) as PieChartWidgetConfig;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('persists category colours, label position and the small-slice threshold in the board JSON', () => {
    const restored = roundTrip(pie({ categoryColors: { PAID: '#2fb37a', OPEN: '--brand-open' }, labelPosition: 'outside', hideLabelsBelowPercent: 3 }));
    expect(restored.categoryColors).toEqual({ PAID: '#2fb37a', OPEN: '--brand-open' });
    expect(restored.labelPosition).toBe('outside');
    expect(restored.hideLabelsBelowPercent).toBe(3);
  });

  it('writes nothing new for boards without the settings (backward compatible)', () => {
    const data = registry.serializeWidget(pie());
    expect(Object.keys(data.config)).not.toContain('categoryColors');
    expect(Object.keys(data.config)).not.toContain('labelPosition');
    const restored = roundTrip(pie());
    expect(restored.categoryColors).toBeUndefined();
    expect(restored.labelPosition).toBeUndefined();
  });

  it('ignores an unknown label position from a hand-edited board', () => {
    const data = registry.serializeWidget(pie());
    const restored = registry.deserializeWidget({
      rtId: 'pie-1', ckTypeId: 'System.UI/DashboardWidget', name: 'Pie', type: 'pieChart', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSourceType: 'systemQuery', dataSourceCkTypeId: null, dataSourceRtId: 'q1',
      config: JSON.stringify({ ...data.config, labelPosition: 'diagonal' })
    }) as PieChartWidgetConfig;
    expect(restored.labelPosition).toBeUndefined();
  });

  it('drops non-string category colours from a hand-edited board', () => {
    const data = registry.serializeWidget(pie());
    const restored = registry.deserializeWidget({
      rtId: 'pie-1', ckTypeId: 'System.UI/DashboardWidget', name: 'Pie', type: 'pieChart', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSourceType: 'systemQuery', dataSourceCkTypeId: null, dataSourceRtId: 'q1',
      config: JSON.stringify({ ...data.config, categoryColors: { PAID: '#2fb37a', OPEN: 42, CLOSED: { c: 1 } } })
    }) as PieChartWidgetConfig;
    expect(restored.categoryColors).toEqual({ PAID: '#2fb37a' });
  });

  it('carries the settings through the config dialog result', () => {
    const initial = registry.getInitialConfig(pie({ categoryColors: { PAID: 'success' }, labelPosition: 'inside' })) as Record<string, unknown>;
    expect(initial['initialCategoryColors']).toEqual({ PAID: 'success' });
    expect(initial['initialLabelPosition']).toBe('inside');
    const applied = registry.applyConfigResult(pie(), {
      ckTypeId: '', rtId: '', dataSourceType: 'persistentQuery', queryRtId: 'q1', chartType: 'pie', categoryField: 'state', valueField: 'count',
      showLabels: true, showLegend: false, legendPosition: 'right', categoryColors: { PAID: '#00ff00' }, labelPosition: 'none'
    } as PieChartConfigResult) as PieChartWidgetConfig;
    expect(applied.categoryColors).toEqual({ PAID: '#00ff00' });
    expect(applied.labelPosition).toBe('none');
  });
});
