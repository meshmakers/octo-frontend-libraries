import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { AnyWidgetConfig, BarChartWidgetConfig, LineChartWidgetConfig, PieChartWidgetConfig } from '../models/meshboard.models';

/**
 * Persistence of `categoryLabels` / `seriesLabels` (AB#7235) through the real registrations: save and
 * reload, the dialog round trip, and boards without the keys. Board export / import carries the
 * persisted config string unchanged, so save -> load is also export -> import.
 */
describe('Default widget registrations - chart value labels (AB#7235)', () => {
  let registry: WidgetRegistryService;

  const BASE = { col: 1, row: 1, colSpan: 3, rowSpan: 2, configurable: true };
  const DS = { type: 'persistentQuery' as const, queryRtId: 'q-energy', queryName: 'energy', queryFamily: 'streamData' as const };
  const LABELS = { '1-1:2.9.0 G.03': 'Feed-in', '1-1:2.9.0 P.01T': 'Surplus' };

  const PIE: PieChartWidgetConfig = {
    ...BASE, id: 'pie-1', rtId: 'pie-1', type: 'pieChart', title: 'Pie', dataSource: DS,
    chartType: 'pie', categoryField: 'obisCode', valueField: 'energy_sum', showLabels: false, showLegend: true, legendPosition: 'right'
  };
  const BAR: BarChartWidgetConfig = {
    ...BASE, id: 'bar-1', rtId: 'bar-1', type: 'barChart', title: 'Bar', dataSource: DS,
    chartType: 'column', categoryField: 'obisCode', series: [], seriesGroupField: 'region', valueField: 'energy_sum',
    showLegend: true, legendPosition: 'right', showDataLabels: false
  };
  const LINE: LineChartWidgetConfig = {
    ...BASE, id: 'line-1', rtId: 'line-1', type: 'lineChart', title: 'Line', dataSource: DS,
    chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value',
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

  function roundTrip<T extends AnyWidgetConfig>(widget: T): T {
    return registry.deserializeWidget(toPersisted(registry.serializeWidget(widget), widget)) as T;
  }

  function withStoredConfig<T extends AnyWidgetConfig>(widget: T, extra: Record<string, unknown>): T {
    const data = registry.serializeWidget(widget);
    return registry.deserializeWidget(toPersisted(data, widget, { ...(data.config as Record<string, unknown>), ...extra })) as T;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  describe('boards without the keys', () => {
    it.each([['pie', PIE], ['bar', BAR], ['line', LINE]] as const)('%s chart: encodes without the keys and loads unchanged (byte-identical)', (_name, widget) => {
      const persisted = registry.serializeWidget(widget);
      expect(persisted.config).not.toHaveProperty('categoryLabels');
      expect(persisted.config).not.toHaveProperty('seriesLabels');

      const loaded = roundTrip(widget);
      expect(loaded).not.toHaveProperty('categoryLabels');
      expect(loaded).not.toHaveProperty('seriesLabels');
      expect(JSON.stringify(registry.serializeWidget(loaded).config)).toBe(JSON.stringify(persisted.config));
    });

    it('does not write an empty map or a map without a complete entry', () => {
      for (const labels of [{}, { A: '' }, { '': 'x' }] as Record<string, string>[]) {
        expect(registry.serializeWidget({ ...PIE, categoryLabels: labels }).config).not.toHaveProperty('categoryLabels');
        expect(registry.serializeWidget({ ...BAR, categoryLabels: labels, seriesLabels: labels }).config).not.toHaveProperty('categoryLabels');
        expect(registry.serializeWidget({ ...BAR, seriesLabels: labels }).config).not.toHaveProperty('seriesLabels');
        expect(registry.serializeWidget({ ...LINE, seriesLabels: labels }).config).not.toHaveProperty('seriesLabels');
      }
    });
  });

  describe('save and reload (and board export / import)', () => {
    it('pie chart keeps categoryLabels', () => {
      expect(roundTrip({ ...PIE, categoryLabels: LABELS }).categoryLabels).toEqual(LABELS);
    });

    it('pie chart on a Construction Kit query keeps categoryLabels', () => {
      const ck: PieChartWidgetConfig = { ...PIE, dataSource: { type: 'constructionKitQuery', queryTarget: 'models', groupBy: 'modelState' }, categoryLabels: { Available: 'Ready' } };
      expect(roundTrip(ck).categoryLabels).toEqual({ Available: 'Ready' });
    });

    it('bar chart keeps categoryLabels and seriesLabels independently', () => {
      const both = roundTrip({ ...BAR, categoryLabels: LABELS, seriesLabels: { N: 'North' } });
      expect(both.categoryLabels).toEqual(LABELS);
      expect(both.seriesLabels).toEqual({ N: 'North' });

      const onlyCategories = roundTrip({ ...BAR, categoryLabels: LABELS });
      expect(onlyCategories.categoryLabels).toEqual(LABELS);
      expect(onlyCategories).not.toHaveProperty('seriesLabels');
    });

    it('line chart keeps seriesLabels', () => {
      expect(roundTrip({ ...LINE, seriesLabels: LABELS }).seriesLabels).toEqual(LABELS);
    });

    it('a chart with names encodes the plain JSON map under the documented key', () => {
      expect(registry.serializeWidget({ ...PIE, categoryLabels: LABELS }).config).toMatchObject({ categoryLabels: LABELS });
      expect(registry.serializeWidget({ ...BAR, seriesLabels: LABELS }).config).toMatchObject({ seriesLabels: LABELS });
      expect(registry.serializeWidget({ ...LINE, seriesLabels: LABELS }).config).toMatchObject({ seriesLabels: LABELS });
    });

    it('keeps the raw values exactly as stored and drops incomplete or foreign entries on load', () => {
      const stored = { ' padded ': 'Kept', A1: '  Alpha  ', B2: '', C3: 5, D4: null, '': 'no key' };
      expect(withStoredConfig(PIE, { categoryLabels: stored }).categoryLabels).toEqual({ ' padded ': 'Kept', A1: 'Alpha' });
      expect(withStoredConfig(BAR, { categoryLabels: stored, seriesLabels: stored }).seriesLabels).toEqual({ ' padded ': 'Kept', A1: 'Alpha' });
      expect(withStoredConfig(LINE, { seriesLabels: stored }).seriesLabels).toEqual({ ' padded ': 'Kept', A1: 'Alpha' });
    });

    it('ignores a key that is not a map', () => {
      for (const foreign of ['A=B', ['A'], 7, null]) {
        expect(withStoredConfig(PIE, { categoryLabels: foreign })).not.toHaveProperty('categoryLabels');
        expect(withStoredConfig(BAR, { categoryLabels: foreign, seriesLabels: foreign })).not.toHaveProperty('seriesLabels');
        expect(withStoredConfig(LINE, { seriesLabels: foreign })).not.toHaveProperty('seriesLabels');
      }
    });
  });

  describe('config dialog round trip', () => {
    it('pie chart: passes the names to the dialog, applies the result and clears them', () => {
      const registration = registry.getRegistration('pieChart')!;
      const widget = { ...PIE, categoryLabels: LABELS };
      expect((registration.getInitialConfig!(widget) as Record<string, unknown>)['initialCategoryLabels']).toEqual(LABELS);

      const result = { dataSourceType: 'persistentQuery', queryRtId: 'q-energy', chartType: 'pie', categoryField: 'obisCode', valueField: 'energy_sum', showLabels: false, showLegend: true, legendPosition: 'right' };
      const applied = registration.applyConfigResult!(widget, { ...result, categoryLabels: { A1: 'Alpha' } } as never) as PieChartWidgetConfig;
      expect(applied.categoryLabels).toEqual({ A1: 'Alpha' });
      expect(roundTrip(applied).categoryLabels).toEqual({ A1: 'Alpha' });

      const cleared = registration.applyConfigResult!(widget, result as never) as PieChartWidgetConfig;
      expect(cleared.categoryLabels).toBeUndefined();
      expect(registry.serializeWidget(cleared).config).not.toHaveProperty('categoryLabels');
    });

    it('bar chart: passes both maps to the dialog, applies the result and clears them', () => {
      const registration = registry.getRegistration('barChart')!;
      const widget = { ...BAR, categoryLabels: LABELS, seriesLabels: { N: 'North' } };
      const initial = registration.getInitialConfig!(widget) as Record<string, unknown>;
      expect(initial['initialCategoryLabels']).toEqual(LABELS);
      expect(initial['initialSeriesLabels']).toEqual({ N: 'North' });

      const result = { queryRtId: 'q-energy', chartType: 'column', categoryField: 'obisCode', series: [], seriesGroupField: 'region', valueField: 'energy_sum', showLegend: true, legendPosition: 'right', showDataLabels: false };
      const applied = registration.applyConfigResult!(widget, { ...result, categoryLabels: { A1: 'Alpha' }, seriesLabels: { S: 'South' } } as never) as BarChartWidgetConfig;
      expect(applied.categoryLabels).toEqual({ A1: 'Alpha' });
      expect(applied.seriesLabels).toEqual({ S: 'South' });
      const reloaded = roundTrip(applied);
      expect(reloaded.categoryLabels).toEqual({ A1: 'Alpha' });
      expect(reloaded.seriesLabels).toEqual({ S: 'South' });

      const cleared = registration.applyConfigResult!(widget, result as never) as BarChartWidgetConfig;
      expect(registry.serializeWidget(cleared).config).not.toHaveProperty('categoryLabels');
      expect(registry.serializeWidget(cleared).config).not.toHaveProperty('seriesLabels');
    });

    it('line chart: passes the names to the dialog, applies the result and clears them', () => {
      const registration = registry.getRegistration('lineChart')!;
      const widget = { ...LINE, seriesLabels: LABELS };
      expect((registration.getInitialConfig!(widget) as Record<string, unknown>)['initialSeriesLabels']).toEqual(LABELS);

      const result = { queryRtId: 'q-energy', chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value', showLegend: true, legendPosition: 'right', showMarkers: false, showDataBadge: true };
      const applied = registration.applyConfigResult!(widget, { ...result, seriesLabels: { A1: 'Alpha' } } as never) as LineChartWidgetConfig;
      expect(applied.seriesLabels).toEqual({ A1: 'Alpha' });
      expect(roundTrip(applied).seriesLabels).toEqual({ A1: 'Alpha' });

      const cleared = registration.applyConfigResult!(widget, result as never) as LineChartWidgetConfig;
      expect(registry.serializeWidget(cleared).config).not.toHaveProperty('seriesLabels');
    });
  });
});
