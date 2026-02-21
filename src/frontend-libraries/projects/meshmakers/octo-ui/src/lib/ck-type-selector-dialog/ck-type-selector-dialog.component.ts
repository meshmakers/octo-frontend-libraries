import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogRef, DialogModule, DialogContentBase } from '@progress/kendo-angular-dialog';
import { GridModule, GridDataResult, SelectionEvent, PageChangeEvent, RowArgs } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { IconsModule } from '@progress/kendo-angular-icons';
import { LoaderModule } from '@progress/kendo-angular-indicators';
import { searchIcon, filterClearIcon } from '@progress/kendo-svg-icons';
import { CkTypeSelectorService, CkTypeSelectorItem } from '@meshmakers/octo-services';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface CkTypeSelectorDialogData {
  selectedCkTypeId?: string;
  ckModelIds?: string[];
  dialogTitle?: string;
  allowAbstract?: boolean;
}

export interface CkTypeSelectorDialogResult {
  selectedCkType: CkTypeSelectorItem;
}

@Component({
  selector: 'mm-ck-type-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    IconsModule,
    LoaderModule,
    DialogModule
  ],
  template: `
    <div class="ck-type-selector-container">
      <div class="filter-container">
        <div class="filter-row">
          <div class="filter-item">
            <label>Model Filter</label>
            <kendo-combobox
              [data]="availableModels"
              [(ngModel)]="selectedModel"
              (valueChange)="onModelFilterChange($event)"
              [allowCustom]="false"
              [clearButton]="true"
              placeholder="All Models"
              class="filter-input">
            </kendo-combobox>
          </div>
          <div class="filter-item flex-grow">
            <label>Type Search</label>
            <kendo-textbox
              [(ngModel)]="searchText"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search types..."
              class="filter-input">
              <ng-template kendoTextBoxSuffixTemplate>
                <button kendoButton [svgIcon]="searchIcon" fillMode="clear" size="small"></button>
              </ng-template>
            </kendo-textbox>
          </div>
          <div class="filter-item filter-actions">
            <label>&nbsp;</label>
            <button kendoButton [svgIcon]="filterClearIcon" (click)="clearFilters()" title="Clear filters"></button>
          </div>
        </div>
      </div>

      <div class="grid-container">
        <kendo-grid
          [data]="gridData"
          [loading]="isLoading"
          [height]="400"
          [selectable]="{ mode: 'single' }"
          [pageable]="{ pageSizes: [25, 50, 100] }"
          [pageSize]="pageSize"
          [skip]="skip"
          (pageChange)="onPageChange($event)"
          (selectionChange)="onSelectionChange($event)"
          [kendoGridSelectBy]="selectItemBy"
          [(selectedKeys)]="selectedKeys"
          class="type-grid">
          <kendo-grid-column field="rtCkTypeId" title="Type" [width]="300">
            <ng-template kendoGridCellTemplate let-dataItem>
              <span [class.abstract-type]="dataItem.isAbstract" [class.final-type]="dataItem.isFinal">
                {{ dataItem.rtCkTypeId }}
              </span>
              <span *ngIf="dataItem.isAbstract" class="type-badge abstract">abstract</span>
              <span *ngIf="dataItem.isFinal" class="type-badge final">final</span>
            </ng-template>
          </kendo-grid-column>
          <kendo-grid-column field="baseTypeRtCkTypeId" title="Base Type" [width]="200">
            <ng-template kendoGridCellTemplate let-dataItem>
              {{ dataItem.baseTypeRtCkTypeId || '-' }}
            </ng-template>
          </kendo-grid-column>
          <kendo-grid-column field="description" title="Description">
            <ng-template kendoGridCellTemplate let-dataItem>
              {{ dataItem.description || '-' }}
            </ng-template>
          </kendo-grid-column>
        </kendo-grid>
      </div>

      <div class="selection-info" *ngIf="selectedType">
        <strong>Selected:</strong> {{ selectedType.rtCkTypeId }}
      </div>
    </div>

    <kendo-dialog-actions>
      <button kendoButton (click)="onCancel()">Cancel</button>
      <button kendoButton themeColor="primary" [disabled]="!selectedType || (selectedType.isAbstract && !allowAbstract)" (click)="onConfirm()">OK</button>
    </kendo-dialog-actions>
  `,
  styles: [`
    .ck-type-selector-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 20px;
      min-width: 700px;
      box-sizing: border-box;
    }

    .filter-container {
      margin-bottom: 16px;
      flex-shrink: 0;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      align-items: flex-end;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .filter-item label {
      font-size: 12px;
      font-weight: 500;
    }

    .filter-item.flex-grow {
      flex: 1;
    }

    .filter-item.filter-actions {
      flex-shrink: 0;
    }

    .filter-input {
      min-width: 180px;
    }

    .grid-container {
      flex: 1;
      min-height: 0;
    }

    .type-grid {
      border-radius: 4px;
    }

    .type-grid ::ng-deep .k-grid-table tbody tr {
      cursor: pointer;
    }

    .abstract-type {
      font-style: italic;
      opacity: 0.7;
    }

    .final-type {
      font-weight: 600;
    }

    .type-badge {
      display: inline-block;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 8px;
      text-transform: uppercase;
    }

    .type-badge.abstract {
      background-color: var(--kendo-color-warning, #ffc107);
      color: var(--kendo-color-on-warning, #000);
      opacity: 0.8;
    }

    .type-badge.final {
      background-color: var(--kendo-color-success, #28a745);
      color: var(--kendo-color-on-success, #fff);
      opacity: 0.8;
    }

    .selection-info {
      margin-top: 12px;
      padding: 8px 12px;
      background: var(--kendo-color-success-subtle, #d4edda);
      border: 1px solid var(--kendo-color-success, #28a745);
      border-radius: 4px;
      font-size: 14px;
      flex-shrink: 0;
    }
  `]
})
export class CkTypeSelectorDialogComponent extends DialogContentBase implements OnInit, OnDestroy {
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  protected readonly searchIcon = searchIcon;
  protected readonly filterClearIcon = filterClearIcon;

