import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridModule } from '@progress/kendo-angular-grid';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  SVGIcon,
  fileIcon,
  folderIcon,
  calendarIcon,
  checkboxCheckedIcon,
  listUnorderedIcon
} from '@progress/kendo-svg-icons';

import { PropertyGridItem, PropertyGridConfig, PropertyChangeEvent, AttributeValueTypeDto, BinaryDownloadEvent } from '../models/property-grid.models';
import { PropertyValueDisplayComponent } from './property-value-display.component';
import { DEFAULT_PROPERTY_GRID_MESSAGES, PropertyGridMessages } from '../property-grid.messages';

/**
 * Generic property grid component for OctoMesh
 */
@Component({
  selector: 'mm-property-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridModule,
    InputsModule,
    DropDownsModule,
    ButtonsModule,
    SVGIconModule,
    PropertyValueDisplayComponent
  ],
  template: `
    <div class="mm-property-grid" [style.height]="config.height || '400px'">

      @if (config.showSearch) {
        <div class="search-toolbar">
          <kendo-textbox
            [(ngModel)]="searchTerm"
            [placeholder]="_messages.searchPlaceholder"
            (input)="onSearch()"
            [clearButton]="true">
          </kendo-textbox>
        </div>
      }

      <kendo-grid
        [data]="filteredData"
        [sortable]="true"
        [resizable]="true"
        [style.height]="gridHeight"
        [selectable]="{mode: 'single'}"
        class="property-grid">

        <!-- Property Name Column -->
        <kendo-grid-column
          field="displayName"
          [title]="_messages.columnPropertyTitle"
          [width]="200"
          [sortable]="true">
          <ng-template kendoGridCellTemplate let-dataItem="dataItem">
            <div class="property-name-cell">
              @if (config.showTypeIcons !== false) {
                <kendo-svgicon
                  [icon]="getTypeIcon(dataItem.type)"
                  class="type-icon">
                </kendo-svgicon>
              }
              <div class="property-info">
                <span class="property-name" [title]="dataItem.description">
                  {{ dataItem.displayName || dataItem.name }}
                </span>
                @if (dataItem.required) {
                  <span class="required-indicator">*</span>
                }
                @if (dataItem.readOnly) {
                  <span class="readonly-indicator" [title]="_messages.readOnlyTooltip">🔒</span>
                }
              </div>
            </div>
          </ng-template>
        </kendo-grid-column>

        <!-- Property Value Column -->
        <kendo-grid-column
          field="value"
          [title]="_messages.columnValueTitle"
          [sortable]="false">
          <ng-template kendoGridCellTemplate let-dataItem="dataItem">
            <mm-property-value-display
              [value]="dataItem.value"
              [type]="dataItem.type"
              [attributeName]="dataItem.displayName || dataItem.name"
              (binaryDownload)="onBinaryDownload($event)">
            </mm-property-value-display>
          </ng-template>
        </kendo-grid-column>

        <!-- Type Column (optional) -->
        @if (showTypeColumn) {
          <kendo-grid-column
            field="type"
            [title]="_messages.columnTypeTitle"
            [width]="120"
            [sortable]="true">
            <ng-template kendoGridCellTemplate let-dataItem="dataItem">
              <span class="type-badge" [ngClass]="'type-' + dataItem.type.toLowerCase()">
                {{ formatTypeName(dataItem.type) }}
              </span>
            </ng-template>
          </kendo-grid-column>
        }

      </kendo-grid>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .mm-property-grid {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--kendo-color-border);
      border-radius: 4px;
      overflow: hidden;
    }

    .search-toolbar {
      padding: 8px;
      border-bottom: 1px solid var(--kendo-color-border);
      background: var(--kendo-color-base-subtle);
    }

    .property-grid {
      flex: 1;
      border: none;
    }

    .property-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 24px;
    }

    .type-icon {
      width: 16px;
      height: 16px;
      opacity: 0.7;
    }

    .property-info {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }

    .property-name {
      font-weight: 500;
    }

    .required-indicator {
      color: var(--kendo-color-error);
      font-weight: bold;
    }

    .readonly-indicator {
      font-size: 12px;
      opacity: 0.7;
    }

    .property-editor {
      width: 100%;
      min-width: 200px;
    }

    .validation-error {
      color: var(--kendo-color-error);
      font-size: 0.8em;
      margin-top: 4px;
    }

    .type-badge {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: 500;
      background: var(--kendo-color-base-subtle);
      color: var(--kendo-color-on-base);
    }

    .grid-toolbar {
      padding: 8px;
      border-top: 1px solid var(--kendo-color-border);
      background: var(--kendo-color-base-subtle);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .changes-indicator {
      margin-left: auto;
      font-size: 0.9em;
      color: var(--kendo-color-primary);
      font-style: italic;
    }

  `]
})
export class PropertyGridComponent implements OnInit, OnChanges {
  @Input() data: PropertyGridItem[] = [];
  @Input() config: PropertyGridConfig = {};
  @Input() showTypeColumn = false;

