import { Component, Input, OnInit, inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService, FieldFilterOperatorsDto, AttributeSelectorService, AttributeItem, FieldFilterDto, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { firstValueFrom } from 'rxjs';
import { GaugeType, GaugeRange, KpiQueryMode, WidgetFilterConfig } from '../../models/meshboard.models';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { RuntimeEntityItem, PersistentQueryItem, QueryColumnItem, CategoryValueItem, RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';

/**
 * Data source type for Gauge
 */
export type GaugeDataSourceType = 'runtimeEntity' | 'persistentQuery';

/**
 * Configuration result from the Gauge dialog
 */
export interface GaugeConfigResult extends WidgetConfigResult {
  dataSourceType: GaugeDataSourceType;
  // Runtime entity fields
  ckTypeId: string;
  rtId?: string;
  valueAttribute: string;
  labelAttribute?: string;
  // Persistent query fields
  queryRtId?: string;
  queryName?: string;
  queryMode?: KpiQueryMode;
  queryValueField?: string;
  queryCategoryField?: string;
  queryCategoryValue?: string;
  // Gauge options
  gaugeType: GaugeType;
  min?: number;
  max?: number;
  ranges?: GaugeRange[];
  showLabel?: boolean;
  prefix?: string;
  suffix?: string;
  reverse?: boolean;
  // Filters
  filters?: FieldFilterDto[];
}

interface GaugeTypeOption {
  value: GaugeType;
  label: string;
  description: string;
}

/**
 * Configuration dialog for Gauge widgets.
 * Allows selecting data source, gauge type, value attribute, and display options.
 */
@Component({
  selector: 'mm-gauge-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    FieldFilterEditorComponent,
    QuerySelectorComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        @if (isLoadingInitial) {
          <div class="loading-indicator">Loading...</div>
        }

        <!-- Data Source Type Selection -->
        <div class="form-field">
          <label>Data Source</label>
          <div class="mode-toggle">
            <button
              kendoButton
              [fillMode]="dataSourceType === 'runtimeEntity' ? 'solid' : 'outline'"
              [themeColor]="dataSourceType === 'runtimeEntity' ? 'primary' : 'base'"
              (click)="onDataSourceTypeChange('runtimeEntity')">
              Runtime Entity
            </button>
            <button
              kendoButton
              [fillMode]="dataSourceType === 'persistentQuery' ? 'solid' : 'outline'"
              [themeColor]="dataSourceType === 'persistentQuery' ? 'primary' : 'base'"
              (click)="onDataSourceTypeChange('persistentQuery')">
              Query
            </button>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- RUNTIME ENTITY DATA SOURCE -->
        <!-- ============================================================ -->
        @if (dataSourceType === 'runtimeEntity') {
          <!-- Runtime Entities Selection -->
          <div class="form-field">
            <label>Runtime Entities</label>
            <mm-ck-type-selector-input
              #ckTypeSelector
              placeholder="Select Runtime Entities..."
              [minSearchLength]="2"
              dialogTitle="Select Runtime Entities"
              [ngModel]="selectedCkType"
              (ckTypeSelected)="onCkTypeSelected($event)"
              (ckTypeCleared)="onCkTypeCleared()">
            </mm-ck-type-selector-input>
            <p class="field-hint">Select the type of Runtime Entities for the data source.</p>
          </div>

          <!-- Entity Selection -->
          <div class="form-field" [class.disabled]="!selectedCkType">
            <label>Entity</label>
            @if (selectedCkType && entityDataSource) {
              <mm-entity-select-input
                #entitySelector
                [dataSource]="entityDataSource"
                [dialogDataSource]="entityDialogDataSource"
                placeholder="Search for an entity..."
                dialogTitle="Select Entity"
                [minSearchLength]="1"
                [ngModel]="selectedEntity"
                (entitySelected)="onEntitySelected($event)"
                (entityCleared)="onEntityCleared()">
              </mm-entity-select-input>
            } @else {
              <kendo-textbox
                [disabled]="true"
                placeholder="First select Runtime Entities...">
              </kendo-textbox>
            }
          </div>

          <!-- Value Attribute (Runtime Entity) -->
          <div class="form-field" [class.disabled]="!selectedCkType">
            <label>Value Attribute</label>
            @if (selectedCkType && !isLoadingAttributes()) {
              <kendo-combobox
                [data]="filteredValueAttributes()"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.valueAttribute"
                [filterable]="true"
                (filterChange)="onValueAttributeFilter($event)"
                placeholder="Search or select an attribute...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="attribute-item">
                    <span class="attribute-path">{{ dataItem.attributePath }}</span>
                    <span class="attribute-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
            } @else if (isLoadingAttributes()) {
              <kendo-textbox [disabled]="true" placeholder="Loading attributes..."></kendo-textbox>
            } @else {
              <kendo-textbox [disabled]="true" placeholder="First select Runtime Entities..."></kendo-textbox>
            }
            <p class="field-hint">The numeric attribute to display on the gauge.</p>
          </div>
        }

        <!-- ============================================================ -->
        <!-- PERSISTENT QUERY DATA SOURCE -->
        <!-- ============================================================ -->
        @if (dataSourceType === 'persistentQuery') {
          <!-- Query Selection -->
          <div class="form-field">
            <label>Query <span class="required">*</span></label>
            <mm-query-selector
              #querySelector
              [(ngModel)]="selectedPersistentQuery"
              (querySelected)="onQuerySelected($event)"
              placeholder="Select a Query..."
              hint="Select a query to provide data for this gauge.">
            </mm-query-selector>
          </div>

          <!-- Query Mode Selection -->
          <div class="form-field">
            <label>Query Mode</label>
            <kendo-dropdownlist
              [data]="queryModeOptions"
              textField="label"
              valueField="value"
              [valuePrimitive]="true"
              [(ngModel)]="queryMode"
              (valueChange)="onQueryModeChange($event)">
            </kendo-dropdownlist>
            <p class="field-hint">
              @switch (queryMode) {
                @case ('simpleCount') { Shows the total count of query results. }
                @case ('aggregation') { Shows the aggregated value from the query. }
                @case ('groupedAggregation') { Shows the value for a specific category. }
              }
            </p>
          </div>

          <!-- Aggregation: Value Field Selection -->
          @if (queryMode === 'aggregation' && selectedPersistentQuery) {
            <div class="form-field">
              <label>Value Field <span class="required">*</span></label>
              @if (!isLoadingQueryColumns) {
                <kendo-combobox
                  [data]="queryColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.queryValueField"
                  placeholder="Select value field...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
              } @else {
                <kendo-textbox [disabled]="true" placeholder="Loading columns..."></kendo-textbox>
              }
            </div>
          }

          <!-- Grouped Aggregation: Category and Value Field Selection -->
          @if (queryMode === 'groupedAggregation' && selectedPersistentQuery) {
            <div class="form-field">
              <label>Category Field <span class="required">*</span></label>
              @if (!isLoadingQueryColumns) {
                <kendo-combobox
                  [data]="queryColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.queryCategoryField"
                  (valueChange)="onCategoryFieldChange($event)"
                  placeholder="Select category field...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
              } @else {
                <kendo-textbox [disabled]="true" placeholder="Loading columns..."></kendo-textbox>
              }
            </div>

            <div class="form-field" [class.disabled]="!form.queryCategoryField">
              <label>Category Value <span class="required">*</span></label>
              @if (!isLoadingCategoryValues && form.queryCategoryField) {
                <kendo-combobox
                  [data]="categoryValues"
                  [textField]="'displayValue'"
                  [valueField]="'value'"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.queryCategoryValue"
                  placeholder="Select category value...">
                </kendo-combobox>
              } @else if (isLoadingCategoryValues) {
                <kendo-textbox [disabled]="true" placeholder="Loading values..."></kendo-textbox>
              } @else {
                <kendo-textbox [disabled]="true" placeholder="First select a category field..."></kendo-textbox>
              }
            </div>

            <div class="form-field">
              <label>Value Field <span class="required">*</span></label>
              @if (!isLoadingQueryColumns) {
                <kendo-combobox
                  [data]="queryColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.queryValueField"
                  placeholder="Select value field...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
              } @else {
                <kendo-textbox [disabled]="true" placeholder="Loading columns..."></kendo-textbox>
              }
            </div>
          }
        }

        <!-- Gauge Type Selection -->
        <div class="form-field">
          <label>Gauge Type</label>
          <kendo-dropdownlist
            [data]="gaugeTypeOptions"
            textField="label"
            valueField="value"
            [valuePrimitive]="true"
            [(ngModel)]="form.gaugeType">
            <ng-template kendoDropDownListItemTemplate let-dataItem>
              <div class="gauge-type-item">
                <span class="gauge-type-label">{{ dataItem.label }}</span>
                <span class="gauge-type-desc">{{ dataItem.description }}</span>
              </div>
            </ng-template>
          </kendo-dropdownlist>
        </div>

        <!-- Scale Settings -->
        <div class="form-section">
          <h4>Scale Settings</h4>

          <div class="form-row">
            <div class="form-field flex-1">
              <label>Minimum</label>
              <kendo-numerictextbox
                [(ngModel)]="form.min"
                [decimals]="2"
                [spinners]="false"
                placeholder="0">
              </kendo-numerictextbox>
            </div>
            <div class="form-field flex-1">
              <label>Maximum</label>
              <kendo-numerictextbox
                [(ngModel)]="form.max"
                [decimals]="2"
                [spinners]="false"
                placeholder="100">
              </kendo-numerictextbox>
            </div>
          </div>

          <div class="form-field">
            <label>
              <input type="checkbox" kendoCheckBox [(ngModel)]="form.reverse">
              <span class="checkbox-label">Reverse Scale</span>
            </label>
          </div>
        </div>

        <!-- Display Options -->
        <div class="form-section">
          <h4>Display Options</h4>

          <div class="form-row">
            <div class="form-field flex-1">
              <label>Prefix</label>
              <kendo-textbox
                [(ngModel)]="form.prefix"
                placeholder="e.g., $, EUR...">
              </kendo-textbox>
            </div>
            <div class="form-field flex-1">
              <label>Suffix</label>
              <kendo-textbox
                [(ngModel)]="form.suffix"
                placeholder="e.g., %, units...">
              </kendo-textbox>
            </div>
          </div>

          <div class="form-field">
            <label>
              <input type="checkbox" kendoCheckBox [(ngModel)]="form.showLabel">
              <span class="checkbox-label">Show Value Label</span>
            </label>
          </div>

          <!-- Label Attribute (only for runtime entity) -->
          @if (dataSourceType === 'runtimeEntity') {
            <div class="form-field" [class.disabled]="!selectedCkType">
              <label>Label Attribute (optional)</label>
              @if (selectedCkType && !isLoadingAttributes()) {
                <kendo-combobox
                  [data]="filteredLabelAttributes()"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.labelAttribute"
                  [filterable]="true"
                  (filterChange)="onLabelAttributeFilter($event)"
                  placeholder="Search or select an attribute...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="attribute-item">
                      <span class="attribute-path">{{ dataItem.attributePath }}</span>
                      <span class="attribute-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
              } @else if (isLoadingAttributes()) {
                <kendo-textbox [disabled]="true" placeholder="Loading attributes..."></kendo-textbox>
              } @else {
                <kendo-textbox [disabled]="true" placeholder="First select Runtime Entities..."></kendo-textbox>
              }
              <p class="field-hint">Optional attribute to use as a dynamic label.</p>
            </div>
          }
        </div>

        <!-- Filters Section -->
        @if (filterAttributes.length > 0) {
          <div class="form-section">
            <h4>Filters</h4>
            <p class="section-hint">Define filters to narrow down the data.</p>
            <mm-field-filter-editor
              [availableAttributes]="filterAttributes"
              [filters]="filters"
              [enableVariables]="filterVariables.length > 0"
              [availableVariables]="filterVariables"
              (filtersChange)="onFiltersChange($event)">
            </mm-field-filter-editor>
          </div>
        }

        <!-- Color Ranges -->
        <div class="form-section">
          <h4>Color Ranges (optional)</h4>
          <p class="field-hint">Define color zones for different value ranges.</p>

          @for (range of form.ranges; track $index) {
            <div class="range-row">
              <kendo-numerictextbox
                [(ngModel)]="range.from"
                [decimals]="0"
                [spinners]="false"
                placeholder="From"
                class="range-input">
              </kendo-numerictextbox>
              <span class="range-separator">-</span>
              <kendo-numerictextbox
                [(ngModel)]="range.to"
                [decimals]="0"
                [spinners]="false"
                placeholder="To"
                class="range-input">
              </kendo-numerictextbox>
              <input
                type="color"
                [(ngModel)]="range.color"
                class="color-picker">
              <button kendoButton [fillMode]="'flat'" [icon]="'x'" (click)="removeRange($index)"></button>
            </div>
          }

          <button kendoButton [fillMode]="'outline'" (click)="addRange()">
            Add Range
          </button>
        </div>
      </div>

      <div class="action-bar">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .action-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }

    .config-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px;
      position: relative;
      flex: 1;
      overflow-y: auto;
    }

    .config-form.loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .loading-indicator {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      text-align: center;
      padding: 8px;
      color: var(--kendo-color-primary, #0d6efd);
      font-style: italic;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field.disabled {
      opacity: 0.6;
    }

    .form-field.flex-1 {
      flex: 1;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .form-section {
      padding: 16px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .form-section h4 {
      margin: 0 0 16px 0;
      font-size: 0.95rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .section-hint {
      margin: 0 0 12px 0;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .checkbox-label {
      margin-left: 8px;
      font-weight: normal;
    }

    .gauge-type-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .gauge-type-label {
      font-weight: 500;
    }

    .gauge-type-desc {
      font-size: 0.75rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .attribute-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .attribute-path {
      flex: 1;
    }

    .attribute-type {
      font-size: 0.75rem;
      color: var(--kendo-color-subtle, #6c757d);
      background: var(--kendo-color-surface-alt, #f8f9fa);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .range-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .range-input {
      width: 80px;
    }

    .range-separator {
      color: var(--kendo-color-subtle, #6c757d);
    }

    .color-picker {
      width: 40px;
      height: 32px;
      padding: 2px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      cursor: pointer;
    }

    .mode-toggle {
      display: flex;
      gap: 8px;
    }

    .mode-toggle button {
      flex: 1;
    }

    .required {
      color: var(--kendo-color-error, #dc3545);
    }

    .query-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .query-name {
      font-weight: 500;
    }

    .query-description {
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .column-item {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .column-path {
      font-weight: 500;
    }

    .column-type {
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }
  `]
})
export class GaugeConfigDialogComponent implements OnInit {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly attributeSelectorService = inject(AttributeSelectorService);
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly meshBoardStateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('ckTypeSelector') ckTypeSelectorInput?: CkTypeSelectorInputComponent;
  @ViewChild('entitySelector') entitySelectorInput?: EntitySelectInputComponent;
  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing - Runtime Entity
  @Input() initialCkTypeId?: string;
  @Input() initialRtId?: string;
  @Input() initialGaugeType?: GaugeType;
  @Input() initialValueAttribute?: string;
  @Input() initialLabelAttribute?: string;
  @Input() initialMin?: number;
  @Input() initialMax?: number;
  @Input() initialRanges?: GaugeRange[];
  @Input() initialShowLabel?: boolean;
  @Input() initialPrefix?: string;
  @Input() initialSuffix?: string;
  @Input() initialReverse?: boolean;

  // Initial values for editing - Persistent Query
  @Input() initialDataSourceType?: GaugeDataSourceType;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialQueryMode?: KpiQueryMode;
  @Input() initialQueryValueField?: string;
  @Input() initialQueryCategoryField?: string;
  @Input() initialQueryCategoryValue?: string;

  // Initial values for filters
  @Input() initialFilters?: WidgetFilterConfig[];

  // Data source type selection
  dataSourceType: GaugeDataSourceType = 'runtimeEntity';

  // Runtime Entity state
  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;
  isLoadingInitial = false;

  // Persistent Query state
  selectedPersistentQuery: PersistentQueryItem | null = null;
  queryColumns: QueryColumnItem[] = [];
  categoryValues: CategoryValueItem[] = [];
  queryMode: KpiQueryMode = 'simpleCount';
  isLoadingQueryColumns = false;
  isLoadingCategoryValues = false;

  // Attribute selection
  readonly isLoadingAttributes = signal(false);
  readonly availableAttributes = signal<AttributeItem[]>([]);
  readonly filteredValueAttributes = signal<AttributeItem[]>([]);
  readonly filteredLabelAttributes = signal<AttributeItem[]>([]);

  // Filter state
  filters: FieldFilterItem[] = [];
  filterAttributes: AttributeItem[] = [];
  filterVariables: FilterVariable[] = [];

  form: {
    gaugeType: GaugeType;
    valueAttribute: string;
    labelAttribute: string;
    min: number | null;
    max: number | null;
    ranges: GaugeRange[];
    showLabel: boolean;
    prefix: string;
    suffix: string;
    reverse: boolean;
    // Query-specific form fields
    queryValueField: string;
    queryCategoryField: string;
    queryCategoryValue: string;
  } = {
    gaugeType: 'arc',
    valueAttribute: '',
    labelAttribute: '',
    min: 0,
    max: 100,
    ranges: [],
    showLabel: true,
    prefix: '',
    suffix: '',
    reverse: false,
    queryValueField: '',
    queryCategoryField: '',
    queryCategoryValue: ''
  };

  gaugeTypeOptions: GaugeTypeOption[] = [
    { value: 'arc', label: 'Arc Gauge', description: 'Semi-circular gauge with center label' },
    { value: 'circular', label: 'Circular Gauge', description: 'Full circle gauge with center label' },
    { value: 'radial', label: 'Radial Gauge', description: 'Classic speedometer style with pointer' },
    { value: 'linear', label: 'Linear Gauge', description: 'Vertical bar gauge with pointer' }
  ];

  queryModeOptions = [
    { value: 'simpleCount' as KpiQueryMode, label: 'Total Count (Simple Query)' },
    { value: 'aggregation' as KpiQueryMode, label: 'Aggregation Value' },
    { value: 'groupedAggregation' as KpiQueryMode, label: 'Grouped Aggregation' }
  ];

  get isValid(): boolean {
    if (this.dataSourceType === 'persistentQuery') {
      if (!this.selectedPersistentQuery) return false;
      if (this.queryMode === 'simpleCount') return true;
      if (this.queryMode === 'aggregation') return this.form.queryValueField !== '';
      if (this.queryMode === 'groupedAggregation') {
        return this.form.queryCategoryField !== '' &&
               this.form.queryCategoryValue !== '' &&
               this.form.queryValueField !== '';
      }
      return false;
    }
    // Runtime entity validation
    return (
      this.selectedCkType !== null &&
      this.selectedEntity !== null &&
      (this.form.valueAttribute?.trim() ?? '') !== ''
    );
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.meshBoardStateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.form.gaugeType = this.initialGaugeType || 'arc';
    this.form.valueAttribute = this.initialValueAttribute || '';
    this.form.labelAttribute = this.initialLabelAttribute || '';
    this.form.min = this.initialMin ?? 0;
    this.form.max = this.initialMax ?? 100;
    this.form.ranges = this.initialRanges ? [...this.initialRanges] : [];
    this.form.showLabel = this.initialShowLabel !== false;
    this.form.prefix = this.initialPrefix || '';
    this.form.suffix = this.initialSuffix || '';
    this.form.reverse = this.initialReverse ?? false;
    this.form.queryValueField = this.initialQueryValueField || '';
    this.form.queryCategoryField = this.initialQueryCategoryField || '';
    this.form.queryCategoryValue = this.initialQueryCategoryValue || '';

    // Initialize filters
    if (this.initialFilters && this.initialFilters.length > 0) {
      this.filters = this.initialFilters.map((f, index) => ({
        id: index + 1,
        attributePath: f.attributePath,
        operator: f.operator as FieldFilterOperatorsDto,
        comparisonValue: f.comparisonValue
      }));
    }

    // Determine data source type
    this.dataSourceType = this.initialDataSourceType || 'runtimeEntity';
    this.queryMode = this.initialQueryMode || 'simpleCount';

    if (this.dataSourceType === 'persistentQuery' && this.initialQueryRtId) {
      this.isLoadingInitial = true;
      setTimeout(async () => {
        if (this.querySelector) {
          const query = await this.querySelector.selectByRtId(this.initialQueryRtId!);
          if (query) {
            this.selectedPersistentQuery = query;
            await this.loadQueryColumnsAndValues(query.rtId);
            if (query.queryCkTypeId) {
              await this.loadFilterAttributesFromCkType(query.queryCkTypeId);
            }
          }
        }
        this.isLoadingInitial = false;
      }, 100);
    } else if (this.initialCkTypeId) {
      await this.loadInitialValues();
    }
  }

  private async loadInitialValues(): Promise<void> {
    if (!this.initialCkTypeId) return;

    this.isLoadingInitial = true;

    try {
      const ckType = await firstValueFrom(
        this.ckTypeSelectorService.getCkTypeByRtCkTypeId(this.initialCkTypeId)
      );

      if (ckType) {
        this.onCkTypeSelected(ckType);

        if (this.initialRtId && this.entityDataSource) {
          await this.loadInitialEntity();
        }
      }
    } catch (error) {
      console.error('Error loading initial values:', error);
    } finally {
      this.isLoadingInitial = false;
    }
  }

  private async loadInitialEntity(): Promise<void> {
    if (!this.initialRtId || !this.initialCkTypeId) return;

    try {
      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId: this.initialCkTypeId,
            rtId: this.initialRtId
          }
        })
      );

      const items = result.data?.runtime?.runtimeEntities?.items ?? [];
      const entity = items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .find(item => item.rtId === this.initialRtId);

      if (entity) {
        this.selectedEntity = {
          rtId: entity.rtId,
          ckTypeId: entity.ckTypeId,
          rtWellKnownName: entity.rtWellKnownName ?? undefined,
          displayName: entity.rtWellKnownName || entity.rtId
        };
      }
    } catch (error) {
      console.error('Error loading initial entity:', error);
    }
  }

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.selectedEntity = null;

    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.fullName
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );

    // Load available attributes for this CK type (fullName is required for the GraphQL query)
    this.loadAvailableAttributes(ckType.fullName);
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.selectedEntity = null;
    this.entityDataSource = undefined;
    this.entityDialogDataSource = undefined;
    this.availableAttributes.set([]);
    this.filteredValueAttributes.set([]);
    this.filteredLabelAttributes.set([]);
    this.filterAttributes = [];
    this.filters = [];
  }

  private loadAvailableAttributes(ckTypeId: string): void {
    this.isLoadingAttributes.set(true);
    this.attributeSelectorService.getAvailableAttributes(ckTypeId).subscribe({
      next: (result) => {
        this.availableAttributes.set(result.items);
        this.filteredValueAttributes.set(result.items);
        this.filteredLabelAttributes.set(result.items);
        // Also set filter attributes for the filter editor
        this.filterAttributes = result.items;
        this.isLoadingAttributes.set(false);
      },
      error: (err) => {
        console.error('Error loading attributes:', err);
        this.availableAttributes.set([]);
        this.filteredValueAttributes.set([]);
        this.filteredLabelAttributes.set([]);
        this.filterAttributes = [];
        this.isLoadingAttributes.set(false);
      }
    });
  }

  onValueAttributeFilter(filter: string): void {
    const filterLower = filter.toLowerCase();
    const filtered = this.availableAttributes().filter(attr =>
      attr.attributePath.toLowerCase().includes(filterLower)
    );
    this.filteredValueAttributes.set(filtered);
  }

  onLabelAttributeFilter(filter: string): void {
    const filterLower = filter.toLowerCase();
    const filtered = this.availableAttributes().filter(attr =>
      attr.attributePath.toLowerCase().includes(filterLower)
    );
    this.filteredLabelAttributes.set(filtered);
  }

  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity = entity;
  }

  onEntityCleared(): void {
    this.selectedEntity = null;
  }

  addRange(): void {
    const lastRange = this.form.ranges[this.form.ranges.length - 1];
    const newFrom = lastRange ? lastRange.to : 0;
    const newTo = Math.min(newFrom + 25, this.form.max ?? 100);

    this.form.ranges.push({
      from: newFrom,
      to: newTo,
      color: '#4caf50'
    });
  }

  removeRange(index: number): void {
    this.form.ranges.splice(index, 1);
  }

  onSave(): void {
    // Convert filters to DTO format
    const filtersDto: FieldFilterDto[] | undefined = this.filters.length > 0
      ? this.filters.map(f => ({
          attributePath: f.attributePath,
          operator: f.operator,
          comparisonValue: f.comparisonValue
        }))
      : undefined;

    if (this.dataSourceType === 'persistentQuery' && this.selectedPersistentQuery) {
      this.windowRef.close({
        dataSourceType: 'persistentQuery',
        ckTypeId: '',
        rtId: undefined,
        valueAttribute: '',
        queryRtId: this.selectedPersistentQuery.rtId,
        queryName: this.selectedPersistentQuery.name,
        queryMode: this.queryMode,
        queryValueField: this.form.queryValueField || undefined,
        queryCategoryField: this.form.queryCategoryField || undefined,
        queryCategoryValue: this.form.queryCategoryValue || undefined,
        gaugeType: this.form.gaugeType,
        min: this.form.min ?? undefined,
        max: this.form.max ?? undefined,
        ranges: this.form.ranges.length > 0 ? this.form.ranges : undefined,
        showLabel: this.form.showLabel,
        prefix: this.form.prefix || undefined,
        suffix: this.form.suffix || undefined,
        reverse: this.form.reverse || undefined,
        filters: filtersDto
      });
    } else if (this.selectedCkType && this.selectedEntity) {
      this.windowRef.close({
        dataSourceType: 'runtimeEntity',
        ckTypeId: this.selectedCkType.rtCkTypeId,
        rtId: this.selectedEntity.rtId,
        gaugeType: this.form.gaugeType,
        valueAttribute: this.form.valueAttribute,
        labelAttribute: this.form.labelAttribute || undefined,
        min: this.form.min ?? undefined,
        max: this.form.max ?? undefined,
        ranges: this.form.ranges.length > 0 ? this.form.ranges : undefined,
        showLabel: this.form.showLabel,
        prefix: this.form.prefix || undefined,
        suffix: this.form.suffix || undefined,
        reverse: this.form.reverse || undefined,
        filters: filtersDto
      });
    }
  }

  onCancel(): void {
    this.windowRef.close();
  }

  // ============================================================================
  // Data Source Type Selection
  // ============================================================================

  onDataSourceTypeChange(type: GaugeDataSourceType): void {
    this.dataSourceType = type;
  }

  // ============================================================================
  // Persistent Query Methods
  // ============================================================================

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.queryColumns = [];
    this.categoryValues = [];
    this.filterAttributes = [];
    this.filters = [];
    this.form.queryValueField = '';
    this.form.queryCategoryField = '';
    this.form.queryCategoryValue = '';

    if (query) {
      // Load query columns for field mapping
      await this.loadQueryColumnsAndValues(query.rtId);

      // Load filter attributes from CK type
      if (query.queryCkTypeId) {
        await this.loadFilterAttributesFromCkType(query.queryCkTypeId);
      }
    }
  }

  async onQueryModeChange(mode: KpiQueryMode): Promise<void> {
    this.queryMode = mode;
    this.form.queryValueField = '';
    this.form.queryCategoryField = '';
    this.form.queryCategoryValue = '';
    this.categoryValues = [];

    // Query columns should already be loaded, but reload if needed for category values
    if (this.selectedPersistentQuery && mode === 'groupedAggregation' && this.queryColumns.length === 0) {
      await this.loadQueryColumnsAndValues(this.selectedPersistentQuery.rtId);
    }
  }

  private async loadQueryColumnsAndValues(queryRtId: string): Promise<void> {
    this.isLoadingQueryColumns = true;

    try {
      const result = await firstValueFrom(this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: queryRtId,
          first: 100 // Fetch rows for category values
        }
      }));

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length > 0 && queryItems[0]) {
        const queryResult = queryItems[0];

        // Extract columns
        const columns = queryResult.columns ?? [];
        const filteredColumns = columns
          .filter((c): c is NonNullable<typeof c> => c !== null);

        // queryColumns use sanitized paths for UI display and matching with query results
        this.queryColumns = filteredColumns.map(c => ({
          attributePath: this.sanitizeFieldName(c.attributePath ?? ''),
          attributeValueType: c.attributeValueType ?? ''
        }));

        // Extract category values for grouped aggregation
        if (this.queryMode === 'groupedAggregation') {
          await this.extractCategoryValues(queryResult);
        }
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.queryColumns = [];
    } finally {
      this.isLoadingQueryColumns = false;
    }
  }

  /**
   * Loads all available filter attributes from the CK type.
   * Uses getCkTypeAvailableQueryColumns to get all attributes, not just query result columns.
   */
  private async loadFilterAttributesFromCkType(queryCkTypeId: string): Promise<void> {
    try {
      const result = await firstValueFrom(this.getCkTypeAvailableQueryColumnsGQL.fetch({
        variables: { rtCkId: queryCkTypeId, first: 1000 }
      }));

      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items || [];
      this.filterAttributes = columns
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map(c => ({
          attributePath: c.attributePath || '',
          attributeValueType: c.attributeValueType
        }));
    } catch (error) {
      console.error('Error loading filter attributes:', error);
      this.filterAttributes = [];
    }
  }

  async onCategoryFieldChange(categoryField: string): Promise<void> {
    this.form.queryCategoryField = categoryField;
    this.form.queryCategoryValue = '';
    this.categoryValues = [];

    if (this.selectedPersistentQuery && categoryField) {
      await this.loadCategoryValuesForField(this.selectedPersistentQuery.rtId, categoryField);
    }
  }

  private async loadCategoryValuesForField(queryRtId: string, categoryField: string): Promise<void> {
    this.isLoadingCategoryValues = true;

    try {
      const result = await firstValueFrom(this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: queryRtId,
          first: 100
        }
      }));

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length > 0 && queryItems[0]) {
        const queryResult = queryItems[0];
        const rows = queryResult.rows?.items ?? [];
        const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

        const values = new Set<string>();

        for (const row of rows) {
          if (!row || !supportedRowTypes.includes(row.__typename ?? '')) continue;

          const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
          const cells = queryRow.cells?.items ?? [];

          for (const cell of cells) {
            if (!cell?.attributePath) continue;

            const sanitizedPath = this.sanitizeFieldName(cell.attributePath);
            if (sanitizedPath === categoryField && cell.value !== null && cell.value !== undefined) {
              values.add(String(cell.value));
            }
          }
        }

        this.categoryValues = Array.from(values).map(v => ({
          value: v,
          displayValue: v
        }));
      }
    } catch (error) {
      console.error('Error loading category values:', error);
      this.categoryValues = [];
    } finally {
      this.isLoadingCategoryValues = false;
    }
  }

  private async extractCategoryValues(_queryResult: { rows?: { items?: ({ __typename?: string; cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null } | null)[] | null } | null }): Promise<void> {
    // Load category values if a category field is already selected
    if (this.queryColumns.length > 0 && this.form.queryCategoryField && this.selectedPersistentQuery) {
      await this.loadCategoryValuesForField(this.selectedPersistentQuery.rtId, this.form.queryCategoryField);
    }
  }

  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
  }
}
