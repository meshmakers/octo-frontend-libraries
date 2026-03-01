import { Component, Input, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { firstValueFrom } from 'rxjs';
import { BarChartType, BarChartSeries, WidgetFilterConfig } from '../../models/meshboard.models';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { FieldFilterDto, FieldFilterOperatorsDto, AttributeItem, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';

/**
 * Series configuration mode
 */
export type SeriesMode = 'static' | 'dynamic';

/**
 * Configuration result from the Bar Chart dialog
 */
export interface BarChartConfigResult extends WidgetConfigResult {
  queryRtId: string;
  queryName?: string;
  chartType: BarChartType;
  categoryField: string;
  series: BarChartSeries[];
  /** Series Group Field for dynamic series mode */
  seriesGroupField?: string;
  /** Value Field for dynamic series mode */
  valueField?: string;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  showDataLabels: boolean;
  filters?: FieldFilterDto[];
}

/**
 * Configuration dialog for Bar Chart widgets.
 * Supports column, bar, stacked, and 100% stacked chart types.
 */
@Component({
  selector: 'mm-bar-chart-config-dialog',
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

        <!-- Data Source Section -->
        <div class="config-section">
          <h3 class="section-title">Data Source</h3>

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
        </div>

        <!-- Field Mapping Section -->
        @if (selectedPersistentQuery && queryColumns.length > 0) {
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
              <p class="field-hint">Field used for category labels (X-axis for column charts, Y-axis for bar charts).</p>
            </div>

            <div class="form-field">
              <label>Series Mode</label>
              <kendo-dropdownlist
                [data]="seriesModeOptions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="seriesMode">
              </kendo-dropdownlist>
              <p class="field-hint">
                @if (seriesMode === 'static') {
                  Select multiple numeric fields, each becomes a separate series.
                } @else {
                  Group rows by a field value to create dynamic series from your data.
                }
              </p>
            </div>

            @if (seriesMode === 'static') {
              <!-- Static Series Mode: Multi-select for value fields -->
              <div class="form-field">
                <label>Value Fields (Series) <span class="required">*</span></label>
                <kendo-multiselect
                  [data]="numericColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="selectedSeriesFields"
                  (valueChange)="onSeriesFieldsChange($event)"
                  placeholder="Select value fields...">
                  <ng-template kendoMultiSelectItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-multiselect>
                <p class="field-hint">Select one or more numeric fields. Each becomes a series in the chart.</p>
              </div>
            } @else {
              <!-- Dynamic Series Mode: Series Group Field + Value Field -->
              <div class="form-field">
                <label>Series Group Field <span class="required">*</span></label>
                <kendo-combobox
                  [data]="nonNumericColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="seriesGroupField"
                  placeholder="Select series group field...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
                <p class="field-hint">Each unique value in this field becomes a separate series (e.g., 'Credit', 'Debit').</p>
              </div>

              <div class="form-field">
                <label>Value Field <span class="required">*</span></label>
                <kendo-combobox
                  [data]="numericColumns"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [(ngModel)]="valueField"
                  placeholder="Select value field...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
                <p class="field-hint">The numeric field to display for each category/series combination.</p>
              </div>
            }
          </div>
        }

        <!-- Filters Section -->
        @if (filterAttributes.length > 0) {
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
            <div class="chart-type-grid">
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="column"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Column</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="bar"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Bar</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="stackedColumn"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Stacked Column</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="stackedBar"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Stacked Bar</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="stackedColumn100"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>100% Column</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="stackedBar100"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>100% Bar</span>
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.showLegend" kendoCheckBox />
                Show Legend
              </label>
            </div>

            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.showDataLabels" kendoCheckBox />
                Show Data Labels
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
      gap: 20px;
      flex: 1;
      overflow-y: auto;
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

    .chart-type-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
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
export class BarChartConfigDialogComponent implements OnInit {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialChartType?: BarChartType;
  @Input() initialCategoryField?: string;
  @Input() initialSeries?: BarChartSeries[];
  @Input() initialSeriesGroupField?: string;
  @Input() initialValueField?: string;
  @Input() initialShowLegend?: boolean;
  @Input() initialLegendPosition?: 'top' | 'bottom' | 'left' | 'right';
  @Input() initialShowDataLabels?: boolean;
  @Input() initialFilters?: WidgetFilterConfig[];

  // State
  isLoadingInitial = false;
  isLoadingColumns = false;

  // Persistent Query
  selectedPersistentQuery: PersistentQueryItem | null = null;
  queryColumns: QueryColumnItem[] = [];
  numericColumns: QueryColumnItem[] = [];

  // Filter state
  filters: FieldFilterItem[] = [];
  filterAttributes: AttributeItem[] = [];
  filterVariables: FilterVariable[] = [];

  // Series mode and fields selection
  seriesMode: SeriesMode = 'static';
  selectedSeriesFields: string[] = [];  // For static mode
  seriesGroupField = '';                 // For dynamic mode
  valueField = '';                       // For dynamic mode

  // Non-numeric columns for series grouping
  nonNumericColumns: QueryColumnItem[] = [];

  // Series mode options
  seriesModeOptions = [
    { value: 'static', label: 'Static Series (multiple value fields)' },
    { value: 'dynamic', label: 'Dynamic Series (group by field)' }
  ];

  // Legend position options
  legendPositions = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' }
  ];

  // Form
  form = {
    chartType: 'column' as BarChartType,
    categoryField: '',
    showLegend: true,
    legendPosition: 'right' as 'top' | 'bottom' | 'left' | 'right',
    showDataLabels: false
  };

  get isValid(): boolean {
    if (this.selectedPersistentQuery === null || this.form.categoryField === '') {
      return false;
    }

    if (this.seriesMode === 'dynamic') {
      return this.seriesGroupField !== '' && this.valueField !== '';
    } else {
      return this.selectedSeriesFields.length > 0;
    }
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.form.chartType = this.initialChartType ?? 'column';
    this.form.categoryField = this.initialCategoryField ?? '';
    this.form.showLegend = this.initialShowLegend ?? true;
    this.form.legendPosition = this.initialLegendPosition ?? 'right';
    this.form.showDataLabels = this.initialShowDataLabels ?? false;

    // Determine series mode from initial values
    if (this.initialSeriesGroupField && this.initialValueField) {
      this.seriesMode = 'dynamic';
      this.seriesGroupField = this.initialSeriesGroupField;
      this.valueField = this.initialValueField;
    } else {
      this.seriesMode = 'static';
      // Initialize series fields from initial series
      if (this.initialSeries && this.initialSeries.length > 0) {
        this.selectedSeriesFields = this.initialSeries.map(s => s.field);
      }
    }

    // Initialize filters
    if (this.initialFilters && this.initialFilters.length > 0) {
      this.filters = this.initialFilters.map((f, index) => ({
        id: index + 1,
        attributePath: f.attributePath,
        operator: f.operator as FieldFilterOperatorsDto,
        comparisonValue: f.comparisonValue
      }));
    }

    // If editing with initial query, load it after view init
    if (this.initialQueryRtId) {
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

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.queryColumns = [];
    this.numericColumns = [];
    this.nonNumericColumns = [];
    this.filterAttributes = [];
    this.filters = [];
    this.form.categoryField = '';
    this.selectedSeriesFields = [];
    this.seriesGroupField = '';
    this.valueField = '';

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

        // Filter numeric and non-numeric columns
        const numericTypes = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];
        this.numericColumns = this.queryColumns.filter(c =>
          numericTypes.includes(c.attributeValueType)
        );
        this.nonNumericColumns = this.queryColumns.filter(c =>
          !numericTypes.includes(c.attributeValueType)
        );

        // Auto-select fields if possible and not editing
        if (!this.initialQueryRtId && this.queryColumns.length >= 2) {
          // Find first non-numeric column for category
          const categoryColumn = this.queryColumns.find(c =>
            !numericTypes.includes(c.attributeValueType)
          );
          if (categoryColumn) {
            this.form.categoryField = categoryColumn.attributePath;
          }

          // Auto-select all numeric columns as series
          if (this.numericColumns.length > 0) {
            this.selectedSeriesFields = this.numericColumns.map(c => c.attributePath);
          }
        }
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.queryColumns = [];
      this.numericColumns = [];
      this.nonNumericColumns = [];
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

  onSeriesFieldsChange(fields: string[]): void {
    this.selectedSeriesFields = fields;
  }

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
  }

  onSave(): void {
    if (!this.selectedPersistentQuery) return;

    // Build series array from selected fields (only for static mode)
    const series: BarChartSeries[] = this.seriesMode === 'static'
      ? this.selectedSeriesFields.map(field => {
          // Check if we have initial series with custom names/colors
          const existingSeries = this.initialSeries?.find(s => s.field === field);
          return {
            field,
            name: existingSeries?.name,
            color: existingSeries?.color
          };
        })
      : [];

    // Convert filters to DTO format
    const filtersDto: FieldFilterDto[] | undefined = this.filters.length > 0
      ? this.filters.map(f => ({
          attributePath: f.attributePath,
          operator: f.operator,
          comparisonValue: f.comparisonValue
        }))
      : undefined;

    const result: BarChartConfigResult = {
      ckTypeId: '',
      rtId: '',
      queryRtId: this.selectedPersistentQuery.rtId,
      queryName: this.selectedPersistentQuery.name,
      chartType: this.form.chartType,
      categoryField: this.form.categoryField,
      series,
      showLegend: this.form.showLegend,
      legendPosition: this.form.legendPosition,
      showDataLabels: this.form.showDataLabels,
      filters: filtersDto
    };

    // Add dynamic series fields if in dynamic mode
    if (this.seriesMode === 'dynamic') {
      result.seriesGroupField = this.seriesGroupField;
      result.valueField = this.valueField;
    }

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
