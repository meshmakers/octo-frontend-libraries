import { Component, Input, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule, NumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { columnsIcon, sortAscIcon, filterIcon, searchIcon } from '@progress/kendo-svg-icons';
import { NotificationService } from '@progress/kendo-angular-notification';
import {
  CkTypeSelectorInputComponent,
  AttributeSelectorDialogService,
  AttributeSortSelectorDialogService,
  FieldFilterEditorComponent,
  FieldFilterItem,
  AttributeSortItem,
  FilterVariable
} from '@meshmakers/octo-ui';
import {
  CkTypeSelectorItem,
  CkTypeSelectorService,
  AttributeItem,
  FieldFilterDto,
  SortDto,
  SortOrdersDto,
  GetCkTypeAvailableQueryColumnsDtoGQL
} from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { TableColumn } from '../../models/meshboard.models';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';

/**
 * Data source type for table widget
 */
export type TableDataSourceType = 'runtimeEntity' | 'persistentQuery';

/**
 * Configuration result from the Table dialog
 */
export interface TableConfigResult {
  dataSourceType: TableDataSourceType;
  // For runtimeEntity:
  ckTypeId: string;
  columns: TableColumn[];
  sorting: SortDto[];
  filters: FieldFilterDto[];
  // For persistentQuery:
  queryRtId?: string;
  queryName?: string;
  // Common:
  pageSize: number;
  sortable: boolean;
}

/**
 * Configuration dialog for Table widgets.
 * Uses the standard dialogs from octo-ui for column, sorting, and filter configuration.
 */
@Component({
  selector: 'mm-table-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    NumericTextBoxModule,
    DropDownsModule,
    SVGIconModule,
    CkTypeSelectorInputComponent,
    FieldFilterEditorComponent,
    QuerySelectorComponent,
    LoadingOverlayComponent
  ],
  providers: [
    AttributeSelectorDialogService,
    AttributeSortSelectorDialogService
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        <mm-loading-overlay [loading]="isLoadingInitial" />

        <!-- Data Source Type Selection -->
        <div class="form-field data-source-type">
          <label>Data Source <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio"
                     name="dataSourceType"
                     value="runtimeEntity"
                     [(ngModel)]="dataSourceType"
                     (change)="onDataSourceTypeChange()"
                     kendoRadioButton />
              <span>Runtime Entity</span>
            </label>
            <label class="radio-label">
              <input type="radio"
                     name="dataSourceType"
                     value="persistentQuery"
                     [(ngModel)]="dataSourceType"
                     (change)="onDataSourceTypeChange()"
                     kendoRadioButton />
              <span>Query</span>
            </label>
          </div>
        </div>

        <!-- Runtime Entity Configuration -->
        @if (dataSourceType === 'runtimeEntity') {
          <!-- CK Type Selection -->
          <div class="form-field">
            <label>Runtime Entities <span class="required">*</span></label>
            <mm-ck-type-selector-input
              #ckTypeSelector
              placeholder="Select a CK Type..."
              [minSearchLength]="2"
              dialogTitle="Select CK Type"
              [ngModel]="selectedCkType"
              (ckTypeSelected)="onCkTypeSelected($event)"
              (ckTypeCleared)="onCkTypeCleared()">
            </mm-ck-type-selector-input>
            <p class="field-hint">Select the type of runtime entities for the table data.</p>
          </div>

          <!-- Columns Configuration -->
          <div class="config-card">
            <div class="card-header">
              <kendo-svgicon [icon]="columnsIcon"></kendo-svgicon>
              <span class="card-title">Columns</span>
              <span class="card-count">({{ selectedColumns.length }})</span>
            </div>
            <div class="card-content">
              <p class="config-summary">{{ getColumnsSummary() }}</p>
              <button kendoButton
                      fillMode="flat"
                      (click)="openColumnSelector()"
                      [disabled]="!selectedCkType">
                Configure Columns...
              </button>
            </div>
          </div>

          <!-- Sorting Configuration -->
          <div class="config-card">
            <div class="card-header">
              <kendo-svgicon [icon]="sortIcon"></kendo-svgicon>
              <span class="card-title">Sorting</span>
              <span class="card-count">({{ sorting.length }})</span>
            </div>
            <div class="card-content">
              <p class="config-summary">{{ getSortingSummary() }}</p>
              <button kendoButton
                      fillMode="flat"
                      (click)="openSortSelector()"
                      [disabled]="!selectedCkType">
                Configure Sorting...
              </button>
            </div>
          </div>

          <!-- Filters Section -->
          <div class="config-card filters-card">
            <div class="card-header">
              <kendo-svgicon [icon]="filterIcon"></kendo-svgicon>
              <span class="card-title">Filters</span>
              <span class="card-count">({{ filters.length }})</span>
            </div>
            <div class="card-content filter-content">
              <mm-field-filter-editor
                #filterEditor
                [availableAttributes]="availableAttributes"
                [filters]="filters"
                [enableVariables]="filterVariables.length > 0"
                [availableVariables]="filterVariables"
                (filtersChange)="onFiltersChange($event)">
              </mm-field-filter-editor>
            </div>
          </div>
        }

        <!-- Query Configuration -->
        @if (dataSourceType === 'persistentQuery') {
          <div class="form-field">
            <label>Query <span class="required">*</span></label>
            <mm-query-selector
              #querySelector
              [(ngModel)]="selectedPersistentQuery"
              (querySelected)="onQuerySelected($event)"
              placeholder="Select a Query..."
              hint="Select a query to provide data for this table.">
            </mm-query-selector>
          </div>

          @if (selectedPersistentQuery) {
            <div class="config-card">
              <div class="card-header">
                <kendo-svgicon [icon]="searchIcon"></kendo-svgicon>
                <span class="card-title">Query Info</span>
              </div>
              <div class="card-content query-info">
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">{{ selectedPersistentQuery.name }}</span>
                </div>
                @if (selectedPersistentQuery.description) {
                  <div class="info-row">
                    <span class="info-label">Description:</span>
                    <span class="info-value">{{ selectedPersistentQuery.description }}</span>
                  </div>
                }
                @if (selectedPersistentQuery.queryCkTypeId) {
                  <div class="info-row">
                    <span class="info-label">Target CK Type:</span>
                    <span class="info-value">{{ selectedPersistentQuery.queryCkTypeId }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Filters Section for Persistent Query -->
            <div class="config-card filters-card">
                <div class="card-header">
                  <kendo-svgicon [icon]="filterIcon"></kendo-svgicon>
                  <span class="card-title">Filters</span>
                  <span class="card-count">({{ filters.length }})</span>
                </div>
                <div class="card-content filter-content">
                  <mm-field-filter-editor
                    [availableAttributes]="queryFilterAttributes"
                    [filters]="filters"
                    [enableVariables]="filterVariables.length > 0"
                    [availableVariables]="filterVariables"
                    (filtersChange)="onFiltersChange($event)">
                  </mm-field-filter-editor>
                </div>
              </div>
          }
        }

        <!-- Table Options (common for both types) -->
        <div class="config-card options-card">
          <div class="card-header">
            <span class="card-title">Options</span>
          </div>
          <div class="card-content options-content">
            <div class="form-field">
              <label>Page Size</label>
              <kendo-numerictextbox
                [(ngModel)]="form.pageSize"
                [min]="5"
                [max]="100"
                [step]="5"
                format="n0">
              </kendo-numerictextbox>
            </div>
            <div class="form-field checkbox-field">
              <label>
                <input type="checkbox" [(ngModel)]="form.sortable" kendoCheckBox />
                Sortable
              </label>
            </div>
          </div>
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
      gap: 16px;
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

    .config-card {
      padding: 12px 16px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .card-header kendo-svgicon {
      color: var(--kendo-color-primary, #0d6efd);
    }

    .card-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .card-count {
      color: var(--kendo-color-subtle, #6c757d);
      font-size: 0.85rem;
    }

    .card-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .config-summary {
      margin: 0;
      font-size: 0.85rem;
      color: var(--kendo-color-on-app-surface, #212529);
      flex: 1;
    }

    .filters-card .card-content {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-content {
      width: 100%;
    }

    .options-card .options-content {
      display: flex;
      gap: 24px;
      align-items: flex-end;
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
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .data-source-type .radio-group {
      display: flex;
      gap: 24px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: normal;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .radio-label span {
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .query-info {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .info-row {
      display: flex;
      gap: 8px;
    }

    .info-label {
      font-weight: 600;
      min-width: 100px;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .info-value {
      flex: 1;
      color: var(--kendo-color-on-app-surface, #212529);
    }
  `]
})
export class TableConfigDialogComponent implements OnInit {
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);
  private readonly attributeSortSelectorDialog = inject(AttributeSortSelectorDialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('ckTypeSelector') ckTypeSelectorInput?: CkTypeSelectorInputComponent;
  @ViewChild('filterEditor') filterEditor?: FieldFilterEditorComponent;
  @ViewChild('querySelector') querySelector?: QuerySelectorComponent;

  // Initial values for editing
  @Input() initialDataSourceType?: TableDataSourceType;
  @Input() initialCkTypeId?: string;
  @Input() initialColumns?: TableColumn[];
  @Input() initialSorting?: { attributePath: string; sortOrder: string }[];
  @Input() initialFilters?: { attributePath: string; operator: string; comparisonValue: string }[];
  @Input() initialPageSize?: number;
  @Input() initialSortable?: boolean;
  @Input() initialQueryRtId?: string;
  @Input() initialQueryName?: string;

  protected readonly columnsIcon = columnsIcon;
  protected readonly sortIcon = sortAscIcon;
  protected readonly filterIcon = filterIcon;
  protected readonly searchIcon = searchIcon;

  // Data source type selection
  dataSourceType: TableDataSourceType = 'runtimeEntity';

  // Runtime Entity configuration
  selectedCkType: CkTypeSelectorItem | null = null;
  isLoadingInitial = false;

  // Selected columns (attribute paths)
  selectedColumns: string[] = [];
  // Sorting configuration
  sorting: SortDto[] = [];
  // Filter configuration
  filters: FieldFilterItem[] = [];
  // Available attributes for the selected CK Type
  availableAttributes: AttributeItem[] = [];

  // Query configuration
  selectedPersistentQuery: PersistentQueryItem | null = null;
  isLoadingQueryColumns = false;
  queryFilterAttributes: AttributeItem[] = [];

  // Variables for filter editor
  filterVariables: FilterVariable[] = [];

  form = {
    pageSize: 10,
    sortable: true
  };

  get isValid(): boolean {
    if (this.dataSourceType === 'runtimeEntity') {
      return this.selectedCkType !== null && this.selectedColumns.length > 0;
    } else {
      return this.selectedPersistentQuery !== null;
    }
  }

  async ngOnInit(): Promise<void> {
    // Initialize filter variables from state service
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      label: v.label || v.name,
      type: v.type
    }));

    // Initialize data source type
    this.dataSourceType = this.initialDataSourceType ?? 'runtimeEntity';

    // Initialize form with initial values
    this.selectedColumns = this.initialColumns?.map(c => c.field) || [];
    this.form.pageSize = this.initialPageSize ?? 10;
    this.form.sortable = this.initialSortable ?? true;

    // Convert initial sorting from string-based format to SortDto
    if (this.initialSorting) {
      this.sorting = this.initialSorting.map(s => ({
        attributePath: s.attributePath,
        sortOrder: s.sortOrder === 'AscendingDto' ? SortOrdersDto.AscendingDto : SortOrdersDto.DescendingDto
      }));
    }

    // Convert initial filters to FieldFilterItem (add IDs and convert operator)
    if (this.initialFilters) {
      let nextId = 1;
      this.filters = this.initialFilters.map(f => ({
        attributePath: f.attributePath,
        operator: f.operator as unknown as import('@meshmakers/octo-services').FieldFilterOperatorsDto,
        comparisonValue: f.comparisonValue,
        id: nextId++
      }));
    }

    if (this.dataSourceType === 'runtimeEntity' && this.initialCkTypeId) {
      await this.loadInitialValues();
    } else if (this.dataSourceType === 'persistentQuery' && this.initialQueryRtId) {
      // Use setTimeout to wait for ViewChild to be available after view init
      setTimeout(async () => {
        if (this.querySelector && this.initialQueryRtId) {
          const query = await this.querySelector.selectByRtId(this.initialQueryRtId);
          if (query) {
            this.selectedPersistentQuery = query;
            // Load filter attributes from CK type
            if (query.queryCkTypeId) {
              await this.loadFilterAttributesForQuery(query.queryCkTypeId);
            }
          }
        }
      });
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
        this.selectedCkType = ckType;
        await this.loadAvailableAttributes(ckType.rtCkTypeId);
      }
    } catch (error) {
      console.error('Error loading initial values:', error);
    } finally {
      this.isLoadingInitial = false;
    }
  }

  private async loadAvailableAttributes(ckTypeId: string): Promise<void> {
    try {
      const result = await firstValueFrom(this.getCkTypeAvailableQueryColumnsGQL.fetch({
        variables: { rtCkId: ckTypeId, first: 1000 }
      }));

      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items || [];
      this.availableAttributes = columns
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map(c => ({
          attributePath: c.attributePath || '',
          attributeValueType: c.attributeValueType
        }));
    } catch (err) {
      console.error('Error loading available attributes:', err);
      this.availableAttributes = [];
    }
  }

  async onCkTypeSelected(ckType: CkTypeSelectorItem): Promise<void> {
    this.selectedCkType = ckType;
    await this.loadAvailableAttributes(ckType.rtCkTypeId);
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.availableAttributes = [];
    this.selectedColumns = [];
    this.sorting = [];
    this.filters = [];
  }

  // Query methods
  onDataSourceTypeChange(): void {
    // QuerySelectorComponent handles loading queries automatically
  }

  async onQuerySelected(query: PersistentQueryItem | null): Promise<void> {
    this.selectedPersistentQuery = query;
    this.queryFilterAttributes = [];
    this.filters = [];

    if (query) {
      // Load filter attributes from CK type (not from query columns)
      if (query.queryCkTypeId) {
        await this.loadFilterAttributesForQuery(query.queryCkTypeId);
      }
    }
  }

  /**
   * Loads all available filter attributes from the CK type.
   * Uses getCkTypeAvailableQueryColumns instead of query result columns.
   */
  private async loadFilterAttributesForQuery(queryCkTypeId: string): Promise<void> {
    this.isLoadingQueryColumns = true;

    try {
      const result = await firstValueFrom(this.getCkTypeAvailableQueryColumnsGQL.fetch({
        variables: { rtCkId: queryCkTypeId, first: 1000 }
      }));

      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items || [];
      this.queryFilterAttributes = columns
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map(c => ({
          attributePath: c.attributePath || '',
          attributeValueType: c.attributeValueType
        }));
    } catch (error) {
      console.error('Error loading filter attributes:', error);
      this.queryFilterAttributes = [];
    } finally {
      this.isLoadingQueryColumns = false;
    }
  }

  async openColumnSelector(): Promise<void> {
    if (!this.selectedCkType?.fullName) {
      this.notificationService.show({
        content: 'Please select a CK Type first',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'warning', icon: true }
      });
      return;
    }

    const result = await this.attributeSelectorDialog.openAttributeSelector(
      this.selectedCkType.fullName,
      this.selectedColumns,
      'Select Columns'
    );

    if (result?.confirmed && result.selectedAttributes) {
      this.selectedColumns = result.selectedAttributes.map(a => a.attributePath);
    }
  }

  async openSortSelector(): Promise<void> {
    if (!this.selectedCkType?.fullName) {
      this.notificationService.show({
        content: 'Please select a CK Type first',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'warning', icon: true }
      });
      return;
    }

    const preSelected: AttributeSortItem[] = this.sorting.map(s => ({
      attributePath: s.attributePath,
      attributeValueType: this.availableAttributes.find(a => a.attributePath === s.attributePath)?.attributeValueType || '',
      sortOrder: s.sortOrder === SortOrdersDto.AscendingDto ? 'ascending' : 'descending'
    }));

    const result = await this.attributeSortSelectorDialog.openAttributeSortSelector(
      this.selectedCkType.fullName,
      preSelected,
      'Configure Sorting'
    );

    if (result?.confirmed && result.selectedAttributes) {
      this.sorting = result.selectedAttributes
        .filter(a => a.sortOrder !== 'standard')
        .map(a => ({
          attributePath: a.attributePath,
          sortOrder: a.sortOrder === 'ascending' ? SortOrdersDto.AscendingDto : SortOrdersDto.DescendingDto
        }));
    }
  }

  onFiltersChange(filters: FieldFilterItem[]): void {
    this.filters = filters;
  }

  getColumnsSummary(): string {
    if (this.selectedColumns.length === 0) return 'No columns selected';
    if (this.selectedColumns.length <= 3) return this.selectedColumns.join(', ');
    return `${this.selectedColumns.slice(0, 3).join(', ')} +${this.selectedColumns.length - 3} more`;
  }

  getSortingSummary(): string {
    if (this.sorting.length === 0) return 'No sorting configured';
    return this.sorting.map(s =>
      `${s.attributePath} ${s.sortOrder === SortOrdersDto.AscendingDto ? '↑' : '↓'}`
    ).join(', ');
  }

  onSave(): void {
    if (this.dataSourceType === 'runtimeEntity' && this.selectedCkType) {
      // Convert selected columns to TableColumn format
      const columns: TableColumn[] = this.selectedColumns.map(field => ({
        field,
        title: this.formatColumnTitle(field),
        width: undefined
      }));

      // Convert filters (remove IDs)
      const filterDtos: FieldFilterDto[] = this.filters.map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }));

      this.windowRef.close({
        dataSourceType: 'runtimeEntity',
        ckTypeId: this.selectedCkType.rtCkTypeId,
        columns,
        sorting: this.sorting,
        filters: filterDtos,
        pageSize: this.form.pageSize,
        sortable: this.form.sortable
      });
    } else if (this.dataSourceType === 'persistentQuery' && this.selectedPersistentQuery) {
      // Convert filters (remove IDs)
      const queryFilterDtos: FieldFilterDto[] = this.filters.map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }));

      this.windowRef.close({
        dataSourceType: 'persistentQuery',
        ckTypeId: '', // Not used for persistent query
        columns: [], // Will be derived from query
        sorting: [],
        filters: queryFilterDtos,
        queryRtId: this.selectedPersistentQuery.rtId,
        queryName: this.selectedPersistentQuery.name,
        pageSize: this.form.pageSize,
        sortable: this.form.sortable
      });
    }
  }

  private formatColumnTitle(field: string): string {
    // Convert camelCase/PascalCase to Title Case
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
