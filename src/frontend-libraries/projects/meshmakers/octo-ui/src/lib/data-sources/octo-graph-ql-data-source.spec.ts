import { OctoGraphQlDataSource } from './octo-graph-ql-data-source';
import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  SearchFilterDto,
  SearchFilterTypesDto,
  SortDto,
  SortOrdersDto
} from '@meshmakers/octo-services';
import { ListViewComponent, FetchDataOptions, FetchResultTyped } from '@meshmakers/shared-ui';
import { FilterOperator } from '@progress/kendo-data-query';
import { State } from '@progress/kendo-data-query/dist/npm/state';
import { Observable, of } from 'rxjs';

interface TestDto {
  id: string;
  name: string;
}

/**
 * Concrete implementation for testing the abstract OctoGraphQlDataSource
 */
class TestableDataSource extends OctoGraphQlDataSource<TestDto> {
  constructor() {
    super(null as unknown as ListViewComponent);
  }

  // Expose protected methods for testing
  public testGetFieldFilterDefinitions(state: State): FieldFilterDto[] | null {
    return this.getFieldFilterDefinitions(state);
  }

  public testGetSearchFilterDefinitions(textSearchValue: string | null): SearchFilterDto | null {
    return this.getSearchFilterDefinitions(textSearchValue);
  }

  public testGetSortDefinitions(state: State): SortDto[] | null {
    return this.getSortDefinitions(state);
  }

  public setSearchFilterAttributePaths(paths: string[]): void {
    this.searchFilterAttributePaths = paths;
  }

  public getSearchFilterAttributePathsValue(): string[] {
    return this.searchFilterAttributePaths;
  }

  // Required abstract method implementation
  public override fetchData(_queryOptions: FetchDataOptions): Observable<FetchResultTyped<TestDto> | null> {
    return of(null);
  }
}

