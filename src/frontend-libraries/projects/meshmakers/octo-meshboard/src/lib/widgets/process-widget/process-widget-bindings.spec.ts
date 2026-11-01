import { ProcessWidgetConfig } from './process-widget-config.model';
import {
  legacyProcessBinding,
  mappingBindingName,
  parsePersistedProcessBindings,
  resolveProcessBindings,
  toPersistedProcessBindings,
  validateProcessWidgetBindings
} from './process-widget-bindings';

describe('process-widget-bindings (AB#8023)', () => {
  function config(overrides: Partial<ProcessWidgetConfig> = {}): ProcessWidgetConfig {
    return {
      id: 'w1',
      type: 'process',
      title: 'Flow',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSource: { type: 'static', data: null },
      ...overrides
    };
  }

  describe('resolveProcessBindings', () => {
    it('reads the legacy fields as one binding named default', () => {
      const c = config({
        dataBindingMode: 'runtimeEntity',
        bindingCkTypeId: 'Test/Tank',
        bindingRtId: 'tank-1',
        bindingEntitySelectorId: 'site',
        bindingIgnoreTimeFilter: true
      });

      expect(resolveProcessBindings(c)).toEqual([legacyProcessBinding(c)]);
      expect(legacyProcessBinding(c)).toEqual(expect.objectContaining({
        name: 'default', mode: 'runtimeEntity', ckTypeId: 'Test/Tank', rtId: 'tank-1', entitySelectorId: 'site', ignoreTimeFilter: true
      }));
    });

    it('has no binding for mode none or no mode', () => {
      expect(resolveProcessBindings(config())).toEqual([]);
      expect(resolveProcessBindings(config({ dataBindingMode: 'none', bindingQueryRtId: 'q' }))).toEqual([]);
    });

    it('prefers named bindings over the legacy fields', () => {
      const c = config({
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'legacy',
        bindings: [{ name: 'pv', mode: 'persistentQuery', queryRtId: 'q-pv' }]
      });

      expect(resolveProcessBindings(c).map(b => b.name)).toEqual(['pv']);
    });

    it('treats an empty bindings list as absent', () => {
      expect(resolveProcessBindings(config({ bindings: [], dataBindingMode: 'persistentQuery', bindingQueryRtId: 'q' }))[0].name).toBe('default');
    });
  });

  it('maps a mapping without bindingName to default', () => {
    expect(mappingBindingName({ propertyId: 'a', sourceType: 'column', sourcePath: 'x' })).toBe('default');
    expect(mappingBindingName({ propertyId: 'a', sourceType: 'column', sourcePath: 'x', bindingName: 'pv' })).toBe('pv');
  });

  describe('validateProcessWidgetBindings', () => {
    it('accepts the EnergyIQ flow', () => {
      const c = config({
        bindings: [
          { name: 'netz', mode: 'persistentQuery', queryRtId: 'q1', entitySelectorId: 'netz' },
          { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' }
        ],
        propertyMappings: [
          { propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
          { propertyId: 'soc', sourceType: 'attribute', sourcePath: 'soc', bindingName: 'batterie' }
        ]
      });

      expect(validateProcessWidgetBindings(c, ['netz', 'batterie'])).toEqual([]);
    });

    it('reports a runtime entity binding with neither rtId nor selector', () => {
      const issues = validateProcessWidgetBindings(config({ bindings: [{ name: 'site', mode: 'runtimeEntity', ckTypeId: 'Test/Site' }] }));

      expect(issues).toEqual([{ bindingName: 'site', message: 'Runtime entity binding needs an rtId or an entity selector' }]);
    });

    it('reports missing CK type, missing query, duplicate and empty names, unknown selector and unknown mapping binding', () => {
      const issues = validateProcessWidgetBindings(config({
        bindings: [
          { name: 'a', mode: 'runtimeEntity', rtId: 'r1' },
          { name: 'b', mode: 'persistentQuery' },
          { name: 'b', mode: 'persistentQuery', queryRtId: 'q', entitySelectorId: 'gone' },
          { name: ' ', mode: 'persistentQuery', queryRtId: 'q' }
        ],
        propertyMappings: [{ propertyId: 'p', sourceType: 'column', sourcePath: 'x', bindingName: 'missing' }]
      }), ['site']);

      expect(issues.map(i => i.message)).toEqual([
        'Runtime entity binding needs a CK type',
        'Persistent query binding needs a query rtId',
        "Duplicate binding name 'b'",
        "Entity selector 'gone' does not exist on the board",
        'A binding has no name',
        "Mapping of 'p' refers to unknown binding 'missing'"
      ]);
    });

    it('reports mappings without bindingName when no binding is named default', () => {
      const issues = validateProcessWidgetBindings(config({
        bindings: [{ name: 'pv', mode: 'persistentQuery', queryRtId: 'q' }],
        propertyMappings: [{ propertyId: 'p', sourceType: 'column', sourcePath: 'x' }]
      }));

      expect(issues).toEqual([{ bindingName: 'default', propertyId: 'p', message: "Mapping of 'p' refers to unknown binding 'default'" }]);
    });

    it('stays silent for a widget without binding and for a valid legacy widget', () => {
      expect(validateProcessWidgetBindings(config({ propertyMappings: [{ propertyId: 'p', sourceType: 'column', sourcePath: 'x' }] }))).toEqual([]);
      expect(validateProcessWidgetBindings(config({
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'q',
        propertyMappings: [{ propertyId: 'p', sourceType: 'column', sourcePath: 'x' }]
      }))).toEqual([]);
    });
  });

  describe('persistence helpers', () => {
    it('writes only set keys', () => {
      expect(toPersistedProcessBindings([{
        name: 'pv', mode: 'persistentQuery', queryRtId: 'q', ignoreTimeFilter: false, filters: [], rtId: '', entitySelectorId: 'pv'
      }])).toEqual([{ name: 'pv', mode: 'persistentQuery', queryRtId: 'q', entitySelectorId: 'pv' }]);
    });

    it('parses valid entries and drops the rest', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(parsePersistedProcessBindings(undefined)).toBeUndefined();
      expect(parsePersistedProcessBindings({})).toBeUndefined();
      expect(parsePersistedProcessBindings([null, 1, { name: 'x', mode: 'none' }])).toBeUndefined();
      expect(parsePersistedProcessBindings([{ name: 'bat', mode: 'runtimeEntity', ckTypeId: 'Test/Bat', ignoreTimeFilter: true }]))
        .toEqual([{ name: 'bat', mode: 'runtimeEntity', ckTypeId: 'Test/Bat', ignoreTimeFilter: true }]);
    });
  });
});
