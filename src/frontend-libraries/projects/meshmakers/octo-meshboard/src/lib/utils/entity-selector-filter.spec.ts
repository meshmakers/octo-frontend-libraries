import { of } from 'rxjs';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import type { EntitySelectorConfig, MeshBoardVariable } from '../models/meshboard.models';
import type { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import {
  filteredDialogTitle,
  filteredNoEntitiesMessage,
  hasPickerFilter,
  pickerFieldFilters,
  unresolvedFilterVariables,
  withPickerFilters
} from './entity-selector-filter';
import { FILTERED_SYSTEMS } from '../testing/entity-selector-filter.fixtures';

/** Picker filter helpers (AB#7724). Neutral fixtures only (Test/System). */
describe('entity-selector-filter (AB#7724)', () => {
  const variableService = new MeshBoardVariableService();
  const region: MeshBoardVariable = { name: 'region', type: 'string', source: 'static', value: 'North' } as MeshBoardVariable;
  const plain: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [] };

  function fakeGql() {
    const fetch = vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } }));
    return { gql: { fetch } as unknown as GetEntitiesByCkTypeDtoGQL, fetch };
  }

  describe('pickerFieldFilters', () => {
    it('is undefined without filter rows', () => {
      expect(hasPickerFilter(plain)).toBe(false);
      expect(pickerFieldFilters(plain, [region], variableService)).toBeUndefined();
      expect(pickerFieldFilters({ ...plain, filters: [] }, [region], variableService)).toBeUndefined();
    });

    it('keeps every row (AND) and substitutes board variables like widget filters', () => {
      expect(pickerFieldFilters(FILTERED_SYSTEMS, [region], variableService)).toEqual([
        { attributePath: 'systemType', operator: 'EQUALS', comparisonValue: 'Electrical' },
        { attributePath: 'region', operator: 'LIKE', comparisonValue: 'North' }
      ]);
    });

    it('is ignored for a follower, which has no picker', () => {
      const follower = { ...FILTERED_SYSTEMS, followsSelectorId: 'site', showInToolbar: false };
      expect(hasPickerFilter(follower)).toBe(false);
      expect(pickerFieldFilters(follower, [region], variableService)).toBeUndefined();
    });

    it('treats a variable without a value exactly like widget filters do', () => {
      const empty = { ...region, value: '' } as MeshBoardVariable;
      const unset = { ...region, value: undefined, defaultValue: undefined } as unknown as MeshBoardVariable;
      for (const variables of [[empty], [unset], []]) {
        expect(pickerFieldFilters(FILTERED_SYSTEMS, variables, variableService))
          .toEqual(variableService.convertToFieldFilterDto(FILTERED_SYSTEMS.filters, variables));
      }
      // An empty value is sent as empty string, an unset one keeps the placeholder.
      expect(pickerFieldFilters(FILTERED_SYSTEMS, [empty], variableService)?.[1].comparisonValue).toBe('');
      expect(pickerFieldFilters(FILTERED_SYSTEMS, [unset], variableService)?.[1].comparisonValue).toBe('$region');
    });
  });

  describe('withPickerFilters', () => {
    const base = [{ attributePath: 'systemType', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: 'Electrical' }];

    it('returns the original query service when there is no filter', () => {
      const { gql } = fakeGql();
      expect(withPickerFilters(gql, undefined)).toBe(gql);
      expect(withPickerFilters(gql, [])).toBe(gql);
    });

    it('puts the filter in front of the search rows of a fetch', () => {
      const { gql, fetch } = fakeGql();
      const search = { attributePath: 'rtDisplayName', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: 'mai' };

      withPickerFilters(gql, base).fetch({ variables: { ckTypeId: 'Test/System', attributeNames: [], first: 10, fieldFilters: [search] } });

      expect(fetch).toHaveBeenCalledWith({
        variables: { ckTypeId: 'Test/System', attributeNames: [], first: 10, fieldFilters: [...base, search] }
      });
    });

    it('adds the filter when the fetch has no field filters of its own', () => {
      const { gql, fetch } = fakeGql();

      withPickerFilters(gql, base).fetch({ variables: { ckTypeId: 'Test/System', attributeNames: [], fieldFilters: undefined } });

      expect(fetch.mock.calls[0][0].variables.fieldFilters).toEqual(base);
    });
  });

  describe('texts', () => {
    it('names unresolved variables', () => {
      expect(unresolvedFilterVariables([
        { attributePath: 'a', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: '$region' },
        { attributePath: 'b', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: '${zone}-x' },
        { attributePath: 'c', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: 'plain' }
      ])).toEqual(['region', 'zone']);
      expect(unresolvedFilterVariables(undefined)).toEqual([]);
    });

    it('explains the empty list of a filtered picker', () => {
      expect(filteredNoEntitiesMessage('System')).toBe('No System found. This board only lists System that match its filter.');
      expect(filteredNoEntitiesMessage('System', ['region']))
        .toBe('No System found. This board only lists System that match its filter. The filter uses $region, which has no value yet.');
      expect(filteredDialogTitle('System')).toBe('Select System (filtered)');
    });
  });
});
