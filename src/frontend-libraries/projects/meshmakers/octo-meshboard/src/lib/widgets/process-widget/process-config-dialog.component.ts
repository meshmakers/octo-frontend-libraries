import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { CkTypeSelectorInputComponent, FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from '@meshmakers/octo-ui';
import {
  CkTypeSelectorItem,
  FieldFilterOperatorsDto,
  AttributeSelectorService,
  AttributeItem,
  GetCkTypeAvailableQueryColumnsDtoGQL
} from '@meshmakers/octo-services';
import {
  EntitySelectInputComponent,
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult,
  ColumnDefinition
} from '@meshmakers/shared-ui';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import {
  GetSystemPersistentQueriesDtoGQL
} from '../../graphQL/getSystemPersistentQueries';
import type { ProcessDiagramConfig, TransformProperty } from '@meshmakers/octo-process-diagrams';
import { ProcessDataService, ProcessDiagramSummary } from './services/process-data.service';
import { ProcessDataBindingMode, DiagramPropertyMapping } from './process-widget-config.model';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { WidgetFilterConfig } from '../../models/meshboard.models';
import { firstValueFrom, Observable, from, map } from 'rxjs';

/**
 * Diagram source type
 */
export type DiagramSourceType = 'stored' | 'none';

/**
 * Represents a runtime entity for selection
 */
export interface RuntimeEntityItem {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string;
  displayName: string;
}

/**
 * Persistent query item for selection
 */
export interface PersistentQueryItem {
  rtId: string;
  name: string;
  description?: string | null;
  queryCkTypeId?: string | null;
}

/**
 * Configuration result from the Process Widget dialog
 */
export interface ProcessConfigResult extends WidgetConfigResult {
  diagramSource: DiagramSourceType;
  processDiagramRtId?: string;
  inlineConfig?: ProcessDiagramConfig;
  fitToBounds: boolean;
  allowZoom: boolean;
  allowPan: boolean;
  showToolbar: boolean;
  initialZoom: number;
  // Data binding fields
  dataBindingMode?: ProcessDataBindingMode;
  bindingCkTypeId?: string;
  bindingRtId?: string;
  bindingQueryRtId?: string;
  bindingQueryName?: string;
  bindingFilters?: WidgetFilterConfig[];
  // Property mappings
  propertyMappings?: DiagramPropertyMapping[];
}

/**
 * Data source for entity autocomplete - filters by ckTypeId
 */
class RuntimeEntitySelectDataSource implements EntitySelectDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  async onFilter(filter: string, take?: number): Promise<EntitySelectResult<RuntimeEntityItem>> {
    const result = await firstValueFrom(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: take ?? 10,
          fieldFilters: filter ? [
            { attributePath: 'rtId', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: filter }
          ] : undefined
        }
      })
    );

    const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        ckTypeId: item.ckTypeId,
        rtWellKnownName: item.rtWellKnownName ?? undefined,
        displayName: item.rtWellKnownName || item.rtId
      }));

    return {
      totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0,
      items
    };
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}

/**
 * Dialog data source for entity selection grid
 */
class RuntimeEntityDialogDataSource implements EntitySelectDialogDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'rtId', displayName: 'RT-ID' },
      { field: 'rtWellKnownName', displayName: 'Name' },
      { field: 'ckTypeId', displayName: 'CK Type' }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<RuntimeEntityItem>> {
    // Build field filters for text search
    const fieldFilters: { attributePath: string; operator: FieldFilterOperatorsDto; comparisonValue: string }[] = [];
    if (options.textSearch && options.textSearch.trim()) {
      fieldFilters.push({
        attributePath: 'rtId',
        operator: FieldFilterOperatorsDto.LikeDto,
        comparisonValue: options.textSearch.trim()
      });
    }

    return from(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: options.take,
          after: options.skip > 0 ? btoa(`arrayconnection:${options.skip - 1}`) : undefined,
          fieldFilters: fieldFilters.length > 0 ? fieldFilters : undefined
        }
      })
    ).pipe(
      map(result => {
        const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            rtId: item.rtId,
            ckTypeId: item.ckTypeId,
            rtWellKnownName: item.rtWellKnownName ?? undefined,
            displayName: item.rtWellKnownName || item.rtId
          }));

        return {
          data: items,
          totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0
        };
      })
    );
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}

