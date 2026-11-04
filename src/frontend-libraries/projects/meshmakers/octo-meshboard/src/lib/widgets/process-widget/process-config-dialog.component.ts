import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { FilterVariable } from '@meshmakers/octo-ui';
import {
  AttributeItem,
  GetCkTypeAvailableQueryColumnsDtoGQL,
  RuntimeEntityItem
} from '@meshmakers/octo-services';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import {
  GetSystemPersistentQueriesDtoGQL
} from '../../graphQL/getSystemPersistentQueries';
import type { ProcessDiagramConfig, TransformProperty } from '@meshmakers/octo-process-diagrams';
import { ProcessDataService, ProcessDiagramSummary } from './services/process-data.service';
import {
  DEFAULT_PROCESS_BINDING_NAME,
  DiagramPropertyMapping,
  ProcessConnectionDirection,
  ProcessDataBindingMode,
  ProcessValueAggregate,
  ProcessWidgetBinding,
  ProcessWidgetConfig
} from './process-widget-config.model';
import { legacyProcessBinding, mappingBindingName } from './process-widget-bindings';
import {
  PROCESS_AGGREGATE_OPTIONS,
  ProcessBindingDraft,
  ProcessBindingSource,
  ProcessDiagramConnection,
  bindingDisplayName,
  bindingDraftIssues,
  bindingResultFields,
  clearMappingsOfBinding,
  draftsFromBindings,
  findDiagramConnections,
  isAggregateFixed,
  renameBindingInMappings,
  sourceTypeForMode,
  withAggregate,
  withBindingName
} from './process-binding-editor';
import { describeProcessDiagramIssues, sanitizeProcessDiagram } from './process-diagram-validation';
import { ProcessBindingCardsComponent, ProcessBindingRename } from './process-binding-cards.component';
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { WidgetFilterConfig, EntitySelectorConfig } from '../../models/meshboard.models';
import { QueryFamily } from '../../utils/query-family';
import { firstValueFrom } from 'rxjs';

/**
 * Diagram source type
 */
export type DiagramSourceType = 'stored' | 'none';

/** Re-exported for host code that imported the dialog's own item type. */
export type { RuntimeEntityItem };

/**
 * Persistent query item for selection
 */
export interface PersistentQueryItem {
  rtId: string;
  name: string;
  description?: string | null;
  /** The persistent-query entity's own CK type — carries the family marker (e.g. `SimpleSdQuery`). */
  ckTypeId?: string | null;
  /** The CK type the query queries against (label only — not used for family classification). */
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
  bindingQueryFamily?: QueryFamily;
  bindingIgnoreTimeFilter?: boolean;
  bindingEntitySelectorId?: string;
  bindingFilters?: WidgetFilterConfig[];
  // Property mappings
  propertyMappings?: DiagramPropertyMapping[];
  /**
   * Named bindings (AB#8025). Set when the widget has more than one binding or
   * one that is not named `default`; the legacy fields above are then absent.
   */
  bindings?: ProcessWidgetBinding[];
  /** Per connection, the property that drives its direction (AB#8025). */
  connectionDirections?: ProcessConnectionDirection[];
}

