import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData, WidgetPersistenceData } from '../../services/widget-registry.service';
import { registerDefaultWidgets } from '../../registrations/default-widget-registrations';
import { HeatmapWidgetConfig } from '../../models/meshboard.models';
import { HeatmapConfigResult } from './heatmap-config-dialog.component';

describe('Heatmap registration — AB#7956 options', () => {
  let registry: WidgetRegistryService;

  function heatmap(overrides: Partial<HeatmapWidgetConfig> = {}): HeatmapWidgetConfig {
    return {
      id: 'hm-1',
      rtId: 'hm-1',
      type: 'heatmap',
      title: 'Heatmap',
      col: 1,
      row: 1,
      colSpan: 3,
      rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryName: 'Q', queryFamily: 'streamData' },
      dateField: 'timestamp',
      aggregation: 'count',
      colorScheme: 'green',
      showLegend: true,
      legendPosition: 'bottom',
      ...overrides
    } as HeatmapWidgetConfig;
  }

  function toPersisted(data: WidgetPersistenceData, widget: HeatmapWidgetConfig): PersistedWidgetData {
    return {
      rtId: widget.id,
      ckTypeId: 'System.UI/DashboardWidget',
      name: widget.title,
      type: 'heatmap',
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: WindowService, useValue: { open: vi.fn() } }]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  it('keeps weighted mean, bucket end and own window through dialog apply and persistence', () => {
    const applied = registry.applyConfigResult(heatmap(), {
      ckTypeId: '',
      queryRtId: 'q1',
      queryName: 'Q',
      queryFamily: 'streamData',
      dateField: 'timestamp',
      valueField: 'value_sum',
      aggregation: 'weightedAvg',
      weightField: 'value_count',
      timestampIsBucketEnd: true,
      bucketWidthMinutes: 5,
      timeWindow: { value: 30, unit: 'days' },
      colorScheme: 'blue',
      showLegend: true,
      legendPosition: 'bottom'
    } as HeatmapConfigResult) as HeatmapWidgetConfig;

    const restored = registry.deserializeWidget(toPersisted(registry.serializeWidget(applied), applied)) as HeatmapWidgetConfig;

    expect(restored.aggregation).toBe('weightedAvg');
    expect(restored.valueField).toBe('value_sum');
    expect(restored.weightField).toBe('value_count');
    expect(restored.timestampIsBucketEnd).toBe(true);
    expect(restored.bucketWidthMinutes).toBe(5);
    expect(restored.timeWindow).toEqual({ value: 30, unit: 'days' });
  });

  it('serializes an existing heatmap without the new keys', () => {
    const config = registry.serializeWidget(heatmap()).config as Record<string, unknown>;
    for (const key of ['weightField', 'timestampIsBucketEnd', 'bucketWidthMinutes', 'timeWindow']) {
      expect(key in config).toBe(false);
    }
  });

  it('reads an existing heatmap without the new options and drops an invalid stored window', () => {
    const widget = heatmap();
    const persisted = toPersisted(registry.serializeWidget(widget), widget);
    const config = JSON.parse(persisted.config as string);
    config.timeWindow = { value: -1, unit: 'days' };
    const restored = registry.deserializeWidget({ ...persisted, config: JSON.stringify(config) }) as HeatmapWidgetConfig;

    expect(restored.weightField).toBeUndefined();
    expect(restored.timestampIsBucketEnd).toBeUndefined();
    expect(restored.bucketWidthMinutes).toBeUndefined();
    expect(restored.timeWindow).toBeUndefined();
  });
});
