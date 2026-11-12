import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  isIncompleteSliceGraphQlError,
  OCTO_HANDLES_PAGE_OUT_OF_RANGE,
  SearchFilterDto,
  SearchFilterTypesDto, SortDto, SortOrdersDto
} from '@meshmakers/octo-services';
import {DataSourceTyped, ListViewComponent} from '@meshmakers/shared-ui';
import {FilterOperator, isCompositeFilterDescriptor} from '@progress/kendo-data-query';
import {State} from '@progress/kendo-data-query/dist/npm/state';

/** Guard against cyclic or deeply nested error objects. */
const MAX_ERROR_NESTING = 4;

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

  /**
   * The OctoMesh API rejects a page window that lies beyond the result set
   * with an INCOMPLETE_SLICE GraphQL error (e.g. a persisted page offset
   * combined with filters that now match fewer rows). Reporting it here lets
   * MmListViewDataBindingDirective recover by resetting to page 1 instead of
   * silently keeping the previous rows on screen.
   *
   * The asset repository reports the error as `extensions.code = 'ASSET1002'`
   * with `extensions.codes = ['ASSET1002', 'INCOMPLETE_SLICE']`. ASSET1002 is
   * the generic GraphQL error code of the asset repository, so only
   * INCOMPLETE_SLICE (in `code` or `codes`) marks a page out of range.
   *
   * Detection is structural (no `instanceof`) and accepts every shape a failed
   * Apollo call comes in: Apollo 4 `CombinedGraphQLErrors` (`errors`), Apollo 3
   * `ApolloError` (`graphQLErrors`, or `networkError.result.errors`), an Apollo 4
   * `ServerError` whose JSON `bodyText` holds the GraphQL errors (non-2xx answer
   * with media type `application/json`), a raw array of GraphQL errors or a
   * single GraphQL error.
   */
  public override isPageOutOfRangeError(error: unknown): boolean {
    return OctoGraphQlDataSource.graphQlErrorEntries(error, 0).some((entry) =>
      isIncompleteSliceGraphQlError({ extensions: OctoGraphQlDataSource.asRecord(entry['extensions']) }));
  }

  /**
   * Apollo operation context for the paged query of {@link fetchData} (AB#8805). `MmListViewDataBindingDirective`
   * recovers from a page-out-of-range answer itself (page 1 once, see {@link isPageOutOfRangeError}), so the global
   * `OctoErrorLink` must not log or toast it. The base class does not send the query, so every subclass opts in by
   * passing this context to its fetch: `gql.fetch({ variables, fetchPolicy, context: this.pageOutOfRangeContext })`.
   * Only the INCOMPLETE_SLICE answer is skipped; every other error of the query is still logged and toasted.
   */
  protected get pageOutOfRangeContext(): Record<string, unknown> {
    return { [OCTO_HANDLES_PAGE_OUT_OF_RANGE]: true };
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private static graphQlErrorEntries(error: unknown, depth: number): Record<string, unknown>[] {
    if (depth > MAX_ERROR_NESTING) {
      return [];
    }
    if (Array.isArray(error)) {
      return error
        .map((e) => OctoGraphQlDataSource.asRecord(e))
        .filter((e): e is Record<string, unknown> => e !== null);
    }
    const candidate = OctoGraphQlDataSource.asRecord(error);
    if (!candidate) {
      return [];
    }
    if (Array.isArray(candidate['errors'])) {
      return OctoGraphQlDataSource.graphQlErrorEntries(candidate['errors'], depth + 1);
    }
    const entries: Record<string, unknown>[] = [];
    if (Array.isArray(candidate['graphQLErrors'])) {
      entries.push(...OctoGraphQlDataSource.graphQlErrorEntries(candidate['graphQLErrors'], depth + 1));
    }
    // Apollo 3 network error (`ApolloError.networkError`) and its parsed body (`ServerError.result`).
    for (const key of ['networkError', 'result']) {
      if (candidate[key] !== undefined) {
        entries.push(...OctoGraphQlDataSource.graphQlErrorEntries(candidate[key], depth + 1));
      }
    }
    // Apollo 4 `ServerError`: only the raw body text is kept.
    if (typeof candidate['bodyText'] === 'string') {
      entries.push(...OctoGraphQlDataSource.graphQlErrorEntries(
        OctoGraphQlDataSource.parseJson(candidate['bodyText']), depth + 1));
    }
    if (entries.length === 0 && candidate['extensions'] !== undefined) {
      entries.push(candidate);
    }
    return entries;
  }

  private static parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
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

  private static getOperatorAndValue(operator: FilterOperator, value: unknown): {
    operator: FieldFilterOperatorsDto,
    value: unknown
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
        return {operator: FieldFilterOperatorsDto.EqualsDto, value: ''};
      case 'isnotempty':
        return {operator: FieldFilterOperatorsDto.NotEqualsDto, value: ''};
      default:
        throw new Error('The filter operator is not supported');
    }
  }
}