  protected _messages: PropertyGridMessages = { ...DEFAULT_PROPERTY_GRID_MESSAGES };
  @Input() set messages(value: Partial<PropertyGridMessages> | undefined) {
    this._messages = { ...DEFAULT_PROPERTY_GRID_MESSAGES, ...(value ?? {}) };
  }

  @Output() propertyChange = new EventEmitter<PropertyChangeEvent>();
  @Output() saveRequested = new EventEmitter<PropertyGridItem[]>();
  @Output() binaryDownload = new EventEmitter<BinaryDownloadEvent>();

  // Component state
  filteredData: PropertyGridItem[] = [];
  searchTerm = '';
  hasChanges = false;
  pendingChanges: PropertyChangeEvent[] = [];

  // Icons
  readonly fileIcon = fileIcon;
  readonly folderIcon = folderIcon;
  readonly calendarIcon = calendarIcon;
  readonly checkboxCheckedIcon = checkboxCheckedIcon;
  readonly listUnorderedIcon = listUnorderedIcon;

  // Enum reference
  // Exposed to the template through a getter, not a `readonly X = X` field: Vite's
  // module-runner transform (used by the Vitest unit-test builder) snapshots a class
  // field whose initialiser is a bare imported identifier at module-evaluation time,
  // which is before esbuild's lazily-initialised shared chunk has assigned the export,
  // so the field would be `undefined`.
  // A getter body is rewritten to a live read. Test-runner-only: production and
  // ng-packagr builds do not use the module runner and are unaffected.
  get AttributeValueTypeDto(): typeof AttributeValueTypeDto { return AttributeValueTypeDto; }

  ngOnInit() {
    this.updateFilteredData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.updateFilteredData();
      this.hasChanges = false;
      this.pendingChanges = [];
    }
  }

  get gridHeight(): string {
    const baseHeight = this.config.height || '400px';
    const searchHeight = this.config.showSearch ? 40 : 0;
    const toolbarHeight = !this.config.readOnlyMode ? 50 : 0;
    const totalOffset = searchHeight + toolbarHeight;

    if (baseHeight.includes('px')) {
      const px = parseInt(baseHeight) - totalOffset;
      return `${Math.max(px, 200)}px`;
    }
    return baseHeight;
  }

  /**
   * Update filtered data based on search term
   */
  updateFilteredData() {
    if (!this.searchTerm.trim()) {
      this.filteredData = [...this.data];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredData = this.data.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.displayName?.toLowerCase().includes(term)) ||
      (item.description?.toLowerCase().includes(term)) ||
      String(item.value).toLowerCase().includes(term)
    );
  }

  /**
   * Handle search input
   */
  onSearch() {
    this.updateFilteredData();
  }

  /**
   * Get appropriate icon for property type
   */
  getTypeIcon(type: AttributeValueTypeDto): SVGIcon {
    switch (type) {
      case AttributeValueTypeDto.BooleanDto:
        return checkboxCheckedIcon;
      case AttributeValueTypeDto.IntDto:
      case AttributeValueTypeDto.IntegerDto:
      case AttributeValueTypeDto.DoubleDto:
        return fileIcon;
      case AttributeValueTypeDto.DateTimeDto:
      case AttributeValueTypeDto.DateTimeOffsetDto:
        return calendarIcon;
      case AttributeValueTypeDto.StringArrayDto:
      case AttributeValueTypeDto.IntegerArrayDto:
        return listUnorderedIcon;
      case AttributeValueTypeDto.RecordDto:
      case AttributeValueTypeDto.RecordArrayDto:
        return folderIcon;
      default:
        return fileIcon;
    }
  }

  /**
   * Format type name for display
   */
  formatTypeName(type: AttributeValueTypeDto): string {
    return type.replace('_DTO', '').replace('DTO', '').replace('_', ' ');
  }

  /**
   * Save pending changes
   */
  saveChanges() {
    if (this.pendingChanges.length > 0) {
      const updatedData = this.data.map(item => {
        const change = this.pendingChanges.find(c => c.property.id === item.id);
        return change ? { ...item, value: change.newValue } : item;
      });

      this.saveRequested.emit(updatedData);
      this.hasChanges = false;
      this.pendingChanges = [];
    }
  }

  /**
   * Discard pending changes
   */
  discardChanges() {
    this.hasChanges = false;
    this.pendingChanges = [];
    this.updateFilteredData();
  }

  /**
   * Handle property value change
   */
  onPropertyChange(property: PropertyGridItem, oldValue: unknown, newValue: unknown) {
    const changeEvent: PropertyChangeEvent = {
      property,
      oldValue,
      newValue
    };

    // Update or add to pending changes
    const existingIndex = this.pendingChanges.findIndex(c => c.property.id === property.id);
    if (existingIndex >= 0) {
      this.pendingChanges[existingIndex] = changeEvent;
    } else {
      this.pendingChanges.push(changeEvent);
    }

    this.hasChanges = this.pendingChanges.length > 0;
    this.propertyChange.emit(changeEvent);
  }

  /**
   * Handle binary download request from property value display
   */
  onBinaryDownload(event: BinaryDownloadEvent): void {
    this.binaryDownload.emit(event);
  }
}
