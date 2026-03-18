import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridModule } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { IconsModule } from '@progress/kendo-angular-icons';
import { PopupModule } from '@progress/kendo-angular-popup';
import { IntlModule } from '@progress/kendo-angular-intl';
// Note: Kendo locale data (de/en) should be loaded via polyfills in the consuming application
import { plusIcon, minusIcon, trashIcon, dollarIcon } from '@progress/kendo-svg-icons';
import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  AttributeValueTypeDto,
  AttributeItem,
  AttributeSelectorService
} from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';

/**
 * Variable definition for use in filter values.
 * Generic interface that can be provided by any consumer (e.g., MeshBoard).
 */
export interface FilterVariable {
  /** Variable name (without $ prefix) */
  name: string;
  /** Display label for UI */
  label?: string;
  /** Variable data type */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
}

export interface FieldFilterItem extends FieldFilterDto {
  id: number;
  /** If true, comparisonValue contains a variable reference (e.g., $myVar) */
  useVariable?: boolean;
}

type InputType = 'text' | 'number' | 'boolean' | 'datetime';

@Component({
  selector: 'mm-field-filter-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridModule,
    ButtonsModule,
    DropDownsModule,
    InputsModule,
    DateInputsModule,
    IconsModule,
    PopupModule,
    IntlModule
  ],
  template: `
    <div class="field-filter-editor">
      @if (ckTypeId && !hideNavigationProperties) {
        <div class="attribute-options">
          <label class="inline-checkbox">
            <input type="checkbox" kendoCheckBox
              [(ngModel)]="includeNavigationProperties"
              (ngModelChange)="onNavigationPropertiesChange()" />
            Include Navigation Properties
          </label>
          <label class="inline-field">
            Max Depth
            <kendo-numerictextbox
              [(ngModel)]="maxDepth"
              [min]="1" [max]="5" [step]="1" [format]="'n0'"
              [spinners]="true"
              [disabled]="!includeNavigationProperties"
              (valueChange)="onMaxDepthChange($event)"
              class="depth-input">
            </kendo-numerictextbox>
          </label>
          @if (isLoadingAttributes) {
            <span class="loading-hint">Loading...</span>
          }
        </div>
      }
      <div class="toolbar">
        <button
          kendoButton
          [svgIcon]="plusIcon"
          themeColor="primary"
          (click)="addFilter()"
          title="Add filter">
          Add Filter
        </button>
        <button
          kendoButton
          [svgIcon]="trashIcon"
          themeColor="error"
          (click)="removeSelected()"
          [disabled]="selectedKeys.length === 0"
          title="Remove selected filters">
          Remove Selected
        </button>
      </div>

      <kendo-grid
        [data]="filters"
        [selectable]="{ mode: 'multiple', enabled: true }"
        [kendoGridSelectBy]="'id'"
        [(selectedKeys)]="selectedKeys"
        class="filter-grid">

        <kendo-grid-column title="" [width]="50" [class]="'checkbox-column'">
          <ng-template kendoGridHeaderTemplate>
            <input
              type="checkbox"
              [checked]="isAllSelected()"
              [indeterminate]="isIndeterminate()"
              (change)="toggleSelectAll($event)" />
          </ng-template>
          <ng-template kendoGridCellTemplate let-dataItem>
            <input
              type="checkbox"
              [checked]="isSelected(dataItem)"
              (change)="toggleSelection(dataItem)" />
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column field="attributePath" title="Attribute Path" [width]="280">
          <ng-template kendoGridCellTemplate let-dataItem>
            @if (availableAttributes.length > 0) {
              <kendo-combobox
                [data]="filteredAttributeList"
                [(ngModel)]="dataItem.attributePath"
                (valueChange)="onAttributeChange(dataItem, $event)"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [allowCustom]="true"
                [filterable]="true"
                (filterChange)="onAttributeFilterChange($event)"
                [listHeight]="300"
                [popupSettings]="{ appendTo: 'root', animate: true }"
                class="attribute-dropdown">
                <ng-template kendoComboBoxItemTemplate let-item>
                  <div class="attribute-item">
                    <span class="attribute-path">{{ item.attributePath }}</span>
                    <span class="attribute-type">{{ item.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
            } @else {
              <kendo-textbox
                [(ngModel)]="dataItem.attributePath"
                (valueChange)="onFilterChange()"
                placeholder="Enter attribute path"
                class="attribute-input">
              </kendo-textbox>
            }
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column field="operator" title="Operator" [width]="180">
          <ng-template kendoGridCellTemplate let-dataItem>
            <kendo-dropdownlist
              [data]="operators"
              [(ngModel)]="dataItem.operator"
              (valueChange)="onOperatorChange(dataItem)"
              [textField]="'label'"
              [valueField]="'value'"
              [valuePrimitive]="true"
              [listHeight]="300"
              [popupSettings]="{ appendTo: 'root', animate: true }"
              class="operator-dropdown">
            </kendo-dropdownlist>
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column field="comparisonValue" title="Value" [width]="280">
          <ng-template kendoGridCellTemplate let-dataItem>
            <div class="value-cell">
              @if (dataItem.useVariable && enableVariables) {
                <!-- Variable mode: show variable dropdown -->
                <kendo-dropdownlist
                  [data]="availableVariables"
                  [value]="getSelectedVariable(dataItem)"
                  (valueChange)="onVariableSelected(dataItem, $event)"
                  [textField]="'label'"
                  [valueField]="'name'"
                  [valuePrimitive]="false"
                  [popupSettings]="{ appendTo: 'root', animate: true }"
                  placeholder="Select variable..."
                  class="value-input variable-dropdown">
                  <ng-template kendoDropDownListItemTemplate let-item>
                    <div class="variable-item">
                      <span class="variable-name">{{ formatVariableDisplay(item.name) }}</span>
                      @if (item.label && item.label !== item.name) {
                        <span class="variable-label">{{ item.label }}</span>
                      }
                    </div>
                  </ng-template>
                  <ng-template kendoDropDownListValueTemplate let-item>
                    @if (item) {
                      <span class="variable-value">{{ formatVariableDisplay(item.name) }}</span>
                    } @else {
                      <span class="variable-placeholder">Select variable...</span>
                    }
                  </ng-template>
                </kendo-dropdownlist>
              } @else {
                <!-- Literal value mode: show type-specific input -->
                @switch (getInputType(dataItem)) {
                  @case ('boolean') {
                    @if (isArrayOperator(dataItem.operator)) {
                      <kendo-textbox
                        [value]="getDisplayValue(dataItem)"
                        (valueChange)="onComparisonValueChange(dataItem, $event)"
                        placeholder="true, false"
                        class="value-input">
                      </kendo-textbox>
                    } @else {
                      <kendo-dropdownlist
                        [data]="booleanOptions"
                        [value]="getBooleanValue(dataItem)"
                        (valueChange)="onBooleanValueChange(dataItem, $event)"
                        [popupSettings]="{ appendTo: 'root', animate: true }"
                        class="value-input">
                      </kendo-dropdownlist>
                    }
                  }
                  @case ('number') {
                    @if (isArrayOperator(dataItem.operator)) {
                      <kendo-textbox
                        [value]="getDisplayValue(dataItem)"
                        (valueChange)="onComparisonValueChange(dataItem, $event)"
                        placeholder="1, 2, 3"
                        class="value-input">
                      </kendo-textbox>
                    } @else {
                      <kendo-numerictextbox
                        [value]="getNumericValue(dataItem)"
                        (valueChange)="onNumericValueChange(dataItem, $event)"
                        [decimals]="getDecimals(dataItem)"
                        [format]="getNumberFormat(dataItem)"
                        class="value-input">
                      </kendo-numerictextbox>
                    }
                  }
                  @case ('datetime') {
                    @if (isArrayOperator(dataItem.operator)) {
                      <kendo-textbox
                        [value]="getDisplayValue(dataItem)"
                        (valueChange)="onComparisonValueChange(dataItem, $event)"
                        placeholder="2024-01-15, 2024-02-20"
                        class="value-input">
                      </kendo-textbox>
                    } @else {
                      <kendo-datetimepicker
                        [value]="getDateTimeValue(dataItem)"
                        (valueChange)="onDateTimeValueChange(dataItem, $event)"
                        [popupSettings]="{ appendTo: 'root', animate: true }"
                        class="value-input">
                      </kendo-datetimepicker>
                    }
                  }
                  @default {
                    <kendo-textbox
                      [value]="getDisplayValue(dataItem)"
                      (valueChange)="onComparisonValueChange(dataItem, $event)"
                      (blur)="onComparisonValueBlur(dataItem)"
                      [placeholder]="getValuePlaceholder(dataItem)"
                      class="value-input">
                    </kendo-textbox>
                  }
                }
              }
              <!-- Variable toggle button -->
              @if (enableVariables && availableVariables.length > 0) {
                <button
                  kendoButton
                  [svgIcon]="dollarIcon"
                  fillMode="flat"
                  [themeColor]="dataItem.useVariable ? 'primary' : 'base'"
                  (click)="toggleVariableMode(dataItem)"
                  [title]="dataItem.useVariable ? 'Switch to literal value' : 'Use variable'"
                  class="variable-toggle">
                </button>
              }
            </div>
          </ng-template>
        </kendo-grid-column>

        <kendo-grid-column title="" [width]="60">
          <ng-template kendoGridCellTemplate let-dataItem>
            <button
              kendoButton
              [svgIcon]="minusIcon"
              fillMode="flat"
              themeColor="error"
              (click)="removeFilter(dataItem)"
              title="Remove this filter">
            </button>
          </ng-template>
        </kendo-grid-column>

      </kendo-grid>

      @if (filters.length === 0) {
        <div class="empty-state">
          <p>No filters defined. Click "Add Filter" to create a new filter.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .field-filter-editor {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .attribute-options {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 0.85rem;
    }

    .inline-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-weight: normal;
    }

    .inline-field {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: normal;
    }

    .depth-input {
      width: 80px;
    }

    .loading-hint {
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 5px;
    }

    .filter-grid {
      border: 1px solid #d5d5d5;
    }

    .filter-grid ::ng-deep .k-grid-header .k-header {
      font-weight: 600;
    }

    .checkbox-column {
      text-align: center;
    }

    .attribute-dropdown,
    .operator-dropdown,
    .attribute-input {
      width: 100%;
    }

    .value-input {
      width: 100%;
    }

    .attribute-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .attribute-path {
      flex: 1;
    }

    .attribute-type {
      font-size: 11px;
      color: #888;
      margin-left: 8px;
      padding: 2px 6px;
      background: #f0f0f0;
      border-radius: 3px;
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      border: 1px dashed;
      border-radius: 8px;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.9rem;
    }

    .empty-state p {
      margin: 0;
    }

    .value-cell {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .value-cell .value-input {
      flex: 1;
    }

    .variable-toggle {
      flex-shrink: 0;
    }

    .variable-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .variable-name {
      font-family: monospace;
      font-weight: 500;
    }

    .variable-label {
      font-size: 11px;
      color: var(--kendo-color-subtle, #888);
    }

    .variable-value {
      font-family: monospace;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .variable-placeholder {
      color: var(--kendo-color-subtle, #888);
    }

    .variable-dropdown ::ng-deep .k-input-value-text {
      font-family: monospace;
    }
  `]
})
export class FieldFilterEditorComponent implements OnChanges {
  private readonly attributeService = inject(AttributeSelectorService, { optional: true });

