import { MatPaginator } from '@angular/material/paginator';
import { MatSort, SortDirection } from '@angular/material/sort';
import { ElementRef, EventEmitter } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import {
  SearchFilterDto,
  SearchFilterTypesDto,
  SortDto,
  SortOrdersDto,
} from './globalTypes';

export class OctoListNavigationDataInfo {
  skip: number;
  take: number;
  searchFilter?: SearchFilterDto;
  sort?: SortDto[];

  constructor() {
    this.skip = 0;
    this.take = 10;
  }
}

export class OctoListNavigationOptions {
  language: string | null;
  searchFilterType?: SearchFilterTypesDto;
  searchFilterAttributeNames?: string[];

  constructor() {
    this.language = null;
  }
}

export class OctoListNavigation {
  public loadDataRequest = new EventEmitter<OctoListNavigationDataInfo>();

  lastSortDirection: SortDirection | null;
  lastSortField: string | null;
  lastSearchText: string | null;

  constructor(
    private readonly paginator: MatPaginator,
    private readonly sort: MatSort,
    private readonly searchBox: ElementRef,
    private readonly octoOptions: OctoListNavigationOptions
  ) {
    this.lastSortDirection = null;
    this.lastSortField = null;
    this.lastSearchText = null;
  }

  public get loadDataInfo(): OctoListNavigationDataInfo {
    const filterString = this.searchBox.nativeElement.value;
    const sortField = this.sort.active;
    const sortDirection = this.sort.direction;

    let filter = null;
    if (filterString) {
      filter = <SearchFilterDto>{
        language: this.octoOptions.language,
        searchTerm: filterString,
        type: this.octoOptions.searchFilterType,
        attributeNames: this.octoOptions.searchFilterAttributeNames,
      };
    }

    const sort = [];
    if (sortField && sortDirection) {
      sort.push(<SortDto>{
        attributeName: sortField,
        sortOrder:
          sortDirection === 'asc'
            ? SortOrdersDto.AscendingDto
            : SortOrdersDto.DescendingDto,
      });
    }

    return <OctoListNavigationDataInfo>{
      skip: this.paginator.pageIndex * this.paginator.pageSize,
      take: this.paginator.pageSize,
      searchFilter: filter,
      sort,
    };
  }

  init(): void {
    // server-side search
    fromEvent(this.searchBox.nativeElement, 'keyup')
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        tap(() => {
          this.paginator.pageIndex = 0;

          const searchText = this.searchBox.nativeElement.value;

          if (!this.lastSearchText && searchText) {
            this.lastSortDirection = this.sort.direction;
            this.lastSortField = this.sort.active;

            // Reset sorting to see the score rating (default sorting returned from server)
            this.sort.sort({ id: '', start: 'asc', disableClear: false });
          }

          this.lastSearchText = searchText;

          if (!searchText && this.lastSortField) {
            if (this.lastSortDirection === 'asc') {
              this.sort.sort({
                id: this.lastSortField,
                start: 'asc',
                disableClear: true,
              });
            } else if (this.lastSortDirection === 'desc') {
              this.sort.sort({
                id: this.lastSortField,
                start: 'desc',
                disableClear: true,
              });
            }
          }

          this.loadData();
        })
      )
      .subscribe();

    // reset the paginator after sorting
    this.sort.sortChange.subscribe(() => (this.paginator.pageIndex = 0));

    merge(this.sort.sortChange, this.paginator.page)
      .pipe(
        tap(() => {
          this.loadData();
        })
      )
      .subscribe();
  }

  private loadData(): void {
    this.loadDataRequest.emit(this.loadDataInfo);
  }
}
