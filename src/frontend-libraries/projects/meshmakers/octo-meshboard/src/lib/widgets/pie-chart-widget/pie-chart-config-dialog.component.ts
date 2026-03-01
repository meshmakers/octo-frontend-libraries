import { Component, Input, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { searchIcon, chartPieIcon } from '@progress/kendo-svg-icons';
import { firstValueFrom } from 'rxjs';
import { PieChartType, CkQueryTarget, DataSourceType, WidgetFilterConfig } from '../../models/meshboard.models';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { FieldFilterDto, FieldFilterOperatorsDto, AttributeItem, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';

/**
 * Configuration result from the Pie Chart dialog
 */
export interface PieChartConfigResult extends WidgetConfigResult {
  dataSourceType: DataSourceType;
  // Persistent Query fields
  queryRtId?: string;
  queryName?: string;
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
    QuerySelectorComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        @if (isLoadingInitial) {
          <div class="loading-indicator">Loading...</div>
        }

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

        <!-- Filters Section (only for persistent queries with columns) -->
        @if (form.dataSourceType === 'persistentQuery' && filterAttributes.length > 0) {
          <div class="config-section">
            <h3 class="section-title">Filters</h3>
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

          <div class="form-row">
            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.showLabels" kendoCheckBox />
                Show Labels
              </label>
            </div>

            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.showLegend" kendoCheckBox />
                Show Legend
              </label>
            </div>
          </div>

          @if (form.showLegend) {
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
      flex: 1;
      overflow-y: auto;
      gap: 20px;
      padding: 16px;
      position: relative;
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

    .form-row {
      display: flex;
      gap: 24px;
    }

    .checkbox-field {
      flex-direction: row;
      align-items: center;
    }

    .checkbox-field label {
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
export class PieChartConfigDialogComponent implements OnInit {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialDataSourceType?: DataSourceType;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialChartType?: PieChartType;
  @Input() initialCategoryField?: string;
  @Input() initialValueField?: string;
  @Input() initialShowLabels?: boolean;
  @Input() initialShowLegend?: boolean;
  @Input() initialLegendPosition?: 'top' | 'bottom' | 'left' | 'right';
  @Input() initialCkQueryTarget?: CkQueryTarget;
  @Input() initialCkGroupBy?: string;
  @Input() initialFilters?: WidgetFilterConfig[];

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
  queryColumns: QueryColumnItem[] = [];

  // Filter state
  filters: FieldFilterItem[] = [];
  filterAttributes: AttributeItem[] = [];
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
    showLabels: true,
    showLegend: true,
    legendPosition: 'right' as 'top' | 'bottom' | 'left' | 'right',
    ckQueryTarget: 'models' as CkQueryTarget,
    ckGroupBy: 'modelState'
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
    this.form.showLabels = this.initialShowLabels ?? true;
    this.form.showLegend = this.initialShowLegend ?? true;
    this.form.legendPosition = this.initialLegendPosition ?? 'right';
    this.form.ckQueryTarget = this.initialCkQueryTarget ?? 'models';
    this.form.ckGroupBy = this.initialCkGroupBy ?? 'modelState';

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

    // If editing with initial query, load it after view init
    if (this.form.dataSourceType === 'persistentQuery' && this.initialQueryRtId) {
      this.isLoadingInitial = true;
      // Defer to allow QuerySelectorComponent to initialize
      setTimeout(async () => {
        if (this.querySelector) {
          const query = await this.querySelector.selectByRtId(this.initialQueryRtId!);
          if (query) {
            this.selectedPersistentQuery = query;
            await this.loadQueryColumns(query.rtId);
            if (query.queryCkTypeId) {
              await this.loadFilterAttributes(query.queryCkTypeId);
            }
          }
        }
        this.isLoadingInitial = false;
      }, 100);
    }
  }

  onDataSourceTypeChange(dataSourceType: DataSourceType): void {
    this.form.dataSourceType = dataSourceType;

    // Reset related fields when changing data source type
    if (dataSourceType !== 'persistentQuery') {
      this.selectedPersistentQuery = null;
      this.queryColumns = [];
      this.filterAttributes = [];
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
    this.filterAttributes = [];
    this.filters = [];
    this.form.categoryField = '';
    this.form.valueField = '';

    if (query) {
      // Load query columns for field mapping
      await this.loadQueryColumns(query.rtId);

      // Load filter attributes from CK type
      if (query.queryCkTypeId) {
        await this.loadFilterAttributes(query.queryCkTypeId);
      }
    }
  }

  private async loadQueryColumns(queryRtId: string): Promise<void> {
    this.isLoadingColumns = true;

    try {
      const result = await firstValueFrom(this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: queryRtId,
          first: 1 // We only need columns, not data
        }
      }));

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length > 0 && queryItems[0]) {
        const columns = queryItems[0].columns ?? [];
        const filteredColumns = columns
          .filter((c): c is NonNullable<typeof c> => c !== null);

        // queryColumns use sanitized paths for UI display and matching with query results
        this.queryColumns = filteredColumns.map(c => ({
          attributePath: this.sanitizeFieldName(c.attributePath ?? ''),
          attributeValueType: c.attributeValueType ?? ''
        }));

        // Auto-select fields if only 2 columns (typical for grouped aggregations)
        if (this.queryColumns.length === 2 && !this.form.categoryField && !this.form.valueField) {
          // Assume first column is category, second is value (typical pattern)
          const numericTypes = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];
          const valueColumn = this.queryColumns.find(c => numericTypes.includes(c.attributeValueType));
          const categoryColumn = this.queryColumns.find(c => c !== valueColumn);

          if (valueColumn && categoryColumn) {
            this.form.valueField = valueColumn.attributePath;
            this.form.categoryField = categoryColumn.attributePath;
          }
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
   * Loads all available filter attributes from the CK type.
   * Uses getCkTypeAvailableQueryColumns to get all attributes, not just query result columns.
   */
  private async loadFilterAttributes(queryCkTypeId: string): Promise<void> {
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

  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
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
      showLabels: this.form.showLabels,
      showLegend: this.form.showLegend,
      legendPosition: this.form.legendPosition,
      filters: filtersDto
    };

    if (this.form.dataSourceType === 'persistentQuery') {
      if (!this.selectedPersistentQuery) return;
      result.queryRtId = this.selectedPersistentQuery.rtId;
      result.queryName = this.selectedPersistentQuery.name;
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
