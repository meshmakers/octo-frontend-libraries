import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WidgetGroupComponent } from './widget-group.component';
import { MeshBoardDataService, RepeaterDataItem } from '../../services/meshboard-data.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { WidgetGroupConfig, KpiWidgetConfig, GaugeWidgetConfig, EntityCardWidgetConfig, RepeaterQueryDataSource } from '../../models/meshboard.models';
import { Component } from '@angular/core';

// Mock child widget components to avoid importing their dependencies
@Component({
  selector: 'mm-kpi-widget',
  template: '<div class="mock-kpi">{{ config?.title }}</div>',
  standalone: true
})
class MockKpiWidgetComponent {
  config: unknown;
}

@Component({
  selector: 'mm-gauge-widget',
  template: '<div class="mock-gauge">{{ config?.title }}</div>',
  standalone: true
})
class MockGaugeWidgetComponent {
  config: unknown;
}

@Component({
  selector: 'mm-entity-card-widget',
  template: '<div class="mock-entity-card">{{ config?.title }}</div>',
  standalone: true
})
class MockEntityCardWidgetComponent {
  config: unknown;
}

describe('WidgetGroupComponent', () => {
  let component: WidgetGroupComponent;
  let fixture: ComponentFixture<WidgetGroupComponent>;
  let dataServiceSpy: jasmine.SpyObj<MeshBoardDataService>;
  let variableServiceSpy: jasmine.SpyObj<MeshBoardVariableService>;
  let stateServiceSpy: jasmine.SpyObj<MeshBoardStateService>;

  const createMockConfig = (overrides: Partial<WidgetGroupConfig> = {}): WidgetGroupConfig => ({
    id: 'widget-group-1',
    type: 'widgetGroup',
    title: 'Test Widget Group',
    col: 1,
    row: 1,
    colSpan: 4,
    rowSpan: 2,
    dataSource: {
      type: 'repeaterQuery',
      queryRtId: 'query-123',
      maxItems: 20
    },
    childTemplate: {
      widgetType: 'kpi',
      titleTemplate: '$rtWellKnownName Status',
      attributeMappings: {
        valueAttribute: 'value'
      }
    },
    layout: 'grid',
    gridColumns: 4,
    gap: 8,
    ...overrides
  });

  const createMockRepeaterData = (count: number): RepeaterDataItem[] => {
    const items: RepeaterDataItem[] = [];
    for (let i = 0; i < count; i++) {
      const attrs = new Map<string, unknown>();
      attrs.set('value', (i + 1) * 100);
      attrs.set('name', `Item ${i + 1}`);
      items.push({
        rtId: `entity-${i + 1}`,
        ckTypeId: 'TestType',
        rtWellKnownName: `Machine ${i + 1}`,
        attributes: attrs
      });
    }
    return items;
  };

  beforeEach(async () => {
    dataServiceSpy = jasmine.createSpyObj('MeshBoardDataService', ['fetchRepeaterData']);
    variableServiceSpy = jasmine.createSpyObj('MeshBoardVariableService', ['resolveVariables']);
    stateServiceSpy = jasmine.createSpyObj('MeshBoardStateService', ['getVariables']);

    stateServiceSpy.getVariables.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [WidgetGroupComponent],
      providers: [
        { provide: MeshBoardDataService, useValue: dataServiceSpy },
        { provide: MeshBoardVariableService, useValue: variableServiceSpy },
        { provide: MeshBoardStateService, useValue: stateServiceSpy }
      ]
    })
      .overrideComponent(WidgetGroupComponent, {
        remove: {
          imports: []
        },
        add: {
          imports: [MockKpiWidgetComponent, MockGaugeWidgetComponent, MockEntityCardWidgetComponent]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(WidgetGroupComponent);
    component = fixture.componentInstance;
  });

  // ========================================================================
  // Basic Component Tests
  // ========================================================================

  describe('initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have initial loading state as false', () => {
      expect(component.isLoading()).toBeFalse();
    });

    it('should have initial data as null', () => {
      expect(component.data()).toBeNull();
    });

    it('should have initial error as null', () => {
      expect(component.error()).toBeNull();
    });
  });

  // ========================================================================
  // Data Loading Tests
  // ========================================================================

  describe('data loading', () => {
    it('should load data on init', fakeAsync(() => {
      const mockData = createMockRepeaterData(3);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      expect(dataServiceSpy.fetchRepeaterData).toHaveBeenCalled();
      expect(component.data()).toEqual(mockData);
      expect(component.isLoading()).toBeFalse();
    }));

    it('should set error when no data source configured', fakeAsync(() => {
      component.config = createMockConfig({
        dataSource: undefined as unknown as RepeaterQueryDataSource
      });
      fixture.detectChanges();
      tick();

      expect(component.error()).toBe('No data source configured');
    }));

    it('should set error when invalid data source type', fakeAsync(() => {
      component.config = createMockConfig({
        dataSource: { type: 'runtimeEntity' } as unknown as RepeaterQueryDataSource
      });
      fixture.detectChanges();
      tick();

      expect(component.error()).toBe('Invalid data source type for Widget Group');
    }));

    it('should set error when no query or CK type configured', fakeAsync(() => {
      component.config = createMockConfig({
        dataSource: {
          type: 'repeaterQuery'
          // Neither queryRtId nor ckTypeId
        }
      });
      fixture.detectChanges();
      tick();

      expect(component.error()).toBe('No query or CK type configured');
    }));

    it('should handle fetch errors gracefully', fakeAsync(() => {
      dataServiceSpy.fetchRepeaterData.and.rejectWith(new Error('Network error'));
      spyOn(console, 'error');

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      expect(component.error()).toBe('Failed to load data');
      expect(component.isLoading()).toBeFalse();
    }));

    it('should reload data on config change', fakeAsync(() => {
      const mockData1 = createMockRepeaterData(2);
      const mockData2 = createMockRepeaterData(5);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData1);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      expect(component.data()?.length).toBe(2);

      // Change config
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData2);
      component.config = createMockConfig({ id: 'new-id' });
      component.ngOnChanges({
        config: {
          currentValue: component.config,
          previousValue: createMockConfig(),
          firstChange: false,
          isFirstChange: () => false
        }
      });
      tick();

      expect(dataServiceSpy.fetchRepeaterData).toHaveBeenCalledTimes(2);
      expect(component.data()?.length).toBe(5);
    }));

    it('should refresh data on refresh() call', fakeAsync(() => {
      const mockData = createMockRepeaterData(3);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      component.refresh();
      tick();

      expect(dataServiceSpy.fetchRepeaterData).toHaveBeenCalledTimes(2);
    }));
  });

  // ========================================================================
  // Child Config Generation Tests
  // ========================================================================

  describe('child config generation', () => {
    it('should generate child configs from data', fakeAsync(() => {
      const mockData = createMockRepeaterData(3);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs.length).toBe(3);
    }));

    it('should generate unique IDs for child widgets', fakeAsync(() => {
      const mockData = createMockRepeaterData(3);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      const ids = childConfigs.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
      expect(ids[0]).toBe('widget-group-1-child-0');
      expect(ids[1]).toBe('widget-group-1-child-1');
      expect(ids[2]).toBe('widget-group-1-child-2');
    }));

    it('should resolve title template with rtWellKnownName', fakeAsync(() => {
      const mockData = createMockRepeaterData(2);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'kpi',
          titleTemplate: '$rtWellKnownName Status',
          attributeMappings: { valueAttribute: 'value' }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].title).toBe('Machine 1 Status');
      expect(childConfigs[1].title).toBe('Machine 2 Status');
    }));

    it('should resolve title template with rtId', fakeAsync(() => {
      const mockData = createMockRepeaterData(1);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'kpi',
          titleTemplate: 'Entity: $rtId',
          attributeMappings: { valueAttribute: 'value' }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].title).toBe('Entity: entity-1');
    }));

    it('should resolve title template with attribute references', fakeAsync(() => {
      const attrs = new Map<string, unknown>();
      attrs.set('customName', 'Alpha');
      const mockData: RepeaterDataItem[] = [{
        rtId: 'entity-1',
        ckTypeId: 'TestType',
        attributes: attrs
      }];
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'kpi',
          titleTemplate: 'Device: $customName',
          attributeMappings: { valueAttribute: 'value' }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].title).toBe('Device: Alpha');
    }));

    it('should create KPI child config correctly', fakeAsync(() => {
      const mockData = createMockRepeaterData(1);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'kpi',
          titleTemplate: '$rtWellKnownName',
          attributeMappings: { valueAttribute: 'status' },
          staticConfig: { prefix: '$', suffix: '%' }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].type).toBe('kpi');
      expect((childConfigs[0] as KpiWidgetConfig).valueAttribute).toBe('status');
      expect((childConfigs[0] as KpiWidgetConfig).prefix).toBe('$');
      expect((childConfigs[0] as KpiWidgetConfig).suffix).toBe('%');
    }));

    it('should create Gauge child config correctly', fakeAsync(() => {
      const mockData = createMockRepeaterData(1);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'gauge',
          attributeMappings: { valueAttribute: 'temperature' },
          staticConfig: { gaugeType: 'arc', min: 0, max: 100 }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].type).toBe('gauge');
      expect((childConfigs[0] as GaugeWidgetConfig).gaugeType).toBe('arc');
      expect((childConfigs[0] as GaugeWidgetConfig).min).toBe(0);
      expect((childConfigs[0] as GaugeWidgetConfig).max).toBe(100);
    }));

    it('should create EntityCard child config correctly', fakeAsync(() => {
      const mockData = createMockRepeaterData(1);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'entityCard',
          attributeMappings: {},
          staticConfig: { showHeader: true, showAttributes: true }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].type).toBe('entityCard');
      expect((childConfigs[0] as EntityCardWidgetConfig).showHeader).toBe(true);
      expect((childConfigs[0] as EntityCardWidgetConfig).showAttributes).toBe(true);
    }));

    it('should return empty array when no data', fakeAsync(() => {
      dataServiceSpy.fetchRepeaterData.and.resolveTo([]);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      expect(component.childConfigs()).toEqual([]);
    }));

    it('should return empty array when data is null', () => {
      component.config = createMockConfig();
      // Don't trigger ngOnInit, so data stays null
      expect(component.childConfigs()).toEqual([]);
    });

    it('should use fallback title when template is empty', fakeAsync(() => {
      const mockData = createMockRepeaterData(2);
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig({
        childTemplate: {
          widgetType: 'kpi',
          titleTemplate: '',
          attributeMappings: { valueAttribute: 'value' }
        }
      });
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      expect(childConfigs[0].title).toBe('Item 1');
      expect(childConfigs[1].title).toBe('Item 2');
    }));
  });

  // ========================================================================
  // Layout Tests
  // ========================================================================

  describe('layout configuration', () => {
    beforeEach(() => {
      dataServiceSpy.fetchRepeaterData.and.resolveTo(createMockRepeaterData(4));
    });

    it('should compute grid template columns for grid layout', fakeAsync(() => {
      component.config = createMockConfig({
        layout: 'grid',
        gridColumns: 4
      });
      fixture.detectChanges();
      tick();

      expect(component.gridTemplateColumns()).toBe('repeat(4, 1fr)');
    }));

    it('should compute grid template columns for horizontal layout', fakeAsync(() => {
      component.config = createMockConfig({
        layout: 'horizontal',
        minChildWidth: 200
      });
      fixture.detectChanges();
      tick();

      expect(component.gridTemplateColumns()).toBe('repeat(auto-fit, minmax(200px, 1fr))');
    }));

    it('should compute grid template columns for vertical layout', fakeAsync(() => {
      component.config = createMockConfig({
        layout: 'vertical'
      });
      fixture.detectChanges();
      tick();

      expect(component.gridTemplateColumns()).toBe('1fr');
    }));

    it('should compute layout class', fakeAsync(() => {
      component.config = createMockConfig({ layout: 'horizontal' });
      fixture.detectChanges();
      tick();

      expect(component.layoutClass()).toBe('layout-horizontal');
    }));

    it('should compute gap style', fakeAsync(() => {
      component.config = createMockConfig({ gap: 16 });
      fixture.detectChanges();
      tick();

      expect(component.gapStyle()).toBe('16px');
    }));

    it('should use default values when not specified', fakeAsync(() => {
      component.config = createMockConfig({
        layout: undefined as unknown as WidgetGroupConfig['layout'],
        gridColumns: undefined,
        minChildWidth: undefined,
        gap: undefined
      });
      fixture.detectChanges();
      tick();

      expect(component.gridTemplateColumns()).toBe('repeat(4, 1fr)'); // default grid with 4 columns
      expect(component.layoutClass()).toBe('layout-grid');
      expect(component.gapStyle()).toBe('8px');
    }));
  });

  // ========================================================================
  // Data Conversion Tests
  // ========================================================================

  describe('data conversion', () => {
    it('should convert RepeaterDataItem to RuntimeEntityData in child config', fakeAsync(() => {
      const attrs = new Map<string, unknown>();
      attrs.set('attr1', 'value1');
      attrs.set('attr2', 42);

      const mockData: RepeaterDataItem[] = [{
        rtId: 'entity-1',
        ckTypeId: 'TestType',
        rtWellKnownName: 'Test Entity',
        attributes: attrs
      }];
      dataServiceSpy.fetchRepeaterData.and.resolveTo(mockData);

      component.config = createMockConfig();
      fixture.detectChanges();
      tick();

      const childConfigs = component.childConfigs();
      const dataSource = childConfigs[0].dataSource;

      expect(dataSource.type).toBe('static');
      if (dataSource.type === 'static') {
        const data = dataSource.data as Record<string, unknown>;
        expect(data['rtId']).toBe('entity-1');
        expect(data['ckTypeId']).toBe('TestType');
        expect(data['rtWellKnownName']).toBe('Test Entity');
        expect((data['attributes'] as unknown[]).length).toBe(2);
        expect(data['associations']).toEqual([]);
      }
    }));
  });
});
