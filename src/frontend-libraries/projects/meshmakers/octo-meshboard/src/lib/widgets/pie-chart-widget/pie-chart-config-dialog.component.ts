import { Component, Input, OnInit, AfterViewInit, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { searchIcon, chartPieIcon, plusIcon, trashIcon } from '@progress/kendo-svg-icons';
import { firstValueFrom } from 'rxjs';
import { PieChartType, PieChartLabelPosition, CkQueryTarget, DataSourceType, WidgetFilterConfig, EntitySelectorConfig } from '../../models/meshboard.models';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { QueryExecutorService } from '../../services/query-executor.service';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { FieldFilterDto, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { QueryFamily, queryFamily } from '../../utils/query-family';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';
import { SdTimeFilterToggleComponent } from '../../components/sd-time-filter-toggle/sd-time-filter-toggle.component';
import { EntitySelectorScopePickerComponent } from '../../components/entity-selector-scope-picker/entity-selector-scope-picker.component';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';

/**
 * Configuration result from the Pie Chart dialog
 */
export interface PieChartConfigResult extends WidgetConfigResult {
  dataSourceType: DataSourceType;
  // Persistent Query fields
  queryRtId?: string;
  queryName?: string;
  queryFamily?: QueryFamily;
  ignoreTimeFilter?: boolean;
  /** Asset-scope binding: id of the entity selector whose selection scopes the stream-data query. */
  entitySelectorId?: string;
  categoryField: string;
  valueField: string;
  // Construction Kit Query fields
  ckQueryTarget?: CkQueryTarget;
  ckGroupBy?: string;
  // Chart options
  chartType: PieChartType;
  showLabels: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  /** Colour per category (AB#5622); absent = default colours. */
  categoryColors?: Record<string, string>;
  /** Slice label position (AB#5622); absent = chart default. */
  labelPosition?: PieChartLabelPosition;
  /** Hide labels of slices below this share in percent (AB#5622); absent = all labelled. */
  hideLabelsBelowPercent?: number;
  // Filters
  filters?: FieldFilterDto[];
}

/**
 * Configuration dialog for Pie Chart widgets.
 */
@Component({
  selector: 'mm-pie-chart-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    SVGIconModule,
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

        <!-- Data Source Type Section -->
        <div class="config-section">
          <h3 class="section-title">Data Source</h3>

          <div class="form-field">
            <label>Data Source Type <span class="required">*</span></label>
            <kendo-dropdownlist
              [data]="dataSourceTypes"
              [textField]="'label'"
              [valueField]="'value'"
              [valuePrimitive]="true"
              [(ngModel)]="form.dataSourceType"
              (valueChange)="onDataSourceTypeChange($event)">
            </kendo-dropdownlist>
          </div>

          <!-- Query Options -->
          @if (form.dataSourceType === 'persistentQuery') {
            <div class="form-field">
              <label>Query <span class="required">*</span></label>
              <mm-query-selector
                #querySelector
                [(ngModel)]="selectedPersistentQuery"
                (querySelected)="onQuerySelected($event)"
                placeholder="Select a Query..."
                hint="Select a grouped aggregation query for the chart data.">
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
          }

          <!-- Construction Kit Query Options -->
          @if (form.dataSourceType === 'constructionKitQuery') {
            <div class="form-field">
              <label>Query Target <span class="required">*</span></label>
              <kendo-dropdownlist
                [data]="ckQueryTargets"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.ckQueryTarget"
                (valueChange)="onCkQueryTargetChange($event)">
              </kendo-dropdownlist>
              <p class="field-hint">What to query from the Construction Kit.</p>
            </div>

            <div class="form-field">
              <label>Group By <span class="required">*</span></label>
              <kendo-dropdownlist
                [data]="ckGroupByOptions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.ckGroupBy">
              </kendo-dropdownlist>
              <p class="field-hint">Field to group results by for chart segments.</p>
            </div>
          }
        </div>

        <!-- Field Mapping Section (only for persistent queries) -->
        @if (form.dataSourceType === 'persistentQuery' && selectedPersistentQuery && queryColumns.length > 0) {
          <div class="config-section">
            <h3 class="section-title">Field Mapping</h3>

            <div class="form-field">
              <label>Category Field <span class="required">*</span></label>
              <kendo-combobox
                [data]="queryColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.categoryField"
                placeholder="Select category field...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Field used for category labels (e.g., legalEntityType).</p>
            </div>

            <div class="form-field">
              <label>Value Field <span class="required">*</span></label>
              <kendo-combobox
                [data]="queryColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.valueField"
                placeholder="Select value field...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Field used for numeric values (e.g., count, sum).</p>
            </div>
          </div>
        }

        <!-- Filters Section (only for persistent queries with a CK type) -->
        @if (form.dataSourceType === 'persistentQuery' && selectedPersistentQuery?.queryCkTypeId) {
          <div class="config-section">
            <h3 class="section-title">Filters</h3>
            <mm-field-filter-editor
              [ckTypeId]="selectedPersistentQuery?.queryCkTypeId ?? undefined"
              [filters]="filters"
              [enableVariables]="filterVariables.length > 0"
              [availableVariables]="filterVariables"
              (filtersChange)="onFiltersChange($event)">
            </mm-field-filter-editor>
          </div>
        }

        <!-- Chart Options Section -->
        <div class="config-section">
          <h3 class="section-title">Chart Options</h3>

          <div class="form-field">
            <label>Chart Type</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="pie"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Pie</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="donut"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Donut</span>
              </label>
            </div>
          </div>

          <div class="form-field">
            <label>Display Mode</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio"
                       name="displayMode"
                       value="legend"
                       [(ngModel)]="form.displayMode"
                       kendoRadioButton />
                <span>Legend</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="displayMode"
                       value="labels"
                       [(ngModel)]="form.displayMode"
                       kendoRadioButton />
                <span>Labels</span>
              </label>
            </div>
          </div>

          @if (form.displayMode === 'legend') {
            <div class="form-field">
              <label>Legend Position</label>
              <kendo-dropdownlist
                [data]="legendPositions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.legendPosition">
              </kendo-dropdownlist>
            </div>
          }

          @if (form.displayMode === 'labels') {
            <div class="form-field">
              <label for="pie-label-position">Label Position</label>
              <kendo-dropdownlist
                id="pie-label-position"
                data-pie-label-position
                [data]="labelPositions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.labelPosition">
              </kendo-dropdownlist>
            </div>
            <div class="form-field">
              <label for="pie-hide-labels-below">Hide labels of slices below (%)</label>
              <kendo-numerictextbox
                id="pie-hide-labels-below"
                data-pie-hide-labels-below
                [min]="0"
                [max]="50"
                [decimals]="1"
                [format]="'n1'"
                [(ngModel)]="form.hideLabelsBelowPercent">
              </kendo-numerictextbox>
              <span class="section-hint">Small neighbouring slices no longer overlap; 0 labels every slice.</span>
            </div>
          }

          <div class="form-field" data-pie-category-colors>
            <label>Category Colours</label>
            <span class="section-hint">Raw category value or label → hex colour, CSS variable (--brand-paid) or status (success, warning, error, info). Others use the theme palette.</span>
            @for (entry of categoryColorRows; track entry.id) {
              <div class="category-color-row">
                <kendo-textbox [(ngModel)]="entry.category" placeholder="Category (e.g. PAID)" [attr.aria-label]="'Category'"></kendo-textbox>
                <kendo-textbox [(ngModel)]="entry.color" placeholder="#2fb37a or --token" [attr.aria-label]="'Colour'"></kendo-textbox>
                <input type="color" class="category-color-swatch" [value]="swatchValue(entry.color)" (input)="entry.color = $any($event.target).value" [attr.aria-label]="'Pick colour'" />
                <button kendoButton fillMode="flat" type="button" [svgIcon]="removeIcon" (click)="removeCategoryColor(entry.id)" [attr.aria-label]="'Remove category colour'" title="Remove"></button>
              </div>
            }
            <button kendoButton fillMode="flat" type="button" [svgIcon]="addIcon" (click)="addCategoryColor()" data-pie-add-category-color>Add category colour</button>
          </div>
        </div>
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
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .action-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }

    .config-form {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow-y: auto;
      gap: 20px;
      padding: 16px;
      position: relative;
    }

    .config-form.loading {
      pointer-events: none;
    }

    .config-section {
      padding: 16px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .section-hint {
      margin: 0 0 12px 0;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .form-field:last-child {
      margin-bottom: 0;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .required {
      color: var(--kendo-color-error, #dc3545);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .category-color-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .category-color-row kendo-textbox { flex: 1; min-width: 0; }
    .category-color-swatch { width: 32px; height: 28px; padding: 0; border: none; background: none; cursor: pointer; }

    .radio-group {
      display: flex;
      gap: 24px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: normal;
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
export class PieChartConfigDialogComponent implements OnInit, AfterViewInit {
  private readonly getRuntimeQueryColumnsGQL = inject(GetRuntimeQueryColumnsDtoGQL);
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialDataSourceType?: DataSourceType;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialQueryFamily?: QueryFamily;
  @Input() initialIgnoreTimeFilter?: boolean;
  @Input() initialEntitySelectorId?: string;
  @Input() initialChartType?: PieChartType;
  @Input() initialCategoryField?: string;
  @Input() initialValueField?: string;
  @Input() initialShowLabels?: boolean;
  @Input() initialShowLegend?: boolean;
  @Input() initialLegendPosition?: 'top' | 'bottom' | 'left' | 'right';
  @Input() initialCkQueryTarget?: CkQueryTarget;
  @Input() initialCkGroupBy?: string;
  @Input() initialFilters?: WidgetFilterConfig[];
  @Input() initialCategoryColors?: Record<string, string>;
  @Input() initialLabelPosition?: PieChartLabelPosition;
  @Input() initialHideLabelsBelowPercent?: number;

  protected readonly addIcon = plusIcon;
  protected readonly removeIcon = trashIcon;

  /** Rows of the category colour editor (AB#5622). */
  categoryColorRows: { id: number; category: string; color: string }[] = [];
  private nextCategoryColorId = 1;

  labelPositions: { value: PieChartLabelPosition | undefined; label: string }[] = [
    { value: undefined, label: 'Default' },
    { value: 'outside', label: 'Outside (with connector lines)' },
    { value: 'inside', label: 'Inside' },
    { value: 'none', label: 'None' }
  ];

  protected readonly searchIcon = searchIcon;
  protected readonly chartPieIcon = chartPieIcon;

  // State
  isLoadingInitial = false;
  isLoadingColumns = false;

  // Data source types
  dataSourceTypes = [
    { value: 'persistentQuery', label: 'Query' },
    { value: 'constructionKitQuery', label: 'Construction Kit Query' }
  ];

  // CK Query targets
  ckQueryTargets = [
    { value: 'models', label: 'Models' },
    { value: 'types', label: 'Types' },
    { value: 'attributes', label: 'Attributes' },
    { value: 'associationRoles', label: 'Association Roles' },
    { value: 'enums', label: 'Enums' },
    { value: 'records', label: 'Records' }
  ];

  // CK Group By options (depends on selected query target)
  ckGroupByOptions: { value: string; label: string }[] = [];

  // Query selection state
  selectedPersistentQuery: PersistentQueryItem | null = null;
  /** Stream-data opt-out: when true the MeshBoard time filter is not bound to the query. */
  ignoreTimeFilter = false;
  entitySelectorId?: string;
  queryColumns: QueryColumnItem[] = [];

  // Filter state
  filters: FieldFilterItem[] = [];
  filterVariables: FilterVariable[] = [];

  // Legend position options
  legendPositions = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' }
  ];

  // Form
  form = {
    dataSourceType: 'persistentQuery' as DataSourceType,
    chartType: 'pie' as PieChartType,
    categoryField: '',
    valueField: '',
    displayMode: 'legend' as 'legend' | 'labels',
    legendPosition: 'right' as 'top' | 'bottom' | 'left' | 'right',
    ckQueryTarget: 'models' as CkQueryTarget,
    ckGroupBy: 'modelState',
    labelPosition: undefined as PieChartLabelPosition | undefined,
    hideLabelsBelowPercent: 0 as number | null
  };

  get isValid(): boolean {
    if (this.form.dataSourceType === 'persistentQuery') {
      return this.selectedPersistentQuery !== null &&
             this.form.categoryField !== '' &&
             this.form.valueField !== '';
    }

    if (this.form.dataSourceType === 'constructionKitQuery') {
      return this.form.ckQueryTarget !== undefined &&
             this.form.ckGroupBy !== '';
    }

    return false;
  }

  /** Family of the currently selected query; drives the time-filter toggle's visibility. */
  get selectedQueryFamily(): QueryFamily | null {
    return queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily ?? null;
  }

  /** Entity selectors available on the current MeshBoard (for the scope picker). */
  get availableEntitySelectors(): EntitySelectorConfig[] {
    return this.stateService.getEntitySelectors();
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.form.dataSourceType = this.initialDataSourceType ?? 'persistentQuery';
    this.form.chartType = this.initialChartType ?? 'pie';
    this.form.categoryField = this.initialCategoryField ?? '';
    this.form.valueField = this.initialValueField ?? '';
    this.form.displayMode = this.initialShowLabels === true ? 'labels' : 'legend';
    this.form.legendPosition = this.initialLegendPosition ?? 'right';
    this.form.ckQueryTarget = this.initialCkQueryTarget ?? 'models';
    this.form.ckGroupBy = this.initialCkGroupBy ?? 'modelState';
    this.form.labelPosition = this.initialLabelPosition;
    this.form.hideLabelsBelowPercent = this.initialHideLabelsBelowPercent ?? 0;
    this.categoryColorRows = Object.entries(this.initialCategoryColors ?? {}).map(([category, color]) => ({ id: this.nextCategoryColorId++, category, color }));
    this.ignoreTimeFilter = this.initialIgnoreTimeFilter ?? false;
    this.entitySelectorId = this.initialEntitySelectorId;

    // Initialize filters
    if (this.initialFilters && this.initialFilters.length > 0) {
      this.filters = this.initialFilters.map((f, index) => ({
        id: index + 1,
        attributePath: f.attributePath,
        operator: f.operator as FieldFilterOperatorsDto,
        comparisonValue: f.comparisonValue
      }));
    }

    // Initialize CK group by options
    this.updateCkGroupByOptions(this.form.ckQueryTarget);

    // Mark as loading if we need to restore initial query (loaded in ngAfterViewInit)
    if (this.form.dataSourceType === 'persistentQuery' && this.initialQueryRtId) {
      this.isLoadingInitial = true;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.form.dataSourceType === 'persistentQuery' && this.initialQueryRtId && this.querySelector) {
      try {
        const query = await this.querySelector.selectByRtId(this.initialQueryRtId);
        if (query) {
          this.selectedPersistentQuery = query;
          await this.loadQueryColumns(query.rtId);
        }
      } finally {
        this.isLoadingInitial = false;
      }
    }
  }

  onDataSourceTypeChange(dataSourceType: DataSourceType): void {
    this.form.dataSourceType = dataSourceType;

    // Reset related fields when changing data source type
    if (dataSourceType !== 'persistentQuery') {
      this.selectedPersistentQuery = null;
      this.queryColumns = [];
      this.filters = [];
      this.form.categoryField = '';
      this.form.valueField = '';
    }
  }

  onCkQueryTargetChange(target: CkQueryTarget): void {
    this.form.ckQueryTarget = target;
    this.updateCkGroupByOptions(target);
  }

  private updateCkGroupByOptions(target: CkQueryTarget): void {
    // Set group by options based on query target
    switch (target) {
      case 'models':
        this.ckGroupByOptions = [
          { value: 'modelState', label: 'Model State' }
        ];
        this.form.ckGroupBy = 'modelState';
        break;
      case 'types':
        this.ckGroupByOptions = [
          { value: 'isAbstract', label: 'Is Abstract' }
        ];
        this.form.ckGroupBy = 'isAbstract';
        break;
      default:
        this.ckGroupByOptions = [];
        this.form.ckGroupBy = '';
        break;
    }
  }

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.queryColumns = [];
    this.filters = [];
    this.form.categoryField = '';
    this.form.valueField = '';

    if (query) {
      await this.loadQueryColumns(query.rtId);
    }
  }

  private async loadQueryColumns(queryRtId: string): Promise<void> {
    this.isLoadingColumns = true;
    // family may be undefined when the selected query metadata is missing —
    // fetchColumnsForFamily resolves it via the executor's one-time lookup.
    const family = queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily;

    try {
      this.queryColumns = await this.fetchColumnsForFamily(family, queryRtId);

      // Auto-select fields if only 2 columns (typical for grouped aggregations)
      if (this.queryColumns.length === 2 && !this.form.categoryField && !this.form.valueField) {
        const numericTypes = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];
        const valueColumn = this.queryColumns.find(c => numericTypes.includes(c.attributeValueType));
        const categoryColumn = this.queryColumns.find(c => c !== valueColumn);

        if (valueColumn && categoryColumn) {
          this.form.valueField = valueColumn.attributePath;
          this.form.categoryField = categoryColumn.attributePath;
        }
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.queryColumns = [];
    } finally {
      this.isLoadingColumns = false;
    }
  }

  /**
   * Runtime queries use the metadata-only resolver (no aggregation executed);
   * stream-data queries fall back to executing the query with `first: 1`
   * because the SD path has no dedicated column-introspection endpoint today.
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
        .map(c => ({
          attributePath: c.attributePath ?? '',
          attributeValueType: c.attributeValueType ?? '',
          aggregationType: c.aggregationType ?? null
        }));
    }

    const sdResult = await firstValueFrom(this.queryExecutor.executeStreamData(rtId, { first: 1 }));
    return sdResult.columns.map(c => ({
      attributePath: c.attributePath,
      attributeValueType: c.attributeValueType ?? '',
      aggregationType: c.aggregationType ?? null
    }));
  }

  addCategoryColor(): void {
    this.categoryColorRows = [...this.categoryColorRows, { id: this.nextCategoryColorId++, category: '', color: '' }];
  }

  removeCategoryColor(id: number): void {
    this.categoryColorRows = this.categoryColorRows.filter(row => row.id !== id);
  }

  /** Value of the native colour picker: the row's hex colour, else black (the picker needs a #rrggbb value). */
  swatchValue(color: string): string {
    return /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : '#000000';
  }

  /** The edited category colours; rows without category or colour are dropped; none = undefined. */
  private categoryColorsResult(): Record<string, string> | undefined {
    const entries = this.categoryColorRows
      .map(row => [row.category.trim(), row.color.trim()] as const)
      .filter(([category, color]) => category !== '' && color !== '');
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
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

    const result: PieChartConfigResult = {
      ckTypeId: '', // Not used for pie chart
      rtId: '', // Not used for pie chart
      dataSourceType: this.form.dataSourceType,
      chartType: this.form.chartType,
      categoryField: this.form.categoryField,
      valueField: this.form.valueField,
      showLabels: this.form.displayMode === 'labels',
      showLegend: this.form.displayMode === 'legend',
      legendPosition: this.form.legendPosition,
      filters: filtersDto
    };
    const categoryColors = this.categoryColorsResult();
    if (categoryColors) {
      result.categoryColors = categoryColors;
    }
    if (this.form.displayMode === 'labels') {
      if (this.form.labelPosition) {
        result.labelPosition = this.form.labelPosition;
      }
      if (this.form.hideLabelsBelowPercent && this.form.hideLabelsBelowPercent > 0) {
        result.hideLabelsBelowPercent = this.form.hideLabelsBelowPercent;
      }
    }

    if (this.form.dataSourceType === 'persistentQuery') {
      if (!this.selectedPersistentQuery) return;
      result.queryRtId = this.selectedPersistentQuery.rtId;
      result.queryName = this.selectedPersistentQuery.name;
      result.queryFamily = queryFamily(this.selectedPersistentQuery.ckTypeId) ?? this.initialQueryFamily ?? undefined;
      result.ignoreTimeFilter = this.ignoreTimeFilter;
      result.entitySelectorId = this.entitySelectorId;
    } else if (this.form.dataSourceType === 'constructionKitQuery') {
      result.ckQueryTarget = this.form.ckQueryTarget;
      result.ckGroupBy = this.form.ckGroupBy;
    }

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