  protected readonly plusIcon = plusIcon;
  protected readonly minusIcon = minusIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly dollarIcon = dollarIcon;

  private readonly arrayOperators = [
    FieldFilterOperatorsDto.InDto,
    FieldFilterOperatorsDto.NotInDto
  ];

  public readonly operators: { label: string; value: FieldFilterOperatorsDto }[] = [
    { label: 'Equals', value: FieldFilterOperatorsDto.EqualsDto },
    { label: 'Not Equals', value: FieldFilterOperatorsDto.NotEqualsDto },
    { label: 'Greater Than', value: FieldFilterOperatorsDto.GreaterThanDto },
    { label: 'Greater Equal', value: FieldFilterOperatorsDto.GreaterEqualThanDto },
    { label: 'Less Than', value: FieldFilterOperatorsDto.LessThanDto },
    { label: 'Less Equal', value: FieldFilterOperatorsDto.LessEqualThanDto },
    { label: 'Like', value: FieldFilterOperatorsDto.LikeDto },
    { label: 'In', value: FieldFilterOperatorsDto.InDto },
    { label: 'Not In', value: FieldFilterOperatorsDto.NotInDto },
    { label: 'Any Equals', value: FieldFilterOperatorsDto.AnyEqDto },
    { label: 'Any Like', value: FieldFilterOperatorsDto.AnyLikeDto },
    { label: 'Match RegEx', value: FieldFilterOperatorsDto.MatchRegExDto }
  ];

