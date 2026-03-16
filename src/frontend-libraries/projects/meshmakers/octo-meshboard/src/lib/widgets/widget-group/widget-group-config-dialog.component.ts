import { Component, Input, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService, FieldFilterOperatorsDto, AttributeSelectorService, FieldFilterDto, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { firstValueFrom } from 'rxjs';
import {
  GroupChildWidgetType,
  WidgetGroupLayout,
  WidgetGroupChildTemplate,
  WidgetFilterConfig,
  GaugeType
} from '../../models/meshboard.models';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';

/**
 * Data source type selection
 */
type WidgetGroupDataSourceMode = 'persistentQuery' | 'ckType';

/**
 * Configuration result from the Widget Group dialog
 */
export interface WidgetGroupConfigResult extends WidgetConfigResult {
  /** Required by WidgetConfigResult - empty string for query mode, actual type for ckType mode */
  ckTypeId: string;
  dataSourceMode: WidgetGroupDataSourceMode;
  // Query mode
  queryRtId?: string;
  queryName?: string;
  // CK Type mode filters
  filters?: FieldFilterDto[];
  // Common
  maxItems?: number;
  // Child template
  childTemplate: WidgetGroupChildTemplate;
  // Layout
  layout: WidgetGroupLayout;
  gridColumns?: number;
  minChildWidth?: number;
  gap?: number;
  emptyMessage?: string;
}

/**
 * Configuration dialog for Widget Group widgets.
 * Allows configuring data source, child widget template, and layout options.
 */
@Component({
  selector: 'mm-widget-group-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    CkTypeSelectorInputComponent,
    FieldFilterEditorComponent,
    QuerySelectorComponent,
    LoadingOverlayComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        <mm-loading-overlay [loading]="isLoadingInitial" />

        <!-- ============================================================ -->
        <!-- TAB 1: Data Source -->
        <!-- ============================================================ -->
        <div class="form-section">
          <h4>Data Source</h4>

          <!-- Data Source Mode Selection -->
          <div class="form-field">
            <label>Source Type</label>
            <div class="mode-toggle">
              <button
                kendoButton
                [fillMode]="dataSourceMode === 'persistentQuery' ? 'solid' : 'outline'"
                [themeColor]="dataSourceMode === 'persistentQuery' ? 'primary' : 'base'"
                (click)="onDataSourceModeChange('persistentQuery')">
                Query
              </button>
              <button
                kendoButton
                [fillMode]="dataSourceMode === 'ckType' ? 'solid' : 'outline'"
                [themeColor]="dataSourceMode === 'ckType' ? 'primary' : 'base'"
                (click)="onDataSourceModeChange('ckType')">
                Runtime Entities
              </button>
            </div>
          </div>

          <!-- Query Selection -->
          @if (dataSourceMode === 'persistentQuery') {
            <div class="form-field">
              <label>Query <span class="required">*</span></label>
              <mm-query-selector
                #querySelector
                [(ngModel)]="selectedPersistentQuery"
                (querySelected)="onQuerySelected($event)"
                placeholder="Select a Query..."
                hint="The query results will be used to render child widgets.">
              </mm-query-selector>
            </div>
          }

          <!-- Runtime Entities Selection -->
          @if (dataSourceMode === 'ckType') {
            <div class="form-field">
              <label>Runtime Entities <span class="required">*</span></label>
              <mm-ck-type-selector-input
                placeholder="Select Runtime Entities..."
                [minSearchLength]="2"
                dialogTitle="Select Runtime Entities"
                [ngModel]="selectedCkType"
                (ckTypeSelected)="onCkTypeSelected($event)"
                (ckTypeCleared)="onCkTypeCleared()">
              </mm-ck-type-selector-input>
              <p class="field-hint">Entities of this type will be used to render child widgets.</p>
            </div>

            <!-- Filters for CK Type mode -->
            @if (selectedCkType?.rtCkTypeId) {
              <div class="form-field">
                <label>Filters</label>
                <mm-field-filter-editor
                  [ckTypeId]="selectedCkType?.rtCkTypeId"
                  [filters]="filters"
                  [enableVariables]="filterVariables.length > 0"
                  [availableVariables]="filterVariables"
                  (filtersChange)="onFiltersChange($event)">
                </mm-field-filter-editor>
              </div>
            }
          }

          <!-- Max Items -->
          <div class="form-field">
            <label>Max Items</label>
            <kendo-numerictextbox
              [(ngModel)]="form.maxItems"
              [min]="1"
              [max]="100"
              [step]="5"
              [decimals]="0"
              format="n0">
            </kendo-numerictextbox>
            <p class="field-hint">Maximum number of child widgets to render (1-100).</p>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- TAB 2: Child Widget Template -->
        <!-- ============================================================ -->
        <div class="form-section">
          <h4>Child Widget</h4>

          <!-- Widget Type Selection -->
          <div class="form-field">
            <label>Widget Type <span class="required">*</span></label>
            <kendo-dropdownlist
              [data]="childWidgetTypeOptions"
              textField="label"
              valueField="value"
              [valuePrimitive]="true"
              [(ngModel)]="form.childWidgetType">
            </kendo-dropdownlist>
          </div>

          <!-- Title Template -->
          <div class="form-field">
            <label>Title Template</label>
            <kendo-textbox
              [(ngModel)]="form.titleTemplate"
              placeholder="e.g., $rtWellKnownName Status">
            </kendo-textbox>
            <p class="field-hint">
              Use $rtWellKnownName, $rtId, or $attributeName for dynamic values.
            </p>
          </div>

          <!-- Value Attribute (for KPI/Gauge) -->
          @if (form.childWidgetType === 'kpi' || form.childWidgetType === 'gauge') {
            <div class="form-field">
              <label>Value Attribute <span class="required">*</span></label>
              @if (!isLoadingColumns && availableColumns.length > 0) {
                <kendo-combobox
                  [data]="filteredColumns()"
                  [textField]="'attributePath'"
                  [valueField]="'attributePath'"
                  [valuePrimitive]="true"
                  [allowCustom]="true"
                  [(ngModel)]="form.valueAttribute"
                  [filterable]="true"
                  (filterChange)="onColumnFilter($event)"
                  placeholder="Select value attribute...">
                  <ng-template kendoComboBoxItemTemplate let-dataItem>
                    <div class="column-item">
                      <span class="column-path">{{ dataItem.attributePath }}</span>
                      <span class="column-type">{{ dataItem.attributeValueType }}</span>
                    </div>
                  </ng-template>
                </kendo-combobox>
              } @else if (isLoadingColumns) {
                <kendo-textbox [disabled]="true" placeholder="Loading attributes..."></kendo-textbox>
              } @else {
                <kendo-textbox
                  [(ngModel)]="form.valueAttribute"
                  placeholder="Enter attribute path...">
                </kendo-textbox>
              }
              <p class="field-hint">The attribute to display as the widget value.</p>
            </div>
          }

          <!-- Gauge-specific options -->
          @if (form.childWidgetType === 'gauge') {
            <div class="form-row">
              <div class="form-field flex-1">
                <label>Gauge Type</label>
                <kendo-dropdownlist
                  [data]="gaugeTypeOptions"
                  textField="label"
                  valueField="value"
                  [valuePrimitive]="true"
                  [(ngModel)]="form.gaugeType">
                </kendo-dropdownlist>
              </div>
              <div class="form-field flex-1">
                <label>Min</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.gaugeMin"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
              <div class="form-field flex-1">
                <label>Max</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.gaugeMax"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
            </div>
          }

          <!-- KPI-specific options -->
          @if (form.childWidgetType === 'kpi') {
            <div class="form-row">
              <div class="form-field flex-1">
                <label>Prefix</label>
                <kendo-textbox
                  [(ngModel)]="form.prefix"
                  placeholder="e.g., $">
                </kendo-textbox>
              </div>
              <div class="form-field flex-1">
                <label>Suffix</label>
                <kendo-textbox
                  [(ngModel)]="form.suffix"
                  placeholder="e.g., %">
                </kendo-textbox>
              </div>
            </div>
          }
        </div>

        <!-- ============================================================ -->
        <!-- TAB 3: Layout Options -->
        <!-- ============================================================ -->
        <div class="form-section">
          <h4>Layout</h4>

          <!-- Layout Type -->
          <div class="form-field">
            <label>Layout Type</label>
            <div class="mode-toggle">
              <button
                kendoButton
                [fillMode]="form.layout === 'grid' ? 'solid' : 'outline'"
                [themeColor]="form.layout === 'grid' ? 'primary' : 'base'"
                (click)="form.layout = 'grid'">
                Grid
              </button>
              <button
                kendoButton
                [fillMode]="form.layout === 'horizontal' ? 'solid' : 'outline'"
                [themeColor]="form.layout === 'horizontal' ? 'primary' : 'base'"
                (click)="form.layout = 'horizontal'">
                Horizontal
              </button>
              <button
                kendoButton
                [fillMode]="form.layout === 'vertical' ? 'solid' : 'outline'"
                [themeColor]="form.layout === 'vertical' ? 'primary' : 'base'"
                (click)="form.layout = 'vertical'">
                Vertical
              </button>
            </div>
          </div>

          @if (form.layout === 'grid') {
            <div class="form-row">
              <div class="form-field flex-1">
                <label>Grid Columns</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.gridColumns"
                  [min]="1"
                  [max]="12"
                  [step]="1"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
              <div class="form-field flex-1">
                <label>Gap (px)</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.gap"
                  [min]="0"
                  [max]="32"
                  [step]="4"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
            </div>
          }

          @if (form.layout === 'horizontal') {
            <div class="form-row">
              <div class="form-field flex-1">
                <label>Min Child Width (px)</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.minChildWidth"
                  [min]="50"
                  [max]="500"
                  [step]="25"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
              <div class="form-field flex-1">
                <label>Gap (px)</label>
                <kendo-numerictextbox
                  [(ngModel)]="form.gap"
                  [min]="0"
                  [max]="32"
                  [step]="4"
                  [decimals]="0"
                  format="n0">
                </kendo-numerictextbox>
              </div>
            </div>
          }

          <!-- Empty Message -->
          <div class="form-field">
            <label>Empty Message</label>
            <kendo-textbox
              [(ngModel)]="form.emptyMessage"
              placeholder="No data available">
            </kendo-textbox>
            <p class="field-hint">Message shown when no items are returned.</p>
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
      pointer-events: none;
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

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .form-field:last-child {
      margin-bottom: 0;
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
export class WidgetGroupConfigDialogComponent implements OnInit {
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly attributeSelectorService = inject(AttributeSelectorService);
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly meshBoardStateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialDataSourceMode?: WidgetGroupDataSourceMode;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;
  @Input() initialCkTypeId?: string;
  @Input() initialFilters?: WidgetFilterConfig[];
  @Input() initialMaxItems?: number;
  @Input() initialChildTemplate?: WidgetGroupChildTemplate;
  @Input() initialLayout?: WidgetGroupLayout;
  @Input() initialGridColumns?: number;
  @Input() initialMinChildWidth?: number;
  @Input() initialGap?: number;
  @Input() initialEmptyMessage?: string;

  // Data source mode
  dataSourceMode: WidgetGroupDataSourceMode = 'persistentQuery';

  // Query mode state
  selectedPersistentQuery: PersistentQueryItem | null = null;

  // CK Type mode state
  selectedCkType: CkTypeSelectorItem | null = null;

  // Attributes/Columns
  availableColumns: QueryColumnItem[] = [];
  isLoadingColumns = false;
  private columnFilter = '';

  // Filter state
  filters: FieldFilterItem[] = [];
  filterVariables: FilterVariable[] = [];

  isLoadingInitial = false;

  // Form state
  form = {
    maxItems: 20,
    childWidgetType: 'kpi' as GroupChildWidgetType,
    titleTemplate: '$rtWellKnownName',
    valueAttribute: '',
    prefix: '',
    suffix: '',
    gaugeType: 'arc' as GaugeType,
    gaugeMin: 0,
    gaugeMax: 100,
    layout: 'grid' as WidgetGroupLayout,
    gridColumns: 4,
    minChildWidth: 150,
    gap: 8,
    emptyMessage: ''
  };

  // Options
  childWidgetTypeOptions = [
    { value: 'kpi' as GroupChildWidgetType, label: 'KPI' },
    { value: 'gauge' as GroupChildWidgetType, label: 'Gauge' },
    { value: 'entityCard' as GroupChildWidgetType, label: 'Entity Card' }
  ];

  gaugeTypeOptions = [
    { value: 'arc' as GaugeType, label: 'Arc' },
    { value: 'circular' as GaugeType, label: 'Circular' },
    { value: 'linear' as GaugeType, label: 'Linear' },
    { value: 'radial' as GaugeType, label: 'Radial' }
  ];

  /**
   * Computed: Filtered columns based on search
   */
  filteredColumns = signal<QueryColumnItem[]>([]);

  get isValid(): boolean {
    // Data source validation
    if (this.dataSourceMode === 'persistentQuery' && !this.selectedPersistentQuery) {
      return false;
    }
    if (this.dataSourceMode === 'ckType' && !this.selectedCkType) {
      return false;
    }

    // Child widget validation
    if (this.form.childWidgetType === 'kpi' || this.form.childWidgetType === 'gauge') {
      if (!this.form.valueAttribute?.trim()) {
        return false;
      }
    }

    return true;
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from MeshBoard state
    this.filterVariables = this.meshBoardStateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize form with initial values
    this.dataSourceMode = this.initialDataSourceMode ?? 'persistentQuery';
    this.form.maxItems = this.initialMaxItems ?? 20;
    this.form.layout = this.initialLayout ?? 'grid';
    this.form.gridColumns = this.initialGridColumns ?? 4;
    this.form.minChildWidth = this.initialMinChildWidth ?? 150;
    this.form.gap = this.initialGap ?? 8;
    this.form.emptyMessage = this.initialEmptyMessage ?? '';

    // Initialize child template
    if (this.initialChildTemplate) {
      this.form.childWidgetType = this.initialChildTemplate.widgetType;
      this.form.titleTemplate = this.initialChildTemplate.titleTemplate ?? '$rtWellKnownName';
      this.form.valueAttribute = this.initialChildTemplate.attributeMappings.valueAttribute ?? '';

      // Extract static config values
      const staticConfig = this.initialChildTemplate.staticConfig;
      if (staticConfig) {
        if ('prefix' in staticConfig) this.form.prefix = staticConfig.prefix ?? '';
        if ('suffix' in staticConfig) this.form.suffix = staticConfig.suffix ?? '';
        if ('gaugeType' in staticConfig) this.form.gaugeType = staticConfig.gaugeType ?? 'arc';
        if ('min' in staticConfig) this.form.gaugeMin = staticConfig.min ?? 0;
        if ('max' in staticConfig) this.form.gaugeMax = staticConfig.max ?? 100;
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

    // Load data based on mode
    if (this.dataSourceMode === 'persistentQuery' && this.initialQueryRtId) {
      // Use setTimeout to wait for ViewChild to be available
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
    } else if (this.initialCkTypeId) {
      await this.loadInitialCkTypeValues();
    }
  }

  // ============================================================================
  // Data Source Mode
  // ============================================================================

  onDataSourceModeChange(mode: WidgetGroupDataSourceMode): void {
    this.dataSourceMode = mode;
    this.availableColumns = [];
    this.filteredColumns.set([]);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.availableColumns = [];
    this.filteredColumns.set([]);

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
        const queryResult = queryItems[0];
        const columns = queryResult.columns ?? [];

        this.availableColumns = columns
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .map(c => ({
            attributePath: c.attributePath?.replace(/\./g, '_') ?? '',
            attributeValueType: c.attributeValueType ?? ''
          }));

        this.filteredColumns.set(this.availableColumns);
      }
    } catch (error) {
      console.error('Error loading query columns:', error);
      this.availableColumns = [];
      this.filteredColumns.set([]);
    } finally {
      this.isLoadingColumns = false;
    }
  }

  // ============================================================================
  // CK Type Methods
  // ============================================================================

  private async loadInitialCkTypeValues(): Promise<void> {
    if (!this.initialCkTypeId) return;

    this.isLoadingInitial = true;

    try {
      const ckType = await firstValueFrom(
        this.ckTypeSelectorService.getCkTypeByRtCkTypeId(this.initialCkTypeId)
      );

      if (ckType) {
        this.onCkTypeSelected(ckType);
      }
    } catch (error) {
      console.error('Error loading initial CK type values:', error);
    } finally {
      this.isLoadingInitial = false;
    }
  }

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.loadCkTypeAttributes(ckType.rtCkTypeId);
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.availableColumns = [];
    this.filteredColumns.set([]);
    this.filters = [];
  }

  private async loadCkTypeAttributes(ckTypeId: string): Promise<void> {
    this.isLoadingColumns = true;

    try {
      const result = await firstValueFrom(this.getCkTypeAvailableQueryColumnsGQL.fetch({
        variables: { rtCkId: ckTypeId, first: 1000, includeNavigationProperties: true }
      }));

      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items || [];
      const mappedColumns = columns
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map(c => ({
          attributePath: c.attributePath || '',
          attributeValueType: c.attributeValueType
        }));

      this.availableColumns = mappedColumns;
      this.filteredColumns.set(mappedColumns);
    } catch (error) {
      console.error('Error loading CK type attributes:', error);
      this.availableColumns = [];
      this.filteredColumns.set([]);
    } finally {
      this.isLoadingColumns = false;
    }
  }

  // ============================================================================
  // Column Filter
  // ============================================================================

  onColumnFilter(filter: string): void {
    this.columnFilter = filter;
    const filterLower = filter.toLowerCase();
    const filtered = this.availableColumns.filter(col =>
      col.attributePath.toLowerCase().includes(filterLower)
    );
    this.filteredColumns.set(filtered);
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  onFiltersChange(updatedFilters: FieldFilterItem[]): void {
    this.filters = updatedFilters;
  }

  // ============================================================================
  // Save/Cancel
  // ============================================================================

  onSave(): void {
    // Build child template
    const childTemplate: WidgetGroupChildTemplate = {
      widgetType: this.form.childWidgetType,
      titleTemplate: this.form.titleTemplate || undefined,
      attributeMappings: {
        valueAttribute: this.form.valueAttribute || undefined
      },
      staticConfig: this.buildStaticConfig()
    };

    // Convert filters to DTO format
    const filtersDto: FieldFilterDto[] | undefined = this.filters.length > 0
      ? this.filters.map(f => ({
          attributePath: f.attributePath,
          operator: f.operator,
          comparisonValue: f.comparisonValue
        }))
      : undefined;

    const result: WidgetGroupConfigResult = {
      ckTypeId: this.dataSourceMode === 'ckType' ? (this.selectedCkType?.rtCkTypeId ?? '') : '',
      dataSourceMode: this.dataSourceMode,
      queryRtId: this.dataSourceMode === 'persistentQuery' ? this.selectedPersistentQuery?.rtId : undefined,
      queryName: this.dataSourceMode === 'persistentQuery' ? this.selectedPersistentQuery?.name : undefined,
      filters: this.dataSourceMode === 'ckType' ? filtersDto : undefined,
      maxItems: this.form.maxItems,
      childTemplate,
      layout: this.form.layout,
      gridColumns: this.form.layout === 'grid' ? this.form.gridColumns : undefined,
      minChildWidth: this.form.layout === 'horizontal' ? this.form.minChildWidth : undefined,
      gap: this.form.gap,
      emptyMessage: this.form.emptyMessage || undefined
    };

    this.windowRef.close(result);
  }

  private buildStaticConfig(): Record<string, unknown> {
    switch (this.form.childWidgetType) {
      case 'kpi':
        return {
          prefix: this.form.prefix || undefined,
          suffix: this.form.suffix || undefined
        };
      case 'gauge':
        return {
          gaugeType: this.form.gaugeType,
          min: this.form.gaugeMin,
          max: this.form.gaugeMax
        };
      case 'entityCard':
        return {
          showHeader: true,
          showAttributes: true
        };
      default:
        return {};
    }
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
