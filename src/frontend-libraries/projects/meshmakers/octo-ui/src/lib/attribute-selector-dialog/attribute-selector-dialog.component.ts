import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowModule, WindowRef } from '@progress/kendo-angular-dialog';
import { GridModule, GridDataResult, CellClickEvent } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { IconsModule } from '@progress/kendo-angular-icons';
import { arrowRightIcon, arrowLeftIcon, searchIcon, arrowUpIcon, arrowDownIcon, chevronDoubleRightIcon, chevronDoubleLeftIcon } from '@progress/kendo-svg-icons';
import { AttributeSelectorService, AttributeItem, AttributeValueTypeDto } from '@meshmakers/octo-services';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface AttributeSelectorDialogData {
  rtCkTypeId: string;
  selectedAttributes?: string[];
  dialogTitle?: string;
  singleSelect?: boolean;
  includeNavigationProperties?: boolean;
  maxDepth?: number;
  /** Additional virtual attributes to include in the available list (e.g., Timestamp for stream data queries) */
  additionalAttributes?: AttributeItem[];
  /** When true, hides the navigation properties checkbox and max depth controls */
  hideNavigationControls?: boolean;
  /** When set, restricts the available attributes to only these attribute paths (filtered client-side after fetching) */
  attributePaths?: string[];
}

export interface AttributeSelectorDialogResult {
  selectedAttributes: AttributeItem[];
}

interface ValueTypeFilterOption {
  text: string;
  value: AttributeValueTypeDto | null;
}

