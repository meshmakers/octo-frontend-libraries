import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  SearchFilterDto,
  SearchFilterTypesDto, SortDto, SortOrdersDto
} from '@meshmakers/octo-services';
import {DataSourceTyped, ListViewComponent} from '@meshmakers/shared-ui';
import {FilterOperator, isCompositeFilterDescriptor} from '@progress/kendo-data-query';
import {State} from '@progress/kendo-data-query/dist/npm/state';

// noinspection JSUnusedGlobalSymbols
export abstract class OctoGraphQlDataSource<TDto> extends DataSourceTyped<TDto | null> {

  private _searchFilterAttributePaths: string[] = [];

  // noinspection JSUnusedGlobalSymbols
  protected constructor(listViewComponent: ListViewComponent) {
    super(listViewComponent);
  }

  protected get searchFilterAttributePaths(): string[] {
    return this._searchFilterAttributePaths;
  }
  protected set searchFilterAttributePaths(value: string[]) {
    this._searchFilterAttributePaths = value;
  }

  // noinspection JSUnusedGlobalSymbols
  protected getFieldFilterDefinitions(state: State) {
    let fieldFilters: FieldFilterDto[] | null = null;
    if (state.filter?.filters) {
      fieldFilters = state.filter.filters.map((f) => {

        if (isCompositeFilterDescriptor(f)) {
          throw new Error('Composite filter descriptor not supported');
        }

        const {operator, value} = OctoGraphQlDataSource.getOperatorAndValue(f.operator as FilterOperator, f.value);

        return {
          attributePath: f.field,
          operator: operator,
          comparisonValue: value
        } as FieldFilterDto;
      });
    }
    return fieldFilters;
  }

  // noinspection JSUnusedGlobalSymbols
  protected getSearchFilterDefinitions(textSearchValue: string | null): SearchFilterDto | null {
    let searchFilterDto: SearchFilterDto | null = null;
    if (textSearchValue) {
      searchFilterDto = {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: this.searchFilterAttributePaths,
        searchTerm: textSearchValue,
      };
    }
    return searchFilterDto;
  }

  // noinspection JSUnusedGlobalSymbols
  protected getSortDefinitions(state: State): SortDto[] | null {
    let sort: SortDto[] | null = null;
    if (state.sort) {
      sort = new Array<SortDto>()
      state.sort.forEach((s) => {

        switch (s.dir) {
          case 'asc':
            sort?.push({
              attributePath: s.field,
              sortOrder: SortOrdersDto.AscendingDto
            });
            break;
          case 'desc':
            sort?.push({
              attributePath: s.field,
              sortOrder: SortOrdersDto.DescendingDto,
            });
            break;
          default:
            sort?.push({
              attributePath: s.field,
              sortOrder: SortOrdersDto.DefaultDto,
            });
            break;
        }

      });
    }
    return sort;
  }

  private static getOperatorAndValue(operator: FilterOperator, value: any): {
    operator: FieldFilterOperatorsDto,
    value: any
  } {

    switch (operator) {
      case 'eq':
        return {operator: FieldFilterOperatorsDto.EqualsDto, value: value};
      case 'neq':
        return {operator: FieldFilterOperatorsDto.NotEqualsDto, value: value};
      case 'lt':
        return {operator: FieldFilterOperatorsDto.LessThanDto, value: value};
      case 'lte':
        return {operator: FieldFilterOperatorsDto.LessEqualThanDto, value: value};
      case 'gt':
        return {operator: FieldFilterOperatorsDto.GreaterThanDto, value: value};
      case 'gte':
        return {operator: FieldFilterOperatorsDto.GreaterEqualThanDto, value: value};
      case 'contains':
        return {operator: FieldFilterOperatorsDto.LikeDto, value: value};
      case 'doesnotcontain':
        return {operator: FieldFilterOperatorsDto.MatchRegExDto, value: `^(?!.*${value}).*$`};
      case 'startswith':
        return {operator: FieldFilterOperatorsDto.MatchRegExDto, value: value + '.*'};
      case 'endswith':
        return {operator: FieldFilterOperatorsDto.MatchRegExDto, value: '.*' + value};
      case 'isnull':
        return {operator: FieldFilterOperatorsDto.EqualsDto, value: null};
      case 'isnotnull':
        return {operator: FieldFilterOperatorsDto.NotEqualsDto, value: null};
      case 'isempty':
        return {operator: FieldFilterOperatorsDto.EqualsDto, value: ""};
      case 'isnotempty':
        return {operator: FieldFilterOperatorsDto.NotEqualsDto, value: ""};
      default:
        throw new Error('The filter operator is not supported');
    }
  }
}
