/**
 * Material Design replacement for legacy Kendo-based MmOctoTableComponent.
 * Uses Angular Material table with sorting, pagination, and search.
 */
import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  OnInit,
  AfterViewInit,
  AfterContentInit,
  OnDestroy,
  Output,
  EventEmitter,
  ContentChildren,
  QueryList,
  TemplateRef
} from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { BehaviorSubject, fromEvent, merge, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';

import { AsyncPipe, NgIf, NgTemplateOutlet } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
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
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatListItemIcon } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { SearchFilterDto, SearchFilterTypesDto, SortDto, SortOrdersDto } from '@meshmakers/octo-services';
import { AssetRepoGraphQlDataSource } from '@meshmakers/octo-services';
import { ColumnDefinition, getDisplayName, getDataKey, TableColumn } from './mm-octo-table.model';

export interface ActionColumn {
  displayText: string;
  actionId: string;
  iconName?: string;
  svgIconName?: string;
}

export interface ToolbarAction {
  iconName?: string;
  svgIconName?: string;
  route?: string;
  clickHandler?: () => void;
  actionText: string;
  isDisabled?: Observable<boolean>;
  isHidden?: Observable<boolean>;
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
    MatHeaderCellDef,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatListItemIcon,
    MatHeaderRow,
    MatHeaderRowDef,
    MatButton,
    RouterLink,
    MatCellDef,
    MatHeaderRowDef,
    MatRowDef,
    NgTemplateOutlet
  ],
  templateUrl: './mm-octo-table.component.html',
  styleUrl: './mm-octo-table.component.scss'
})
 
export class MmOctoTableComponent implements OnInit, AfterViewInit, AfterContentInit, OnDestroy {
   
  @Input() dataSource!: AssetRepoGraphQlDataSource<any, any, any>;
   
  @ContentChildren(TemplateRef) cellTemplates!: QueryList<TemplateRef<any>>;
   
  templateMap = new Map<string, TemplateRef<any>>();

  @Input() actionColumns: ActionColumn[] = [];
  @Input() leftToolbarActions: ToolbarAction[] = [];
  @Input() optionActions: ActionColumn[] = [];
  @Input() searchFilterColumns: string[] = [];
  @Input() currentId = '';
  @Input() defaultSortColumn = '';
  @Input() rowIsClickable = true;

  @Input() pageSizeOptions = [5, 10, 20, 50];
  @Input() selectedPageSize = 5;

   
  @Output() rowClicked = new EventEmitter<any>();
  @Output() searchFilterStringUpdated = new EventEmitter<string>();
  @Input() selectedRowId = '';

   
  @Output() actionColumnClick = new EventEmitter<{ action: string; id: string; entry: any }>();

  @Input() set columns(cols: ColumnDefinition[]) {
    if (cols === null || cols === undefined || cols.length === 0) {
      this._columns = [];
      return;
    }

    this._columns = [];

    for (const column of cols) {
      if (typeof column === 'string') {
        this._columns.push({ dataKey: column });
      } else {
        this._columns.push(column);
      }
    }
  }

  get columns(): TableColumn[] {
    return this._columns;
  }
  _columns: TableColumn[] = [];

   
  selectedRow: any = null;

  selectedPageSizeSubject: BehaviorSubject<number> = new BehaviorSubject<number>(this.selectedPageSize);

  @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;
  @ViewChild(MatSort, { static: false }) sort?: MatSort;
  @ViewChild('input', { static: false }) input?: ElementRef<HTMLInputElement>;

  private loadingSubscription?: Subscription;
  private wasLoadingPreviously = false;
  private hadFocusBeforeLoading = false;

  get columnDataKeys(): string[] {
    return this._columns.map((c) => getDataKey(c));
  }

  get columnDisplayNames(): string[] {
    return this._columns.map((c) => getDisplayName(c));
  }

  ngOnInit(): void {
    this.selectedPageSizeSubject.next(this.selectedPageSize);

    if (!this.dataSource) {
      throw new Error('No dataSource provided');
    }

    this.checkSelectedRow();
  }