  public dialogTitle = 'Select Construction Kit Type';
  public allowAbstract = false;

  public searchText = '';
  public selectedModel: string | null = null;
  public availableModels: string[] = [];

  public gridData: GridDataResult = { data: [], total: 0 };
  public isLoading = false;
  public pageSize = 50;
  public skip = 0;

  public selectedKeys: string[] = [];
  public selectedType: CkTypeSelectorItem | null = null;

  // Selection key function - returns fullName as unique identifier
  public selectItemBy = (context: RowArgs): string => (context.dataItem as CkTypeSelectorItem).fullName;

  private initialCkModelIds?: string[];

  constructor() {
    super(inject(DialogRef));
  }

  ngOnInit(): void {
    const data = (this.dialog.content as any)?.instance?.data as CkTypeSelectorDialogData;

    if (data) {
      this.dialogTitle = data.dialogTitle || 'Select Construction Kit Type';
      this.allowAbstract = data.allowAbstract ?? false;
      this.initialCkModelIds = data.ckModelIds;

      if (data.selectedCkTypeId) {
        this.selectedKeys = [data.selectedCkTypeId];
      }
    }

    // Set up search debouncing
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.skip = 0;
        this.loadTypes();
      })
    );

    // Load initial types and extract available models
    this.loadTypes();
    this.loadAvailableModels();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadTypes(): void {
    this.isLoading = true;

    const ckModelIds = this.selectedModel
      ? [this.selectedModel]
      : this.initialCkModelIds;

    this.subscriptions.add(
      this.ckTypeSelectorService.getCkTypes({
        ckModelIds,
        searchText: this.searchText || undefined,
        first: this.pageSize,
        skip: this.skip
      }).subscribe({
        next: result => {
          this.gridData = {
            data: result.items,
            total: result.totalCount
          };

          // Restore selection if exists
          if (this.selectedKeys.length > 0) {
            const selectedItem = result.items.find(item => item.fullName === this.selectedKeys[0]);
            if (selectedItem) {
              this.selectedType = selectedItem;
            }
          }

          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.gridData = { data: [], total: 0 };
        }
      })
    );
  }

  private loadAvailableModels(): void {
    // Load all types to extract unique models
    this.subscriptions.add(
      this.ckTypeSelectorService.getCkTypes({
        first: 1000
      }).subscribe(result => {
        const modelSet = new Set<string>();
        result.items.forEach(item => {
          // Extract model from fullName (format: "ModelName-Version/TypeName-Version")
          const modelMatch = item.fullName.match(/^([^/]+)\//);
          if (modelMatch) {
            modelSet.add(modelMatch[1]);
          }
        });
        this.availableModels = Array.from(modelSet).sort();
      })
    );
  }

  public onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  public onModelFilterChange(_value: string | null): void {
    this.skip = 0;
    this.loadTypes();
  }

  public clearFilters(): void {
    this.searchText = '';
    this.selectedModel = null;
    this.skip = 0;
    this.loadTypes();
  }

  public onPageChange(event: PageChangeEvent): void {
    this.skip = event.skip;
    this.pageSize = event.take;
    this.loadTypes();
  }

  public onSelectionChange(event: SelectionEvent): void {
    const selectedItems = event.selectedRows;
    if (selectedItems && selectedItems.length > 0) {
      this.selectedType = selectedItems[0].dataItem as CkTypeSelectorItem;
    } else {
      this.selectedType = null;
    }
  }

  public onCancel(): void {
    this.dialog.close();
  }

  public onConfirm(): void {
    if (this.selectedType) {
      const result: CkTypeSelectorDialogResult = {
        selectedCkType: this.selectedType
      };
      this.dialog.close(result);
    }
  }
}