describe('OctoGraphQlDataSource', () => {
  let dataSource: TestableDataSource;

  beforeEach(() => {
    dataSource = new TestableDataSource();
  });

  it('should create an instance', () => {
    expect(dataSource).toBeTruthy();
  });

  // =========================================================================
  // searchFilterAttributePaths Tests
  // =========================================================================

  describe('searchFilterAttributePaths', () => {
    it('should initialize with empty array', () => {
      expect(dataSource.getSearchFilterAttributePathsValue()).toEqual([]);
    });

    it('should set and get search filter attribute paths', () => {
      const paths = ['name', 'description', 'code'];
      dataSource.setSearchFilterAttributePaths(paths);
      expect(dataSource.getSearchFilterAttributePathsValue()).toEqual(paths);
    });
  });

  // =========================================================================
  // getFieldFilterDefinitions Tests
  // =========================================================================

  describe('getFieldFilterDefinitions', () => {
    it('should return null when state has no filter', () => {
      const state: State = {};
      const result = dataSource.testGetFieldFilterDefinitions(state);
      expect(result).toBeNull();
    });

    it('should return null when filter has no filters array', () => {
      const state: State = { filter: { logic: 'and', filters: [] } };
      state.filter!.filters = undefined as never;
      const result = dataSource.testGetFieldFilterDefinitions(state);
      expect(result).toBeNull();
    });

    it('should return empty array when filters array is empty', () => {
      const state: State = { filter: { logic: 'and', filters: [] } };
      const result = dataSource.testGetFieldFilterDefinitions(state);
      expect(result).toEqual([]);
    });

    it('should throw error for composite filter descriptor', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [
            {
              logic: 'or',
              filters: [
                { field: 'name', operator: 'eq', value: 'test' }
              ]
            }
          ]
        }
      };
      expect(() => dataSource.testGetFieldFilterDefinitions(state))
        .toThrowError('Composite filter descriptor not supported');
    });

    // Filter Operator Mapping Tests

    it('should map "eq" operator to EqualsDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'name', operator: 'eq', value: 'test' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result).toEqual([{
        attributePath: 'name',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: 'test'
      }]);
    });

    it('should map "neq" operator to NotEqualsDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'status', operator: 'neq', value: 'inactive' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.NotEqualsDto);
      expect(result?.[0].comparisonValue).toBe('inactive');
    });

    it('should map "lt" operator to LessThanDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'age', operator: 'lt', value: 18 }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.LessThanDto);
      expect(result?.[0].comparisonValue).toBe(18);
    });

    it('should map "lte" operator to LessEqualThanDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'price', operator: 'lte', value: 100 }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.LessEqualThanDto);
      expect(result?.[0].comparisonValue).toBe(100);
    });

    it('should map "gt" operator to GreaterThanDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'count', operator: 'gt', value: 0 }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.GreaterThanDto);
      expect(result?.[0].comparisonValue).toBe(0);
    });

    it('should map "gte" operator to GreaterEqualThanDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'quantity', operator: 'gte', value: 1 }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.GreaterEqualThanDto);
      expect(result?.[0].comparisonValue).toBe(1);
    });

    it('should map "contains" operator to LikeDto', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'description', operator: 'contains', value: 'search' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.LikeDto);
      expect(result?.[0].comparisonValue).toBe('search');
    });

    it('should map "doesnotcontain" operator to MatchRegExDto with negation pattern', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'name', operator: 'doesnotcontain', value: 'test' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.MatchRegExDto);
      expect(result?.[0].comparisonValue).toBe('^(?!.*test).*$');
    });

    it('should map "startswith" operator to MatchRegExDto with prefix pattern', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'code', operator: 'startswith', value: 'PRE' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.MatchRegExDto);
      expect(result?.[0].comparisonValue).toBe('PRE.*');
    });

    it('should map "endswith" operator to MatchRegExDto with suffix pattern', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'filename', operator: 'endswith', value: '.pdf' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.MatchRegExDto);
      expect(result?.[0].comparisonValue).toBe('.*.pdf');
    });

    it('should map "isnull" operator to EqualsDto with null value', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'deletedAt', operator: 'isnull', value: null }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.EqualsDto);
      expect(result?.[0].comparisonValue).toBeNull();
    });

    it('should map "isnotnull" operator to NotEqualsDto with null value', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'assignedTo', operator: 'isnotnull', value: null }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.NotEqualsDto);
      expect(result?.[0].comparisonValue).toBeNull();
    });

    it('should map "isempty" operator to EqualsDto with empty string', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'notes', operator: 'isempty', value: '' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.EqualsDto);
      expect(result?.[0].comparisonValue).toBe('');
    });

    it('should map "isnotempty" operator to NotEqualsDto with empty string', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'title', operator: 'isnotempty', value: '' }]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.NotEqualsDto);
      expect(result?.[0].comparisonValue).toBe('');
    });

    it('should throw error for unsupported operator', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'name', operator: 'unsupported' as unknown as FilterOperator, value: 'test' }]
        }
      };

      expect(() => dataSource.testGetFieldFilterDefinitions(state))
        .toThrowError('The filter operator is not supported');
    });

    it('should handle multiple filters', () => {
      const state: State = {
        filter: {
          logic: 'and',
          filters: [
            { field: 'name', operator: 'contains', value: 'test' },
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'count', operator: 'gt', value: 5 }
          ]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.length).toBe(3);
      expect(result?.[0].attributePath).toBe('name');
      expect(result?.[0].operator).toBe(FieldFilterOperatorsDto.LikeDto);
      expect(result?.[1].attributePath).toBe('status');
      expect(result?.[1].operator).toBe(FieldFilterOperatorsDto.EqualsDto);
      expect(result?.[2].attributePath).toBe('count');
      expect(result?.[2].operator).toBe(FieldFilterOperatorsDto.GreaterThanDto);
    });

    it('should preserve different value types', () => {
      const dateValue = new Date('2024-01-15');
      const state: State = {
        filter: {
          logic: 'and',
          filters: [
            { field: 'stringField', operator: 'eq', value: 'text' },
            { field: 'numberField', operator: 'eq', value: 42 },
            { field: 'boolField', operator: 'eq', value: true },
            { field: 'dateField', operator: 'eq', value: dateValue }
          ]
        }
      };
      const result = dataSource.testGetFieldFilterDefinitions(state);

      expect(result?.[0].comparisonValue).toBe('text');
      expect(result?.[1].comparisonValue).toBe(42);
      expect(result?.[2].comparisonValue).toBe(true);
      expect(result?.[3].comparisonValue).toEqual(dateValue);
    });
  });

  // =========================================================================
  // getSearchFilterDefinitions Tests
  // =========================================================================

  describe('getSearchFilterDefinitions', () => {
    beforeEach(() => {
      dataSource.setSearchFilterAttributePaths(['name', 'description', 'code']);
    });

    it('should return null for null search value', () => {
      const result = dataSource.testGetSearchFilterDefinitions(null);
      expect(result).toBeNull();
    });

    it('should return null for empty string search value', () => {
      const result = dataSource.testGetSearchFilterDefinitions('');
      expect(result).toBeNull();
    });

    it('should create SearchFilterDto with correct properties', () => {
      const result = dataSource.testGetSearchFilterDefinitions('search term');

      expect(result).toEqual({
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: ['name', 'description', 'code'],
        searchTerm: 'search term'
      });
    });

    it('should use configured attribute paths', () => {
      dataSource.setSearchFilterAttributePaths(['field1', 'field2']);
      const result = dataSource.testGetSearchFilterDefinitions('test');

      expect(result?.attributePaths).toEqual(['field1', 'field2']);
    });

    it('should use empty attribute paths when none configured', () => {
      dataSource.setSearchFilterAttributePaths([]);
      const result = dataSource.testGetSearchFilterDefinitions('test');

      expect(result?.attributePaths).toEqual([]);
    });

    it('should preserve whitespace in search term', () => {
      const result = dataSource.testGetSearchFilterDefinitions('  spaced  search  ');

      expect(result?.searchTerm).toBe('  spaced  search  ');
    });

    it('should handle special characters in search term', () => {
      const result = dataSource.testGetSearchFilterDefinitions('test@example.com');

      expect(result?.searchTerm).toBe('test@example.com');
    });
  });

  // =========================================================================
  // getSortDefinitions Tests
  // =========================================================================

  describe('getSortDefinitions', () => {
    it('should return null when state has no sort', () => {
      const state: State = {};
      const result = dataSource.testGetSortDefinitions(state);
      expect(result).toBeNull();
    });

    it('should return empty array when sort array is empty', () => {
      const state: State = { sort: [] };
      const result = dataSource.testGetSortDefinitions(state);
      expect(result).toEqual([]);
    });

    it('should map "asc" direction to AscendingDto', () => {
      const state: State = {
        sort: [{ field: 'name', dir: 'asc' }]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result).toEqual([{
        attributePath: 'name',
        sortOrder: SortOrdersDto.AscendingDto
      }]);
    });

    it('should map "desc" direction to DescendingDto', () => {
      const state: State = {
        sort: [{ field: 'createdAt', dir: 'desc' }]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result).toEqual([{
        attributePath: 'createdAt',
        sortOrder: SortOrdersDto.DescendingDto
      }]);
    });

    it('should map undefined direction to DefaultDto', () => {
      const state: State = {
        sort: [{ field: 'id', dir: undefined }]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result).toEqual([{
        attributePath: 'id',
        sortOrder: SortOrdersDto.DefaultDto
      }]);
    });

    it('should handle multiple sort definitions', () => {
      const state: State = {
        sort: [
          { field: 'lastName', dir: 'asc' },
          { field: 'firstName', dir: 'asc' },
          { field: 'createdAt', dir: 'desc' }
        ]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result?.length).toBe(3);
      expect(result?.[0]).toEqual({ attributePath: 'lastName', sortOrder: SortOrdersDto.AscendingDto });
      expect(result?.[1]).toEqual({ attributePath: 'firstName', sortOrder: SortOrdersDto.AscendingDto });
      expect(result?.[2]).toEqual({ attributePath: 'createdAt', sortOrder: SortOrdersDto.DescendingDto });
    });

    it('should preserve sort order', () => {
      const state: State = {
        sort: [
          { field: 'first', dir: 'asc' },
          { field: 'second', dir: 'desc' },
          { field: 'third', dir: 'asc' }
        ]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result?.[0].attributePath).toBe('first');
      expect(result?.[1].attributePath).toBe('second');
      expect(result?.[2].attributePath).toBe('third');
    });

    it('should handle field with dot notation (nested path)', () => {
      const state: State = {
        sort: [{ field: 'address.city', dir: 'asc' }]
      };
      const result = dataSource.testGetSortDefinitions(state);

      expect(result?.[0].attributePath).toBe('address.city');
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================

  describe('Integration', () => {
    it('should handle combined filter, sort, and search', () => {
      dataSource.setSearchFilterAttributePaths(['name']);

      const state: State = {
        filter: {
          logic: 'and',
          filters: [{ field: 'status', operator: 'eq', value: 'active' }]
        },
        sort: [{ field: 'name', dir: 'asc' }]
      };

      const filters = dataSource.testGetFieldFilterDefinitions(state);
      const sort = dataSource.testGetSortDefinitions(state);
      const search = dataSource.testGetSearchFilterDefinitions('test');

      expect(filters?.length).toBe(1);
      expect(sort?.length).toBe(1);
      expect(search).toBeTruthy();
    });
  });
});