/**
 * Configuration dialog for Process Widget.
 * Allows selecting a stored diagram, display options, the data bindings (one
 * card per binding, AB#8025), the property mappings with their binding and
 * aggregate, and the binding that drives each connection's direction.
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
    LoadingOverlayComponent,
    ProcessBindingCardsComponent
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
                  @if (diagramIssueHint) {
                    <p class="field-hint warning diagram-issue-hint" role="status">{{ diagramIssueHint }}</p>
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

          <!-- Tab 2: Data Binding (AB#8025: binding cards) -->
          <kendo-tabstrip-tab [title]="'Data Binding'">
            <ng-template kendoTabContent>
              <div class="tab-content">
                <p class="section-hint">Bind the diagram to runtime data. Each binding has its own source and entity selector; mappings refer to it by name.</p>
                <mm-process-binding-cards
                  [drafts]="drafts"
                  [selectors]="entitySelectors"
                  [persistentQueries]="persistentQueries"
                  [isLoadingQueries]="isLoadingQueries"
                  [filterVariables]="filterVariables"
                  [mappings]="propertyMappings"
                  [nextUid]="nextUid"
                  (draftsChange)="onDraftsChange()"
                  (bindingRenamed)="onBindingRenamed($event)"
                  (bindingDeleted)="onBindingDeleted($event)"
                  (queryFilterChange)="onQueryFilterChange($event)">
                </mm-process-binding-cards>
              </div>
            </ng-template>
          </kendo-tabstrip-tab>

          <!-- Tab 3: Property Mappings (AB#8025: Binding + Aggregate columns, connections) -->
          <kendo-tabstrip-tab [title]="'Mappings'" [disabled]="drafts.length === 0 || diagramExposedProperties.length === 0">
            <ng-template kendoTabContent>
              <div class="tab-content">
                @if (diagramExposedProperties.length === 0) {
                  <p class="empty-hint">No exposed properties in this diagram.</p>
                } @else if (isLoadingDiagramConfig) {
                  <div class="loading-hint">Loading diagram properties...</div>
                } @else {
                  <p class="section-hint">Map diagram properties to fields of a binding. Aggregate reduces all rows of the binding's scope first, then the expression runs on the result.</p>
                  <div class="property-mappings-table" role="table" aria-label="Property mappings">
                    <div class="mapping-header" role="row">
                      <span class="col-property" role="columnheader">Property</span>
                      <span class="col-type" role="columnheader">Type</span>
                      <span class="col-binding" role="columnheader">Binding</span>
                      <span class="col-path" role="columnheader">Field</span>
                      <span class="col-aggregate" role="columnheader">Aggregate</span>
                      <span class="col-expression" role="columnheader">Expression</span>
                    </div>
                    @for (prop of diagramExposedProperties; track prop.id) {
                      <div class="mapping-row" role="row" [attr.data-mapping-row]="prop.id">
                        <span class="col-property" role="cell" [title]="prop.name">{{ prop.name }}</span>
                        <span class="col-type type-badge" role="cell">{{ prop.type }}</span>
                        <kendo-dropdownlist
                          class="col-binding"
                          [attr.data-mapping-binding]="prop.id"
                          [attr.aria-label]="'Binding of ' + prop.name"
                          [data]="bindingOptionsFor(prop.id)"
                          textField="label"
                          valueField="value"
                          [valuePrimitive]="true"
                          [value]="mappingBindingOf(prop.id)"
                          (valueChange)="onMappingBindingChange(prop.id, $event)">
                        </kendo-dropdownlist>
                        @if (fieldAttributesFor(prop.id); as attributes) {
                          <kendo-combobox
                            class="col-path"
                            [attr.aria-label]="'Field of ' + prop.name"
                            [title]="getMappingSourcePath(prop.id) || ''"
                            [data]="attributes"
                            textField="attributePath"
                            valueField="attributePath"
                            [valuePrimitive]="true"
                            [allowCustom]="true"
                            [value]="getMappingSourcePath(prop.id)"
                            [filterable]="true"
                            (valueChange)="onMappingSourcePathChange(prop.id, $event)"
                            placeholder="Attribute...">
                          </kendo-combobox>
                        } @else {
                          <kendo-textbox
                            class="col-path"
                            [attr.aria-label]="'Field of ' + prop.name"
                            [title]="getMappingSourcePath(prop.id) || ''"
                            [value]="getMappingSourcePath(prop.id)"
                            (valueChange)="onMappingSourcePathChange(prop.id, $event)"
                            [placeholder]="bindingModeOf(prop.id) === 'runtimeEntity' ? 'Attribute...' : 'Column...'">
                          </kendo-textbox>
                        }
                        <kendo-dropdownlist
                          class="col-aggregate"
                          [attr.data-mapping-aggregate]="prop.id"
                          [attr.aria-label]="'Aggregate of ' + prop.name"
                          [title]="isAggregateFixedFor(prop) ? aggregateFixedHint(prop) : ''"
                          [data]="aggregateOptions"
                          textField="label"
                          valueField="value"
                          [valuePrimitive]="true"
                          [disabled]="isAggregateFixedFor(prop)"
                          [value]="mappingAggregateOf(prop)"
                          (valueChange)="onMappingAggregateChange(prop.id, $event)">
                        </kendo-dropdownlist>
                        <kendo-textbox
                          class="col-expression"
                          [attr.aria-label]="'Expression of ' + prop.name"
                          [value]="getMappingExpression(prop.id)"
                          (valueChange)="onMappingExpressionChange(prop.id, $event)"
                          placeholder="value">
                        </kendo-textbox>
                      </div>
                    }
                  </div>
                  <p class="field-hint expression-help">
                    <code>value</code> = raw value. Examples: <code>value / 100</code>, <code>abs(value)</code>.
                    Sum, Average, Minimum and Maximum need a number property and a persistent-query binding; otherwise the first row is used.
                  </p>

                  <!-- Connections (AB#8025, wireframe approval condition on AB#7954) -->
                  <div class="connections-section" data-connections>
                    <h4 class="section-title">Connections</h4>
                    @if (connections.length === 0) {
                      <p class="field-hint">This diagram has no flow lines with a direction binding. Only line, polyline and path shapes whose flow animation, visibility or colour is bound to a property in the Process Designer are listed; plain connections between elements have no direction to pick.</p>
                    } @else {
                      <p class="section-hint">Each line takes its direction from the sign of a mapped value: positive flows forward, negative backward, 0 or no value shows no flow.</p>
                      <div class="connection-list" role="list" aria-label="Connections">
                        @for (connection of connections; track connection.id) {
                          <div class="connection-row" role="listitem" [attr.data-connection]="connection.id">
                            <span class="connection-name" [title]="connection.id">{{ connection.label }}</span>
                            <svg class="connection-preview" viewBox="0 0 120 24" width="120" height="24" aria-hidden="true">
                              <line class="flow-line" x1="6" y1="12" x2="104" y2="12"></line>
                              <path class="flow-arrow" d="M104 6 L116 12 L104 18 Z"></path>
                            </svg>
                            <kendo-dropdownlist
                              class="connection-direction"
                              [attr.data-connection-direction]="connection.id"
                              [attr.aria-label]="'Direction of ' + connection.label + ' from'"
                              [data]="directionOptionsFor(connection)"
                              textField="label"
                              valueField="value"
                              [valuePrimitive]="true"
                              [value]="connectionDirectionOf(connection.id)"
                              (valueChange)="onConnectionDirectionChange(connection.id, $event)">
                            </kendo-dropdownlist>
                            <span class="connection-source field-hint">{{ connectionSourceText(connection) }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
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

      @if (saveIssues.length > 0) {
        <div class="save-issues" role="alert" data-save-issues>
          @for (issue of saveIssues; track issue) {
            <p>{{ issue }}</p>
          }
        </div>
      }

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
      grid-template-columns: minmax(70px, 1fr) 55px minmax(90px, 0.9fr) minmax(130px, 1.2fr) minmax(100px, 0.9fr) minmax(80px, 1fr);
      gap: 6px;
      padding: 6px 10px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.7rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .mapping-row {
      display: grid;
      grid-template-columns: minmax(70px, 1fr) 55px minmax(90px, 0.9fr) minmax(130px, 1.2fr) minmax(100px, 0.9fr) minmax(80px, 1fr);
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
      color: var(--kendo-color-subtle, #6c757d);
    }

    .col-expression kendo-textbox {
      font-family: var(--theme-font-mono);
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

    /* Narrow dialog (600 px): two lines per mapping row. */
    .tab-content { container-type: inline-size; }
    @container (max-width: 560px) {
      .mapping-header { display: none; }
      /* Two equal columns (never the 55 px type column for an input): the
         property name and its type on the first line, then Binding | Aggregate
         and Field | Expression, each at least ~200 px wide. */
      .mapping-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mapping-row .col-property { grid-column: 1; }
      .mapping-row .col-type { grid-column: 2; justify-self: end; min-width: 55px; }
      .mapping-row .col-binding { grid-column: 1; }
      .mapping-row .col-aggregate { grid-column: 2; }
      .mapping-row .col-path { grid-column: 1; }
      .mapping-row .col-expression { grid-column: 2; }
    }

    .connections-section { margin-top: 20px; }
    .section-title { margin: 0 0 6px; font-size: 0.9rem; font-weight: 600; }
    .connection-list { display: flex; flex-direction: column; gap: 6px; }
    .connection-row {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) 120px minmax(160px, 1.4fr);
      gap: 4px 10px;
      align-items: center;
      padding: 6px 10px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }
    .connection-name { font-weight: 500; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .connection-source { grid-column: 1 / -1; }
    .connection-preview .flow-line {
      stroke: var(--kendo-color-primary, #0d6efd);
      stroke-width: 3;
      stroke-dasharray: 8 5;
      stroke-linecap: round;
    }
    .connection-preview .flow-arrow { fill: var(--kendo-color-primary, #0d6efd); }
    @container (max-width: 560px) {
      .connection-row { grid-template-columns: 1fr; }
    }

    .save-issues {
      margin: 0 16px;
      padding: 8px 10px;
      border: 1px solid var(--kendo-color-error, #dc3545);
      border-radius: 4px;
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.8rem;
    }
    .save-issues p { margin: 0; }

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
  private readonly getSystemPersistentQueriesGQL = inject(GetSystemPersistentQueriesDtoGQL);
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

  // Initial values for editing - Data Binding (legacy single binding)
  @Input() initialDataBindingMode?: ProcessDataBindingMode;
  @Input() initialBindingCkTypeId?: string;
  @Input() initialBindingRtId?: string;
  @Input() initialBindingQueryRtId?: string;
  @Input() initialBindingQueryName?: string;
  @Input() initialBindingQueryFamily?: QueryFamily;
  @Input() initialBindingIgnoreTimeFilter?: boolean;
  @Input() initialBindingEntitySelectorId?: string;
  @Input() initialBindingFilters?: WidgetFilterConfig[];
  @Input() initialPropertyMappings?: DiagramPropertyMapping[];
  /** Named bindings (AB#8023); win over the legacy fields when non-empty. */
  @Input() initialBindings?: ProcessWidgetBinding[];
  /** Connection direction overrides (AB#8025). */
  @Input() initialConnectionDirections?: ProcessConnectionDirection[];

  // State - Diagram
  isLoadingDiagrams = false;
  storedDiagrams: ProcessDiagramSummary[] = [];
  selectedDiagram: ProcessDiagramSummary | null = null;
  /** Full config of the selected diagram (properties, connections). */
  diagramConfig: ProcessDiagramConfig | null = null;
  /** Validation hint naming diagram elements that are invalid and skipped when rendering (AB#8151). */
  diagramIssueHint = '';

  // State - Bindings (AB#8025)
  drafts: ProcessBindingDraft[] = [];
  persistentQueries: { rtId: string; name: string; description?: string | null; ckTypeId?: string | null; queryCkTypeId?: string | null }[] = [];
  isLoadingQueries = false;
  entitySelectors: EntitySelectorConfig[] = [];
  filterVariables: FilterVariable[] = [];
  private uidSeed = 0;
  /** Shared uid source for the cards (also used by the binding cards component). */
  readonly nextUid = (): number => ++this.uidSeed;

  // State - Mappings
  diagramExposedProperties: TransformProperty[] = [];
  propertyMappings: DiagramPropertyMapping[] = [];
  isLoadingDiagramConfig = false;
  /** Attribute lists per CK type (Field column of runtime-entity bindings). */
  private readonly attributesByCkType = new Map<string, AttributeItem[]>();
  private readonly attributesLoading = new Set<string>();

  // State - Connections
  connections: ProcessDiagramConnection[] = [];
  private connectionDirections = new Map<string, string>();

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

  get aggregateOptions(): typeof PROCESS_AGGREGATE_OPTIONS { return PROCESS_AGGREGATE_OPTIONS; }

  // Form state
  form = {
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1
  };

  /** Messages that block Save (names, selectors not on the board, incomplete bindings). */
  get saveIssues(): string[] {
    return bindingDraftIssues(this.drafts, this.entitySelectors.map(s => s.id));
  }

  get isValid(): boolean {
    return !!this.selectedDiagram && this.saveIssues.length === 0;
  }

  async ngOnInit(): Promise<void> {
    // Initialize display options
    this.form.fitToBounds = this.initialFitToBounds ?? true;
    this.form.allowZoom = this.initialAllowZoom ?? false;
    this.form.allowPan = this.initialAllowPan ?? false;
    this.form.showToolbar = this.initialShowToolbar ?? false;
    this.form.initialZoom = this.initialInitialZoom ?? 1;

    this.entitySelectors = this.stateService.getEntitySelectors();
    this.initFilterVariables();

    // One card per binding: the named bindings, else the implicit legacy one ("Default").
    this.drafts = draftsFromBindings(this.initialBindingList(), this.nextUid);
    this.propertyMappings = [...(this.initialPropertyMappings ?? [])];
    for (const d of this.initialConnectionDirections ?? []) {
      this.connectionDirections.set(d.connectionId, d.propertyId);
    }

    await Promise.all([this.loadStoredDiagrams(), this.loadPersistentQueries()]);

    // Fill the queried CK type of query cards (filters, labels) from the list.
    for (const draft of this.drafts) {
      if (draft.mode === 'persistentQuery' && draft.queryRtId) {
        draft.queryCkTypeId ??= this.persistentQueries.find(q => q.rtId === draft.queryRtId)?.queryCkTypeId ?? undefined;
      }
    }
    this.loadMissingAttributes();

    if (this.initialProcessDiagramRtId) {
      this.selectedDiagram = this.storedDiagrams.find(d => d.rtId === this.initialProcessDiagramRtId) ?? null;
      if (this.selectedDiagram) {
        await this.loadDiagramConfig(this.selectedDiagram.rtId);
      }
    }
  }

  private initialBindingList(): ProcessWidgetBinding[] {
    if (this.initialBindings && this.initialBindings.length > 0) {
      return this.initialBindings;
    }
    const legacy = legacyProcessBinding({
      dataBindingMode: this.initialDataBindingMode,
      bindingCkTypeId: this.initialBindingCkTypeId,
      bindingRtId: this.initialBindingRtId,
      bindingQueryRtId: this.initialBindingQueryRtId,
      bindingQueryName: this.initialBindingQueryName,
      bindingQueryFamily: this.initialBindingQueryFamily,
      bindingIgnoreTimeFilter: this.initialBindingIgnoreTimeFilter,
      bindingEntitySelectorId: this.initialBindingEntitySelectorId,
      bindingFilters: this.initialBindingFilters
    } as ProcessWidgetConfig);
    return legacy ? [legacy] : [];
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
    this.diagramConfig = null;
    this.diagramIssueHint = '';
    this.connections = [];
    // Connection ids belong to the previous diagram.
    this.connectionDirections.clear();

    if (!diagram) {
      return;
    }

    await this.loadDiagramConfig(diagram.rtId);
  }

  private async loadDiagramConfig(diagramRtId: string): Promise<void> {
    this.isLoadingDiagramConfig = true;
    try {
      const loaded = await this.processDataService.loadDiagram(diagramRtId);
      // A malformed element must not leave the other tabs empty (AB#8151): the exposed
      // properties and connections come from the valid part, the problems become a hint.
      const result = loaded ? sanitizeProcessDiagram(loaded) : null;
      const fullDiagram = result?.diagram;
      this.diagramIssueHint = result ? describeProcessDiagramIssues(result.issues) : '';
      if (this.diagramIssueHint) {
        console.warn(`[ProcessConfigDialog] ${this.diagramIssueHint}`);
      }
      this.diagramConfig = fullDiagram ?? null;
      this.diagramExposedProperties = fullDiagram?.transformProperties ?? [];
      this.connections = findDiagramConnections(fullDiagram);
    } catch (error) {
      console.error('Error loading diagram config:', error);
    } finally {
      this.isLoadingDiagramConfig = false;
    }
  }

  // ===========================================================================
  // Bindings (cards)
  // ===========================================================================

  onDraftsChange(): void {
    this.drafts = [...this.drafts];
    this.loadMissingAttributes();
  }

  onBindingRenamed(rename: ProcessBindingRename): void {
    this.propertyMappings = renameBindingInMappings(this.propertyMappings, rename.oldName, rename.newName);
  }

  onBindingDeleted(name: string): void {
    this.propertyMappings = clearMappingsOfBinding(this.propertyMappings, name);
  }

  async onQueryFilterChange(filter: string): Promise<void> {
    await this.loadPersistentQueries(filter);
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
          ckTypeId: item.ckTypeId,
          queryCkTypeId: item.queryCkTypeId
        }));
    } finally {
      this.isLoadingQueries = false;
    }
  }

  private initFilterVariables(): void {
    this.filterVariables = this.stateService.getVariables().map(v => ({
      name: v.name,
      displayName: v.name,
      value: v.value
    }));
  }

  /** Loads the attribute list of every runtime-entity binding's CK type once. */
  private loadMissingAttributes(): void {
    for (const draft of this.drafts) {
      const ckTypeId = draft.mode === 'runtimeEntity' ? draft.ckTypeId : undefined;
      if (ckTypeId && !this.attributesByCkType.has(ckTypeId) && !this.attributesLoading.has(ckTypeId)) {
        void this.loadAttributesForCkType(ckTypeId);
      }
    }
  }

  private async loadAttributesForCkType(ckTypeId: string): Promise<void> {
    this.attributesLoading.add(ckTypeId);
    try {
      const result = await firstValueFrom(
        this.getCkTypeAvailableQueryColumnsGQL.fetch({
          variables: { rtCkId: ckTypeId, first: 1000, includeNavigationProperties: true }
        })
      );
      const columns = result.data?.constructionKit?.types?.items?.[0]?.availableQueryColumns?.items ?? [];
      this.attributesByCkType.set(ckTypeId, columns
        .filter((attr): attr is NonNullable<typeof attr> => attr !== null)
        .map(attr => ({
          attributePath: attr.attributePath ?? '',
          attributeValueType: attr.attributeValueType ?? 'String'
        })));
    } catch (error) {
      console.error('Error loading attributes:', error);
      this.attributesByCkType.set(ckTypeId, []);
    } finally {
      this.attributesLoading.delete(ckTypeId);
    }
  }

  // ===========================================================================
  // Property Mappings
  // ===========================================================================

  private mappingOf(propertyId: string): DiagramPropertyMapping | undefined {
    return this.propertyMappings.find(m => m.propertyId === propertyId);
  }

  private draftNamed(name: string): ProcessBindingDraft | undefined {
    return this.drafts.find(d => d.name.trim() === name);
  }

  /** Binding a row reads from: its mapping's binding, else the first card. */
  mappingBindingOf(propertyId: string): string | undefined {
    const mapping = this.mappingOf(propertyId);
    if (mapping) {
      return mappingBindingName(mapping);
    }
    return this.drafts[0]?.name.trim() || undefined;
  }

  bindingModeOf(propertyId: string): ProcessBindingSource | undefined {
    const name = this.mappingBindingOf(propertyId);
    return name ? this.draftNamed(name)?.mode : undefined;
  }

  /** Binding names for the row's dropdown; an unknown stored name stays visible. */
  bindingOptionsFor(propertyId: string): { value: string; label: string }[] {
    const names = [...new Set(this.drafts.map(d => d.name.trim()).filter(n => !!n))];
    const options = names.map(n => ({ value: n, label: bindingDisplayName(n) }));
    const current = this.mappingOf(propertyId) ? this.mappingBindingOf(propertyId) : undefined;
    if (current && !names.includes(current)) {
      options.push({ value: current, label: `${bindingDisplayName(current)} (unknown binding)` });
    }
    return options;
  }

  /** Attribute list for the Field column of a runtime-entity binding, when loaded. */
  fieldAttributesFor(propertyId: string): AttributeItem[] | undefined {
    const name = this.mappingBindingOf(propertyId);
    const draft = name ? this.draftNamed(name) : undefined;
    if (draft?.mode !== 'runtimeEntity' || !draft.ckTypeId) {
      return undefined;
    }
    const attributes = this.attributesByCkType.get(draft.ckTypeId);
    return attributes && attributes.length > 0 ? attributes : undefined;
  }

  isAggregateFixedFor(prop: TransformProperty): boolean {
    return isAggregateFixed(prop.type, this.bindingModeOf(prop.id));
  }

  aggregateFixedHint(prop: TransformProperty): string {
    return prop.type !== 'number'
      ? 'Only number properties can be aggregated.'
      : 'A runtime-entity binding loads one entity; use a persistent query to aggregate.';
  }

  mappingAggregateOf(prop: TransformProperty): ProcessValueAggregate {
    if (this.isAggregateFixedFor(prop)) {
      return 'first';
    }
    return this.mappingOf(prop.id)?.aggregate ?? 'first';
  }

  getMappingSourcePath(propertyId: string): string {
    return this.mappingOf(propertyId)?.sourcePath ?? '';
  }

  getMappingExpression(propertyId: string): string {
    return this.mappingOf(propertyId)?.expression ?? '';
  }

  /** Replaces (or creates) the mapping of a property. */
  private updateMapping(propertyId: string, change: (mapping: DiagramPropertyMapping) => DiagramPropertyMapping): void {
    const index = this.propertyMappings.findIndex(m => m.propertyId === propertyId);
    if (index >= 0) {
      this.propertyMappings = [
        ...this.propertyMappings.slice(0, index),
        change(this.propertyMappings[index]),
        ...this.propertyMappings.slice(index + 1)
      ];
      return;
    }
    const bindingName = this.mappingBindingOf(propertyId) ?? DEFAULT_PROCESS_BINDING_NAME;
    const mode = this.draftNamed(bindingName)?.mode ?? 'persistentQuery';
    const created = withBindingName({ propertyId, sourceType: sourceTypeForMode(mode), sourcePath: '' }, bindingName);
    this.propertyMappings = [...this.propertyMappings, change(created)];
  }

  onMappingBindingChange(propertyId: string, bindingName: string): void {
    const mode = this.draftNamed(bindingName)?.mode;
    this.updateMapping(propertyId, m => {
      let next = withBindingName(m, bindingName);
      if (mode) {
        next = { ...next, sourceType: sourceTypeForMode(mode) };
      }
      if (mode === 'runtimeEntity') {
        next = withAggregate(next, 'first');
      }
      return next;
    });
  }

  onMappingSourcePathChange(propertyId: string, sourcePath: string | null | undefined): void {
    this.updateMapping(propertyId, m => ({ ...m, sourcePath: sourcePath ?? '' }));
  }

  onMappingAggregateChange(propertyId: string, aggregate: ProcessValueAggregate): void {
    this.updateMapping(propertyId, m => withAggregate(m, aggregate));
  }

  onMappingExpressionChange(propertyId: string, expression: string): void {
    this.updateMapping(propertyId, m => ({ ...m, expression: expression || undefined }));
  }

  // ===========================================================================
  // Connections
  // ===========================================================================

  connectionDirectionOf(connectionId: string): string | null {
    return this.connectionDirections.get(connectionId) ?? null;
  }

  /** "As in diagram" plus every number property, labelled with the value it is mapped to. */
  directionOptionsFor(connection: ProcessDiagramConnection): { value: string | null; label: string }[] {
    const diagramProperty = connection.diagramPropertyId
      ? this.propertyName(connection.diagramPropertyId)
      : 'several properties';
    return [
      { value: null, label: `As in diagram (${diagramProperty})` },
      ...this.diagramExposedProperties
        .filter(p => p.type === 'number')
        .map(p => ({ value: p.id, label: p.name }))
    ];
  }

  onConnectionDirectionChange(connectionId: string, propertyId: string | null | undefined): void {
    if (propertyId) {
      this.connectionDirections.set(connectionId, propertyId);
    } else {
      this.connectionDirections.delete(connectionId);
    }
  }

  /** Which mapped value the line follows: "pvPower ← pv · totalCurrentPower (Sum)". */
  connectionSourceText(connection: ProcessDiagramConnection): string {
    const propertyId = this.connectionDirections.get(connection.id) ?? connection.diagramPropertyId;
    if (!propertyId) {
      return 'Direction from several properties (as bound in the diagram).';
    }
    const mapping = this.mappingOf(propertyId);
    const name = this.propertyName(propertyId);
    if (!mapping?.sourcePath) {
      return `Direction from ${name} — not mapped yet, the line shows no flow.`;
    }
    const aggregate = mapping.aggregate && mapping.aggregate !== 'first'
      ? ` (${PROCESS_AGGREGATE_OPTIONS.find(o => o.value === mapping.aggregate)?.label ?? mapping.aggregate})`
      : '';
    return `Direction from ${name} ← ${bindingDisplayName(mappingBindingName(mapping))} · ${mapping.sourcePath}${aggregate}`;
  }

  private propertyName(propertyId: string): string {
    return this.diagramExposedProperties.find(p => p.id === propertyId)?.name ?? propertyId;
  }

  // ===========================================================================
  // Save / Cancel
  // ===========================================================================

  onSave(): void {
    if (!this.isValid) {
      return;
    }
    const result: ProcessConfigResult = {
      ckTypeId: '',
      rtId: '',
      diagramSource: this.selectedDiagram ? 'stored' : 'none',
      fitToBounds: this.form.fitToBounds,
      allowZoom: this.form.allowZoom,
      allowPan: this.form.allowPan,
      showToolbar: this.form.showToolbar,
      initialZoom: this.form.initialZoom,
      ...bindingResultFields(this.drafts, this.initialDataBindingMode)
    };

    if (this.selectedDiagram) {
      result.processDiagramRtId = this.selectedDiagram.rtId;
    }

    // Mappings with a field; their source type follows the binding's source.
    if (this.drafts.length > 0) {
      const mappings = this.propertyMappings
        .filter(m => m.sourcePath && m.sourcePath.trim() !== '')
        .map(m => {
          const mode = this.draftNamed(mappingBindingName(m))?.mode;
          return mode && m.sourceType !== sourceTypeForMode(mode) ? { ...m, sourceType: sourceTypeForMode(mode) } : m;
        });
      if (mappings.length > 0) {
        result.propertyMappings = mappings;
      }
    }

    if (this.connectionDirections.size > 0) {
      result.connectionDirections = [...this.connectionDirections].map(([connectionId, propertyId]) => ({ connectionId, propertyId }));
    }

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
