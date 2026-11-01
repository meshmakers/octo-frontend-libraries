import { aggregateQueryColumn, isPartialAggregate, isReducingAggregate, processAggregateIssue } from './process-value-aggregation';
import { mappingAggregateIssue, validateProcessWidgetBindings } from './process-widget-bindings';
import { ProcessWidgetConfig } from './process-widget-config.model';
import { QueryResultData } from './services/process-data.service';

/** Pure aggregation helpers and the aggregate check of the config validator (AB#8024). */
describe('process value aggregation (AB#8024)', () => {
  function result(values: unknown[], totalCount = values.length, column = 'power'): QueryResultData {
    return { columns: [{ attributePath: column }], rows: values.map(v => ({ cells: new Map<string, unknown>([[column, v]]) })), totalCount };
  }

  describe('aggregateQueryColumn', () => {
    const values = [3, null, '4.5', undefined, 'abc', -2, 10];

    it('first / absent returns the first cell unchanged', () => {
      expect(aggregateQueryColumn(result(['x', 2]), 'power', undefined)).toBe('x');
      expect(aggregateQueryColumn(result(['x', 2]), 'power', 'first')).toBe('x');
    });

    it('sum / avg / min / max over numeric cells; numeric strings count, others are skipped', () => {
      expect(aggregateQueryColumn(result(values), 'power', 'sum')).toBe(15.5);
      expect(aggregateQueryColumn(result(values), 'power', 'avg')).toBeCloseTo(15.5 / 4, 12);
      expect(aggregateQueryColumn(result(values), 'power', 'min')).toBe(-2);
      expect(aggregateQueryColumn(result(values), 'power', 'max')).toBe(10);
    });

    it('zero rows or no numeric cell gives undefined, never 0', () => {
      for (const agg of ['sum', 'avg', 'min', 'max'] as const) {
        expect(aggregateQueryColumn(result([]), 'power', agg)).toBeUndefined();
        expect(aggregateQueryColumn(result([null, '', 'n/a', NaN, Infinity]), 'power', agg)).toBeUndefined();
      }
      expect(aggregateQueryColumn(result([]), 'power', 'first')).toBeUndefined();
    });

    it('reads the sanitized column name (dots → underscores)', () => {
      expect(aggregateQueryColumn(result([1, 2], 2, 'power_value'), 'power.value', 'sum')).toBe(3);
    });
  });

  it('isPartialAggregate compares totalCount with the loaded rows', () => {
    expect(isPartialAggregate(result([1, 2], 2))).toBe(false);
    expect(isPartialAggregate(result([1, 2], 5))).toBe(true);
  });

  it('isReducingAggregate is false for first and absent', () => {
    expect(isReducingAggregate(undefined)).toBe(false);
    expect(isReducingAggregate('first')).toBe(false);
    expect(isReducingAggregate('sum')).toBe(true);
  });

  describe('processAggregateIssue / mappingAggregateIssue', () => {
    it('accepts first and absent everywhere, and reducing aggregates on query + number', () => {
      expect(processAggregateIssue(undefined, 'string', 'runtimeEntity')).toBeUndefined();
      expect(processAggregateIssue('first', 'boolean', 'runtimeEntity')).toBeUndefined();
      expect(processAggregateIssue('sum', 'number', 'persistentQuery')).toBeUndefined();
      expect(processAggregateIssue('sum', undefined, undefined)).toBeUndefined();
    });

    it('rejects runtime-entity bindings, non-number properties and unknown aggregates', () => {
      expect(processAggregateIssue('sum', 'number', 'runtimeEntity')).toMatch(/needs a persistent query binding/);
      expect(processAggregateIssue('avg', 'string', 'persistentQuery')).toMatch(/needs a number property, not 'string'/);
      expect(processAggregateIssue('median' as never, 'number', 'persistentQuery')).toMatch(/Unknown aggregate 'median'/);
    });

    it('rejects a reducing aggregate on an attribute mapping', () => {
      expect(mappingAggregateIssue(
        { propertyId: 'p', sourceType: 'attribute', sourcePath: 'x', aggregate: 'max' },
        { name: 'default', mode: 'persistentQuery', queryRtId: 'q' }
      )).toMatch(/needs a column mapping/);
    });
  });

  describe('validateProcessWidgetBindings with aggregates', () => {
    const base: ProcessWidgetConfig = {
      id: 'w', type: 'process', title: 'W', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      dataSource: { type: 'static', data: null },
      bindings: [
        { name: 'geraete', mode: 'persistentQuery', queryRtId: 'q1', entitySelectorId: 'geraete' },
        { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' }
      ]
    };

    it('reports aggregates on a runtime-entity binding and on non-number properties', () => {
      const config: ProcessWidgetConfig = {
        ...base,
        propertyMappings: [
          { propertyId: 'power', sourceType: 'column', sourcePath: 'p', bindingName: 'geraete', aggregate: 'sum' },
          { propertyId: 'label', sourceType: 'column', sourcePath: 'n', bindingName: 'geraete', aggregate: 'max' },
          { propertyId: 'soc', sourceType: 'attribute', sourcePath: 's', bindingName: 'batterie', aggregate: 'avg' }
        ]
      };
      const types = new Map([['power', 'number'], ['label', 'string'], ['soc', 'number']]);

      const issues = validateProcessWidgetBindings(config, ['geraete', 'batterie'], types);

      expect(issues.map(i => [i.propertyId, i.message])).toEqual([
        ['label', "Mapping of 'label': Aggregate 'max' needs a number property, not 'string'; the first row is used"],
        ['soc', "Mapping of 'soc': Aggregate 'avg' needs a persistent query binding; a runtime entity binding loads one entity; the first row is used"]
      ]);
    });

    it('checks legacy configs against their implicit binding and has no issue without aggregates', () => {
      const legacy: ProcessWidgetConfig = {
        ...base,
        bindings: undefined,
        dataBindingMode: 'runtimeEntity',
        bindingCkTypeId: 'Test/Tank',
        bindingRtId: 'r1',
        propertyMappings: [{ propertyId: 'level', sourceType: 'attribute', sourcePath: 'level' }]
      };
      expect(validateProcessWidgetBindings(legacy)).toEqual([]);

      const withSum = { ...legacy, propertyMappings: [{ propertyId: 'level', sourceType: 'attribute' as const, sourcePath: 'level', aggregate: 'sum' as const }] };
      expect(validateProcessWidgetBindings(withSum)).toHaveLength(1);
    });
  });
});
