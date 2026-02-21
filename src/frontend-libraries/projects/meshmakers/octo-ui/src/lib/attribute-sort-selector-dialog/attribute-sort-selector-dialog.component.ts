import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridModule, GridDataResult, CellClickEvent } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { IconsModule } from '@progress/kendo-angular-icons';
import { searchIcon, sortAscSmallIcon, sortDescSmallIcon } from '@progress/kendo-svg-icons';
import { AttributeSelectorService, AttributeItem } from '@meshmakers/octo-services';
import { DialogContentBase, DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface AttributeSortItem {
  attributePath: string;
  attributeValueType: string;
  sortOrder: 'standard' | 'ascending' | 'descending';
}

export interface AttributeSortSelectorDialogData {
  ckTypeId: string;
  selectedAttributes?: AttributeSortItem[];
  dialogTitle?: string;
}

export interface AttributeSortSelectorDialogResult {
  selectedAttributes: AttributeSortItem[];
}

export interface SortOption {
  text: string;
  value: 'standard' | 'ascending' | 'descending';
}

@Component({
  selector: 'mm-attribute-sort-selector-dialog',
  standalone: true,
  host: { 'data-component': 'attribute-sort-selector' },
  imports: [
    CommonModule,
    FormsModule,
    GridModule,
    ButtonsModule,
    InputsModule,
    DropDownListModule,
    IconsModule,
    DialogModule
  ],
  template: `
      <div class="attribute-sort-selector-container">
        <!-- Search Section -->
        <div class="search-container">
          <kendo-textbox
            [(ngModel)]="searchText"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search attributes..."
            class="search-input">
            <ng-template kendoTextBoxSuffixTemplate>
              <button kendoButton [svgIcon]="searchIcon" fillMode="clear"></button>
            </ng-template>
          </kendo-textbox>
        </div>

        <!-- Main Content Area - All side by side -->
        <div class="lists-container">
          <!-- Available Attributes -->
          <div class="list-section">
            <h4>Available Attributes</h4>
            <kendo-grid
              [data]="availableGridData"
              [height]="350"
              [scrollable]="'scrollable'"
              [selectable]="{ mode: 'single', enabled: true }"
              [kendoGridSelectBy]="'attributePath'"
              [(selectedKeys)]="selectedAvailableKeys"
              (cellClick)="onAvailableCellClick($event)"
              class="attribute-grid">
              <kendo-grid-column field="attributePath" title="Attribute Path" [width]="200"></kendo-grid-column>
              <kendo-grid-column field="attributeValueType" title="Type" [width]="140"></kendo-grid-column>
            </kendo-grid>
          </div>

          <!-- Sort Options in center -->
          <div class="sort-options-section">
            <h4>Sort Order</h4>
            <div class="sort-buttons">
              <button
                kendoButton
                [fillMode]="currentSortOrder === 'standard' ? 'solid' : 'outline'"
                [themeColor]="currentSortOrder === 'standard' ? 'primary' : 'base'"
                (click)="setSortOrder('standard')"
                class="sort-button"
                title="Standard (no sort)">
                —
              </button>
              <button
                kendoButton
                [svgIcon]="sortAscIcon"
                [fillMode]="currentSortOrder === 'ascending' ? 'solid' : 'outline'"
                [themeColor]="currentSortOrder === 'ascending' ? 'primary' : 'base'"
                (click)="setSortOrder('ascending')"
                class="sort-button"
                title="Ascending">
              </button>
              <button
                kendoButton
                [svgIcon]="sortDescIcon"
                [fillMode]="currentSortOrder === 'descending' ? 'solid' : 'outline'"
                [themeColor]="currentSortOrder === 'descending' ? 'primary' : 'base'"
                (click)="setSortOrder('descending')"
                class="sort-button"
                title="Descending">
              </button>
            </div>

            <button
              kendoButton
              themeColor="primary"
              [disabled]="selectedAvailableKeys.length === 0"
              (click)="addAttributeWithSort()"
              class="add-button">
              Add →
            </button>
          </div>

          <!-- Selected Attributes -->
          <div class="list-section">
            <h4>Selected ({{ selectedAttributes.length }})</h4>
            <kendo-grid
              [data]="selectedGridData"
              [height]="350"
              [scrollable]="'scrollable'"
              [selectable]="{ mode: 'single', enabled: true }"
              [kendoGridSelectBy]="'attributePath'"
              [(selectedKeys)]="selectedChosenKeys"
              (cellClick)="onSelectedCellClick($event)"
              class="attribute-grid">
              <kendo-grid-column field="attributePath" title="Attribute Path" [width]="180"></kendo-grid-column>
              <kendo-grid-column field="sortOrder" title="Sort" [width]="100">
                <ng-template kendoGridCellTemplate let-dataItem>
                  <div class="sort-display">
                    <span class="sort-indicator">{{ getSortIndicator(dataItem.sortOrder) }}</span>
                    <span>{{ getSortText(dataItem.sortOrder) }}</span>
                  </div>
                </ng-template>
              </kendo-grid-column>
              <kendo-grid-column title="" [width]="50">
                <ng-template kendoGridCellTemplate let-dataItem>
                  <button
                    kendoButton
                    size="small"
                    fillMode="flat"
                    (click)="removeAttribute(dataItem)"
                    title="Remove">
                    ✕
                  </button>
                </ng-template>
              </kendo-grid-column>
            </kendo-grid>
          </div>
        </div>
      </div>

      <kendo-dialog-actions>
        <button kendoButton (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onOk()">Apply</button>
      </kendo-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    .attribute-sort-selector-container {
      display: flex;
      flex-direction: column;
      padding: 16px 20px;
      min-width: 1000px;
      box-sizing: border-box;
      gap: 16px;
    }

    .search-container {
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
    }

    .lists-container {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .list-section {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .list-section h4, .sort-options-section h4 {
      margin: 0 0 10px 0;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .attribute-grid {
      border-radius: 4px;
    }

    .attribute-grid ::ng-deep .k-grid-table tbody tr {
      cursor: pointer;
    }

    .sort-options-section {
      width: 120px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      padding-top: 32px;
    }

    .sort-buttons {
      display: flex;
      flex-direction: row;
      gap: 4px;
    }

    .sort-button {
      flex: 1;
      min-width: 36px;
      height: 36px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .add-button {
      width: 100%;
      margin-top: 16px;
    }

    .sort-display {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sort-indicator {
      font-size: 14px;
      font-weight: bold;
      color: var(--kendo-color-primary, #ff6358);
    }
  `]
})
export class AttributeSortSelectorDialogComponent extends DialogContentBase implements OnInit {
  private readonly attributeService = inject(AttributeSelectorService);
  private searchSubject = new Subject<string>();