  public readonly booleanOptions = ['true', 'false'];

  @Input() public availableAttributes: AttributeItem[] = [];

  /**
   * Optional CK type ID for self-loading attributes.
   * When set, the component loads available attributes itself and shows
   * navigation property controls (checkbox + max depth).
   * When not set, the component uses the externally provided availableAttributes input.
   */
  @Input() public ckTypeId?: string;

  /**
   * When true, hides the "Include Navigation Properties" checkbox and Max Depth controls,
   * and forces attribute loading without navigation properties.
   * Used for stream data queries which don't support navigation properties.
   */
  @Input() public hideNavigationProperties = false;

  /**
   * When set, restricts the available attributes to only these attribute paths (filtered client-side after fetching).
   * Used for stream data queries to show only stream-data-enabled attributes.
   */
  @Input() public attributePaths?: string[];

  /** Enable variable mode - allows using variables instead of literal values */
  @Input() public enableVariables = false;

  /** Available variables for selection when enableVariables is true */
  @Input() public availableVariables: FilterVariable[] = [];

  /** Controls for self-loading mode (when ckTypeId is set) */
  public includeNavigationProperties = true;
  public maxDepth: number | null = null;
  public isLoadingAttributes = false;

  private _filters: FieldFilterItem[] = [];
  private nextId = 1;
  public filteredAttributeList: AttributeItem[] = [];
  private attributeTypeMap = new Map<string, AttributeValueTypeDto>();

