import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, PersistedWidgetData } from '../services/widget-registry.service';
import { registerProcessWidget } from './process-widget-registration';
import { ProcessWidgetConfig } from '../models/meshboard.models';
import { ProcessConfigResult } from '../widgets/process-widget/process-config-dialog.component';

/**
 * Persistence of the Process Widget's data bindings (AB#8023): legacy boards
 * load and save byte-identically; named bindings round-trip; a single binding
 * named `default` is saved in the legacy shape.
 */
describe('Process widget registration — bindings (AB#8023)', () => {
  let registry: WidgetRegistryService;

  function persisted(config: Record<string, unknown>): PersistedWidgetData {
    return {
      rtId: 'w-1',
      ckTypeId: 'System.UI/DashboardWidget',
      name: 'Flow',
      type: 'process',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSourceType: 'static',
      dataSourceCkTypeId: null,
      dataSourceRtId: null,
      config: JSON.stringify(config)
    };
  }

  function load(config: Record<string, unknown>): ProcessWidgetConfig {
    return registry.deserializeWidget(persisted(config)) as ProcessWidgetConfig;
  }

  function saveJson(widget: ProcessWidgetConfig): string {
    return JSON.stringify(registry.serializeWidget(widget).config);
  }

  /** A legacy board as stored before AB#8023 (what the old toPersistedConfig wrote). */
  const legacyStored = {
    processDiagramRtId: '65a1b2c3d4e5f60123456789',
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1,
    dataBindingMode: 'persistentQuery',
    bindingQueryRtId: '65a1b2c3d4e5f6012345678a',
    bindingQueryName: 'Tank levels',
    bindingQueryFamily: 'streamData',
    bindingEntitySelectorId: 'site',
    bindingFilters: [{ attributePath: 'state', operator: 'EQUALS', comparisonValue: '1' }],
    propertyMappings: [{ propertyId: 'level', sourceType: 'column', sourcePath: 'level_avg', expression: 'value / 100' }]
  };

  const energyFlowStored = {
    processDiagramRtId: '65a1b2c3d4e5f60123456789',
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1,
    propertyMappings: [
      { propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
      { propertyId: 'pv', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
      { propertyId: 'soc', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie' }
    ],
    bindings: [
      { name: 'netz', mode: 'persistentQuery', queryRtId: '65a1b2c3d4e5f6012345678b', queryFamily: 'streamData', entitySelectorId: 'netz' },
      { name: 'pv', mode: 'persistentQuery', queryRtId: '65a1b2c3d4e5f6012345678c', queryFamily: 'streamData', ignoreTimeFilter: true, entitySelectorId: 'pv' },
      { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' },
      {
        name: 'wallboxen', mode: 'persistentQuery', queryRtId: '65a1b2c3d4e5f6012345678d', queryFamily: 'runtime', entitySelectorId: 'wallboxen',
        filters: [{ attributePath: 'enabled', operator: 'EQUALS', comparisonValue: 'true' }]
      },
      { name: 'geraete', mode: 'persistentQuery', queryRtId: '65a1b2c3d4e5f6012345678e', queryFamily: 'runtime', entitySelectorId: 'geraete' }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: WindowService, useValue: { open: vi.fn() } }]
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerProcessWidget(registry);
  });

  describe('legacy single-binding board', () => {
    it('loads without bindings and saves byte-identically', () => {
      const widget = load(legacyStored);

      expect(widget.bindings).toBeUndefined();
      expect(widget.dataBindingMode).toBe('persistentQuery');
      expect(widget.bindingEntitySelectorId).toBe('site');
      expect(saveJson(widget)).toBe(JSON.stringify(legacyStored));
    });

    it('re-saves a minimal board without a binding unchanged', () => {
      const minimal = { processDiagramRtId: 'x', fitToBounds: true, allowZoom: false, allowPan: false, showToolbar: false, initialZoom: 1 };

      expect(saveJson(load(minimal))).toBe(JSON.stringify(minimal));
    });

    it('keeps dialog edits working as before', () => {
      const widget = load(legacyStored);
      const applied = registry.applyConfigResult(widget, {
        diagramSource: 'stored',
        processDiagramRtId: widget.processDiagramRtId,
        fitToBounds: true,
        allowZoom: false,
        allowPan: false,
        showToolbar: false,
        initialZoom: 1,
        dataBindingMode: 'runtimeEntity',
        bindingCkTypeId: 'Test/Tank',
        bindingRtId: 'tank-1',
        propertyMappings: [{ propertyId: 'level', sourceType: 'attribute', sourcePath: 'level' }]
      } as ProcessConfigResult) as ProcessWidgetConfig;

      expect(applied.dataBindingMode).toBe('runtimeEntity');
      expect(applied.bindingRtId).toBe('tank-1');
      expect(applied.bindings).toBeUndefined();
    });
  });

  describe('named bindings', () => {
    it('round-trip through load and save unchanged', () => {
      const widget = load(energyFlowStored);

      expect(widget.bindings?.map(b => b.name)).toEqual(['netz', 'pv', 'batterie', 'wallboxen', 'geraete']);
      expect(widget.bindings?.[2]).toEqual({ name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' });
      expect(widget.propertyMappings?.[0].bindingName).toBe('netz');

      const saved = registry.serializeWidget(widget).config as Record<string, unknown>;
      expect(saved['bindings']).toEqual(energyFlowStored.bindings);
      expect(saved['propertyMappings']).toEqual(energyFlowStored.propertyMappings);
      expect(saved['dataBindingMode']).toBeUndefined();

      // Second round trip is stable.
      expect(saveJson(load(saved))).toBe(JSON.stringify(saved));
    });

    it('round-trips mapping aggregates unchanged (AB#8024)', () => {
      const stored = {
        ...energyFlowStored,
        propertyMappings: [
          ...energyFlowStored.propertyMappings,
          { propertyId: 'devicesPower', sourceType: 'column', sourcePath: 'activePower', bindingName: 'geraete', aggregate: 'sum', expression: 'value / 1000' },
          { propertyId: 'wallboxMax', sourceType: 'column', sourcePath: 'power', bindingName: 'wallboxen', aggregate: 'max' }
        ]
      };

      const widget = load(stored);
      expect(widget.propertyMappings?.[3].aggregate).toBe('sum');

      const saved = registry.serializeWidget(widget).config as Record<string, unknown>;
      expect(JSON.stringify(saved['propertyMappings'])).toBe(JSON.stringify(stored.propertyMappings));
      expect(saveJson(load(saved))).toBe(JSON.stringify(saved));
    });

    it('drops entries with an unknown mode and leaves no empty bindings key', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const widget = load({ ...legacyStored, bindings: [{ name: 'x', mode: 'magic' }, 'nonsense'] });

      expect(widget.bindings).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      expect(saveJson(widget)).toBe(JSON.stringify(legacyStored));
    });

    it('saves exactly one binding named default in the legacy shape', () => {
      const widget: ProcessWidgetConfig = {
        ...load({ processDiagramRtId: 'x', fitToBounds: true, allowZoom: false, allowPan: false, showToolbar: false, initialZoom: 1 }),
        bindings: [{ name: 'default', mode: 'persistentQuery', queryRtId: 'q1', queryFamily: 'runtime', entitySelectorId: 'site' }],
        propertyMappings: [{ propertyId: 'level', sourceType: 'column', sourcePath: 'level' }]
      };

      const saved = registry.serializeWidget(widget).config as Record<string, unknown>;

      expect(saved['bindings']).toBeUndefined();
      expect(saved['dataBindingMode']).toBe('persistentQuery');
      expect(saved['bindingQueryRtId']).toBe('q1');
      expect(saved['bindingEntitySelectorId']).toBe('site');
    });

    it('keeps a single binding with another name as bindings (mappings still refer to it)', () => {
      const widget = load({
        ...energyFlowStored,
        bindings: [energyFlowStored.bindings[0]],
        propertyMappings: [energyFlowStored.propertyMappings[0]]
      });

      const saved = registry.serializeWidget(widget).config as Record<string, unknown>;

      expect(saved['bindings']).toEqual([energyFlowStored.bindings[0]]);
    });

    it('the legacy dialog keeps bindings and mappings, applying only diagram and display options', () => {
      const widget = load(energyFlowStored);

      const applied = registry.applyConfigResult(widget, {
        diagramSource: 'stored',
        processDiagramRtId: 'other-diagram',
        fitToBounds: false,
        allowZoom: true,
        allowPan: true,
        showToolbar: true,
        initialZoom: 2,
        dataBindingMode: 'none'
      } as ProcessConfigResult) as ProcessWidgetConfig;

      expect(applied.processDiagramRtId).toBe('other-diagram');
      expect(applied.allowZoom).toBe(true);
      expect(applied.bindings).toEqual(widget.bindings);
      expect(applied.propertyMappings).toEqual(widget.propertyMappings);
      expect(applied.dataBindingMode).toBeUndefined();
    });
  });
});
