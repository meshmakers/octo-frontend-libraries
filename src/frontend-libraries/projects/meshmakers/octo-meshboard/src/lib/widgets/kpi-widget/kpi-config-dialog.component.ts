import { Component, Input, OnInit, inject, ViewChild, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService, FieldFilterOperatorsDto, AttributeSelectorService, AttributeItem, FieldFilterDto } from '@meshmakers/octo-services';
import {
  EntitySelectInputComponent
} from '@meshmakers/shared-ui';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { firstValueFrom } from 'rxjs';
import { KpiQueryMode, WidgetFilterConfig, EntitySelectorConfig } from '../../models/meshboard.models';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { RuntimeEntityItem, PersistentQueryItem, QueryColumnItem, CategoryValueItem, RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource } from '../../utils/runtime-entity-data-sources';
import { QueryFamily, queryFamily } from '../../utils/query-family';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';
import { SdTimeFilterToggleComponent } from '../../components/sd-time-filter-toggle/sd-time-filter-toggle.component';
import { EntitySelectorScopePickerComponent } from '../../components/entity-selector-scope-picker/entity-selector-scope-picker.component';
import { matchesAttributePath } from '../../utils/widget-data-utils';

/**
 * Data source type for KPI
 */
export type KpiDataSourceType = 'runtimeEntity' | 'persistentQuery' | 'static';

/**
 * Configuration result from the KPI dialog
 */
export interface KpiConfigResult extends WidgetConfigResult {
  dataSourceType: KpiDataSourceType;
  // Runtime entity fields
  ckTypeId: string;
  rtId?: string;
  valueAttribute: string;
  labelAttribute?: string;
  // Persistent query fields
  queryRtId?: string;
  queryName?: string;
  queryFamily?: QueryFamily;
  ignoreTimeFilter?: boolean;
  /** Asset-scope binding: id of the entity selector whose selection scopes the stream-data query. */
  entitySelectorId?: string;
  queryMode?: KpiQueryMode;
  queryValueField?: string;
  queryCategoryField?: string;
  queryCategoryValue?: string;
  // Static fields
  staticValue?: string;
  // Display options
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  comparisonText?: string;
  // Filters
  filters?: FieldFilterDto[];
}

interface TrendOption {
  value: 'up' | 'down' | 'neutral' | undefined;
  label: string;
}

/**
 * Configuration dialog for KPI widgets.
 * Allows selecting data source, value attribute, and display options.
 */