/**
 * Configuration dialog for Process Widget.
 * Allows selecting a stored diagram, display options, and data binding.
 */
@Component({
  selector: 'mm-process-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    LayoutModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    FieldFilterEditorComponent,
    LoadingOverlayComponent
  ],
  providers: [ProcessDataService],
  template: `
    <div class="config-container">

      <div class="config-form">
        <kendo-tabstrip [animate]="false">
          <!-- Tab 1: Diagram -->
          <kendo-tabstrip-tab [title]="'Diagram'" [selected]="true">
            <ng-template kendoTabContent>
              <div class="tab-content" [class.loading]="isLoadingDiagrams">
                <mm-loading-overlay [loading]="isLoadingDiagrams" />

                <div class="form-field">
                  <label>Process Diagram <span class="required">*</span></label>
                  <kendo-combobox
                    [data]="storedDiagrams"
                    [textField]="'name'"
                    [valueField]="'rtId'"
                    [valuePrimitive]="false"
                    [(ngModel)]="selectedDiagram"
                    [filterable]="true"
                    (filterChange)="onDiagramFilterChange($event)"
                    (valueChange)="onDiagramSelected($event)"
                    [loading]="isLoadingDiagrams"
                    placeholder="Select a diagram...">
                    <ng-template kendoComboBoxItemTemplate let-dataItem>
                      <div class="diagram-item">
                        <span class="diagram-name">{{ dataItem.name }}</span>
                        <span class="diagram-size">{{ dataItem.canvasWidth }}x{{ dataItem.canvasHeight }}</span>
                      </div>
                    </ng-template>
                  </kendo-combobox>
                  @if (storedDiagrams.length === 0 && !isLoadingDiagrams) {
                    <p class="field-hint warning">No diagrams found. Create diagrams using the Process Designer.</p>
                  }
                </div>

                <!-- Preview Section -->
                @if (selectedDiagram) {
                  <div class="preview-section">
                    <div class="preview-info">
                      <div class="preview-item">
                        <span class="preview-label">Name:</span>
                        <span class="preview-value">{{ selectedDiagram.name }}</span>
                      </div>
                      <div class="preview-item">
                        <span class="preview-label">Canvas Size:</span>
                        <span class="preview-value">{{ selectedDiagram.canvasWidth }}x{{ selectedDiagram.canvasHeight }}</span>
                      </div>
                      <div class="preview-item">
                        <span class="preview-label">Version:</span>
                        <span class="preview-value">{{ selectedDiagram.version }}</span>
                      </div>
                      @if (diagramExposedProperties.length > 0) {
                        <div class="preview-item">
                          <span class="preview-label">Exposed Properties:</span>
                          <span class="preview-value">{{ diagramExposedProperties.length }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </ng-template>
          </kendo-tabstrip-tab>

          <!-- Tab 2: Data Binding -->
          <kendo-tabstrip-tab [title]="'Data Binding'">
            <ng-template kendoTabContent>
              <div class="tab-content">
                <p class="section-hint">Bind the diagram to runtime data for dynamic values.</p>

                <!-- Data Binding Mode Toggle -->
                <div class="form-field">
                  <label>Binding Mode</label>
                  <div class="mode-toggle">
                    <button
                      kendoButton
                      [fillMode]="dataBindingMode === 'none' ? 'solid' : 'outline'"
                      [themeColor]="dataBindingMode === 'none' ? 'primary' : 'base'"
                      (click)="onDataBindingModeChange('none')">
                      None
                    </button>
                    <button
                      kendoButton
                      [fillMode]="dataBindingMode === 'runtimeEntity' ? 'solid' : 'outline'"
                      [themeColor]="dataBindingMode === 'runtimeEntity' ? 'primary' : 'base'"
                      (click)="onDataBindingModeChange('runtimeEntity')">
                      Runtime Entity
                    </button>
                    <button
                      kendoButton
                      [fillMode]="dataBindingMode === 'persistentQuery' ? 'solid' : 'outline'"
                      [themeColor]="dataBindingMode === 'persistentQuery' ? 'primary' : 'base'"
                      (click)="onDataBindingModeChange('persistentQuery')">
                      Query
                    </button>
                  </div>
                </div>

                <!-- Runtime Entity Data Binding -->
                @if (dataBindingMode === 'runtimeEntity') {
                  <!-- CK Type Selection -->
                  <div class="form-field">
                    <label>CK Type <span class="required">*</span></label>
                    <mm-ck-type-selector-input
                      placeholder="Select a CK Type..."
                      [minSearchLength]="2"
                      dialogTitle="Select CK Type"
                      [ngModel]="selectedCkType"
                      (ckTypeSelected)="onCkTypeSelected($event)"
                      (ckTypeCleared)="onCkTypeCleared()">
                    </mm-ck-type-selector-input>
                  </div>

                  <!-- Entity Selection -->
                  <div class="form-field" [class.disabled]="!selectedCkType">
                    <label>Entity <span class="required">*</span></label>
                    @if (selectedCkType && entityDataSource) {
                      <mm-entity-select-input
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
                        placeholder="First select a CK Type...">
                      </kendo-textbox>
                    }
                  </div>
                }

                <!-- Persistent Query Data Binding -->
                @if (dataBindingMode === 'persistentQuery') {
                  <!-- Query Selection -->
                  <div class="form-field">
                    <label>Persistent Query <span class="required">*</span></label>
                    <kendo-combobox
                      [data]="persistentQueries"
                      [textField]="'name'"
                      [valueField]="'rtId'"
                      [valuePrimitive]="false"
                      [(ngModel)]="selectedPersistentQuery"
                      [filterable]="true"
                      (filterChange)="onQueryFilterChange($event)"
                      (valueChange)="onQuerySelected($event)"
                      placeholder="Select a Persistent Query..."
                      [loading]="isLoadingQueries">
                      <ng-template kendoComboBoxItemTemplate let-dataItem>
                        <div class="query-item">
                          <span class="query-name">{{ dataItem.name }}</span>
                          @if (dataItem.description) {
                            <span class="query-description">{{ dataItem.description }}</span>
                          }
                        </div>
                      </ng-template>
                    </kendo-combobox>
                    @if (persistentQueries.length === 0 && !isLoadingQueries) {
                      <p class="field-hint warning">No queries found.</p>
                    }
                  </div>
                }

                <!-- Filters Section -->
                @if (dataBindingMode !== 'none' && filterAttributes.length > 0) {
                  <div class="form-field">
                    <label>Filters (Optional)</label>
                    <mm-field-filter-editor
                      [availableAttributes]="filterAttributes"
                      [filters]="filters"
                      [enableVariables]="filterVariables.length > 0"
                      [availableVariables]="filterVariables"
                      (filtersChange)="onFiltersChange($event)">
                    </mm-field-filter-editor>
                  </div>
                }
              </div>
            </ng-template>
          </kendo-tabstrip-tab>

          <!-- Tab 3: Property Mappings -->
          <kendo-tabstrip-tab [title]="'Mappings'" [disabled]="dataBindingMode === 'none' || diagramExposedProperties.length === 0">
            <ng-template kendoTabContent>
              <div class="tab-content">
                @if (diagramExposedProperties.length === 0) {
                  <p class="empty-hint">No exposed properties in this diagram.</p>
                } @else if (isLoadingDiagramConfig) {
                  <div class="loading-hint">Loading diagram properties...</div>
                } @else {
                  <p class="section-hint">Map diagram exposed properties to data source fields.</p>
                  <div class="property-mappings-table">
                    <div class="mapping-header">
                      <span class="col-property">Property</span>
                      <span class="col-type">Type</span>
                      <span class="col-source">Source</span>
                      <span class="col-path">Field</span>
                      <span class="col-expression">Expression</span>
                    </div>
                    @for (prop of diagramExposedProperties; track prop.id) {
                      <div class="mapping-row">
                        <span class="col-property" [title]="prop.name">{{ prop.name }}</span>
                        <span class="col-type type-badge">{{ prop.type }}</span>
                        <kendo-dropdownlist
                          class="col-source"
                          [data]="sourceTypeOptions"
                          [textField]="'label'"
                          [valueField]="'value'"
                          [valuePrimitive]="true"
                          [value]="getMappingSourceType(prop.id)"
                          (valueChange)="onMappingSourceTypeChange(prop.id, $event)">
                        </kendo-dropdownlist>
                        @if (getMappingSourceType(prop.id) === 'attribute' && filterAttributes.length > 0) {
                          <kendo-combobox
                            class="col-path"
                            [data]="filterAttributes"
                            [textField]="'attributePath'"
                            [valueField]="'attributePath'"
                            [valuePrimitive]="true"
                            [value]="getMappingSourcePath(prop.id)"
                            [filterable]="true"
                            (valueChange)="onMappingSourcePathChange(prop.id, $event)"
                            placeholder="Select...">
                          </kendo-combobox>
                        } @else {
                          <kendo-textbox
                            class="col-path"
                            [value]="getMappingSourcePath(prop.id)"
                            (valueChange)="onMappingSourcePathChange(prop.id, $event)"
                            [placeholder]="getMappingSourceType(prop.id) === 'column' ? 'Column...' : 'Attribute...'">
                          </kendo-textbox>
                        }
                        <kendo-textbox
                          class="col-expression"
                          [value]="getMappingExpression(prop.id)"
                          (valueChange)="onMappingExpressionChange(prop.id, $event)"
                          placeholder="value">
                        </kendo-textbox>
                      </div>
                    }
                  </div>
                  <p class="field-hint expression-help">
                    <code>value</code> = raw value. Examples: <code>value / 100</code>, <code>lerp(value, 0, 4096, 0, 100)</code>
                  </p>
                }
              </div>
            </ng-template>
          </kendo-tabstrip-tab>

          <!-- Tab 4: Display Options -->
          <kendo-tabstrip-tab [title]="'Display'">
            <ng-template kendoTabContent>
              <div class="tab-content">
                <div class="form-row">
                  <div class="form-field checkbox-field">
                    <label>
                      <input type="checkbox" [(ngModel)]="form.fitToBounds" kendoCheckBox />
                      Fit to Bounds
                    </label>
                    <p class="field-hint">Scale diagram to fit widget size.</p>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-field checkbox-field">
                    <label>
                      <input type="checkbox" [(ngModel)]="form.allowZoom" kendoCheckBox />
                      Allow Zoom
                    </label>
                  </div>

                  <div class="form-field checkbox-field">
                    <label>
                      <input type="checkbox" [(ngModel)]="form.allowPan" kendoCheckBox />
                      Allow Pan
                    </label>
                  </div>
                </div>

                <div class="form-field checkbox-field">
                  <label>
                    <input type="checkbox" [(ngModel)]="form.showToolbar" kendoCheckBox />
                    Show Toolbar
                  </label>
                  <p class="field-hint">Display zoom controls and other tools.</p>
                </div>

                @if (form.allowZoom || !form.fitToBounds) {
                  <div class="form-field">
                    <label>Initial Zoom</label>
                    <kendo-dropdownlist
                      [data]="zoomLevels"
                      [textField]="'label'"
                      [valueField]="'value'"
                      [valuePrimitive]="true"
                      [(ngModel)]="form.initialZoom">
                    </kendo-dropdownlist>
                  </div>
                }
              </div>
            </ng-template>
          </kendo-tabstrip-tab>
        </kendo-tabstrip>
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
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .tab-content {
      padding: 16px;
      min-height: 200px;
      position: relative;
    }

    .tab-content.loading {
      pointer-events: none;
    }

    .section-hint {
      margin: 0 0 16px 0;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .empty-hint {
      text-align: center;
      padding: 24px;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }

    .form-field:last-child {
      margin-bottom: 0;
    }

    .form-field.disabled {
      opacity: 0.6;
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

    .field-hint.warning {
      color: var(--kendo-color-warning, #ffc107);
    }

    .form-row {
      display: flex;
      gap: 24px;
      margin-bottom: 12px;
    }

    .form-row:last-child {
      margin-bottom: 0;
    }

    .mode-toggle {
      display: flex;
      gap: 8px;
    }

    .checkbox-field {
      flex-direction: row;
      align-items: flex-start;
    }

    .checkbox-field label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: normal;
    }

    .checkbox-field .field-hint {
      margin-top: 4px;
      margin-left: 28px;
    }

    .preview-section {
      margin-top: 16px;
      padding: 12px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .preview-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      background: var(--kendo-color-surface, #ffffff);
      border-radius: 4px;
    }

    .preview-label {
      font-weight: 500;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .preview-value {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .diagram-item {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .diagram-name {
      font-weight: 500;
    }

    .diagram-size {
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
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

    /* Property Mappings Table */
    .property-mappings-table {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mapping-header {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) 55px 85px minmax(80px, 1fr) minmax(90px, 1.2fr);
      gap: 6px;
      padding: 6px 10px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.7rem;
      color: var(--kendo-color-subtle, #6c757d);
      text-transform: uppercase;
    }

    .mapping-row {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) 55px 85px minmax(80px, 1fr) minmax(90px, 1.2fr);
      gap: 6px;
      padding: 6px 10px;
      background: var(--kendo-color-surface, #ffffff);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      align-items: center;
    }

    .col-property {
      font-weight: 500;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .col-type.type-badge {
      font-size: 0.65rem;
      padding: 2px 4px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border-radius: 10px;
      text-align: center;
      text-transform: uppercase;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .col-expression kendo-textbox {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.8rem;
    }

    .expression-help {
      margin-top: 12px;
    }

    .expression-help code {
      background: var(--kendo-color-surface-alt, #f8f9fa);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.75rem;
    }

    .loading-hint {
      font-style: italic;
      color: var(--kendo-color-subtle, #6c757d);
      padding: 8px;
      text-align: center;
    }

    /* TabStrip styling */
    :host ::ng-deep kendo-tabstrip {
      border: none;
    }

    :host ::ng-deep .k-tabstrip-items-wrapper {
      border-bottom: 1px solid var(--kendo-color-border, #dee2e6);
    }

    :host ::ng-deep .k-tabstrip-content {
      border: none;
      padding: 0;
    }
  `]
})
export class ProcessConfigDialogComponent implements OnInit {
  private readonly processDataService = inject(ProcessDataService);
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly getSystemPersistentQueriesGQL = inject(GetSystemPersistentQueriesDtoGQL);
  private readonly attributeSelectorService = inject(AttributeSelectorService);
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  // Initial values for editing - Diagram
  @Input() initialProcessDiagramRtId?: string;
  @Input() initialFitToBounds?: boolean;
  @Input() initialAllowZoom?: boolean;
  @Input() initialAllowPan?: boolean;
  @Input() initialShowToolbar?: boolean;
  @Input() initialInitialZoom?: number;

