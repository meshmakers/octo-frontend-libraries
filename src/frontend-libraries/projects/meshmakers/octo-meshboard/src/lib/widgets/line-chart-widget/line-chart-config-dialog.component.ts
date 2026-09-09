import { Component, Input, OnInit, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { firstValueFrom } from 'rxjs';
import { LineChartType, WidgetFilterConfig, ChartReferenceLine, EntitySelectorConfig, SeriesAggregationFunction } from '../../models/meshboard.models';
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

/**
 * Configuration result from the Line Chart dialog
 */
export interface LineChartConfigResult extends WidgetConfigResult {
  queryRtId: string;
  queryName?: string;
  queryFamily?: QueryFamily;
  ignoreTimeFilter?: boolean;
  /** Asset-scope binding: id of the entity selector whose selection scopes the stream-data query. */
  entitySelectorId?: string;
  /** Resolution-aware routing (AB#4290): auto-select the best archive/rollup before querying. */
  resolutionAware?: boolean;
  /** Aggregation the series is reduced with (required when resolutionAware). */
  requiredAggregation?: SeriesAggregationFunction;
  chartType: LineChartType;
  categoryField: string;
  seriesGroupField: string;
  valueField: string;
  unitField?: string;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  showMarkers: boolean;
  showDataBadge: boolean;
  filters?: FieldFilterDto[];
  referenceLines?: ChartReferenceLine[];
}

/**
 * Configuration dialog for Line Chart widgets.
 * Supports line and area chart types with multi-series and multi-axis configuration.
 */
@Component({
  selector: 'mm-line-chart-config-dialog',
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
              hint="Select a query that returns time-series data with grouping.">
            </mm-query-selector>
          </div>

          <mm-sd-time-filter-toggle
            [family]="selectedQueryFamily"
            [(ignoreTimeFilter)]="ignoreTimeFilter">
          </mm-sd-time-filter-toggle>

          <mm-entity-selector-scope-picker
            [family]="selectedQueryFamily"
            [selectors]="availableEntitySelectors"
            [(entitySelectorId)]="entitySelectorId">
          </mm-entity-selector-scope-picker>

          @if (selectedQueryFamily === 'streamData') {
            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="resolutionAware" kendoCheckBox />
                Resolution-aware archive selection
              </label>
            </div>
            <p class="field-hint">Picks the coarsest rollup that still yields the target point count for the visible time range, then downsamples against it. Each scoped source entity renders as its own line.</p>

            @if (resolutionAware) {
              <div class="form-field">
                <label>Aggregation <span class="required">*</span></label>
                <kendo-dropdownlist
                  [data]="aggregationOptions"
                  [textField]="'label'"
                  [valueField]="'value'"
                  [valuePrimitive]="true"
                  [(ngModel)]="requiredAggregation">
                </kendo-dropdownlist>
                <p class="field-hint">How the <strong>Value Field</strong> is reduced across buckets. Energy registers are additive → Sum. Never guessed.</p>
              </div>
            }
          }
        </div>

        <!-- Field Mapping Section -->
        @if (selectedPersistentQuery && queryColumns.length > 0) {
          <div class="config-section">
            <h3 class="section-title">Field Mapping</h3>

            <div class="form-field">
              <label>Category Field (X-Axis) <span class="required">*</span></label>
              <kendo-combobox
                [data]="queryColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.categoryField"
                placeholder="Select date/time field...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Date/time field used for the X-axis (e.g., timeRange_from).</p>
            </div>

            <div class="form-field">
              <label>Series Group Field <span class="required">*</span></label>
              <kendo-combobox
                [data]="nonNumericColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.seriesGroupField"
                placeholder="Select grouping field...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Each unique value becomes a separate line (e.g., OBIS code).</p>
            </div>

            <div class="form-field">
              <label>Value Field (Y-Axis) <span class="required">*</span></label>
              <kendo-combobox
                [data]="numericColumns"
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
              <p class="field-hint">Numeric field for Y-axis values (e.g., sum).</p>
            </div>

            <div class="form-field">
              <label>Unit Field</label>
              <kendo-combobox
                [data]="nonNumericColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.unitField"
                [clearButton]="true"
                placeholder="Select unit field (optional)...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Optional unit field (e.g., kWh, m3). Creates separate Y-axes per unit.</p>
            </div>
          </div>
        }

        <!-- Filters Section -->
        @if (selectedPersistentQuery?.queryCkTypeId) {
          <div class="config-section">
            <h3 class="section-title">Filters</h3>
            <p class="section-hint">Define filters to narrow down the data.</p>
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
            <div class="chart-type-grid">
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="line"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Line</span>
              </label>
              <label class="radio-label">
                <input type="radio"
                       name="chartType"
                       value="area"
                       [(ngModel)]="form.chartType"
                       kendoRadioButton />
                <span>Area</span>
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
                <input type="checkbox" [(ngModel)]="form.showMarkers" kendoCheckBox />
                Show Markers
              </label>
            </div>

            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.showDataBadge" kendoCheckBox />
                Show data badge
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

        <div class="form-section">
          <h4>Reference Lines</h4>
          <p class="section-hint">Add horizontal threshold lines to the chart.</p>
          @for (refLine of form.referenceLines; track $index) {
            <div class="reference-line-row">
              <kendo-numerictextbox [(ngModel)]="refLine.value" [format]="'n0'" [placeholder]="'Value'" [spinners]="false" style="width: 100px;"></kendo-numerictextbox>
              <kendo-textbox [(ngModel)]="refLine.label" [placeholder]="'Label (e.g. Limit)'" style="flex: 1;"></kendo-textbox>
              <kendo-textbox [(ngModel)]="refLine.color" [placeholder]="'Color (#ef4444)'" style="width: 110px;"></kendo-textbox>
              <button kendoButton fillMode="flat" (click)="removeReferenceLine($index)">Remove</button>
            </div>
          }
          <button kendoButton fillMode="flat" (click)="addReferenceLine()">+ Add Reference Line</button>
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
      gap: 20px;
      flex: 1;
      overflow-y: auto;
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
      align-items: center;
    }

    .checkbox-field {
      flex-direction: row;
      align-items: center;
      margin-bottom: 0;
    }

    .checkbox-field label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: normal;
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

    .form-section {
      margin-top: 8px;
    }

    .form-section h4 {
      margin: 0 0 4px 0;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .reference-line-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
  `]
})
export class LineChartConfigDialogComponent implements OnInit {
  private readonly getRuntimeQueryColumnsGQL = inject(GetRuntimeQueryColumnsDtoGQL);
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialQueryFamily?: QueryFamily;
  @Input() initialIgnoreTimeFilter?: boolean;
  @Input() initialEntitySelectorId?: string;
  @Input() initialResolutionAware?: boolean;
  @Input() initialRequiredAggregation?: SeriesAggregationFunction;
  @Input() initialChartType?: LineChartType;
  @Input() initialCategoryField?: string;
  @Input() initialSeriesGroupField?: string;
  @Input() initialValueField?: string;
  @Input() initialUnitField?: string;
  @Input() initialShowLegend?: boolean;
  @Input() initialLegendPosition?: 'top' | 'bottom' | 'left' | 'right';
  @Input() initialShowMarkers?: boolean;
  @Input() initialShowDataBadge?: boolean;
  @Input() initialReferenceLines?: ChartReferenceLine[];
  @Input() initialFilters?: WidgetFilterConfig[];

  // State
  isLoadingInitial = false;
  isLoadingColumns = false;

  // Persistent Query
  selectedPersistentQuery: PersistentQueryItem | null = null;
  queryColumns: QueryColumnItem[] = [];
  numericColumns: QueryColumnItem[] = [];
  nonNumericColumns: QueryColumnItem[] = [];

  /** Per-widget opt-out of the MeshBoard time-filter → stream-data binding. */
  ignoreTimeFilter = false;

  /** Asset-scope binding: id of the entity selector whose selection scopes the stream-data query. */
  entitySelectorId?: string;

  /** Resolution-aware routing (AB#4290): auto-select the best archive/rollup before querying. */
  resolutionAware = false;
  /** Aggregation the series is reduced with (required when resolutionAware). */
  requiredAggregation: SeriesAggregationFunction = 'SUM';

  /** Aggregation options for the resolution-aware reducer dropdown. */
  readonly aggregationOptions: { value: SeriesAggregationFunction; label: string }[] = [
    { value: 'SUM', label: 'Sum (additive, e.g. energy)' },
    { value: 'AVG', label: 'Average (instantaneous)' },
    { value: 'MAX', label: 'Max (e.g. demand)' },
    { value: 'MIN', label: 'Min' },
    { value: 'COUNT', label: 'Count' },
    { value: 'TIME_WEIGHTED_AVG', label: 'Time-weighted average (event-based duty cycle)' }
  ];

  /** Entity selectors available on the current MeshBoard (for the scope picker). */
  get availableEntitySelectors(): EntitySelectorConfig[] {
    return this.stateService.getEntitySelectors();
  }

  /** Family of the currently selected query — gates the time-filter opt-out toggle. */
  get selectedQueryFamily(): QueryFamily | null {
    return queryFamily(this.selectedPersistentQuery?.ckTypeId) ?? this.initialQueryFamily ?? null;
  }

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
    chartType: 'line' as LineChartType,
    categoryField: '',
    seriesGroupField: '',
    valueField: '',
    unitField: '' as string | undefined,
    showLegend: true,
    legendPosition: 'right' as 'top' | 'bottom' | 'left' | 'right',
    showMarkers: false,
    showDataBadge: true,
    referenceLines: [] as ChartReferenceLine[]
  };

  get isValid(): boolean {
    return this.selectedPersistentQuery !== null
      && this.form.categoryField !== ''
      && this.form.seriesGroupField !== ''
      && this.form.valueField !== '';
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.ignoreTimeFilter = this.initialIgnoreTimeFilter ?? false;
    this.entitySelectorId = this.initialEntitySelectorId;
    this.resolutionAware = this.initialResolutionAware ?? false;
    this.requiredAggregation = this.initialRequiredAggregation ?? 'SUM';
    this.form.chartType = this.initialChartType ?? 'line';
    this.form.categoryField = this.initialCategoryField ?? '';
    this.form.seriesGroupField = this.initialSeriesGroupField ?? '';
    this.form.valueField = this.initialValueField ?? '';
    this.form.unitField = this.initialUnitField ?? '';
    this.form.showLegend = this.initialShowLegend ?? true;
    this.form.legendPosition = this.initialLegendPosition ?? 'right';
    this.form.showMarkers = this.initialShowMarkers ?? false;
    this.form.showDataBadge = this.initialShowDataBadge ?? true;
    this.form.referenceLines = this.initialReferenceLines ? [...this.initialReferenceLines] : [];

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
      setTimeout(async () => {
        if (this.querySelector) {
          const query = await this.querySelector.selectByRtId(this.initialQueryRtId!);
          if (query) {
            this.selectedPersistentQuery = query;
            await this.loadQueryColumns(query.rtId);
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
    this.filters = [];
    this.form.categoryField = '';
    this.form.seriesGroupField = '';
    this.form.valueField = '';
    this.form.unitField = '';

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

      const numericTypes = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];
      this.numericColumns = this.queryColumns.filter(c =>
        numericTypes.includes(c.attributeValueType)
      );
      this.nonNumericColumns = this.queryColumns.filter(c =>
        !numericTypes.includes(c.attributeValueType)
      );
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

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
  }

  onSave(): void {
    if (!this.selectedPersistentQuery) return;

    const filtersDto: FieldFilterDto[] | undefined = this.filters.length > 0
      ? this.filters.map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }))
      : undefined;

    const family = queryFamily(this.selectedPersistentQuery.ckTypeId) ?? this.initialQueryFamily ?? undefined;

    const result: LineChartConfigResult = {
      ckTypeId: '',
      rtId: '',
      queryRtId: this.selectedPersistentQuery.rtId,
      queryName: this.selectedPersistentQuery.name,
      queryFamily: family,
      ignoreTimeFilter: this.ignoreTimeFilter,
      entitySelectorId: this.entitySelectorId,
      resolutionAware: this.resolutionAware || undefined,
      requiredAggregation: this.resolutionAware ? this.requiredAggregation : undefined,
      chartType: this.form.chartType,
      categoryField: this.form.categoryField,
      seriesGroupField: this.form.seriesGroupField,
      valueField: this.form.valueField,
      unitField: this.form.unitField || undefined,
      showLegend: this.form.showLegend,
      legendPosition: this.form.legendPosition,
      showMarkers: this.form.showMarkers,
      showDataBadge: this.form.showDataBadge,
      referenceLines: this.form.referenceLines.length > 0 ? this.form.referenceLines : undefined,
      filters: filtersDto
    };

    this.windowRef.close(result);
  }

  addReferenceLine(): void {
    this.form.referenceLines.push({ value: 0, label: '', color: '#ef4444' });
  }

  removeReferenceLine(index: number): void {
    this.form.referenceLines.splice(index, 1);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