@Component({
  selector: 'mm-attribute-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridModule,
    ButtonsModule,
    InputsModule,
    DropDownListModule,
    IconsModule,
    WindowModule
  ],
  template: `
    <div class="attribute-selector-container">
      <div class="filter-container">
        <kendo-textbox
          [(ngModel)]="searchText"
          (ngModelChange)="onSearchChange($event)"
          placeholder="Search path & description..."
          class="search-input">
          <ng-template kendoTextBoxSuffixTemplate>
            <button kendoButton [svgIcon]="searchIcon" fillMode="clear"></button>
          </ng-template>
        </kendo-textbox>
        <kendo-dropdownlist
          [data]="valueTypeOptions"
          [(ngModel)]="selectedValueTypeFilter"
          (valueChange)="onValueTypeFilterChange($event)"
          textField="text"
          valueField="value"
          [valuePrimitive]="true"
          class="type-filter-dropdown">
        </kendo-dropdownlist>
      </div>

      @if (!hideNavigationControls) {
        <div class="options-container">
          <input type="checkbox" kendoCheckBox
            [(ngModel)]="includeNavigationProperties"
            (ngModelChange)="onNavigationPropertiesChange()" />
          <label class="option-label">Include Navigation Properties</label>

          <kendo-numerictextbox
            [(ngModel)]="maxDepth"
            [min]="1" [max]="5" [step]="1" [format]="'n0'"
            [placeholder]="'Depth'"
            [spinners]="true"
            [disabled]="!includeNavigationProperties"
            (valueChange)="onMaxDepthChange($event)"
            class="depth-input">
          </kendo-numerictextbox>
          <label class="option-label">Max Depth</label>
        </div>
      }

      <div class="lists-container" *ngIf="!singleSelect">
        <div class="list-section">
          <h4>Available Attributes</h4>
          <kendo-grid
            [data]="availableGridData"
            [scrollable]="'scrollable'"
            [selectable]="{ mode: 'multiple', enabled: true }"
            [kendoGridSelectBy]="'attributePath'"
            [(selectedKeys)]="selectedAvailableKeys"
            (cellClick)="onAvailableCellClick($event)"
            [resizable]="true"
            class="attribute-grid">
            <kendo-grid-column field="attributePath" title="Attribute Path" [width]="250"></kendo-grid-column>
            <kendo-grid-column field="attributeValueType" title="Type" [width]="100"></kendo-grid-column>
            <kendo-grid-column field="description" title="Description"></kendo-grid-column>
          </kendo-grid>
        </div>

        <div class="action-buttons">
          <button
            kendoButton
            [svgIcon]="arrowRightIcon"
            [disabled]="selectedAvailableKeys.length === 0"
            (click)="addSelected()"
            title="Add selected">
          </button>
          <button
            kendoButton
            [svgIcon]="arrowLeftIcon"
            [disabled]="selectedChosenKeys.length === 0"
            (click)="removeSelected()"
            title="Remove selected">
          </button>
          <div class="separator"></div>
          <button
            kendoButton
            [svgIcon]="chevronDoubleRightIcon"
            [disabled]="availableAttributes.length === 0"
            (click)="addAll()"
            title="Add all">
          </button>
          <button
            kendoButton
            [svgIcon]="chevronDoubleLeftIcon"
            [disabled]="selectedAttributes.length === 0"
            (click)="removeAll()"
            title="Remove all">
          </button>
        </div>

        <div class="list-section">
          <h4>Selected Attributes ({{ selectedAttributes.length }})</h4>
          <kendo-grid
            [data]="selectedGridData"
            [scrollable]="'scrollable'"
            [selectable]="{ mode: 'single', enabled: true }"
            [kendoGridSelectBy]="'attributePath'"
            [(selectedKeys)]="selectedChosenKeys"
            (cellClick)="onSelectedCellClick($event)"
            [resizable]="true"
            class="attribute-grid">
            <kendo-grid-column field="attributePath" title="Attribute Path" [width]="200">
              <ng-template kendoGridCellTemplate let-dataItem let-rowIndex="rowIndex">
                <span class="order-number">{{ rowIndex + 1 }}.</span>
                {{ dataItem.attributePath }}
              </ng-template>
            </kendo-grid-column>
            <kendo-grid-column field="attributeValueType" title="Type" [width]="100"></kendo-grid-column>
          </kendo-grid>
        </div>

        <div class="order-buttons">
          <button
            kendoButton
            [svgIcon]="arrowUpIcon"
            [disabled]="!canMoveUp()"
            (click)="moveUp()"
            title="Move up">
          </button>
          <button
            kendoButton
            [svgIcon]="arrowDownIcon"
            [disabled]="!canMoveDown()"
            (click)="moveDown()"
            title="Move down">
          </button>
        </div>
      </div>

      <div class="single-select-container" *ngIf="singleSelect">
        <kendo-grid
          [data]="availableGridData"
          [scrollable]="'scrollable'"
          [selectable]="{ mode: 'single', enabled: true }"
          [kendoGridSelectBy]="'attributePath'"
          [(selectedKeys)]="selectedSingleKey"
          (cellClick)="onSingleSelectCellClick($event)"
          [resizable]="true"
          class="attribute-grid">
          <kendo-grid-column field="attributePath" title="Attribute Path" [width]="250"></kendo-grid-column>
          <kendo-grid-column field="attributeValueType" title="Type" [width]="100"></kendo-grid-column>
          <kendo-grid-column field="description" title="Description"></kendo-grid-column>
        </kendo-grid>
      </div>

      <div class="action-bar">
        <button kendoButton (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" [disabled]="singleSelect && selectedSingleKey.length === 0" (click)="onConfirm()">OK</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .attribute-selector-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px 20px;
      box-sizing: border-box;
      gap: 16px;
    }

    .filter-container {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
    }

    .type-filter-dropdown {
      width: 160px;
      flex-shrink: 0;
    }

    .options-container {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .option-label {
      cursor: pointer;
    }

    .depth-input {
      width: 90px;
    }

    .lists-container {
      display: flex;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }

    .list-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .list-section h4 {
      margin: 0 0 10px 0;
      font-size: 0.85rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .attribute-grid {
      border-radius: 4px;
      flex: 1;
      min-height: 200px;
    }

    .attribute-grid ::ng-deep .k-grid-table tbody tr {
      cursor: pointer;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
      padding: 0 8px;
      padding-top: 32px;
    }

    .separator {
      height: 1px;
      background-color: var(--kendo-color-border, #dee2e6);
      margin: 8px 0;
    }

    .order-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
      padding: 0 8px;
      padding-top: 32px;
    }

    .order-number {
      color: var(--kendo-color-primary, #ff6358);
      font-weight: 600;
      margin-right: 8px;
      min-width: 24px;
      display: inline-block;
    }

    .single-select-container {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .single-select-container .attribute-grid {
      flex: 1;
    }

    .action-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 8px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }
  `]
})
export class AttributeSelectorDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);
  private readonly attributeService = inject(AttributeSelectorService);
  private searchSubject = new Subject<string>();

  protected readonly arrowRightIcon = arrowRightIcon;
  protected readonly arrowLeftIcon = arrowLeftIcon;
  protected readonly chevronDoubleRightIcon = chevronDoubleRightIcon;
  protected readonly chevronDoubleLeftIcon = chevronDoubleLeftIcon;
  protected readonly searchIcon = searchIcon;
  protected readonly arrowUpIcon = arrowUpIcon;
  protected readonly arrowDownIcon = arrowDownIcon;

  private _data!: AttributeSelectorDialogData;
  public get data(): AttributeSelectorDialogData { return this._data; }
  public set data(value: AttributeSelectorDialogData) {
    this._data = value;
    if (value) {
      this.initializeFromData(value);
    }
  }

  public dialogTitle = 'Select Attributes';
  public rtCkTypeId!: string;
  public singleSelect = false;
  private additionalAttributes: AttributeItem[] = [];
  public searchText = '';
  public selectedSingleKey: string[] = [];
  public selectedValueTypeFilter: AttributeValueTypeDto | null = null;
  public includeNavigationProperties = true;
  public maxDepth: number | null = null;
  public hideNavigationControls = false;
  private attributePathsSet: Set<string> | null = null;

  public availableAttributes: AttributeItem[] = [];
  public selectedAttributes: AttributeItem[] = [];

  public availableGridData: GridDataResult = { data: [], total: 0 };
  public selectedGridData: GridDataResult = { data: [], total: 0 };

  public selectedAvailableKeys: string[] = [];
  public selectedChosenKeys: string[] = [];

  public valueTypeOptions: ValueTypeFilterOption[] = [
    { text: 'All Types', value: null },
    { text: 'String', value: AttributeValueTypeDto.StringDto },
    { text: 'Integer', value: AttributeValueTypeDto.IntegerDto },
    { text: 'Double', value: AttributeValueTypeDto.DoubleDto },
    { text: 'Boolean', value: AttributeValueTypeDto.BooleanDto },
    { text: 'DateTime', value: AttributeValueTypeDto.DateTimeDto },
    { text: 'DateTimeOffset', value: AttributeValueTypeDto.DateTimeOffsetDto },
    { text: 'Enum', value: AttributeValueTypeDto.EnumDto },
    { text: 'TimeSpan', value: AttributeValueTypeDto.TimeSpanDto }
  ];

  // Double-click tracking
  private lastClickTime = 0;
  private lastClickedItem: string | null = null;
  private readonly doubleClickDelay = 300; // milliseconds

  ngOnInit(): void {
    // Set up search debouncing (always, regardless of data timing)
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.loadAvailableAttributes(searchText);
    });
  }

  private initializeFromData(data: AttributeSelectorDialogData): void {
    this.rtCkTypeId = data.rtCkTypeId;
    this.dialogTitle = data.dialogTitle || 'Select Attributes';
    this.singleSelect = data.singleSelect ?? false;
    this.includeNavigationProperties = data.includeNavigationProperties ?? true;
    this.maxDepth = data.maxDepth ?? null;
    this.additionalAttributes = data.additionalAttributes ?? [];
    this.hideNavigationControls = data.hideNavigationControls ?? false;
    this.attributePathsSet = data.attributePaths ? new Set(data.attributePaths) : null;

    if (data.selectedAttributes && data.selectedAttributes.length > 0) {
      if (this.singleSelect) {
        this.selectedSingleKey = [data.selectedAttributes[0]];
      } else {
        this.loadInitialSelectedAttributes(data.selectedAttributes);
      }
    }

    // Load initial attributes
    this.loadAvailableAttributes();
  }

  private loadAvailableAttributes(searchTerm?: string): void {
    this.attributeService.getAvailableAttributes(
      this.rtCkTypeId, undefined, undefined, undefined,
      this.selectedValueTypeFilter || undefined,
      searchTerm || undefined,
      this.includeNavigationProperties,
      this.maxDepth ?? undefined
    ).subscribe(result => {
      // Filter out already selected attributes
      const selectedPaths = new Set(this.selectedAttributes.map(a => a.attributePath));

      // Apply client-side attribute path restriction if set (additionalAttributes bypass this filter intentionally)
      const filteredItems = this.attributePathsSet
        ? result.items.filter(item => this.attributePathsSet!.has(item.attributePath))
        : result.items;

      // Include additional virtual attributes (e.g., Timestamp for stream data), filtered by search/type
      const filteredAdditional = this.additionalAttributes.filter(attr => {
        if (selectedPaths.has(attr.attributePath)) return false;
        if (searchTerm && !attr.attributePath.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (this.selectedValueTypeFilter && attr.attributeValueType !== this.selectedValueTypeFilter) return false;
        return true;
      });

      this.availableAttributes = [
        ...filteredAdditional,
        ...filteredItems.filter(item => !selectedPaths.has(item.attributePath))
      ];
      this.updateAvailableGrid();
    });
  }

  private loadInitialSelectedAttributes(attributePaths: string[]): void {
    // Load all attributes to get the details for selected ones
    this.attributeService.getAvailableAttributes(
      this.rtCkTypeId, undefined, undefined, undefined,
      undefined, undefined,
      this.includeNavigationProperties,
      this.maxDepth ?? undefined
    ).subscribe(result => {
      // Create a map for quick lookup, including additional virtual attributes
      const attributeMap = new Map(result.items.map(item => [item.attributePath, item]));
      for (const attr of this.additionalAttributes) {
        attributeMap.set(attr.attributePath, attr);
      }

      // Preserve the order from attributePaths
      this.selectedAttributes = attributePaths
        .map(path => attributeMap.get(path))
        .filter((item): item is AttributeItem => item !== undefined);

      this.updateSelectedGrid();

      // Filter out selected from available, and apply attributePathsSet restriction
      const selectedPaths = new Set(this.selectedAttributes.map(a => a.attributePath));
      const filteredItems = this.attributePathsSet
        ? result.items.filter(item => this.attributePathsSet!.has(item.attributePath))
        : result.items;
      this.availableAttributes = [
        ...this.additionalAttributes.filter(attr => !selectedPaths.has(attr.attributePath)),
        ...filteredItems.filter(item => !selectedPaths.has(item.attributePath))
      ];
      this.updateAvailableGrid();
    });
  }

  public onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  public onValueTypeFilterChange(_value: AttributeValueTypeDto | null): void {
    this.loadAvailableAttributes(this.searchText || undefined);
  }

  public onNavigationPropertiesChange(): void {
    if (!this.includeNavigationProperties) {
      this.maxDepth = null;
    }
    this.loadAvailableAttributes(this.searchText || undefined);
  }

  public onMaxDepthChange(value: number | null): void {
    this.maxDepth = value;
    this.loadAvailableAttributes(this.searchText || undefined);
  }

  public addSelected(): void {
    const itemsToAdd = this.availableAttributes.filter(
      item => this.selectedAvailableKeys.includes(item.attributePath)
    );

    this.selectedAttributes.push(...itemsToAdd);
    this.availableAttributes = this.availableAttributes.filter(
      item => !this.selectedAvailableKeys.includes(item.attributePath)
    );

    this.selectedAvailableKeys = [];
    this.updateGrids();
  }

  public removeSelected(): void {
    const itemsToRemove = this.selectedAttributes.filter(
      item => this.selectedChosenKeys.includes(item.attributePath)
    );

    this.availableAttributes.push(...itemsToRemove);
    this.selectedAttributes = this.selectedAttributes.filter(
      item => !this.selectedChosenKeys.includes(item.attributePath)
    );

    this.selectedChosenKeys = [];
    this.sortAvailableAttributes();
    this.updateGrids();
  }

  public addAll(): void {
    this.selectedAttributes.push(...this.availableAttributes);
    this.availableAttributes = [];
    this.selectedAvailableKeys = [];
    this.updateGrids();
  }

  public removeAll(): void {
    this.availableAttributes.push(...this.selectedAttributes);
    this.selectedAttributes = [];
    this.selectedChosenKeys = [];
    this.sortAvailableAttributes();
    this.updateGrids();
  }

  private sortAvailableAttributes(): void {
    this.availableAttributes.sort((a, b) =>
      a.attributePath.localeCompare(b.attributePath)
    );
  }

  public canMoveUp(): boolean {
    if (this.selectedChosenKeys.length !== 1) return false;
    const index = this.selectedAttributes.findIndex(
      a => a.attributePath === this.selectedChosenKeys[0]
    );
    return index > 0;
  }

  public canMoveDown(): boolean {
    if (this.selectedChosenKeys.length !== 1) return false;
    const index = this.selectedAttributes.findIndex(
      a => a.attributePath === this.selectedChosenKeys[0]
    );
    return index >= 0 && index < this.selectedAttributes.length - 1;
  }

  public moveUp(): void {
    if (!this.canMoveUp()) return;
    const index = this.selectedAttributes.findIndex(
      a => a.attributePath === this.selectedChosenKeys[0]
    );
    [this.selectedAttributes[index - 1], this.selectedAttributes[index]] =
      [this.selectedAttributes[index], this.selectedAttributes[index - 1]];
    this.updateSelectedGrid();
  }

  public moveDown(): void {
    if (!this.canMoveDown()) return;
    const index = this.selectedAttributes.findIndex(
      a => a.attributePath === this.selectedChosenKeys[0]
    );
    [this.selectedAttributes[index], this.selectedAttributes[index + 1]] =
      [this.selectedAttributes[index + 1], this.selectedAttributes[index]];
    this.updateSelectedGrid();
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

  public onCancel(): void {
    this.windowRef.close();
  }

  public onConfirm(): void {
    if (this.singleSelect) {
      const selected = this.availableAttributes.find(
        a => a.attributePath === this.selectedSingleKey[0]
      );
      const result: AttributeSelectorDialogResult = {
        selectedAttributes: selected ? [selected] : []
      };
      this.windowRef.close(result);
    } else {
      const result: AttributeSelectorDialogResult = {
        selectedAttributes: this.selectedAttributes
      };
      this.windowRef.close(result);
    }
  }

  /**
   * Handle cell click on available attributes grid to detect double-click
   */
  public onAvailableCellClick(event: CellClickEvent): void {
    const dataItem = event.dataItem as AttributeItem;
    if (!dataItem) return;

    const currentTime = Date.now();
    const attributePath = dataItem.attributePath;

    if (
      this.lastClickedItem === attributePath &&
      currentTime - this.lastClickTime <= this.doubleClickDelay
    ) {
      // Double-click detected - move attribute to selected
      this.moveAttributeToSelected(dataItem);
      // Reset to prevent triple-click
      this.lastClickTime = 0;
      this.lastClickedItem = null;
    } else {
      // Single click - just update tracking
      this.lastClickTime = currentTime;
      this.lastClickedItem = attributePath;
    }
  }

  /**
   * Handle cell click on selected attributes grid to detect double-click
   */
  public onSelectedCellClick(event: CellClickEvent): void {
    const dataItem = event.dataItem as AttributeItem;
    if (!dataItem) return;

    const currentTime = Date.now();
    const attributePath = dataItem.attributePath;

    if (
      this.lastClickedItem === attributePath &&
      currentTime - this.lastClickTime <= this.doubleClickDelay
    ) {
      // Double-click detected - move attribute to available
      this.moveAttributeToAvailable(dataItem);
      // Reset to prevent triple-click
      this.lastClickTime = 0;
      this.lastClickedItem = null;
    } else {
      // Single click - just update tracking
      this.lastClickTime = currentTime;
      this.lastClickedItem = attributePath;
    }
  }

  /**
   * Handle cell click on single-select grid to detect double-click (confirm immediately)
   */
  public onSingleSelectCellClick(event: CellClickEvent): void {
    const dataItem = event.dataItem as AttributeItem;
    if (!dataItem) return;

    const currentTime = Date.now();
    const attributePath = dataItem.attributePath;

    if (
      this.lastClickedItem === attributePath &&
      currentTime - this.lastClickTime <= this.doubleClickDelay
    ) {
      // Double-click detected - confirm immediately
      this.selectedSingleKey = [attributePath];
      this.onConfirm();
      this.lastClickTime = 0;
      this.lastClickedItem = null;
    } else {
      this.lastClickTime = currentTime;
      this.lastClickedItem = attributePath;
    }
  }

  /**
   * Move a single attribute from available to selected
   */
  private moveAttributeToSelected(attribute: AttributeItem): void {
    // Remove from available
    this.availableAttributes = this.availableAttributes.filter(
      item => item.attributePath !== attribute.attributePath
    );

    // Add to selected
    this.selectedAttributes.push(attribute);

    // Clear selections
    this.selectedAvailableKeys = this.selectedAvailableKeys.filter(
      key => key !== attribute.attributePath
    );

    this.updateGrids();
  }

  /**
   * Move a single attribute from selected to available
   */
  private moveAttributeToAvailable(attribute: AttributeItem): void {
    // Remove from selected
    this.selectedAttributes = this.selectedAttributes.filter(
      item => item.attributePath !== attribute.attributePath
    );

    // Add to available
    this.availableAttributes.push(attribute);

    // Clear selections
    this.selectedChosenKeys = this.selectedChosenKeys.filter(
      key => key !== attribute.attributePath
    );

    // Sort available attributes
    this.sortAvailableAttributes();
    this.updateGrids();
  }
}