  @Input()
  public get filters(): FieldFilterItem[] {
    return this._filters;
  }
  public set filters(value: FieldFilterItem[]) {
    this._filters = value;
    this.filtersChange.emit(this._filters);
  }

  @Output() public filtersChange = new EventEmitter<FieldFilterItem[]>();

  public selectedKeys: number[] = [];

  ngOnChanges(changes?: SimpleChanges): void {
    // When hideNavigationProperties changes to true, reset nav props
    if (changes?.['hideNavigationProperties'] && this.hideNavigationProperties) {
      this.includeNavigationProperties = false;
      this.maxDepth = null;
    }

    // Reload attributes when ckTypeId, hideNavigationProperties, or attributePaths changes
    if ((changes?.['ckTypeId'] || changes?.['hideNavigationProperties'] || changes?.['attributePaths']) && this.ckTypeId) {
      this.loadAttributesFromCkType();
    }

    this.filteredAttributeList = [...this.availableAttributes];
    this.buildAttributeTypeMap();
    // Ensure useVariable flag is set correctly for filters with variable values
    this.detectVariableFilters();
  }

  /**
   * Detects filters that contain variable references and sets useVariable flag.
   * This ensures proper display when filters are loaded from saved configuration.
   */
  private detectVariableFilters(): void {
    for (const filter of this._filters) {
      // Always check if the value is a variable reference and update the flag
      const isVariable = this.isVariableValue(filter.comparisonValue);
      if (isVariable && !filter.useVariable) {
        filter.useVariable = true;
      }
    }
  }

