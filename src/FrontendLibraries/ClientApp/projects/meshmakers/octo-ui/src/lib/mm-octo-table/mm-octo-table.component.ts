import { Component, ElementRef, Input, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { BehaviorSubject, fromEvent, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';

import { AsyncPipe, NgClass, NgForOf, NgIf, TitleCasePipe } from "@angular/common";
import { MatButton } from '@angular/material/button';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from '@angular/material/table';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';


// pascal-case.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { MatTooltip } from "@angular/material/tooltip";
import { NewGraphQlDataSource } from "../list-element/newGraphQlDataSource";
import { SearchFilterDto, SearchFilterTypesDto, SortDto, SortOrdersDto } from "../list-element/globalTypes";

@Pipe({
  standalone: true,
  name: "pascalCase"
})
export class PascalCasePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export interface DataColumns {
  columnNames: string[];
  accessPaths: Record<string, string>
}


@Component({
  selector: 'mm-octo-table',
  standalone: true,
  imports: [
    AsyncPipe,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatFormField,
    MatHeaderCell,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatInput,
    MatLabel,
    MatPaginator,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatSort,
    MatSortHeader,
    MatTable,
    MatToolbar,
    NgIf,
    RouterLink,
    MatHeaderCellDef,
    NgForOf,
    TitleCasePipe,
    NgClass,
    PascalCasePipe,
    MatTooltip
  ],
  templateUrl: './mm-octo-table.component.html',
  styleUrl: './mm-octo-table.component.scss'
})
export class MmOctoTableComponent implements OnInit, AfterViewInit {
  @Input() dataSource!: NewGraphQlDataSource<any, any, any>;
  @Input() dataColumns: DataColumns =  { columnNames: [], accessPaths: {} };
  @Input() actionColumns: string[] = [];
  @Input() searchFilterColumns: string[] = [];
  @Input() currentRoute = "";
  @Input() currentId = "";
  @Input() selectedPageSize= new BehaviorSubject<number>(10);

  @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;
  @ViewChild(MatSort, { static: false }) sort?: MatSort;
  @ViewChild('input', { static: false }) input?: ElementRef<HTMLInputElement>;

  protected loading = false;
  protected isMobile: boolean;

  constructor() {
    this.isMobile = false;
  }

  ngOnInit(): void {

    // at least add the currentId to the search filter columns
    if(this.currentId && !this.searchFilterColumns.includes(this.currentId)) {
      this.searchFilterColumns.push(this.currentId);
    }

    if (!this.dataSource) {
      throw new Error('No dataSource provided');
    }
  }

  // noinspection JSUnusedGlobalSymbols
  ngAfterViewInit(): void {
    if (this.sort && this.input && this.paginator) {
      // server-side search
      fromEvent(this.input.nativeElement, 'keyup')
        .pipe(
          debounceTime(500),
          distinctUntilChanged(),
          tap(() => {
            if (this.paginator) {
              this.paginator.pageIndex = 0;
            }
            this.loadData();
          })
        )
        .subscribe();

      // reset the paginator after sorting
      this.sort.sortChange.subscribe(() => {
        if (this.paginator) this.paginator.pageIndex = 0;
      });

      merge(this.sort.sortChange, this.paginator.page)
        .pipe(
          tap(() => {
            this.loadData();
          })
        )
        .subscribe();
    }
  }

  loadData(): void {
    if (!this.input || !this.sort) {
      return;
    }
    const filterString = this.input.nativeElement.value;
    const field = this.sort.active;
    const direction = this.sort.direction;

    let filter = null;
    if (filterString) {
      filter = {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributeNames: this.searchFilterColumns,
        searchTerm: filterString
      } as SearchFilterDto;
    }

    const sort = [];
    if (field) {
      sort.push(({
        attributeName: field,
        sortOrder: direction === 'asc' ? SortOrdersDto.AscendingDto : SortOrdersDto.DescendingDto
      } as SortDto));
    }

    if (this.paginator) {
      this.dataSource?.loadData(this.paginator.pageIndex * this.paginator.pageSize, this.paginator.pageSize, filter, null, sort);
    }
  }

  protected readonly encodeURIComponent = encodeURIComponent;

  accessElement(element:any, column: string, accessPaths: Record<string, string>): any {
    // get keys of accessPaths
    const keys = Object.keys(accessPaths);
    // check if column is in keys
    if(!keys.includes(column)) {
      return element[column];
    }

    try {
      // if column is in accessPaths, try split accessPaths[column] by '.' and access element
      const path = accessPaths[column].split('.');
      let result = element;
      for (const p of path) {
        result = result[p];
      }
      return result;
    } catch (e) {
      //console.log(`Error accessing element: ${e}`);
      return "NONE";
    }
  }

  selectedPageSizeChanged($event: PageEvent) {
    this.selectedPageSize.next($event.pageSize);
  }
}