  constructor() {
    super(inject(DialogRef));
  }

  // Dialog data
  public ckTypeId!: string;
  public searchText = '';
  public currentSortOrder: 'standard' | 'ascending' | 'descending' = 'standard';

  // Grid data
  public availableAttributes: AttributeItem[] = [];
  public selectedAttributes: AttributeSortItem[] = [];
  public availableGridData: GridDataResult = { data: [], total: 0 };
  public selectedGridData: GridDataResult = { data: [], total: 0 };

  // Selection tracking
  public selectedAvailableKeys: string[] = [];
  public selectedChosenKeys: string[] = [];

  // Double-click tracking
  private lastClickTime = 0;
  private lastClickedItem: string | null = null;
  private readonly doubleClickDelay = 300;

  // UI configuration
  public dialogTitle = 'Select Attributes with Sort Order';

  public sortOptions: SortOption[] = [
    { text: 'Standard', value: 'standard' },
    { text: 'Ascending', value: 'ascending' },
    { text: 'Descending', value: 'descending' }
  ];

  // Icons
  protected readonly searchIcon = searchIcon;
  protected readonly sortAscIcon = sortAscSmallIcon;
  protected readonly sortDescIcon = sortDescSmallIcon;

  ngOnInit(): void {
    // Get dialog data
    const data = (this.dialog.content as any)?.instance?.data as AttributeSortSelectorDialogData;
    console.log('ngOnInit - received data:', data);

    if (data) {
      this.ckTypeId = data.ckTypeId;
      this.dialogTitle = data.dialogTitle || 'Select Attributes with Sort Order';
      console.log('Set ckTypeId:', this.ckTypeId);

      if (data.selectedAttributes && data.selectedAttributes.length > 0) {
        this.selectedAttributes = [...data.selectedAttributes];
        this.updateSelectedGrid();
        console.log('Pre-populated selectedAttributes:', this.selectedAttributes);
      }
    } else {
      console.warn('No dialog data received');
    }

    // Set up search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.loadAvailableAttributes(searchText);
    });

    // Load initial data
    this.loadAvailableAttributes();
  }

  private loadAvailableAttributes(filter?: string): void {
    this.attributeService.getAvailableAttributes(this.ckTypeId, filter).subscribe(result => {
      // Filter out already selected attributes
      const selectedPaths = new Set(this.selectedAttributes.map(a => a.attributePath));
      this.availableAttributes = result.items.filter(item => !selectedPaths.has(item.attributePath));
      this.updateAvailableGrid();
    });
  }

  public onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  public setSortOrder(order: 'standard' | 'ascending' | 'descending'): void {
    this.currentSortOrder = order;
  }

  public addAttributeWithSort(): void {
    if (this.selectedAvailableKeys.length === 0) return;

    const attributePath = this.selectedAvailableKeys[0];
    const attribute = this.availableAttributes.find(a => a.attributePath === attributePath);

    if (attribute) {
      this.addAttributeToSelected(attribute);
    }
  }

  public onAvailableCellClick(event: CellClickEvent): void {
    const dataItem = event.dataItem as AttributeItem;
    if (!dataItem) return;

    const currentTime = Date.now();
    const attributePath = dataItem.attributePath;

    if (
      this.lastClickedItem === attributePath &&
      currentTime - this.lastClickTime <= this.doubleClickDelay
    ) {
      // Double-click detected - add attribute with current sort
      this.addAttributeToSelected(dataItem);
      this.lastClickTime = 0;
      this.lastClickedItem = null;
    } else {
      this.lastClickTime = currentTime;
      this.lastClickedItem = attributePath;
    }
  }

  public onSelectedCellClick(event: CellClickEvent): void {
    const dataItem = event.dataItem as AttributeSortItem;
    if (!dataItem) return;

    const currentTime = Date.now();
    const attributePath = dataItem.attributePath;

    if (
      this.lastClickedItem === attributePath &&
      currentTime - this.lastClickTime <= this.doubleClickDelay
    ) {
      // Double-click detected - remove attribute
      this.removeAttribute(dataItem);
      this.lastClickTime = 0;
      this.lastClickedItem = null;
    } else {
      this.lastClickTime = currentTime;
      this.lastClickedItem = attributePath;
    }
  }

  private addAttributeToSelected(attribute: AttributeItem): void {
    console.log('Adding attribute to selected:', attribute, 'with sort order:', this.currentSortOrder);
    const sortItem: AttributeSortItem = {
      attributePath: attribute.attributePath,
      attributeValueType: attribute.attributeValueType,
      sortOrder: this.currentSortOrder
    };

    this.selectedAttributes.push(sortItem);
    console.log('Selected attributes after add:', this.selectedAttributes);

    // Remove from available
    this.availableAttributes = this.availableAttributes.filter(
      item => item.attributePath !== attribute.attributePath
    );

    // Clear selections
    this.selectedAvailableKeys = [];

    this.updateGrids();
  }

  public removeAttribute(attribute: AttributeSortItem): void {
    // Remove from selected
    this.selectedAttributes = this.selectedAttributes.filter(
      item => item.attributePath !== attribute.attributePath
    );

    // Add back to available (convert back to AttributeItem)
    const availableItem: AttributeItem = {
      attributePath: attribute.attributePath,
      attributeValueType: attribute.attributeValueType
    };

    this.availableAttributes.push(availableItem);
    this.availableAttributes.sort((a, b) => a.attributePath.localeCompare(b.attributePath));

    // Clear selections
    this.selectedChosenKeys = this.selectedChosenKeys.filter(
      key => key !== attribute.attributePath
    );

    this.updateGrids();
  }

  public getSortIndicator(sortOrder: string): string {
    switch (sortOrder) {
      case 'ascending': return '↑';
      case 'descending': return '↓';
      default: return '';
    }
  }

  public getSortText(sortOrder: string): string {
    const option = this.sortOptions.find(opt => opt.value === sortOrder);
    return option?.text || sortOrder;
  }

  private updateGrids(): void {
    this.updateAvailableGrid();
    this.updateSelectedGrid();
  }

  private updateAvailableGrid(): void {
    this.availableGridData = {
      data: this.availableAttributes,
      total: this.availableAttributes.length
    };
  }

  private updateSelectedGrid(): void {
    this.selectedGridData = {
      data: this.selectedAttributes,
      total: this.selectedAttributes.length
    };
  }

  public onOk(): void {
    console.log('onOk called, selectedAttributes:', this.selectedAttributes);
    const result: AttributeSortSelectorDialogResult = {
      selectedAttributes: this.selectedAttributes
    };
    console.log('Closing dialog with result:', result);
    this.dialog.close(result);
  }

  public onCancel(): void {
    console.log('onCancel called');
    this.dialog.close();
  }
}