  // Initial values for editing - Data Binding
  @Input() initialDataBindingMode?: ProcessDataBindingMode;
  @Input() initialBindingCkTypeId?: string;
  @Input() initialBindingRtId?: string;
  @Input() initialBindingQueryRtId?: string;
  @Input() initialBindingQueryName?: string;
  @Input() initialBindingFilters?: WidgetFilterConfig[];
  @Input() initialPropertyMappings?: DiagramPropertyMapping[];

  // State - Diagram
  isLoadingDiagrams = false;
  storedDiagrams: ProcessDiagramSummary[] = [];
  selectedDiagram: ProcessDiagramSummary | null = null;

  // State - Data Binding
  dataBindingMode: ProcessDataBindingMode = 'none';

  // State - Runtime Entity Binding
  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource: RuntimeEntitySelectDataSource | undefined;
  entityDialogDataSource: RuntimeEntityDialogDataSource | undefined;

  // State - Persistent Query Binding
  persistentQueries: PersistentQueryItem[] = [];
  selectedPersistentQuery: PersistentQueryItem | null = null;
  isLoadingQueries = false;

  // State - Filters
  filters: FieldFilterItem[] = [];
  filterAttributes: AttributeItem[] = [];
  filterVariables: FilterVariable[] = [];

  // State - Attributes loading
  private readonly _isLoadingAttributes = signal(false);
  readonly isLoadingAttributes = this._isLoadingAttributes.asReadonly;

