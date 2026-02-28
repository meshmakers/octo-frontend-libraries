import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogContentBase, DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import {
  GridComponent,
  ColumnComponent,
  PagerSettings,
  SelectableSettings,
  SelectionEvent,
  PageChangeEvent,
  CheckboxColumnComponent
} from '@progress/kendo-angular-grid';
import { TextBoxComponent } from '@progress/kendo-angular-inputs';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { EntitySelectDialogDataSource, EntitySelectDialogResult } from './entity-select-dialog-data-source';
import { TableColumn } from '../list-view/list-view.model';
import { PascalCasePipe } from '../pipes/pascal-case.pipe';

@Component({
  selector: 'mm-entity-select-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    DialogModule,
    GridComponent,
    ColumnComponent,
    CheckboxColumnComponent,
    TextBoxComponent,
    PascalCasePipe
  ],
  template: `
    <div class="entity-select-dialog-content">
      <div class="search-toolbar">
        <kendo-textbox
          [style.width.px]="250"
          placeholder="Search..."
          [value]="searchValue"
          (valueChange)="onSearchChange($event)">
        </kendo-textbox>
      </div>

      <kendo-grid
        [data]="gridData"
        [pageSize]="pageSize"
        [skip]="skip"
        [pageable]="pageable"
        [selectable]="selectableSettings"
        [loading]="isLoading"
        (pageChange)="onPageChange($event)"
        (selectionChange)="onSelectionChange($event)"
        class="entity-grid">

        <kendo-grid-checkbox-column
          [width]="40"
          [showSelectAll]="multiSelect">
        </kendo-grid-checkbox-column>

        <kendo-grid-column
          *ngFor="let column of columns"
          [field]="column.field"
          [title]="getDisplayName(column) | pascalCase">
        </kendo-grid-column>

      </kendo-grid>

      <div class="selection-info" *ngIf="selectedEntities.length > 0">
        {{ selectedEntities.length }} selected
      </div>
    </div>

    <kendo-dialog-actions>
      <button kendoButton (click)="onCancel()">Cancel</button>
      <button kendoButton
              themeColor="primary"
              [disabled]="selectedEntities.length === 0"
              (click)="onConfirm()">
        OK
      </button>
    </kendo-dialog-actions>
  `,
  styles: [`
    .entity-select-dialog-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      box-sizing: border-box;
    }

    .search-toolbar {
      padding: 8px 0 16px 0;
      flex-shrink: 0;
    }

    .entity-grid {
      flex: 1;
      min-height: 200px;
      border: 1px solid var(--kendo-color-border);
    }

    .selection-info {
      padding: 8px 0;
      font-size: 12px;
      color: var(--kendo-color-subtle);
      flex-shrink: 0;
    }
  `]
})
export class EntitySelectDialogComponent<T> extends DialogContentBase implements OnInit, OnDestroy {
  private readonly dialogRef: DialogRef;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  @Input() dataSource!: EntitySelectDialogDataSource<T>;
  @Input() multiSelect = false;
  @Input() preSelectedEntities: T[] = [];

  columns: TableColumn[] = [];
  gridData: { data: T[]; total: number } = { data: [], total: 0 };
  selectedEntities: T[] = [];
  selectedKeys: string[] = [];
  isLoading = false;
  searchValue = '';
  pageSize = 10;
  skip = 0;

  pageable: PagerSettings = {
    buttonCount: 5,
    info: true,
    type: 'numeric',
    pageSizes: [5, 10, 20, 50],
    previousNext: true
  };

  get selectableSettings(): SelectableSettings {
    return {
      enabled: true,
      mode: this.multiSelect ? 'multiple' : 'single',
      checkboxOnly: true
    };
  }

  constructor() {
    const dialogRef = inject(DialogRef);
    super(dialogRef);
    this.dialogRef = dialogRef;
  }

  ngOnInit(): void {
    this.initializeColumns();
    this.setupSearch();
    this.loadData();

    // Set pre-selected entities
    if (this.preSelectedEntities.length > 0) {
      this.selectedEntities = [...this.preSelectedEntities];
      this.selectedKeys = this.preSelectedEntities.map(e => this.dataSource.getIdEntity(e));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeColumns(): void {
    const columnDefs = this.dataSource.getColumns();
    this.columns = columnDefs.map(col => {
      if (typeof col === 'string') {
        return { field: col, dataType: 'text' as const };
      }
      return col as TableColumn;
    });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.skip = 0;
      this.loadData();
    });
  }

  private loadData(): void {
    if (!this.dataSource) return;

    this.isLoading = true;

    this.dataSource.fetchData({
      skip: this.skip,
      take: this.pageSize,
      textSearch: this.searchValue || null
    }).subscribe({
      next: (result) => {
        this.gridData = {
          data: (result?.data ?? []).filter((item): item is T => item !== null),
          total: result?.totalCount ?? 0
        };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.gridData = { data: [], total: 0 };
        this.isLoading = false;
      }
    });
  }

  getDisplayName(column: TableColumn): string {
    return column.displayName ?? column.field;
  }

  onSearchChange(value: string | null): void {
    this.searchValue = value || '';
    this.searchSubject.next(this.searchValue);
  }

  onPageChange(event: PageChangeEvent): void {
    this.skip = event.skip;
    this.pageSize = event.take;
    this.loadData();
  }

  onSelectionChange(event: SelectionEvent): void {
    // Handle selected rows
    if (event.selectedRows) {
      for (const row of event.selectedRows) {
        if (row.dataItem && !this.selectedEntities.includes(row.dataItem)) {
          if (!this.multiSelect) {
            // Single select: replace selection
            this.selectedEntities = [row.dataItem];
            this.selectedKeys = [this.dataSource.getIdEntity(row.dataItem)];
          } else {
            // Multi select: add to selection
            this.selectedEntities.push(row.dataItem);
            this.selectedKeys.push(this.dataSource.getIdEntity(row.dataItem));
          }
        }
      }
    }

    // Handle deselected rows
    if (event.deselectedRows) {
      for (const row of event.deselectedRows) {
        if (row.dataItem) {
          const id = this.dataSource.getIdEntity(row.dataItem);
          const index = this.selectedKeys.indexOf(id);
          if (index > -1) {
            this.selectedEntities.splice(index, 1);
            this.selectedKeys.splice(index, 1);
          }
        }
      }
    }
  }

  onConfirm(): void {
    const result: EntitySelectDialogResult<T> = {
      selectedEntities: this.selectedEntities
    };
    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