  ngAfterContentInit(): void {
    this.templateMap.clear();
    if (this.cellTemplates) {
       
      this.cellTemplates.forEach((template: any) => {
        const refName = template._declarationTContainer?.localNames?.[0];
        if (refName) {
          this.templateMap.set(refName, template);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    if (this.dataSource?.loading$) {
      this.loadingSubscription = this.dataSource.loading$.subscribe((isLoading) => {
        if (this.wasLoadingPreviously && !isLoading && this.hadFocusBeforeLoading && this.input) {
          setTimeout(() => {
            this.input?.nativeElement?.focus();
            this.hadFocusBeforeLoading = false;
          }, 0);
        }

        if (!this.wasLoadingPreviously && isLoading && this.input) {
          this.hadFocusBeforeLoading = document.activeElement === this.input.nativeElement;
        }

        this.wasLoadingPreviously = isLoading;
      });
    }

    if (this.sort && this.input && this.paginator) {
      fromEvent(this.input.nativeElement, 'keyup')
        .pipe(
          debounceTime(500),
          distinctUntilChanged(),
          tap(() => {
            if (this.paginator) {
              this.paginator.pageIndex = 0;
            }
            this.searchFilterStringUpdated.emit(this.input?.nativeElement?.value ?? '');
            this.loadData();
          })
        )
        .subscribe();

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
    this.loadData();
  }

  loadData(): void {
    if (!this.input || !this.sort) {
      return;
    }
    const filterString = this.input.nativeElement.value;
    const field = this.sort.active;
    const direction = this.sort.direction;

    let filter: SearchFilterDto | null = null;
    if (filterString) {
      filter = {
        type: SearchFilterTypesDto.AttributeFilterDto,
        attributePaths: this.searchFilterColumns,
        searchTerm: filterString
      };
    }

    const sort = [];
    if (field) {
      sort.push({
        attributePath: field,
        sortOrder: direction === 'asc' ? SortOrdersDto.AscendingDto : SortOrdersDto.DescendingDto
      } as SortDto);
    }

    if (this.paginator) {
      this.dataSource?.loadData(this.paginator.pageIndex * this.paginator.pageSize, this.paginator.pageSize, filter, null, sort);
    }
  }

  protected readonly encodeURIComponent = encodeURIComponent;

   
  accessElement(element: any, column: TableColumn): any {
    if (column.templateName) {
      return element;
    }
    if (column.dataKey.indexOf('.') === -1) {
      return element[column.dataKey];
    }
    const keys = column.dataKey.split('.');
    let value = element;
    for (const key of keys) {
      value = value[key];
    }
    return value;
  }

  selectedPageSizeChanged($event: PageEvent) {
    this.selectedPageSizeSubject.next($event.pageSize);
  }

  getActionDisplayTexts(): string[] {
    return this.actionColumns.map((ac) => ac.displayText);
  }

   
  onRowClick(row: any) {
    if (this.rowIsClickable) {
      this.selectedRow = row;
      this.rowClicked.emit(row);
    }
  }

   
  isRowSelected(row: any): boolean {
    return this.selectedRow === row;
  }

  checkSelectedRow() {
     
    this.dataSource.connect(null as any).subscribe((data) => {
      for (const entry of data) {
        if (entry.rtId === this.selectedRowId) {
          this.onRowClick(entry);
        }
      }
    });
  }

   
  emitRowData(data: { action: string; id: string; entry: any }) {
    this.actionColumnClick.emit(data);
  }

  hasOptionActions = () => {
    return this.optionActions.length > 0;
  };

  hasActionColumns = () => {
    return this.actionColumns.length > 0 || this.optionActions.length > 0;
  };
  protected readonly getDisplayName = getDisplayName;
  protected readonly getDataKey = getDataKey;

  isSortable(column: TableColumn): boolean {
    if (column.sortingDisabled !== undefined) {
      return !column.sortingDisabled;
    }
    return true;
  }

   
  getTemplate(templateName: string): TemplateRef<any> | undefined {
    return this.templateMap.get(templateName);
  }

  ngOnDestroy(): void {
    if (this.loadingSubscription) {
      this.loadingSubscription.unsubscribe();
    }
  }
}
