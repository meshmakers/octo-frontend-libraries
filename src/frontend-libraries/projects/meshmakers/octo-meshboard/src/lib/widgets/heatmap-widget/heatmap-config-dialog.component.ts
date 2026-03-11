import { Component, Input, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { firstValueFrom } from 'rxjs';
import { HeatmapColorScheme, HeatmapAggregation, WidgetFilterConfig } from '../../models/meshboard.models';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { FieldFilterDto, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';

/**
 * Configuration result from the Heatmap dialog
 */
export interface HeatmapConfigResult extends WidgetConfigResult {
  queryRtId: string;
  queryName?: string;
  dateField: string;
  dateEndField?: string;
  valueField?: string;
  aggregation: HeatmapAggregation;
  colorScheme: HeatmapColorScheme;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  decimalPlaces?: number;
  compactNumbers?: boolean;
  valueMultiplier?: number;
  filters?: FieldFilterDto[];
}

@Component({
  selector: 'mm-heatmap-config-dialog',
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
              hint="Select a query containing datetime data for the heatmap.">
            </mm-query-selector>
          </div>
        </div>

        <!-- Field Mapping Section -->
        @if (selectedPersistentQuery && queryColumns.length > 0) {
          <div class="config-section">
            <h3 class="section-title">Field Mapping</h3>

            <div class="form-field">
              <label>Date/Time Field <span class="required">*</span></label>
              <kendo-combobox
                [data]="dateTimeColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.dateField"
                placeholder="Select date/time field...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">The datetime field used to group data into day/hour buckets.</p>
            </div>

            <div class="form-field">
              <label>Date/Time End Field</label>
              <kendo-combobox
                [data]="dateTimeColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.dateEndField"
                [clearButton]="true"
                placeholder="Select end field (optional)...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Optional: end-of-interval field (e.g. timeRange.to). When set, sub-hour intervals are auto-detected.</p>
            </div>

            <div class="form-field">
              <label>Value Field</label>
              <kendo-combobox
                [data]="numericColumns"
                [textField]="'attributePath'"
                [valueField]="'attributePath'"
                [valuePrimitive]="true"
                [(ngModel)]="form.valueField"
                [clearButton]="true"
                placeholder="Select value field (optional)...">
                <ng-template kendoComboBoxItemTemplate let-dataItem>
                  <div class="column-item">
                    <span class="column-path">{{ dataItem.attributePath }}</span>
                    <span class="column-type">{{ dataItem.attributeValueType }}</span>
                  </div>
                </ng-template>
              </kendo-combobox>
              <p class="field-hint">Numeric field to aggregate. Leave empty for count aggregation.</p>
            </div>

            <div class="form-field">
              <label>Aggregation</label>
              <kendo-dropdownlist
                [data]="aggregationOptions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.aggregation">
              </kendo-dropdownlist>
              <p class="field-hint">How to aggregate values within each time slot.</p>
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

        <!-- Display Options Section -->
        <div class="config-section">
          <h3 class="section-title">Display Options</h3>

          <div class="form-field">
            <label>Color Scheme</label>
            <div class="color-scheme-grid">
              @for (scheme of colorSchemeOptions; track scheme.value) {
                <label class="radio-label">
                  <input type="radio"
                         name="colorScheme"
                         [value]="scheme.value"
                         [(ngModel)]="form.colorScheme"
                         kendoRadioButton />
                  <span class="color-scheme-preview">
                    <span class="color-swatch" [style.background]="scheme.previewColor"></span>
                    {{ scheme.label }}
                  </span>
                </label>
              }
            </div>
          </div>

          <div class="form-field">
            <label>Decimal Places</label>
            <kendo-numerictextbox
              [(ngModel)]="form.decimalPlaces"
              [min]="0"
              [max]="6"
              [step]="1"
              [decimals]="0"
              format="n0">
            </kendo-numerictextbox>
            <p class="field-hint">Number of decimal places for displayed values (0-6).</p>
          </div>

          <div class="form-row">
            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.compactNumbers" kendoCheckBox />
                Compact Numbers (SI: 32k, 1.5M, 3G)
              </label>
            </div>
          </div>

          @if (form.compactNumbers) {
            <div class="form-field">
              <label>Value Scale</label>
              <kendo-dropdownlist
                [data]="valueMultiplierOptions"
                [textField]="'label'"
                [valueField]="'value'"
                [valuePrimitive]="true"
                [(ngModel)]="form.valueMultiplier">
              </kendo-dropdownlist>
              <p class="field-hint">If values are already in thousands (k), select ×1000 so 13.000 displays as 13M.</p>
            </div>
          }

          <div class="form-row">
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

    .color-scheme-grid {
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

    .color-scheme-preview {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .color-swatch {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
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
export class HeatmapConfigDialogComponent implements OnInit {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialDateField?: string;
  @Input() initialDateEndField?: string;
  @Input() initialValueField?: string;
  @Input() initialAggregation?: HeatmapAggregation;
  @Input() initialColorScheme?: HeatmapColorScheme;
  @Input() initialShowLegend?: boolean;
  @Input() initialLegendPosition?: 'top' | 'bottom' | 'left' | 'right';
  @Input() initialDecimalPlaces?: number;
  @Input() initialCompactNumbers?: boolean;
  @Input() initialValueMultiplier?: number;
  @Input() initialFilters?: WidgetFilterConfig[];

  // State
  isLoadingInitial = false;
  isLoadingColumns = false;

  // Persistent Query
  selectedPersistentQuery: PersistentQueryItem | null = null;
  queryColumns: QueryColumnItem[] = [];
  numericColumns: QueryColumnItem[] = [];
  dateTimeColumns: QueryColumnItem[] = [];

  // Filter state
  filters: FieldFilterItem[] = [];
  filterVariables: FilterVariable[] = [];

  // Aggregation options
  aggregationOptions = [
    { value: 'count', label: 'Count (number of rows)' },
    { value: 'sum', label: 'Sum (total of values)' },
    { value: 'avg', label: 'Average (mean of values)' }
  ];

  // Color scheme options
  colorSchemeOptions = [
    { value: 'green' as HeatmapColorScheme, label: 'Green', previewColor: '#66bb6a' },
    { value: 'redGreen' as HeatmapColorScheme, label: 'Red-Green', previewColor: '#aed581' },
    { value: 'blue' as HeatmapColorScheme, label: 'Blue', previewColor: '#42a5f5' },
    { value: 'heat' as HeatmapColorScheme, label: 'Heat', previewColor: '#ff9800' }
  ];

  // Value multiplier options
  valueMultiplierOptions = [
    { value: 1, label: 'As-is (×1)' },
    { value: 1000, label: 'Values are in k (×1000)' },
    { value: 1000000, label: 'Values are in M (×1000000)' }
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
    dateField: '',
    dateEndField: '' as string | undefined,
    valueField: '' as string | undefined,
    aggregation: 'count' as HeatmapAggregation,
    colorScheme: 'green' as HeatmapColorScheme,
    showLegend: true,
    legendPosition: 'bottom' as 'top' | 'bottom' | 'left' | 'right',
    decimalPlaces: 2,
    compactNumbers: false,
    valueMultiplier: 1
  };

  get isValid(): boolean {
    return this.selectedPersistentQuery !== null && this.form.dateField !== '';
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.form.dateField = this.initialDateField ?? '';
    this.form.dateEndField = this.initialDateEndField;
    this.form.valueField = this.initialValueField;
    this.form.aggregation = this.initialAggregation ?? 'count';
    this.form.colorScheme = this.initialColorScheme ?? 'green';
    this.form.showLegend = this.initialShowLegend ?? true;
    this.form.legendPosition = this.initialLegendPosition ?? 'bottom';
    this.form.decimalPlaces = this.initialDecimalPlaces ?? 2;
    this.form.compactNumbers = this.initialCompactNumbers ?? false;
    this.form.valueMultiplier = this.initialValueMultiplier ?? 1;

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
    this.dateTimeColumns = [];
    this.filters = [];
    this.form.dateField = '';
    this.form.dateEndField = undefined;
    this.form.valueField = undefined;

    if (query) {
      await this.loadQueryColumns(query.rtId);
    }
  }

  private async loadQueryColumns(queryRtId: string): Promise<void> {
    this.isLoadingColumns = true;

    try {
      const result = await firstValueFrom(this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: queryRtId,
          first: 1
        }
      }));

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length > 0 && queryItems[0]) {
        const columns = queryItems[0].columns ?? [];
        const filteredColumns = columns
          .filter((c): c is NonNullable<typeof c> => c !== null);

        this.queryColumns = filteredColumns.map(c => ({
          attributePath: this.sanitizeFieldName(c.attributePath ?? ''),
          attributeValueType: c.attributeValueType ?? ''
        }));

        const numericTypes = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];
        const dateTimeTypes = ['DATE_TIME', 'DATETIME', 'DATE'];

        this.numericColumns = this.queryColumns.filter(c =>
          numericTypes.includes(c.attributeValueType)
        );
        this.dateTimeColumns = this.queryColumns.filter(c =>
          dateTimeTypes.includes(c.attributeValueType)
        );

        // If no explicit datetime columns found, also allow string columns
        // (datetime values are sometimes returned as strings)
        if (this.dateTimeColumns.length === 0) {
          this.dateTimeColumns = this.queryColumns;
        }

        // Auto-select first datetime column if not editing
        if (!this.initialQueryRtId && this.dateTimeColumns.length > 0) {
          this.form.dateField = this.dateTimeColumns[0].attributePath;
        }
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.queryColumns = [];
      this.numericColumns = [];
      this.dateTimeColumns = [];
    } finally {
      this.isLoadingColumns = false;
    }
  }

  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
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

    const result: HeatmapConfigResult = {
      ckTypeId: '',
      rtId: '',
      queryRtId: this.selectedPersistentQuery.rtId,
      queryName: this.selectedPersistentQuery.name,
      dateField: this.form.dateField,
      dateEndField: this.form.dateEndField || undefined,
      valueField: this.form.valueField || undefined,
      aggregation: this.form.aggregation,
      colorScheme: this.form.colorScheme,
      showLegend: this.form.showLegend,
      legendPosition: this.form.legendPosition,
      decimalPlaces: this.form.decimalPlaces,
      compactNumbers: this.form.compactNumbers,
      valueMultiplier: this.form.compactNumbers ? this.form.valueMultiplier : undefined,
      filters: filtersDto
    };

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