  private buildAttributeTypeMap(): void {
    this.attributeTypeMap.clear();
    for (const attr of this.availableAttributes) {
      this.attributeTypeMap.set(attr.attributePath, attr.attributeValueType as AttributeValueTypeDto);
    }
  }

  // ============================================================================
  // Self-loading attribute methods (when ckTypeId is set)
  // ============================================================================

  public onNavigationPropertiesChange(): void {
    if (!this.includeNavigationProperties) {
      this.maxDepth = null;
    }
    this.loadAttributesFromCkType();
  }

  public onMaxDepthChange(value: number | null): void {
    this.maxDepth = value;
    this.loadAttributesFromCkType();
  }

  private async loadAttributesFromCkType(): Promise<void> {
    if (!this.ckTypeId || !this.attributeService) return;

    this.isLoadingAttributes = true;
    const includeNavProps = this.hideNavigationProperties ? false : this.includeNavigationProperties;
    try {
      const result = await firstValueFrom(
        this.attributeService.getAvailableAttributes(
          this.ckTypeId,
          undefined, // filter
          1000,      // first
          undefined, // after
          undefined, // attributeValueType
          undefined, // searchTerm
          includeNavProps,
          this.maxDepth ?? undefined
        )
      );
      // Apply client-side attribute path restriction if set
      const allowedPathsSet = this.attributePaths ? new Set(this.attributePaths) : null;
      this.availableAttributes = allowedPathsSet
        ? result.items.filter(item => allowedPathsSet.has(item.attributePath))
        : result.items;
      this.filteredAttributeList = [...this.availableAttributes];
      this.buildAttributeTypeMap();
    } catch (error) {
      console.error('Error loading filter attributes:', error);
      this.availableAttributes = [];
      this.filteredAttributeList = [];
    } finally {
      this.isLoadingAttributes = false;
    }
  }

  public addFilter(): void {
    const newFilter: FieldFilterItem = {
      id: this.nextId++,
      attributePath: '',
      operator: FieldFilterOperatorsDto.EqualsDto,
      comparisonValue: ''
    };
    this._filters = [...this._filters, newFilter];
    this.filtersChange.emit(this._filters);
  }

  public removeFilter(filter: FieldFilterItem): void {
    this._filters = this._filters.filter(f => f.id !== filter.id);
    this.selectedKeys = this.selectedKeys.filter(k => k !== filter.id);
    this.filtersChange.emit(this._filters);
  }

  public removeSelected(): void {
    this._filters = this._filters.filter(f => !this.selectedKeys.includes(f.id));
    this.selectedKeys = [];
    this.filtersChange.emit(this._filters);
  }

  public onFilterChange(): void {
    this.filtersChange.emit(this._filters);
  }

  public onAttributeChange(filter: FieldFilterItem, attributePath: string): void {
    filter.attributePath = attributePath;
    // Reset comparison value when attribute changes
    filter.comparisonValue = '';
    this.onFilterChange();
  }

  public onOperatorChange(filter: FieldFilterItem): void {
    if (!filter.comparisonValue) {
      this.onFilterChange();
      return;
    }

    const currentValue = String(filter.comparisonValue);

    if (this.isArrayOperator(filter.operator)) {
      const valuesToProcess = this.extractArrayContent(currentValue);
      const cleanedValues = this.parseAndCleanArrayValues(valuesToProcess);
      filter.comparisonValue = `[${cleanedValues.join(', ')}]`;
    } else {
      const scalarValue = this.extractArrayContent(currentValue);
      if (scalarValue.includes(',')) {
        filter.comparisonValue = scalarValue.split(',')[0].trim();
      } else {
        filter.comparisonValue = scalarValue.trim();
      }
    }

    this.onFilterChange();
  }

