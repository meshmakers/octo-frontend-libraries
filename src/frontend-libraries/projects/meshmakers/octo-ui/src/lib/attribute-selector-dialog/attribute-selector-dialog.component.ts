import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogRef, DialogModule, DialogContentBase } from '@progress/kendo-angular-dialog';
import { GridModule, GridDataResult, CellClickEvent } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { IconsModule } from '@progress/kendo-angular-icons';
import { arrowRightIcon, arrowLeftIcon, searchIcon, arrowUpIcon, arrowDownIcon, chevronDoubleRightIcon, chevronDoubleLeftIcon } from '@progress/kendo-svg-icons';
import { AttributeSelectorService, AttributeItem } from '@meshmakers/octo-services';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface AttributeSelectorDialogData {
  rtCkTypeId: string;
  selectedAttributes?: string[];
  dialogTitle?: string;
}

export interface AttributeSelectorDialogResult {
  selectedAttributes: AttributeItem[];
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
    IconsModule,
    DialogModule
  ],
  template: `
    <div class="attribute-selector-container">
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

      <div class="lists-container">
        <div class="list-section">
          <h4>Available Attributes</h4>
          <kendo-grid
            [data]="availableGridData"
            [height]="350"
            [scrollable]="'scrollable'"
            [selectable]="{ mode: 'multiple', enabled: true }"
            [kendoGridSelectBy]="'attributePath'"
            [(selectedKeys)]="selectedAvailableKeys"
            (cellClick)="onAvailableCellClick($event)"
            class="attribute-grid">
            <kendo-grid-column field="attributePath" title="Attribute Path" [width]="200"></kendo-grid-column>
            <kendo-grid-column field="attributeValueType" title="Type" [width]="100"></kendo-grid-column>
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
            [height]="350"
            [scrollable]="'scrollable'"
            [selectable]="{ mode: 'single', enabled: true }"
            [kendoGridSelectBy]="'attributePath'"
            [(selectedKeys)]="selectedChosenKeys"
            (cellClick)="onSelectedCellClick($event)"
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
    </div>

    <kendo-dialog-actions>
      <button kendoButton (click)="onCancel()">Cancel</button>
      <button kendoButton themeColor="primary" (click)="onConfirm()">OK</button>
    </kendo-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    .attribute-selector-container {
      display: flex;
      flex-direction: column;
      padding: 16px 20px;
      min-width: 800px;
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

    .list-section h4 {
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
  `]
})
export class AttributeSelectorDialogComponent extends DialogContentBase implements OnInit {
  private readonly attributeService = inject(AttributeSelectorService);
  private searchSubject = new Subject<string>();

  constructor() {
    super(inject(DialogRef));
  }

  protected readonly arrowRightIcon = arrowRightIcon;
  protected readonly arrowLeftIcon = arrowLeftIcon;
  protected readonly chevronDoubleRightIcon = chevronDoubleRightIcon;
  protected readonly chevronDoubleLeftIcon = chevronDoubleLeftIcon;
  protected readonly searchIcon = searchIcon;
  protected readonly arrowUpIcon = arrowUpIcon;
  protected readonly arrowDownIcon = arrowDownIcon;

  public dialogTitle = 'Select Attributes';
  public rtCkTypeId!: string;
  public searchText = '';

  public availableAttributes: AttributeItem[] = [];
  public selectedAttributes: AttributeItem[] = [];

  public availableGridData: GridDataResult = { data: [], total: 0 };
  public selectedGridData: GridDataResult = { data: [], total: 0 };

  public selectedAvailableKeys: string[] = [];
  public selectedChosenKeys: string[] = [];

  // Double-click tracking
  private lastClickTime = 0;
  private lastClickedItem: string | null = null;
  private readonly doubleClickDelay = 300; // milliseconds

  ngOnInit(): void {
    const data = (this.dialog.content as any)?.instance?.data as AttributeSelectorDialogData;

    if (data) {
      this.rtCkTypeId = data.rtCkTypeId;
      this.dialogTitle = data.dialogTitle || 'Select Attributes';

      if (data.selectedAttributes && data.selectedAttributes.length > 0) {
        // Pre-populate selected attributes if provided
        this.loadInitialSelectedAttributes(data.selectedAttributes);
      }
    }

    // Set up search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.loadAvailableAttributes(searchText);
    });

    // Load initial attributes
    this.loadAvailableAttributes();
  }

  private loadAvailableAttributes(filter?: string): void {
    this.attributeService.getAvailableAttributes(this.rtCkTypeId, filter).subscribe(result => {
      // Filter out already selected attributes
      const selectedPaths = new Set(this.selectedAttributes.map(a => a.attributePath));
      this.availableAttributes = result.items.filter(item => !selectedPaths.has(item.attributePath));
      this.updateAvailableGrid();
    });
  }

  private loadInitialSelectedAttributes(attributePaths: string[]): void {
    // Load all attributes to get the details for selected ones
    this.attributeService.getAvailableAttributes(this.rtCkTypeId).subscribe(result => {
      // Create a map for quick lookup
      const attributeMap = new Map(result.items.map(item => [item.attributePath, item]));

      // Preserve the order from attributePaths
      this.selectedAttributes = attributePaths
        .map(path => attributeMap.get(path))
        .filter((item): item is AttributeItem => item !== undefined);

      this.updateSelectedGrid();

      // Filter out selected from available
      const selectedPaths = new Set(this.selectedAttributes.map(a => a.attributePath));
      this.availableAttributes = result.items.filter(item => !selectedPaths.has(item.attributePath));
      this.updateAvailableGrid();
    });
  }

  public onSearchChange(value: string): void {
    this.searchSubject.next(value);
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
    this.dialog.close();
  }

  public onConfirm(): void {
    const result: AttributeSelectorDialogResult = {
      selectedAttributes: this.selectedAttributes
    };
    this.dialog.close(result);
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
