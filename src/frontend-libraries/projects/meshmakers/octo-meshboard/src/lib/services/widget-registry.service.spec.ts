import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import {
  WidgetRegistryService,
  WidgetRegistration,
  WidgetConfigResult,
  BaseWidgetConfig,
  PersistedWidgetData,
  WidgetPersistenceData,
  WidgetConfigDialog
} from './widget-registry.service';
import {
  KpiWidgetConfig,
  GaugeWidgetConfig,
  WidgetType,
  RuntimeEntityDataSource
} from '../models/meshboard.models';

describe('WidgetRegistryService', () => {
  let service: WidgetRegistryService;

  // Helper to create a mock KPI widget
  function createMockKpiWidget(overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id: 'test-widget-1',
      type: 'kpi',
      title: 'Test KPI',
      col: 1,
      row: 1,
      colSpan: 2,
      rowSpan: 1,
      valueAttribute: 'testValue',
      dataSource: {
        type: 'runtimeEntity',
        ckTypeId: 'TestType',
        rtId: 'test-rt-id'
      },
      configurable: true,
      ...overrides
    };
  }

  // Helper to create a mock gauge widget
  function createMockGaugeWidget(overrides: Partial<GaugeWidgetConfig> = {}): GaugeWidgetConfig {
    return {
      id: 'test-gauge-1',
      type: 'gauge',
      title: 'Test Gauge',
      col: 1,
      row: 1,
      colSpan: 2,
      rowSpan: 2,
      gaugeType: 'arc',
      valueAttribute: 'gaugeValue',
      dataSource: {
        type: 'runtimeEntity',
        ckTypeId: 'TestType',
        rtId: 'test-rt-id'
      },
      configurable: true,
      ...overrides
    };
  }

  // Mock dialog component class for registration tests
  class MockConfigDialog implements WidgetConfigDialog {
    initialCkTypeId?: string;
    initialRtId?: string;
  }

  // Helper to create a KPI widget registration
  function createKpiRegistration(): WidgetRegistration<KpiWidgetConfig, WidgetConfigResult> {
    return {
      type: 'kpi',
      label: 'KPI Widget',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      component: MockConfigDialog as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      configDialogComponent: MockConfigDialog as any,
      defaultSize: { colSpan: 2, rowSpan: 1 },
      supportedDataSources: ['runtimeEntity', 'persistentQuery', 'static'],
      createDefaultConfig: (baseConfig: BaseWidgetConfig): KpiWidgetConfig => ({
        ...baseConfig,
        type: 'kpi',
        valueAttribute: 'value',
        dataSource: { type: 'static', data: 0 }
      }),
      toPersistedConfig: (widget: KpiWidgetConfig): WidgetPersistenceData => ({
        dataSourceType: widget.dataSource.type,
        dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
        dataSourceRtId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined,
        config: {
          valueAttribute: widget.valueAttribute,
          prefix: widget.prefix,
          suffix: widget.suffix
        }
      }),
      fromPersistedConfig: (data: PersistedWidgetData, baseConfig: BaseWidgetConfig): KpiWidgetConfig => ({
        ...baseConfig,
        type: 'kpi',
        valueAttribute: JSON.parse(data.config).valueAttribute ?? 'value',
        prefix: JSON.parse(data.config).prefix,
        suffix: JSON.parse(data.config).suffix,
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: data.dataSourceCkTypeId ?? undefined,
          rtId: data.dataSourceRtId ?? undefined
        }
      }),
      getInitialConfig: (widget: KpiWidgetConfig) => ({
        initialCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
        initialRtId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined,
        valueAttribute: widget.valueAttribute
      }),
      applyConfigResult: (widget: KpiWidgetConfig, result: WidgetConfigResult): KpiWidgetConfig => ({
        ...widget,
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: result.ckTypeId,
          rtId: result.rtId
        }
      })
    };
  }

  // Helper to create a gauge registration (without config dialog)
  function createGaugeRegistration(): WidgetRegistration<GaugeWidgetConfig, WidgetConfigResult> {
    return {
      type: 'gauge',
      label: 'Gauge Widget',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      component: MockConfigDialog as any,
      // No configDialogComponent - intentionally
      defaultSize: { colSpan: 2, rowSpan: 2 },
      createDefaultConfig: (baseConfig: BaseWidgetConfig): GaugeWidgetConfig => ({
        ...baseConfig,
        type: 'gauge',
        gaugeType: 'arc',
        valueAttribute: 'value',
        dataSource: { type: 'static', data: 0 }
      }),
      toPersistedConfig: (widget: GaugeWidgetConfig): WidgetPersistenceData => ({
        dataSourceType: widget.dataSource.type,
        config: {
          gaugeType: widget.gaugeType,
          valueAttribute: widget.valueAttribute
        }
      }),
      fromPersistedConfig: (data: PersistedWidgetData, baseConfig: BaseWidgetConfig): GaugeWidgetConfig => {
        const config = JSON.parse(data.config);
        return {
          ...baseConfig,
          type: 'gauge',
          gaugeType: config.gaugeType ?? 'arc',
          valueAttribute: config.valueAttribute ?? 'value',
          dataSource: { type: 'static', data: 0 }
        };
      }
    };
  }

  beforeEach(() => {
    const mockWindowService = jasmine.createSpyObj('WindowService', ['open']);

    TestBed.configureTestingModule({
      providers: [
        { provide: WindowService, useValue: mockWindowService }
      ]
    });
    service = TestBed.inject(WidgetRegistryService);
  });

  // ========================================================================
  // Registration Tests
  // ========================================================================

  describe('Widget Registration', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should register a widget type', () => {
      const registration = createKpiRegistration();
      service.registerWidget(registration);

      const retrieved = service.getRegistration('kpi');
      expect(retrieved).toBeDefined();
      expect(retrieved?.label).toBe('KPI Widget');
    });

    it('should register multiple widget types', () => {
      service.registerWidget(createKpiRegistration());
      service.registerWidget(createGaugeRegistration());

      const registeredWidgets = service.getRegisteredWidgets();
      expect(registeredWidgets.length).toBe(2);
    });

    it('should overwrite existing registration for same type', () => {
      const kpiReg1 = createKpiRegistration();
      kpiReg1.label = 'Original KPI';
      service.registerWidget(kpiReg1);

      const kpiReg2 = createKpiRegistration();
      kpiReg2.label = 'Updated KPI';
      service.registerWidget(kpiReg2);

      const retrieved = service.getRegistration('kpi');
      expect(retrieved?.label).toBe('Updated KPI');
    });
  });

  // ========================================================================
  // getRegisteredWidgets Tests
  // ========================================================================

  describe('getRegisteredWidgets', () => {
    it('should return empty array when no widgets registered', () => {
      const widgets = service.getRegisteredWidgets();
      expect(widgets).toEqual([]);
    });

    it('should return type and label for all registered widgets', () => {
      service.registerWidget(createKpiRegistration());
      service.registerWidget(createGaugeRegistration());

      const widgets = service.getRegisteredWidgets();
      expect(widgets).toContain({ type: 'kpi', label: 'KPI Widget' });
      expect(widgets).toContain({ type: 'gauge', label: 'Gauge Widget' });
    });
  });

  // ========================================================================
  // getWidgetComponent Tests
  // ========================================================================

  describe('getWidgetComponent', () => {
    it('should return component for registered widget type', () => {
      service.registerWidget(createKpiRegistration());

      const component = service.getWidgetComponent('kpi');
      expect(component).toBeDefined();
    });

    it('should return undefined for unregistered widget type', () => {
      const component = service.getWidgetComponent('unknownType' as WidgetType);
      expect(component).toBeUndefined();
    });
  });

  // ========================================================================
  // getDefaultSize Tests
  // ========================================================================

  describe('getDefaultSize', () => {
    it('should return default size for registered widget', () => {
      service.registerWidget(createKpiRegistration());

      const size = service.getDefaultSize('kpi');
      expect(size).toEqual({ colSpan: 2, rowSpan: 1 });
    });

    it('should return fallback size for unregistered widget', () => {
      const size = service.getDefaultSize('unknownType' as WidgetType);
      expect(size).toEqual({ colSpan: 2, rowSpan: 1 });
    });

    it('should return different sizes for different widget types', () => {
      service.registerWidget(createKpiRegistration());
      service.registerWidget(createGaugeRegistration());

      expect(service.getDefaultSize('kpi')).toEqual({ colSpan: 2, rowSpan: 1 });
      expect(service.getDefaultSize('gauge')).toEqual({ colSpan: 2, rowSpan: 2 });
    });
  });

  // ========================================================================
  // getRegistration Tests
  // ========================================================================

  describe('getRegistration', () => {
    it('should return full registration object', () => {
      service.registerWidget(createKpiRegistration());

      const registration = service.getRegistration('kpi');
      expect(registration).toBeDefined();
      expect(registration?.type).toBe('kpi');
      expect(registration?.label).toBe('KPI Widget');
      expect(registration?.createDefaultConfig).toBeDefined();
      expect(registration?.toPersistedConfig).toBeDefined();
      expect(registration?.fromPersistedConfig).toBeDefined();
    });

    it('should return undefined for unregistered type', () => {
      const registration = service.getRegistration('unknownType' as WidgetType);
      expect(registration).toBeUndefined();
    });
  });

  // ========================================================================
  // getSupportedDataSources Tests
  // ========================================================================

  describe('getSupportedDataSources', () => {
    it('should return supported data sources from registration', () => {
      service.registerWidget(createKpiRegistration());

      const sources = service.getSupportedDataSources('kpi');
      expect(sources).toEqual(['runtimeEntity', 'persistentQuery', 'static']);
    });

    it('should return all data source types when not specified', () => {
      service.registerWidget(createGaugeRegistration());

      const sources = service.getSupportedDataSources('gauge');
      expect(sources).toContain('runtimeEntity');
      expect(sources).toContain('persistentQuery');
      expect(sources).toContain('aggregation');
      expect(sources).toContain('serviceCall');
      expect(sources).toContain('constructionKitQuery');
      expect(sources).toContain('static');
    });

    it('should return all data source types for unregistered widget', () => {
      const sources = service.getSupportedDataSources('unknownType' as WidgetType);
      expect(sources.length).toBe(6);
    });
  });

  // ========================================================================
  // createWidget Tests
  // ========================================================================

  describe('createWidget', () => {
    it('should create widget with default configuration', () => {
      service.registerWidget(createKpiRegistration());

      const baseConfig: BaseWidgetConfig = {
        id: 'new-widget',
        title: 'New KPI',
        col: 3,
        row: 2,
        colSpan: 2,
        rowSpan: 1
      };

      const widget = service.createWidget('kpi', baseConfig);
      expect(widget.id).toBe('new-widget');
      expect(widget.title).toBe('New KPI');
      expect(widget.type).toBe('kpi');
      expect(widget.col).toBe(3);
      expect(widget.row).toBe(2);
    });

    it('should throw error for unknown widget type', () => {
      expect(() => {
        service.createWidget('unknownType' as WidgetType, {
          id: 'test',
          title: 'Test',
          col: 1,
          row: 1,
          colSpan: 2,
          rowSpan: 1
        });
      }).toThrowError('Unknown widget type: unknownType');
    });

    it('should use registration createDefaultConfig function', () => {
      const customRegistration = createKpiRegistration();
      customRegistration.createDefaultConfig = (base) => ({
        ...base,
        type: 'kpi',
        valueAttribute: 'customValue',
        prefix: 'PREFIX:',
        dataSource: { type: 'static', data: 100 }
      });
      service.registerWidget(customRegistration);

      const widget = service.createWidget('kpi', {
        id: 'test',
        title: 'Test',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1
      }) as KpiWidgetConfig;

      expect(widget.valueAttribute).toBe('customValue');
      expect(widget.prefix).toBe('PREFIX:');
    });
  });

  // ========================================================================
  // serializeWidget Tests
  // ========================================================================

  describe('serializeWidget', () => {
    it('should serialize widget configuration', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget({ prefix: '$', suffix: '%' });

      const persisted = service.serializeWidget(widget);
      expect(persisted.dataSourceType).toBe('runtimeEntity');
      expect(persisted.dataSourceCkTypeId).toBe('TestType');
      expect(persisted.dataSourceRtId).toBe('test-rt-id');
      expect(persisted.config['valueAttribute']).toBe('testValue');
    });

    it('should throw error for unknown widget type', () => {
      const widget = createMockKpiWidget();
      (widget as { type: string }).type = 'unknownType';

      expect(() => service.serializeWidget(widget)).toThrowError('Unknown widget type: unknownType');
    });

    it('should handle static data source', () => {
      const customRegistration = createKpiRegistration();
      customRegistration.toPersistedConfig = (w) => ({
        dataSourceType: w.dataSource.type,
        config: {}
      });
      service.registerWidget(customRegistration);

      const widget = createMockKpiWidget({
        dataSource: { type: 'static', data: 42 }
      });

      const persisted = service.serializeWidget(widget);
      expect(persisted.dataSourceType).toBe('static');
      expect(persisted.dataSourceCkTypeId).toBeUndefined();
      expect(persisted.dataSourceRtId).toBeUndefined();
    });
  });

  // ========================================================================
  // deserializeWidget Tests
  // ========================================================================

  describe('deserializeWidget', () => {
    it('should deserialize persisted widget data', () => {
      service.registerWidget(createKpiRegistration());

      const persistedData: PersistedWidgetData = {
        rtId: 'widget-123',
        ckTypeId: 'System.UI/Widget',
        name: 'My KPI',
        type: 'kpi',
        col: 2,
        row: 3,
        colSpan: 3,
        rowSpan: 2,
        dataSourceType: 'runtimeEntity',
        dataSourceCkTypeId: 'TestType',
        dataSourceRtId: 'test-rt-id',
        config: JSON.stringify({ valueAttribute: 'revenue', prefix: '$' })
      };

      const widget = service.deserializeWidget(persistedData) as KpiWidgetConfig;
      expect(widget.id).toBe('widget-123');
      expect(widget.title).toBe('My KPI');
      expect(widget.type).toBe('kpi');
      expect(widget.col).toBe(2);
      expect(widget.row).toBe(3);
      expect(widget.colSpan).toBe(3);
      expect(widget.rowSpan).toBe(2);
      expect(widget.valueAttribute).toBe('revenue');
      expect(widget.prefix).toBe('$');
    });

    it('should fall back to KPI for unknown widget type', () => {
      service.registerWidget(createKpiRegistration());

      const persistedData: PersistedWidgetData = {
        rtId: 'widget-456',
        ckTypeId: 'System.UI/Widget',
        name: 'Unknown Widget',
        type: 'unknownType',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1,
        dataSourceType: 'static',
        config: JSON.stringify({ valueAttribute: 'value' })
      };

      spyOn(console, 'warn');
      const widget = service.deserializeWidget(persistedData);

      expect(console.warn).toHaveBeenCalledWith('Unknown widget type: unknownType, falling back to KPI');
      expect(widget.type).toBe('kpi');
    });

    it('should throw error when falling back to KPI but KPI not registered', () => {
      // Don't register KPI
      const persistedData: PersistedWidgetData = {
        rtId: 'widget-789',
        ckTypeId: 'System.UI/Widget',
        name: 'Unknown Widget',
        type: 'unknownType',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1,
        dataSourceType: 'static',
        config: '{}'
      };

      spyOn(console, 'warn');
      expect(() => service.deserializeWidget(persistedData))
        .toThrowError('KPI widget registration not found for fallback');
    });

    it('should set configurable to true', () => {
      service.registerWidget(createKpiRegistration());

      const persistedData: PersistedWidgetData = {
        rtId: 'widget-123',
        ckTypeId: 'System.UI/Widget',
        name: 'Test',
        type: 'kpi',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1,
        dataSourceType: 'static',
        config: JSON.stringify({ valueAttribute: 'value' })
      };

      const widget = service.deserializeWidget(persistedData);
      expect(widget.configurable).toBe(true);
    });

    it('should deserialize gauge widget', () => {
      service.registerWidget(createGaugeRegistration());

      const persistedData: PersistedWidgetData = {
        rtId: 'gauge-123',
        ckTypeId: 'System.UI/Widget',
        name: 'My Gauge',
        type: 'gauge',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 2,
        dataSourceType: 'static',
        config: JSON.stringify({ gaugeType: 'circular', valueAttribute: 'temperature' })
      };

      const widget = service.deserializeWidget(persistedData) as GaugeWidgetConfig;
      expect(widget.type).toBe('gauge');
      expect(widget.gaugeType).toBe('circular');
      expect(widget.valueAttribute).toBe('temperature');
    });
  });

  // ========================================================================
  // hasConfigDialog Tests
  // ========================================================================

  describe('hasConfigDialog', () => {
    it('should return true when widget has config dialog', () => {
      service.registerWidget(createKpiRegistration());
      expect(service.hasConfigDialog('kpi')).toBeTrue();
    });

    it('should return false when widget has no config dialog', () => {
      service.registerWidget(createGaugeRegistration());
      expect(service.hasConfigDialog('gauge')).toBeFalse();
    });

    it('should return false for unregistered widget type', () => {
      expect(service.hasConfigDialog('unknownType' as WidgetType)).toBeFalse();
    });
  });

  // ========================================================================
  // getConfigDialogComponent Tests
  // ========================================================================

  describe('getConfigDialogComponent', () => {
    it('should return config dialog component', () => {
      service.registerWidget(createKpiRegistration());

      const dialogComponent = service.getConfigDialogComponent('kpi');
      expect(dialogComponent).toBeDefined();
    });

    it('should return undefined when no config dialog', () => {
      service.registerWidget(createGaugeRegistration());

      const dialogComponent = service.getConfigDialogComponent('gauge');
      expect(dialogComponent).toBeUndefined();
    });
  });

  // ========================================================================
  // getInitialConfig Tests
  // ========================================================================

  describe('getInitialConfig', () => {
    it('should use custom getInitialConfig from registration', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget({
        valueAttribute: 'revenue',
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: 'CustomType',
          rtId: 'custom-rt-id'
        }
      });

      const initialConfig = service.getInitialConfig(widget);
      expect(initialConfig['initialCkTypeId']).toBe('CustomType');
      expect(initialConfig['initialRtId']).toBe('custom-rt-id');
      expect(initialConfig['valueAttribute']).toBe('revenue');
    });

    it('should use default when no getInitialConfig in registration', () => {
      service.registerWidget(createGaugeRegistration());
      const widget = createMockGaugeWidget({
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: 'GaugeType',
          rtId: 'gauge-rt-id'
        }
      });

      const initialConfig = service.getInitialConfig(widget);
      expect(initialConfig['initialCkTypeId']).toBe('GaugeType');
      expect(initialConfig['initialRtId']).toBe('gauge-rt-id');
    });

    it('should return undefined values for non-runtimeEntity data source', () => {
      service.registerWidget(createGaugeRegistration());
      const widget = createMockGaugeWidget({
        dataSource: { type: 'static', data: 50 }
      });

      const initialConfig = service.getInitialConfig(widget);
      expect(initialConfig['initialCkTypeId']).toBeUndefined();
      expect(initialConfig['initialRtId']).toBeUndefined();
    });
  });

  // ========================================================================
  // applyConfigResult Tests
  // ========================================================================

  describe('applyConfigResult', () => {
    it('should use custom applyConfigResult from registration', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget();
      const result: WidgetConfigResult = {
        ckTypeId: 'NewType',
        rtId: 'new-rt-id'
      };

      const updatedWidget = service.applyConfigResult(widget, result) as KpiWidgetConfig;
      expect(updatedWidget.dataSource.type).toBe('runtimeEntity');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).ckTypeId).toBe('NewType');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).rtId).toBe('new-rt-id');
    });

    it('should use default when no applyConfigResult in registration', () => {
      service.registerWidget(createGaugeRegistration());
      const widget = createMockGaugeWidget();
      const result: WidgetConfigResult = {
        ckTypeId: 'NewGaugeType',
        rtId: 'new-gauge-rt-id'
      };

      const updatedWidget = service.applyConfigResult(widget, result) as GaugeWidgetConfig;
      expect(updatedWidget.dataSource.type).toBe('runtimeEntity');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).ckTypeId).toBe('NewGaugeType');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).rtId).toBe('new-gauge-rt-id');
    });

    it('should preserve other widget properties', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget({
        title: 'Original Title',
        valueAttribute: 'originalValue',
        prefix: '$'
      });
      const result: WidgetConfigResult = {
        ckTypeId: 'NewType'
      };

      const updatedWidget = service.applyConfigResult(widget, result) as KpiWidgetConfig;
      expect(updatedWidget.title).toBe('Original Title');
      expect(updatedWidget.valueAttribute).toBe('originalValue');
      expect(updatedWidget.prefix).toBe('$');
    });

    it('should handle result without rtId', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget();
      const result: WidgetConfigResult = {
        ckTypeId: 'TypeOnly'
      };

      const updatedWidget = service.applyConfigResult(widget, result) as KpiWidgetConfig;
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).ckTypeId).toBe('TypeOnly');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).rtId).toBeUndefined();
    });
  });

  // ========================================================================
  // openConfigDialog Tests
  // ========================================================================

  describe('openConfigDialog', () => {
    it('should return saved: false when widget has no config dialog', (done) => {
      service.registerWidget(createGaugeRegistration());
      const widget = createMockGaugeWidget();

      service.openConfigDialog(widget).subscribe(result => {
        expect(result.saved).toBeFalse();
        expect(result.result).toBeUndefined();
        done();
      });
    });

    it('should return saved: false for unregistered widget type', (done) => {
      const widget = createMockKpiWidget();

      service.openConfigDialog(widget).subscribe(result => {
        expect(result.saved).toBeFalse();
        done();
      });
    });
  });

  // ========================================================================
  // openConfigDialogAsync Tests
  // ========================================================================

  describe('openConfigDialogAsync', () => {
    it('should return Promise that resolves to saved: false when no dialog', async () => {
      service.registerWidget(createGaugeRegistration());
      const widget = createMockGaugeWidget();

      const result = await service.openConfigDialogAsync(widget);
      expect(result.saved).toBeFalse();
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe('Integration', () => {
    it('should support full widget lifecycle: create, serialize, deserialize', () => {
      service.registerWidget(createKpiRegistration());

      // Create widget
      const baseConfig: BaseWidgetConfig = {
        id: 'lifecycle-test',
        title: 'Lifecycle Widget',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1
      };
      const widget = service.createWidget('kpi', baseConfig) as KpiWidgetConfig;

      // Modify widget
      const modifiedWidget: KpiWidgetConfig = {
        ...widget,
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: 'LifecycleType',
          rtId: 'lifecycle-rt'
        },
        valueAttribute: 'lifecycleValue',
        prefix: 'LF:'
      };

      // Serialize
      const serialized = service.serializeWidget(modifiedWidget);
      expect(serialized.dataSourceType).toBe('runtimeEntity');

      // Create persisted data (simulating backend storage)
      const persistedData: PersistedWidgetData = {
        rtId: 'backend-generated-id',
        ckTypeId: 'System.UI/Widget',
        name: modifiedWidget.title,
        type: modifiedWidget.type,
        col: modifiedWidget.col,
        row: modifiedWidget.row,
        colSpan: modifiedWidget.colSpan,
        rowSpan: modifiedWidget.rowSpan,
        dataSourceType: serialized.dataSourceType,
        dataSourceCkTypeId: serialized.dataSourceCkTypeId,
        dataSourceRtId: serialized.dataSourceRtId,
        config: JSON.stringify(serialized.config)
      };

      // Deserialize
      const restored = service.deserializeWidget(persistedData) as KpiWidgetConfig;
      expect(restored.type).toBe('kpi');
      expect(restored.valueAttribute).toBe('lifecycleValue');
      expect(restored.prefix).toBe('LF:');
    });

    it('should support configuration update workflow', () => {
      service.registerWidget(createKpiRegistration());
      const widget = createMockKpiWidget();

      // Get initial config for dialog
      const initialConfig = service.getInitialConfig(widget);
      expect(initialConfig['initialCkTypeId']).toBe('TestType');

      // Simulate dialog result
      const configResult: WidgetConfigResult = {
        ckTypeId: 'UpdatedType',
        rtId: 'updated-rt-id'
      };

      // Apply result
      const updatedWidget = service.applyConfigResult(widget, configResult);
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).ckTypeId).toBe('UpdatedType');
      expect((updatedWidget.dataSource as RuntimeEntityDataSource).rtId).toBe('updated-rt-id');
    });

    it('should handle multiple widget types independently', () => {
      service.registerWidget(createKpiRegistration());
      service.registerWidget(createGaugeRegistration());

      // Create different widget types
      const kpiWidget = service.createWidget('kpi', {
        id: 'kpi-1',
        title: 'KPI',
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 1
      });

      const gaugeWidget = service.createWidget('gauge', {
        id: 'gauge-1',
        title: 'Gauge',
        col: 3,
        row: 1,
        colSpan: 2,
        rowSpan: 2
      });

      expect(kpiWidget.type).toBe('kpi');
      expect(gaugeWidget.type).toBe('gauge');
      expect((kpiWidget as KpiWidgetConfig).valueAttribute).toBeDefined();
      expect((gaugeWidget as GaugeWidgetConfig).gaugeType).toBe('arc');
    });
  });
});