  public onComparisonValueChange(filter: FieldFilterItem, inputValue: string | null): void {
    if (inputValue === null) {
      filter.comparisonValue = '';
      return;
    }

    if (this.isArrayOperator(filter.operator)) {
      const cleanedValues = this.parseAndCleanArrayValues(inputValue);
      filter.comparisonValue = `[${cleanedValues.join(', ')}]`;
    } else {
      filter.comparisonValue = this.extractArrayContent(inputValue);
    }

    this.onFilterChange();
  }

  public onComparisonValueBlur(filter: FieldFilterItem): void {
    if (!filter.comparisonValue) return;

    const value = String(filter.comparisonValue);

    if (this.isArrayOperator(filter.operator)) {
      const cleanedValues = this.parseAndCleanArrayValues(value);
      filter.comparisonValue = `[${cleanedValues.join(', ')}]`;
    } else {
      filter.comparisonValue = this.extractArrayContent(value).trim();
    }

    this.onFilterChange();
  }

  public onBooleanValueChange(filter: FieldFilterItem, value: string): void {
    filter.comparisonValue = value;
    this.onFilterChange();
  }

  public onNumericValueChange(filter: FieldFilterItem, value: number | null): void {
    filter.comparisonValue = value !== null ? String(value) : '';
    this.onFilterChange();
  }

  public onDateTimeValueChange(filter: FieldFilterItem, value: Date | null): void {
    filter.comparisonValue = value !== null ? value.toISOString() : '';
    this.onFilterChange();
  }

  public getDisplayValue(filter: FieldFilterItem): string {
    if (!filter.comparisonValue) {
      return '';
    }

    const value = String(filter.comparisonValue);

    if (this.isArrayOperator(filter.operator) && this.isArrayValue(value)) {
      return this.extractArrayContent(value);
    }

    return value;
  }

  public getBooleanValue(filter: FieldFilterItem): string {
    const value = filter.comparisonValue;
    if (value === 'true' || value === true) return 'true';
    if (value === 'false' || value === false) return 'false';
    return '';
  }

  public getNumericValue(filter: FieldFilterItem): number {
    const value = filter.comparisonValue;
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  public getDateTimeValue(filter: FieldFilterItem): Date | null {
    const value = filter.comparisonValue;
    if (!value) return null;
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  }

  public getInputType(filter: FieldFilterItem): InputType {
    const attrType = this.attributeTypeMap.get(filter.attributePath);
    if (!attrType) return 'text';

    // Normalize to uppercase for case-insensitive comparison
    const normalizedType = String(attrType).toUpperCase();

    // Boolean types
    if (normalizedType === 'BOOLEAN') {
      return 'boolean';
    }

    // Numeric types
    if (normalizedType === 'INT' || normalizedType === 'INTEGER' ||
        normalizedType === 'INT_64' || normalizedType === 'INTEGER_64' ||
        normalizedType === 'DOUBLE') {
      return 'number';
    }

    // DateTime types
    if (normalizedType === 'DATE_TIME' || normalizedType === 'DATE_TIME_OFFSET' ||
        normalizedType === 'DATETIME' || normalizedType === 'DATETIMEOFFSET') {
      return 'datetime';
    }

    return 'text';
  }

  public getDecimals(filter: FieldFilterItem): number {
    const attrType = this.attributeTypeMap.get(filter.attributePath);
    return attrType === AttributeValueTypeDto.DoubleDto ? 4 : 0;
  }

  public getNumberFormat(filter: FieldFilterItem): string {
    const attrType = this.attributeTypeMap.get(filter.attributePath);
    return attrType === AttributeValueTypeDto.DoubleDto ? 'n4' : 'n0';
  }

  public getValuePlaceholder(filter: FieldFilterItem): string {
    if (this.isArrayOperator(filter.operator)) {
      return 'Values: A,B,C or "value,with,comma"';
    }
    return 'Enter value';
  }

  public isArrayOperator(operator: FieldFilterOperatorsDto): boolean {
    return this.arrayOperators.includes(operator);
  }

  public isSelected(filter: FieldFilterItem): boolean {
    return this.selectedKeys.includes(filter.id);
  }

  public toggleSelection(filter: FieldFilterItem): void {
    if (this.isSelected(filter)) {
      this.selectedKeys = this.selectedKeys.filter(k => k !== filter.id);
    } else {
      this.selectedKeys = [...this.selectedKeys, filter.id];
    }
  }

  public isAllSelected(): boolean {
    return this._filters.length > 0 && this.selectedKeys.length === this._filters.length;
  }

  public isIndeterminate(): boolean {
    return this.selectedKeys.length > 0 && this.selectedKeys.length < this._filters.length;
  }

  public toggleSelectAll(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedKeys = this._filters.map(f => f.id);
    } else {
      this.selectedKeys = [];
    }
  }

