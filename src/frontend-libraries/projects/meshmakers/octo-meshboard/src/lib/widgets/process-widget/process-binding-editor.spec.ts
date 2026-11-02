import type { ProcessDiagramConfig } from '@meshmakers/octo-process-diagrams';
import {
  ProcessBindingDraft,
  applyConnectionDirections,
  bindingDraftIssues,
  bindingFromDraft,
  bindingNameError,
  bindingResultFields,
  clearMappingsOfBinding,
  connectionDirectionIssues,
  draftsFromBindings,
  findDiagramConnections,
  isAggregateFixed,
  mappingsUsingBinding,
  renameBindingInMappings,
  uniqueBindingName,
  withAggregate,
  withBindingName
} from './process-binding-editor';
import { DiagramPropertyMapping } from './process-widget-config.model';

/** Pure rules of the process widget binding editor (AB#8025). */
describe('process-binding-editor (AB#8025)', () => {
  let uid = 0;
  const next = (): number => ++uid;

  function draft(name: string, extra: Partial<ProcessBindingDraft> = {}): ProcessBindingDraft {
    return { uid: next(), name, mode: 'persistentQuery', queryRtId: `q-${name}`, expanded: false, ...extra };
  }

  describe('cards from bindings and back', () => {
    it('one card per binding; a single card opens expanded', () => {
      const one = draftsFromBindings([{ name: 'default', mode: 'runtimeEntity', ckTypeId: 'Test/Tank', rtId: 't1' }], next);
      expect(one).toHaveLength(1);
      expect(one[0]).toEqual(expect.objectContaining({ name: 'default', mode: 'runtimeEntity', ckTypeId: 'Test/Tank', rtId: 't1', expanded: true }));

      const two = draftsFromBindings([{ name: 'a', mode: 'persistentQuery' }, { name: 'b', mode: 'persistentQuery' }], next);
      expect(two.map(d => d.expanded)).toEqual([false, false]);
    });

    it('a card writes only the keys of its source', () => {
      expect(bindingFromDraft(draft(' pv ', { ckTypeId: 'stale', ignoreTimeFilter: false, filters: [], queryFamily: 'streamData', entitySelectorId: 'pv' })))
        .toEqual({ name: 'pv', mode: 'persistentQuery', queryRtId: 'q- pv ', queryFamily: 'streamData', entitySelectorId: 'pv' });
      expect(bindingFromDraft({ uid: 1, name: 'bat', mode: 'runtimeEntity', ckTypeId: 'Test/Bat', queryRtId: 'stale', expanded: true }))
        .toEqual({ name: 'bat', mode: 'runtimeEntity', ckTypeId: 'Test/Bat' });
    });
  });

  describe('validation', () => {
    it('name is required and unique', () => {
      const a = draft('pv');
      const b = draft('pv');
      const c = draft('  ');
      expect(bindingNameError([a, b, c], a)).toBe('The name "pv" is used by another binding.');
      expect(bindingNameError([a, c], a)).toBeUndefined();
      expect(bindingNameError([a, c], c)).toBe('Enter a binding name.');
    });

    it('lists every Save blocker: name, missing selector, incomplete source', () => {
      const issues = bindingDraftIssues([
        draft('netz', { entitySelectorId: 'netz' }),
        draft('geraete', { entitySelectorId: 'geraete_alt' }),
        draft('', { queryRtId: undefined })
      ], ['netz']);

      expect(issues).toEqual([
        'Binding "geraete": selector "geraete_alt" does not exist on this board — choose another selector or "None".',
        'Binding 3: Enter a binding name.',
        'Binding 3: Persistent query binding needs a query rtId.'
      ]);
    });

    it('a runtime entity with a selector needs no rtId', () => {
      expect(bindingDraftIssues([{ uid: 1, name: 'bat', mode: 'runtimeEntity', ckTypeId: 'Test/Bat', entitySelectorId: 'bat', expanded: true }], ['bat'])).toEqual([]);
    });
  });

  it('unique names: base, then base 2, 3 …', () => {
    expect(uniqueBindingName('binding', [])).toBe('binding');
    expect(uniqueBindingName('binding', [draft('binding'), draft('binding 2')])).toBe('binding 3');
    expect(uniqueBindingName('pv copy', [draft('pv'), draft('pv copy')])).toBe('pv copy 2');
  });

  describe('mappings follow the bindings', () => {
    const mappings: DiagramPropertyMapping[] = [
      { propertyId: 'level', sourceType: 'attribute', sourcePath: 'level' },
      { propertyId: 'pv', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
      { propertyId: 'empty', sourceType: 'column', sourcePath: '', bindingName: 'pv' }
    ];

    it('lists the properties a binding feeds (only mappings with a field)', () => {
      expect(mappingsUsingBinding(mappings, 'default')).toEqual(['level']);
      expect(mappingsUsingBinding(mappings, 'pv')).toEqual(['pv']);
    });

    it('rename moves the mappings; back to default writes no bindingName', () => {
      const renamed = renameBindingInMappings(mappings, 'default', 'netz');
      expect(renamed[0]).toEqual({ propertyId: 'level', sourceType: 'attribute', sourcePath: 'level', bindingName: 'netz' });
      expect(renameBindingInMappings(renamed, 'netz', 'default')[0]).toEqual(mappings[0]);
    });

    it('delete clears the binding\'s mappings', () => {
      expect(clearMappingsOfBinding(mappings, 'pv').map(m => m.propertyId)).toEqual(['level']);
    });

    it('first is written as no aggregate', () => {
      expect(withAggregate({ ...mappings[1], aggregate: 'sum' }, 'first')).toEqual(mappings[1]);
      expect(withAggregate(mappings[1], 'avg').aggregate).toBe('avg');
      expect(withBindingName(mappings[1], 'default').bindingName).toBeUndefined();
    });

    it('aggregate is fixed for non-number properties and runtime-entity bindings', () => {
      expect(isAggregateFixed('number', 'persistentQuery')).toBe(false);
      expect(isAggregateFixed('string', 'persistentQuery')).toBe(true);
      expect(isAggregateFixed('number', 'runtimeEntity')).toBe(true);
    });
  });

  describe('result fields', () => {
    it('no card: absent stays absent, otherwise none', () => {
      expect(bindingResultFields([], undefined)).toEqual({});
      expect(bindingResultFields([], 'persistentQuery')).toEqual({ dataBindingMode: 'none' });
    });

    it('one card named default: the legacy fields', () => {
      const fields = bindingResultFields([draft('default', {
        queryName: 'Tanks', queryFamily: 'streamData', entitySelectorId: 'site', ignoreTimeFilter: true,
        filters: [{ attributePath: 'state', operator: 'EQUALS', comparisonValue: '1' }]
      })], 'persistentQuery');
      expect(fields).toEqual({
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'q-default',
        bindingQueryName: 'Tanks',
        bindingQueryFamily: 'streamData',
        bindingIgnoreTimeFilter: true,
        bindingEntitySelectorId: 'site',
        bindingFilters: [{ attributePath: 'state', operator: 'EQUALS', comparisonValue: '1' }]
      });
    });

    it('otherwise: bindings, no legacy fields', () => {
      expect(bindingResultFields([draft('pv')], undefined)).toEqual({ bindings: [{ name: 'pv', mode: 'persistentQuery', queryRtId: 'q-pv' }] });
    });
  });

  describe('connections', () => {
    function diagram(): ProcessDiagramConfig {
      return {
        id: 'd', name: 'd', version: '1', canvas: { width: 10, height: 10 }, elements: [], connections: [],
        primitives: [
          { id: 'l1', type: 'line', name: 'PV → Haus', position: { x: 0, y: 0 } },
          { id: 'l2', type: 'polyline', position: { x: 0, y: 0 } },
          { id: 'l3', type: 'path', position: { x: 0, y: 0 } },
          { id: 'r1', type: 'rectangle', position: { x: 0, y: 0 } }
        ],
        transformProperties: [
          { id: 'pv', name: 'PV', type: 'number', defaultValue: 0 },
          { id: 'grid', name: 'Netz', type: 'number', defaultValue: 0 }
        ],
        propertyBindings: [
          { propertyId: 'pv', targetType: 'primitive', targetId: 'l1', effectType: 'animation.enabled', animationId: 'a', expression: 'value > 0' },
          { propertyId: 'pv', targetType: 'primitive', targetId: 'l1', effectType: 'transform.offsetX', expression: 'value' },
          { propertyId: 'pv', targetType: 'primitive', targetId: 'l2', effectType: 'visible', expression: 'value > 0' },
          { propertyId: 'grid', targetType: 'primitive', targetId: 'l2', effectType: 'style.stroke.color', expression: "'#000'" },
          { propertyId: 'pv', targetType: 'primitive', targetId: 'r1', effectType: 'visible', expression: 'value > 0' }
        ]
      } as unknown as ProcessDiagramConfig;
    }

    it('finds lines, polylines and paths with a direction effect', () => {
      expect(findDiagramConnections(diagram())).toEqual([
        { id: 'l1', label: 'PV → Haus', diagramPropertyId: 'pv', effects: ['animation.enabled'] },
        { id: 'l2', label: 'l2', diagramPropertyId: undefined, effects: ['visible', 'style.stroke.color'] }
      ]);
      expect(findDiagramConnections(null)).toEqual([]);
    });

    it('re-points only the direction effects of the picked line, never mutating the diagram', () => {
      const original = diagram();
      const result = applyConnectionDirections(original, [{ connectionId: 'l1', propertyId: 'grid' }]);

      expect(result).not.toBe(original);
      expect(result.propertyBindings!.map(b => `${b.targetId}:${b.effectType}:${b.propertyId}`)).toEqual([
        'l1:animation.enabled:grid',
        'l1:transform.offsetX:pv',
        'l2:visible:pv',
        'l2:style.stroke.color:grid',
        'r1:visible:pv'
      ]);
      expect(original.propertyBindings![0].propertyId).toBe('pv');
    });

    it('returns the same diagram when nothing applies', () => {
      const original = diagram();
      expect(applyConnectionDirections(original, undefined)).toBe(original);
      expect(applyConnectionDirections(original, [{ connectionId: 'l1', propertyId: 'unknown' }])).toBe(original);
      expect(applyConnectionDirections(original, [{ connectionId: 'l1', propertyId: 'pv' }])).toBe(original);
      // r1 is a rectangle, not a connection: reported and not re-pointed
      expect(applyConnectionDirections(original, [{ connectionId: 'r1', propertyId: 'grid' }])).toBe(original);
    });

    it('reports unknown connections and properties', () => {
      expect(connectionDirectionIssues(diagram(), [
        { connectionId: 'r1', propertyId: 'pv' },
        { connectionId: 'l1', propertyId: 'x' },
        { connectionId: 'l2', propertyId: 'grid' }
      ])).toEqual([
        "Connection direction refers to unknown connection 'r1'",
        "Direction of connection 'l1' refers to unknown property 'x'"
      ]);
    });
  });
});