  // State - Diagram exposed properties and mappings
  diagramExposedProperties: TransformProperty[] = [];
  propertyMappings: DiagramPropertyMapping[] = [];
  isLoadingDiagramConfig = false;

  // Zoom level options
  zoomLevels = [
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2, label: '200%' }
  ];

  // Source type options for property mappings
  sourceTypeOptions: { value: 'attribute' | 'column'; label: string }[] = [
    { value: 'attribute', label: 'Attribute' },
    { value: 'column', label: 'Column' }
  ];

  // Form state
  form = {
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1
  };

  get isValid(): boolean {
    // Diagram is always required
    if (!this.selectedDiagram) {
      return false;
    }

    // Validate data binding based on mode
    if (this.dataBindingMode === 'runtimeEntity') {
      return !!this.selectedCkType && !!this.selectedEntity;
    }

    if (this.dataBindingMode === 'persistentQuery') {
      return !!this.selectedPersistentQuery;
    }

    return true;
  }

  async ngOnInit(): Promise<void> {
    // Initialize display options
    this.form.fitToBounds = this.initialFitToBounds ?? true;
    this.form.allowZoom = this.initialAllowZoom ?? false;
    this.form.allowPan = this.initialAllowPan ?? false;
    this.form.showToolbar = this.initialShowToolbar ?? false;
    this.form.initialZoom = this.initialInitialZoom ?? 1;

    // Initialize data binding mode
    this.dataBindingMode = this.initialDataBindingMode ?? 'none';

    // Initialize filter variables from MeshBoard
    this.initFilterVariables();

    // Load data in parallel
    const loadPromises: Promise<void>[] = [
      this.loadStoredDiagrams(),
      this.loadPersistentQueries()
    ];

    await Promise.all(loadPromises);

    // Initialize property mappings from initial values
    if (this.initialPropertyMappings && this.initialPropertyMappings.length > 0) {
      this.propertyMappings = [...this.initialPropertyMappings];
    }

    // Pre-select initial diagram and load its exposed properties
    if (this.initialProcessDiagramRtId) {
      this.selectedDiagram = this.storedDiagrams.find(
        d => d.rtId === this.initialProcessDiagramRtId
      ) ?? null;

      // Load the diagram's exposed properties
      if (this.selectedDiagram) {
        await this.loadDiagramExposedProperties(this.selectedDiagram.rtId);
      }
    }

    // Pre-select initial data binding values
    if (this.initialDataBindingMode === 'runtimeEntity' && this.initialBindingCkTypeId) {
      await this.initRuntimeEntityBinding();
    } else if (this.initialDataBindingMode === 'persistentQuery' && this.initialBindingQueryRtId) {
      await this.initPersistentQueryBinding();
    }

    // Initialize filters
    if (this.initialBindingFilters && this.initialBindingFilters.length > 0) {
      this.filters = this.initialBindingFilters.map((f, index) => ({
        id: index + 1,
        attributePath: f.attributePath,
        operator: f.operator as FieldFilterOperatorsDto,
        comparisonValue: f.comparisonValue
      }));
    }
  }

  // ===========================================================================
  // Diagram Selection
  // ===========================================================================

  async onDiagramFilterChange(filter: string): Promise<void> {
    await this.loadStoredDiagrams(filter);
  }

  private async loadStoredDiagrams(searchText?: string): Promise<void> {
    this.isLoadingDiagrams = true;
    try {
      this.storedDiagrams = await this.processDataService.loadDiagramList(searchText);
    } finally {
      this.isLoadingDiagrams = false;
    }
  }

  async onDiagramSelected(diagram: ProcessDiagramSummary | null): Promise<void> {
    this.selectedDiagram = diagram;
    this.diagramExposedProperties = [];

    if (!diagram) {
      return;
    }

    await this.loadDiagramExposedProperties(diagram.rtId);
  }

  private async loadDiagramExposedProperties(diagramRtId: string): Promise<void> {
    this.isLoadingDiagramConfig = true;
    try {
      const fullDiagram = await this.processDataService.loadDiagram(diagramRtId);
      if (fullDiagram?.transformProperties) {
        this.diagramExposedProperties = fullDiagram.transformProperties;
      }
    } catch (error) {
      console.error('Error loading diagram config:', error);
    } finally {
      this.isLoadingDiagramConfig = false;
    }
  }

  // ===========================================================================
  // Property Mappings
  // ===========================================================================

  getMappingSourceType(propertyId: string): 'attribute' | 'column' {
    const mapping = this.propertyMappings.find(m => m.propertyId === propertyId);
    return mapping?.sourceType ?? 'attribute';
  }

  getMappingSourcePath(propertyId: string): string {
    const mapping = this.propertyMappings.find(m => m.propertyId === propertyId);
    return mapping?.sourcePath ?? '';
  }

  getMappingExpression(propertyId: string): string {
    const mapping = this.propertyMappings.find(m => m.propertyId === propertyId);
    return mapping?.expression ?? '';
  }

  onMappingSourceTypeChange(propertyId: string, sourceType: 'attribute' | 'column'): void {
    const existingIndex = this.propertyMappings.findIndex(m => m.propertyId === propertyId);
    if (existingIndex >= 0) {
      // Update existing mapping
      this.propertyMappings = [
        ...this.propertyMappings.slice(0, existingIndex),
        { ...this.propertyMappings[existingIndex], sourceType, sourcePath: '' },
        ...this.propertyMappings.slice(existingIndex + 1)
      ];
    } else {
      // Create new mapping
      this.propertyMappings = [
        ...this.propertyMappings,
        { propertyId, sourceType, sourcePath: '' }
      ];
    }
  }

  onMappingSourcePathChange(propertyId: string, sourcePath: string): void {
    const existingIndex = this.propertyMappings.findIndex(m => m.propertyId === propertyId);
    if (existingIndex >= 0) {
      // Update existing mapping
      this.propertyMappings = [
        ...this.propertyMappings.slice(0, existingIndex),
        { ...this.propertyMappings[existingIndex], sourcePath },
        ...this.propertyMappings.slice(existingIndex + 1)
      ];
    } else {
      // Create new mapping with default source type
      this.propertyMappings = [
        ...this.propertyMappings,
        { propertyId, sourceType: 'attribute', sourcePath }
      ];
    }
  }

  onMappingExpressionChange(propertyId: string, expression: string): void {
    const existingIndex = this.propertyMappings.findIndex(m => m.propertyId === propertyId);
    if (existingIndex >= 0) {
      // Update existing mapping
      this.propertyMappings = [
        ...this.propertyMappings.slice(0, existingIndex),
        { ...this.propertyMappings[existingIndex], expression: expression || undefined },
        ...this.propertyMappings.slice(existingIndex + 1)
      ];
    } else {
      // Create new mapping with defaults
      this.propertyMappings = [
        ...this.propertyMappings,
        { propertyId, sourceType: 'attribute', sourcePath: '', expression: expression || undefined }
      ];
    }
  }

  // ===========================================================================
  // Data Binding Mode
  // ===========================================================================

  onDataBindingModeChange(mode: ProcessDataBindingMode): void {
    this.dataBindingMode = mode;

    // Reset selections when changing mode
    if (mode !== 'runtimeEntity') {
      this.selectedCkType = null;
      this.selectedEntity = null;
      this.entityDataSource = undefined;
      this.entityDialogDataSource = undefined;
    }

    if (mode !== 'persistentQuery') {
      this.selectedPersistentQuery = null;
    }

    // Reset filters when changing mode
    this.filters = [];
    this.filterAttributes = [];
  }

  // ===========================================================================
  // Runtime Entity Binding
  // ===========================================================================

  private async initRuntimeEntityBinding(): Promise<void> {
    // Create a mock CkTypeSelectorItem for initial value
    // The full CkTypeSelectorItem has more properties, but we only need rtCkTypeId for our use
    this.selectedCkType = {
      rtCkTypeId: this.initialBindingCkTypeId!,
      displayName: this.initialBindingCkTypeId!.split('/').pop() ?? this.initialBindingCkTypeId!,
      fullName: this.initialBindingCkTypeId!,
      isAbstract: false,
      isFinal: false
    } as CkTypeSelectorItem;

    // Set up data sources
    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      this.initialBindingCkTypeId!
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      this.initialBindingCkTypeId!
    );

    // Load attributes for filters
    await this.loadAttributesForCkType(this.initialBindingCkTypeId!);

    // Pre-select entity if provided
    if (this.initialBindingRtId) {
      // Create a mock entity item - the actual display name will be updated when the combobox loads
      this.selectedEntity = {
        rtId: this.initialBindingRtId,
        ckTypeId: this.initialBindingCkTypeId!,
        displayName: this.initialBindingRtId
      };
    }
  }

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.selectedEntity = null;

    // Create data sources for entity selection
    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );

    // Load attributes for filters
    this.loadAttributesForCkType(ckType.rtCkTypeId);
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.selectedEntity = null;
    this.entityDataSource = undefined;
    this.entityDialogDataSource = undefined;
    this.filterAttributes = [];
  }

  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity = entity;
  }

  onEntityCleared(): void {
    this.selectedEntity = null;
  }

  // ===========================================================================
  // Persistent Query Binding
  // ===========================================================================

  private async initPersistentQueryBinding(): Promise<void> {
    // Pre-select query
    this.selectedPersistentQuery = this.persistentQueries.find(
      q => q.rtId === this.initialBindingQueryRtId
    ) ?? null;

    // If query has associated CK type, load attributes
    if (this.selectedPersistentQuery?.queryCkTypeId) {
      await this.loadAttributesForCkType(this.selectedPersistentQuery.queryCkTypeId);
    }
  }

  async onQueryFilterChange(filter: string): Promise<void> {
    await this.loadPersistentQueries(filter);
  }

  onQuerySelected(query: PersistentQueryItem | null): void {
    this.selectedPersistentQuery = query;

    // Load attributes if query has associated CK type
    if (query?.queryCkTypeId) {
      this.loadAttributesForCkType(query.queryCkTypeId);
    } else {
      this.filterAttributes = [];
    }
  }

  private async loadPersistentQueries(searchText?: string): Promise<void> {
    this.isLoadingQueries = true;
    try {
      const result = await firstValueFrom(
        this.getSystemPersistentQueriesGQL.fetch({
          first: 100,
          searchFilter: searchText ? { searchTerm: searchText, language: 'de' } : undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Apollo fetch requires flexible variable typing
        } as any)
      );

      this.persistentQueries = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          rtId: item.rtId,
          name: item.name,
          description: item.description,
          queryCkTypeId: item.queryCkTypeId
        }));
    } finally {
      this.isLoadingQueries = false;
    }
  }

  // ===========================================================================
  // Filters
  // ===========================================================================

  private initFilterVariables(): void {
    const meshBoardVariables = this.stateService.getVariables();
    this.filterVariables = meshBoardVariables.map(v => ({
      name: v.name,
      displayName: v.name,
      value: v.value
    }));
  }

  private async loadAttributesForCkType(ckTypeId: string): Promise<void> {
    this._isLoadingAttributes.set(true);
    try {
      const result = await firstValueFrom(
        this.getCkTypeAvailableQueryColumnsGQL.fetch({
          variables: { rtCkId: ckTypeId, first: 1000 }
        })
      );

      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items ?? [];
      this.filterAttributes = columns
        .filter((attr): attr is NonNullable<typeof attr> => attr !== null)
        .map(attr => ({
          attributePath: attr.attributePath ?? '',
          attributeValueType: attr.attributeValueType ?? 'String'
        }));
    } catch (error) {
      console.error('Error loading attributes:', error);
      this.filterAttributes = [];
    } finally {
      this._isLoadingAttributes.set(false);
    }
  }

  onFiltersChange(filters: FieldFilterItem[]): void {
    this.filters = filters;
  }

  // ===========================================================================
  // Save / Cancel
  // ===========================================================================

  onSave(): void {
    const result: ProcessConfigResult = {
      ckTypeId: '',
      rtId: '',
      diagramSource: this.selectedDiagram ? 'stored' : 'none',
      fitToBounds: this.form.fitToBounds,
      allowZoom: this.form.allowZoom,
      allowPan: this.form.allowPan,
      showToolbar: this.form.showToolbar,
      initialZoom: this.form.initialZoom,
      dataBindingMode: this.dataBindingMode
    };

    // Diagram
    if (this.selectedDiagram) {
      result.processDiagramRtId = this.selectedDiagram.rtId;
    }

    // Data binding - Runtime Entity
    if (this.dataBindingMode === 'runtimeEntity' && this.selectedCkType && this.selectedEntity) {
      result.bindingCkTypeId = this.selectedCkType.rtCkTypeId;
      result.bindingRtId = this.selectedEntity.rtId;
    }

    // Data binding - Persistent Query
    if (this.dataBindingMode === 'persistentQuery' && this.selectedPersistentQuery) {
      result.bindingQueryRtId = this.selectedPersistentQuery.rtId;
      result.bindingQueryName = this.selectedPersistentQuery.name;
    }

    // Filters
    if (this.filters.length > 0 && this.dataBindingMode !== 'none') {
      result.bindingFilters = this.filters.map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }));
    }

    // Property mappings (only include mappings with a sourcePath set)
    if (this.propertyMappings.length > 0 && this.dataBindingMode !== 'none') {
      const validMappings = this.propertyMappings.filter(m => m.sourcePath && m.sourcePath.trim() !== '');
      if (validMappings.length > 0) {
        result.propertyMappings = validMappings;
      }
    }

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