  public onAttributeFilterChange(filter: string): void {
    this.filteredAttributeList = this.availableAttributes.filter(
      attr => attr.attributePath.toLowerCase().includes(filter.toLowerCase())
    );
  }

  // ============================================================================
  // Variable Mode Methods
  // ============================================================================

  /**
   * Toggles between literal value and variable mode for a filter.
   */
  public toggleVariableMode(filter: FieldFilterItem): void {
    filter.useVariable = !filter.useVariable;
    // Clear the value when switching modes
    filter.comparisonValue = '';
    this.onFilterChange();
  }

  /**
   * Gets the selected variable object for a filter that uses variable mode.
   */
  public getSelectedVariable(filter: FieldFilterItem): FilterVariable | null {
    if (!filter.comparisonValue) return null;

    const varName = this.extractVariableName(String(filter.comparisonValue));
    if (!varName) return null;

    return this.availableVariables.find(v => v.name === varName) || null;
  }

  /**
   * Handles variable selection from the dropdown.
   */
  public onVariableSelected(filter: FieldFilterItem, variable: FilterVariable | null): void {
    if (variable) {
      // Store as ${variableName} format
      filter.comparisonValue = `\${${variable.name}}`;
    } else {
      filter.comparisonValue = '';
    }
    this.onFilterChange();
  }

  /**
   * Extracts variable name from ${variableName} or $variableName format.
   */
  private extractVariableName(value: string): string | null {
    // Match ${varName} format
    const bracketMatch = value.match(/^\$\{([^}]+)\}$/);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    // Match $varName format (without braces)
    const simpleMatch = value.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (simpleMatch) {
      return simpleMatch[1];
    }

    return null;
  }

  /**
   * Checks if a filter value is a variable reference.
   */
  public isVariableValue(value: unknown): boolean {
    if (!value || typeof value !== 'string') return false;
    return /^\$\{[^}]+\}$/.test(value) || /^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
  }

  /**
   * Formats a variable name for display (e.g., "myVar" -> "${myVar}").
   */
  public formatVariableDisplay(name: string): string {
    return '$' + '{' + name + '}';
  }

  public getFieldFilters(): FieldFilterDto[] {
    return this._filters
      .filter(f => f.attributePath && f.attributePath.trim() !== '')
      .map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }));
  }

  public setFieldFilters(filters: FieldFilterDto[]): void {
    this._filters = filters.map(f => ({
      ...f,
      id: this.nextId++,
      // Detect if the value is a variable reference
      useVariable: this.isVariableValue(f.comparisonValue)
    }));
    this.filtersChange.emit(this._filters);
  }

  public clear(): void {
    this._filters = [];
    this.selectedKeys = [];
    this.filtersChange.emit(this._filters);
  }

  private isArrayValue(value: string): boolean {
    return value.trim().startsWith('[') && value.trim().endsWith(']');
  }

  private extractArrayContent(value: string): string {
    const trimmed = value.trim();
    if (this.isArrayValue(trimmed)) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  private parseAndCleanArrayValues(inputValue: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of inputValue) {
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        current += char;
        quoteChar = '';
      } else if (!inQuotes && char === ',') {
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          values.push(trimmed);
        }
        current = '';
      } else {
        current += char;
      }
    }

    const trimmed = current.trim();
    if (trimmed.length > 0) {
      values.push(trimmed);
    }

    return values;
  }
}