@Component({
  selector: 'mm-kpi-config-dialog',
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
    QuerySelectorComponent,
    SdTimeFilterToggleComponent,
    EntitySelectorScopePickerComponent,
    LoadingOverlayComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        <mm-loading-overlay [loading]="isLoadingInitial" />

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
            <button
              kendoButton
              [fillMode]="dataSourceType === 'static' ? 'solid' : 'outline'"
              [themeColor]="dataSourceType === 'static' ? 'primary' : 'base'"
              (click)="onDataSourceTypeChange('static')">
              Static
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

          <!-- Mode Selection (Count vs Single Entity) -->
          <div class="form-field">
            <label>Mode</label>
            <div class="mode-toggle">
              <button
                kendoButton
                [fillMode]="isCountMode ? 'solid' : 'outline'"
                [themeColor]="isCountMode ? 'primary' : 'base'"
                (click)="setCountMode(true)">
                Count Entities
              </button>
              <button
                kendoButton
                [fillMode]="!isCountMode ? 'solid' : 'outline'"
                [themeColor]="!isCountMode ? 'primary' : 'base'"
                (click)="setCountMode(false)">
                Single Entity Value
              </button>
            </div>
            <p class="field-hint">
              {{ isCountMode ? 'Display the count of all entities of the selected type.' : 'Display a specific attribute value from a single entity.' }}
            </p>
          </div>

          <!-- Entity Selection (only for single entity mode) -->
          @if (!isCountMode) {
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

            <!-- Value Attribute -->
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
              <p class="field-hint">The attribute path to display as the KPI value.</p>
            </div>

            <!-- Label Attribute -->
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
              hint="Select a query to provide data for this KPI.">
            </mm-query-selector>
          </div>

          <!-- Stream-data: opt out of the MeshBoard time-filter binding -->
          <mm-sd-time-filter-toggle
            [family]="selectedQueryFamily"
            [(ignoreTimeFilter)]="ignoreTimeFilter">
          </mm-sd-time-filter-toggle>

          <mm-entity-selector-scope-picker
            [family]="selectedQueryFamily"
            [selectors]="availableEntitySelectors"
            [(entitySelectorId)]="entitySelectorId">
          </mm-entity-selector-scope-picker>

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
              <p class="field-hint">The column containing the aggregated value.</p>
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
              <p class="field-hint">The grouping column (e.g., legalEntityType).</p>
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
              <p class="field-hint">The specific category to display (e.g., LegalPerson).</p>
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
              <p class="field-hint">The column containing the numeric value.</p>
            </div>
          }
        }

        <!-- ============================================================ -->
        <!-- STATIC DATA SOURCE -->
        <!-- ============================================================ -->
        @if (dataSourceType === 'static') {
          <div class="form-field">
            <label>Value <span class="required">*</span></label>
            <kendo-textbox
              [(ngModel)]="form.staticValue"
              placeholder="e.g., Fixed text or a variable reference">
            </kendo-textbox>
            <p class="field-hint">Enter a static value or reference a MeshBoard variable using <code>{{variableSyntaxHint}}</code> syntax.</p>
          </div>
        }

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
            <label>Trend</label>
            <kendo-dropdownlist
              [data]="trendOptions"
              textField="label"
              valueField="value"
              [valuePrimitive]="true"
              [(ngModel)]="form.trend">
            </kendo-dropdownlist>
          </div>
          <div class="form-field">
            <label>Comparison Text</label>
            <kendo-textbox [(ngModel)]="form.comparisonText" placeholder="e.g. +3,1% vs. last week"></kendo-textbox>
            <p class="section-hint">Displayed below the value in the trend color. Supports {{ variableSyntaxHint }}</p>
          </div>
        </div>

        <!-- Filters Section -->
        @if (dataSourceType === 'runtimeEntity' ? selectedCkType?.rtCkTypeId : selectedPersistentQuery?.queryCkTypeId) {
          <div class="form-section">
            <h4>Filters</h4>
            <p class="section-hint">Define filters to narrow down the data.</p>
            <mm-field-filter-editor
              [ckTypeId]="(dataSourceType === 'runtimeEntity' ? selectedCkType?.rtCkTypeId : selectedPersistentQuery?.queryCkTypeId) ?? undefined"
              [filters]="filters"
              [enableVariables]="filterVariables.length > 0"
              [availableVariables]="filterVariables"
              (filtersChange)="onFiltersChange($event)">
            </mm-field-filter-editor>
          </div>
        }
      </div>

      <div class="action-bar mm-dialog-actions">
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .config-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .action-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }

    .config-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      position: relative;
    }

    .config-form.loading {
      pointer-events: none;
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

    .mode-toggle {
      display: flex;
      gap: 8px;
    }

    .mode-toggle button {
      flex: 1;
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
export class KpiConfigDialogComponent implements OnInit {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly attributeSelectorService = inject(AttributeSelectorService);
  private readonly getRuntimeQueryColumnsGQL = inject(GetRuntimeQueryColumnsDtoGQL);
  private readonly queryExecutor = inject(QueryExecutorService);

  /**
   * Row __typenames the dialog recognises when collecting distinct category
   * values from a query result for the grouped-aggregation category picker.
   */
  private static readonly INTROSPECTION_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtSimpleQueryRow',
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);
  private readonly meshBoardStateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('ckTypeSelector') ckTypeSelectorInput?: CkTypeSelectorInputComponent;
  @ViewChild('entitySelector') entitySelectorInput?: EntitySelectInputComponent;
  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing - Runtime Entity
  @Input() initialCkTypeId?: string;
  @Input() initialRtId?: string;
  @Input() initialValueAttribute?: string;
  @Input() initialLabelAttribute?: string;
  @Input() initialPrefix?: string;
  @Input() initialSuffix?: string;
  @Input() initialTrend?: 'up' | 'down' | 'neutral';
  @Input() initialComparisonText?: string;

  // Initial values for editing - Persistent Query
  @Input() initialDataSourceType?: KpiDataSourceType;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialQueryFamily?: QueryFamily;
  @Input() initialIgnoreTimeFilter?: boolean;
  @Input() initialEntitySelectorId?: string;
  @Input() initialQueryMode?: KpiQueryMode;
  @Input() initialQueryValueField?: string;
  @Input() initialQueryCategoryField?: string;
  @Input() initialQueryCategoryValue?: string;

  // Initial values for static
  @Input() initialStaticValue?: string;

  // Initial values for filters
  @Input() initialFilters?: WidgetFilterConfig[];

  // Data source type selection
  dataSourceType: KpiDataSourceType = 'runtimeEntity';

  // Runtime Entity state
  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;
  isLoadingInitial = false;
  isCountMode = false;

  // Persistent Query state
  selectedPersistentQuery: PersistentQueryItem | null = null;
  /** Stream-data opt-out: when true the MeshBoard time filter is not bound to the query. */
  ignoreTimeFilter = false;
  entitySelectorId?: string;
  queryColumns: QueryColumnItem[] = [];
  categoryValues: CategoryValueItem[] = [];
  queryMode: KpiQueryMode = 'simpleCount';

  /** Family of the currently selected query; drives the time-filter toggle's visibility. */
  get selectedQueryFamily(): QueryFamily | null {
    return queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily ?? null;
  }

  /** Entity selectors available on the current MeshBoard (for the scope picker). */
  get availableEntitySelectors(): EntitySelectorConfig[] {
    return this.meshBoardStateService.getEntitySelectors();
  }
  isLoadingQueryColumns = false;
  isLoadingCategoryValues = false;

  // Attribute selection
  readonly isLoadingAttributes = signal(false);
  readonly availableAttributes = signal<AttributeItem[]>([]);
  readonly filteredValueAttributes = signal<AttributeItem[]>([]);
  readonly filteredLabelAttributes = signal<AttributeItem[]>([]);

  // Filter state
  filters: FieldFilterItem[] = [];
  filterVariables: FilterVariable[] = [];

  form = {
    valueAttribute: '',
    labelAttribute: '',
    prefix: '',
    suffix: '',
    trend: undefined as 'up' | 'down' | 'neutral' | undefined,
    comparisonText: '',
    // Query-specific form fields
    queryValueField: '',
    queryCategoryField: '',
    queryCategoryValue: '',
    // Static form fields
    staticValue: ''
  };

  readonly variableSyntaxHint = '${variableName}';

  trendOptions: TrendOption[] = [
    { value: undefined, label: 'None' },
    { value: 'up', label: 'Up (positive)' },
    { value: 'down', label: 'Down (negative)' },
    { value: 'neutral', label: 'Neutral' }
  ];

  queryModeOptions = [
    { value: 'simpleCount' as KpiQueryMode, label: 'Total Count (Simple Query)' },
    { value: 'aggregation' as KpiQueryMode, label: 'Aggregation Value' },
    { value: 'groupedAggregation' as KpiQueryMode, label: 'Grouped Aggregation' }
  ];

  get isValid(): boolean {
    if (this.dataSourceType === 'static') {
      return (this.form.staticValue?.trim() ?? '') !== '';
    }
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
    if (!this.selectedCkType) return false;
    if (this.isCountMode) return true;
    return this.selectedEntity !== null && (this.form.valueAttribute?.trim() ?? '') !== '';
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.meshBoardStateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.form.valueAttribute = this.initialValueAttribute || '';
    this.form.labelAttribute = this.initialLabelAttribute || '';
    this.form.prefix = this.initialPrefix || '';
    this.form.suffix = this.initialSuffix || '';
    this.form.trend = this.initialTrend;
    this.form.comparisonText = this.initialComparisonText || '';
    this.form.queryValueField = this.initialQueryValueField || '';
    this.form.queryCategoryField = this.initialQueryCategoryField || '';
    this.form.queryCategoryValue = this.initialQueryCategoryValue || '';
    this.form.staticValue = this.initialStaticValue || '';

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
    this.ignoreTimeFilter = this.initialIgnoreTimeFilter ?? false;
    this.entitySelectorId = this.initialEntitySelectorId;

    // Check if this is count mode (for runtime entity)
    this.isCountMode = this.initialValueAttribute === '_count';

    if (this.dataSourceType === 'persistentQuery' && this.initialQueryRtId) {
      this.isLoadingInitial = true;
      setTimeout(async () => {
        if (this.querySelector) {
          const query = await this.querySelector.selectByRtId(this.initialQueryRtId!);
          if (query) {
            this.selectedPersistentQuery = query;
            await this.loadQueryColumnsAndValues();
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

        if (this.initialRtId && this.entityDataSource && !this.isCountMode) {
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
          rtDisplayName: entity.rtDisplayName,
          rtDisplayDescription: entity.rtDisplayDescription ?? undefined,
          displayName: entity.rtDisplayName
        };
      }
    } catch (error) {
      console.error('Error loading initial entity:', error);
    }
  }

  setCountMode(countMode: boolean): void {
    this.isCountMode = countMode;
    if (countMode) {
      this.selectedEntity = null;
      this.form.valueAttribute = '_count';
      this.form.labelAttribute = '';
    } else {
      this.form.valueAttribute = '';
    }
  }

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.selectedEntity = null;

    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
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
    this.filters = [];
  }

  private loadAvailableAttributes(ckTypeId: string): void {
    this.isLoadingAttributes.set(true);
    // Restrict to direct attributes: navigation expansion explodes deeply (3+ hops)
    // and the backend caps the result at `first` (1000), which crowds out direct
    // attributes that sort later alphabetically (e.g. "temperature" is hidden behind
    // many "containedInSpace.*->..." paths). Direct attributes are what users pick
    // for a KPI value/label in the typical case.
    const includeNavigationProperties = false;
    this.attributeSelectorService
      .getAvailableAttributes(
        ckTypeId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        includeNavigationProperties
      )
      .subscribe({
        next: (result) => {
          this.availableAttributes.set(result.items);
          this.filteredValueAttributes.set(result.items);
          this.filteredLabelAttributes.set(result.items);
          this.isLoadingAttributes.set(false);
        },
        error: (err) => {
          console.error('Error loading attributes:', err);
          this.availableAttributes.set([]);
          this.filteredValueAttributes.set([]);
          this.filteredLabelAttributes.set([]);
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

  onSave(): void {
    // Convert filters to DTO format
    const filtersDto: FieldFilterDto[] | undefined = this.filters.length > 0
      ? this.filters.map(f => ({
          attributePath: f.attributePath,
          operator: f.operator,
          comparisonValue: f.comparisonValue
        }))
      : undefined;

    if (this.dataSourceType === 'static') {
      this.windowRef.close({
        dataSourceType: 'static',
        ckTypeId: '',
        valueAttribute: '',
        staticValue: this.form.staticValue,
        prefix: this.form.prefix || undefined,
        suffix: this.form.suffix || undefined,
        trend: this.form.trend,
        comparisonText: this.form.comparisonText || undefined
      });
      return;
    }

    if (this.dataSourceType === 'persistentQuery' && this.selectedPersistentQuery) {
      const family = queryFamily(this.selectedPersistentQuery.ckTypeId) ?? this.initialQueryFamily ?? undefined;
      this.windowRef.close({
        dataSourceType: 'persistentQuery',
        ckTypeId: '',
        rtId: undefined,
        valueAttribute: '',
        queryRtId: this.selectedPersistentQuery.rtId,
        queryName: this.selectedPersistentQuery.name,
        queryFamily: family,
        ignoreTimeFilter: this.ignoreTimeFilter,
        entitySelectorId: this.entitySelectorId,
        queryMode: this.queryMode,
        queryValueField: this.form.queryValueField || undefined,
        queryCategoryField: this.form.queryCategoryField || undefined,
        queryCategoryValue: this.form.queryCategoryValue || undefined,
        prefix: this.form.prefix || undefined,
        suffix: this.form.suffix || undefined,
        trend: this.form.trend,
        comparisonText: this.form.comparisonText || undefined,
        filters: filtersDto
      });
    } else if (this.selectedCkType) {
      this.windowRef.close({
        dataSourceType: 'runtimeEntity',
        ckTypeId: this.selectedCkType.rtCkTypeId,
        rtId: this.isCountMode ? undefined : this.selectedEntity?.rtId,
        valueAttribute: this.isCountMode ? '_count' : this.form.valueAttribute,
        labelAttribute: this.form.labelAttribute || undefined,
        prefix: this.form.prefix || undefined,
        suffix: this.form.suffix || undefined,
        trend: this.form.trend,
        comparisonText: this.form.comparisonText || undefined,
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

  onDataSourceTypeChange(type: KpiDataSourceType): void {
    this.dataSourceType = type;
  }

  // ============================================================================
  // Persistent Query Methods
  // ============================================================================

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.queryColumns = [];
    this.categoryValues = [];
    this.filters = [];
    this.form.queryValueField = '';
    this.form.queryCategoryField = '';
    this.form.queryCategoryValue = '';

    if (query) {
      // Load query columns for field mapping
      await this.loadQueryColumnsAndValues(query.rtId);
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

  private async loadQueryColumnsAndValues(queryRtId?: string): Promise<void> {
    const rtId = queryRtId || this.selectedPersistentQuery?.rtId;
    if (!rtId) return;

    // queryFamily may be undefined when the selected query metadata is missing —
    // fetchColumnsForFamily resolves it via the executor's one-time lookup.
    const family = queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily;

    this.isLoadingQueryColumns = true;

    try {
      this.queryColumns = await this.fetchColumnsForFamily(family, rtId);

      // Category values for grouped aggregation are loaded on-demand by
      // loadCategoryValuesForField — only when a categoryField is actually selected.
      if (this.queryColumns.length > 0 && this.queryMode === 'groupedAggregation' && this.form.queryCategoryField) {
        await this.loadCategoryValuesForField(rtId, this.form.queryCategoryField);
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.queryColumns = [];
    } finally {
      this.isLoadingQueryColumns = false;
    }
  }

  /**
   * Loads column metadata for the picker. Runtime queries use the
   * metadata-only resolver (no aggregation executed); stream-data queries
   * fall back to executing the query with `first: 1`. When `family` is
   * unknown (legacy configs), the executor resolves it once by rtId lookup.
   */
  private async fetchColumnsForFamily(family: QueryFamily | undefined, rtId: string): Promise<QueryColumnItem[]> {
    const resolvedFamily = family ?? await this.queryExecutor.resolveFamily(rtId);
    if (resolvedFamily === 'runtime') {
      const result = await firstValueFrom(this.getRuntimeQueryColumnsGQL.fetch({
        variables: { rtId }
      }));
      const queryItem = result.data?.runtime?.runtimeQuery?.items?.[0];
      if (!queryItem) return [];
      return (queryItem.columns ?? [])
        .filter((c): c is NonNullable<typeof c> => c !== null)
        // Column AttributePath is already in the engine's wire form for aggregation /
        // grouping columns (e.g. `quantity_sum`, `operatingstatus`) so picker entries
        // double as both the visible label and the stored config value.
        .map(c => ({
          attributePath: c.attributePath ?? '',
          attributeValueType: c.attributeValueType ?? '',
          aggregationType: c.aggregationType ?? null
        }));
    }

    // Stream-data: execute with a tiny page just to surface columns.
    const sdResult = await firstValueFrom(this.queryExecutor.executeStreamData(rtId, { first: 1 }));
    return sdResult.columns.map(c => ({
      attributePath: c.attributePath,
      attributeValueType: c.attributeValueType ?? '',
      aggregationType: c.aggregationType ?? null
    }));
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
      // family may be undefined here — the executor falls back to a lookup.
      const family = queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily;
      const result = await firstValueFrom(this.queryExecutor.execute(family, queryRtId, { first: 100 }));

      const values = new Set<string>();
      for (const row of result.rows) {
        if (!KpiConfigDialogComponent.INTROSPECTION_ROW_TYPES.has(row.__typename ?? '')) continue;
        for (const cell of row.cells) {
          if (matchesAttributePath(cell.attributePath, categoryField) && cell.value !== null && cell.value !== undefined) {
            values.add(String(cell.value));
          }
        }
      }

      this.categoryValues = Array.from(values).map(v => ({
        value: v,
        displayValue: v
      }));
    } catch (error) {
      console.error('Error loading category values:', error);
      this.categoryValues = [];
    } finally {
      this.isLoadingCategoryValues = false;
    }
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
  }
}
