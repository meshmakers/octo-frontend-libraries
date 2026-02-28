/**
 * Backward-compatible AssetRepoGraphQlDataSource for legacy apps.
 *
 * New code should use OctoGraphQlDataSource from @meshmakers/octo-ui.
 */
import { map, Observable, Subscription } from 'rxjs';
import { DataSourceBase, MessageService, PagedResultDto } from '@meshmakers/shared-services';
import { FieldFilterDto, InputMaybe, SearchFilterDto, SortDto } from '../graphQL/globalTypes';
import type { OperationVariables } from '@apollo/client/core';
import { GraphQL } from '../shared/graphQL';

export interface IQueryVariablesDto extends OperationVariables {
  first?: number | null | undefined;
  after?: string | null | undefined;
  sort?: InputMaybe<InputMaybe<SortDto> | InputMaybe<SortDto>[]> | undefined;
  searchFilter?: InputMaybe<SearchFilterDto> | undefined;
  fieldFilters?: InputMaybe<InputMaybe<FieldFilterDto>[] | InputMaybe<FieldFilterDto>>;
}

/**
 * Structural interface for QueryRef to avoid private/protected member type incompatibilities
 * between different apollo-angular npm installations.
 */
interface QueryRefLike<_TQueryDto = unknown, TVariablesDto = unknown> {
  valueChanges: Observable<unknown>;
  refetch(variables?: TVariablesDto): Promise<unknown>;
  stopPolling(): void;
}

/**
 * Structural interface for apollo-angular Query.
 */
interface QueryLike<_TQueryDto = unknown, _TVariablesDto extends OperationVariables = OperationVariables> {
  watch(options?: Record<string, unknown>): QueryRefLike<unknown, unknown>;
}

export abstract class GraphQlDataSource<TDto> extends DataSourceBase<TDto> {
  public abstract refetch(): Promise<void>;

  public abstract refetchWith(
    skip?: number,
    take?: number,
    searchFilter?: SearchFilterDto | null,
    fieldFilter?: FieldFilterDto[] | null,
    sort?: SortDto[] | null
  ): Promise<void>;

  public abstract loadData(
    skip?: number,
    take?: number,
    searchFilter?: SearchFilterDto | null,
    fieldFilter?: FieldFilterDto[] | null,
    sort?: SortDto[] | null
  ): void;
}

export class AssetRepoGraphQlDataSource<TDto, TQueryDto, TVariablesDto extends IQueryVariablesDto> extends GraphQlDataSource<TDto> {
  private queryRef: QueryRefLike<TQueryDto, TVariablesDto> | null;
  private subscription: Subscription | null;

  constructor(
    protected messageService: MessageService,
    private readonly query: QueryLike<TQueryDto, TVariablesDto>,
    private readonly defaultSort: SortDto[] | null = null
  ) {
    super();
    this.queryRef = null;
    this.subscription = null;
  }

  override clear(): void {
    super.clear();
    this.queryRef?.stopPolling();
    this.queryRef = null;
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  public async refetch(): Promise<void> {
    await this.queryRef?.refetch();
  }

  public async refetchWith(
    skip = 0,
    take = 10,
    searchFilter: SearchFilterDto | null = null,
    fieldFilter: FieldFilterDto[] | null = null,
    sort: SortDto[] | null = null
  ): Promise<void> {
    const variables = this.createVariables(skip, take, searchFilter, fieldFilter, sort);
    await this.queryRef?.refetch(variables);
  }

  protected createVariables(
    skip = 0,
    take = 10,
    searchFilter: SearchFilterDto | null = null,
    fieldFilter: FieldFilterDto[] | null = null,
    sort: SortDto[] | null = null
  ): TVariablesDto {
    if ((!sort || (sort && sort.length === 0)) && searchFilter === null) {
      sort = new Array<SortDto>();
      if (this.defaultSort) {
        sort = this.defaultSort;
      }
    }

    return {
      first: take,
      after: GraphQL.offsetToCursor(skip),
      sort,
      searchFilter,
      fieldFilters: fieldFilter
    } as TVariablesDto;
  }

  public loadData(
    skip = 0,
    take = 10,
    searchFilter: SearchFilterDto | null = null,
    fieldFilter: FieldFilterDto[] | null = null,
    sort: SortDto[] | null = null
  ): void {
    this.clear();
    super.onBeginLoad();

    const variables = this.createVariables(skip, take, searchFilter, fieldFilter, sort);
    this.queryRef = this.query.watch({ variables, errorPolicy: 'all' });

    this.subscription = this.queryRef.valueChanges
      .pipe(
        map((v, i) => this.executeLoad(v, i)))
      .subscribe({
        next: (pagedResult) => super.onCompleteLoad(pagedResult),
        error: (e) => {
          const errorMessage = e instanceof Error ? e.message : String(e);
          this.messageService.showErrorWithDetails(errorMessage, '');
          super.onCompleteLoad(new PagedResultDto<TDto>());
        }
      });
  }

  protected executeLoad(_value: unknown, _index: number): PagedResultDto<TDto> {
    return new PagedResultDto<TDto>();
  }
}
