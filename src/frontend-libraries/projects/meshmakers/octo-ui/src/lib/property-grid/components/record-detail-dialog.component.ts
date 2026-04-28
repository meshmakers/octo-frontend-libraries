import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { GridModule } from '@progress/kendo-angular-grid';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  fileIcon, folderIcon, calendarIcon, checkboxCheckedIcon, listUnorderedIcon,
  chevronRightIcon, chevronDownIcon
} from '@progress/kendo-svg-icons';
import { AttributeValueTypeDto } from '../models/property-grid.models';

interface RecordProperty {
  key: string;
  value: unknown;
  formattedValue: string;
  type: AttributeValueTypeDto;
}

interface RecordArrayItem {
  /** Stable position in the original array — preserved when filtering shrinks the visible list. */
  originalIndex: number;
  label: string | null;
  properties: RecordProperty[];
  expanded: boolean;
}

/**
 * Content component for displaying Record and RecordArray attribute values.
 * Designed to be hosted inside a Kendo Window opened via `WindowService.open()`
 * — this guarantees the window is mounted at the application root (escaping
 * any tile/widget stacking context) and is fully resizable, draggable,
 * minimizable and maximizable like the other dialogs in the studio.
 *
 * Inputs are set on the component instance after the window is created:
 *   const ref = windowService.open({ content: RecordDetailDialogComponent, ... });
 *   const c = ref.content.instance as RecordDetailDialogComponent;
 *   c.attributeName = ...; c.value = ...; c.type = ...;
 */
@Component({
  selector: 'mm-record-detail-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule, GridModule, SVGIconModule],
  template: `
    <div class="record-detail-content">
      @if (isRecordArray && recordItems.length > 1) {
        <div class="record-toolbar">
          <input
            type="text"
            class="search-input"
            [value]="searchTerm"
            (input)="onSearchInput($event)"
            placeholder="Search records, keys, values…"
            aria-label="Search" />
          @if (searchTerm) {
            <button
              type="button"
              class="search-clear"
              (click)="clearSearch()"
              aria-label="Clear search"
              title="Clear search">×</button>
            <span class="match-count">
              {{ visibleRecords.length }} of {{ recordItems.length }}
            </span>
          }
          <span class="toolbar-spacer"></span>
          <button
            kendoButton
            fillMode="flat"
            [svgIcon]="chevronDownIcon"
            (click)="expandAll()">
            Expand All
          </button>
          <button
            kendoButton
            fillMode="flat"
            [svgIcon]="chevronRightIcon"
            (click)="collapseAll()">
            Collapse All
          </button>
        </div>
      }

      @if (isRecordArray && searchTerm && visibleRecords.length === 0) {
        <div class="no-matches">No records match "{{ searchTerm }}".</div>
      } @else if (isRecordArray && visibleRecords.length > 0) {
        <div class="record-array-list">
          @for (record of visibleRecords; track record.originalIndex) {
            <div class="record-array-item">
              <div class="array-item-header" (click)="toggleRecord(record.originalIndex)">
                <kendo-svgicon
                  [icon]="isRecordExpanded(record) ? chevronDownIcon : chevronRightIcon"
                  class="record-chevron">
                </kendo-svgicon>
                <span class="array-item-index">[{{ record.originalIndex }}]</span>
                @if (record.label) {
                  <span class="array-item-label">{{ record.label }}</span>
                }
                <span class="array-item-summary">
                  {{ record.properties.length }} propert{{ record.properties.length === 1 ? 'y' : 'ies' }}
                </span>
              </div>
              @if (isRecordExpanded(record)) {
                <kendo-grid [data]="record.properties" [resizable]="true" scrollable="none" class="detail-grid">
                  <kendo-grid-column field="key" title="Property" [width]="180">
                    <ng-template kendoGridCellTemplate let-dataItem="dataItem">
                      <div class="property-name-cell">
                        <kendo-svgicon [icon]="getTypeIcon(dataItem.type)" class="type-icon"></kendo-svgicon>
                        <span class="property-name">{{ dataItem.key }}</span>
                      </div>
                    </ng-template>
                  </kendo-grid-column>
                  <kendo-grid-column field="formattedValue" title="Value">
                    <ng-template kendoGridCellTemplate let-dataItem="dataItem">
                      <span class="property-value" [title]="dataItem.formattedValue">{{ dataItem.formattedValue }}</span>
                    </ng-template>
                  </kendo-grid-column>
                  <kendo-grid-column field="type" title="Type" [width]="120">
                    <ng-template kendoGridCellTemplate let-dataItem="dataItem">
                      <span class="type-badge">{{ formatTypeName(dataItem.type) }}</span>
                    </ng-template>
                  </kendo-grid-column>
                </kendo-grid>
              }
            </div>
          }
        </div>
      } @else {
        <kendo-grid [data]="singleRecordProperties" [resizable]="true" class="detail-grid">
          <kendo-grid-column field="key" title="Property" [width]="180">
            <ng-template kendoGridCellTemplate let-dataItem="dataItem">
              <div class="property-name-cell">
                <kendo-svgicon [icon]="getTypeIcon(dataItem.type)" class="type-icon"></kendo-svgicon>
                <span class="property-name">{{ dataItem.key }}</span>
              </div>
            </ng-template>
          </kendo-grid-column>
          <kendo-grid-column field="formattedValue" title="Value">
            <ng-template kendoGridCellTemplate let-dataItem="dataItem">
              <span class="property-value" [title]="dataItem.formattedValue">{{ dataItem.formattedValue }}</span>
            </ng-template>
          </kendo-grid-column>
          <kendo-grid-column field="type" title="Type" [width]="120">
            <ng-template kendoGridCellTemplate let-dataItem="dataItem">
              <span class="type-badge">{{ formatTypeName(dataItem.type) }}</span>
            </ng-template>
          </kendo-grid-column>
        </kendo-grid>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .record-detail-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 8px;
      padding: 12px 16px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .record-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--kendo-color-border, #dee2e6);
    }

    .toolbar-spacer {
      flex: 1;
    }

    .search-input {
      flex: 0 1 220px;
      min-width: 0;
      padding: 4px 8px;
      font: inherit;
      color: var(--kendo-color-on-app-surface, #1d1b20);
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 6%, transparent);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 3px;
      outline: none;
    }

    .search-input::placeholder {
      color: var(--kendo-color-subtle, #6c757d);
    }

    .search-input:focus {
      border-color: var(--kendo-color-primary, #0d6efd);
    }

    .search-clear {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      padding: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 1.1em;
      line-height: 1;
      color: var(--kendo-color-subtle, #6c757d);
      border-radius: 3px;
    }

    .search-clear:hover {
      color: var(--kendo-color-on-app-surface, #1d1b20);
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 8%, transparent);
    }

    .match-count {
      flex-shrink: 0;
      font-size: 0.8em;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .no-matches {
      padding: 16px;
      text-align: center;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .record-array-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    /* Block (not flex) — kendo-grid's flex-column host inside a flex-column */
    /* parent collapses to ~1 px because both lack a defined height. Stacking */
    /* the header + grid as normal blocks lets the grid size to its content */
    /* (combined with scrollable="none" on kendo-grid). */
    .record-array-item {
      display: block;
      flex-shrink: 0;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      overflow: hidden;
    }

    .array-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      transition: background-color 0.15s ease;
    }

    .array-item-header:hover {
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 6%, transparent);
    }

    .record-chevron {
      width: 14px;
      height: 14px;
      color: var(--kendo-color-subtle);
      flex-shrink: 0;
    }

    .array-item-index {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8em;
      font-weight: 600;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .array-item-label {
      font-size: 0.85em;
      color: var(--kendo-color-on-app-surface, #1d1b20);
      font-weight: 500;
    }

    .array-item-summary {
      margin-left: auto;
      font-size: 0.75em;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    /* Kendo Grid defaults to display:flex with the inner aria-root taking */
    /* its space via flex:1. Inside our column-flex item that collapses to */
    /* 0 height because there's no constrained parent height to flex from. */
    /* Force block layout + auto height so the grid simply sizes to its */
    /* rows when scrollable="none". */
    .detail-grid {
      display: block !important;
      height: auto !important;
      border: none;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }

    :host ::ng-deep .detail-grid .k-grid-aria-root {
      height: auto;
    }

    .property-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .type-icon {
      width: 16px;
      height: 16px;
      opacity: 0.7;
    }

    .property-name {
      font-weight: 500;
    }

    .property-value {
      word-break: break-word;
      white-space: pre-wrap;
    }

    .type-badge {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: 500;
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 12%, transparent);
      color: var(--kendo-color-on-app-surface, #1d1b20);
    }
  `]
})
export class RecordDetailDialogComponent implements OnInit {
  @Input() attributeName = 'Record';
  @Input() value: unknown;
  @Input() type: AttributeValueTypeDto = AttributeValueTypeDto.RecordDto;

  /**
   * Emitted when the user-visible state changes in a way the host might want
   * to react to. Currently unused for closing — the host listens to
   * `WindowRef.result` for that.
   */
  @Output() closed = new EventEmitter<void>();

  singleRecordProperties: RecordProperty[] = [];
  recordItems: RecordArrayItem[] = [];
  searchTerm = '';

  // Icons
  readonly fileIcon = fileIcon;
  readonly folderIcon = folderIcon;
  readonly calendarIcon = calendarIcon;
  readonly checkboxCheckedIcon = checkboxCheckedIcon;
  readonly listUnorderedIcon = listUnorderedIcon;
  readonly chevronRightIcon = chevronRightIcon;
  readonly chevronDownIcon = chevronDownIcon;

  get isRecordArray(): boolean {
    return this.type === AttributeValueTypeDto.RecordArrayDto;
  }

  /**
   * Compute the title text for the host window. The host reads this via
   * the component instance after construction.
   */
  get dialogTitle(): string {
    const name = this.formatAttributeName(this.attributeName);
    if (this.isRecordArray && Array.isArray(this.value)) {
      return `${name} (${this.value.length} record${this.value.length !== 1 ? 's' : ''})`;
    }
    return name;
  }

  ngOnInit(): void {
    this.recompute();
  }

  /**
   * Recompute derived state. Public so the host can call it after late
   * input assignment (WindowService.open() instantiates the component
   * before inputs can be set on its instance).
   */
  recompute(): void {
    if (this.isRecordArray && Array.isArray(this.value)) {
      this.recordItems = this.value.map((item, originalIndex) => ({
        originalIndex,
        label: this.getRecordLabel(item),
        properties: this.toRecordProperties(item),
        expanded: true
      }));
      this.singleRecordProperties = [];
    } else {
      this.singleRecordProperties = this.toRecordProperties(this.value);
      this.recordItems = [];
    }
    this.searchTerm = '';
  }

  /**
   * Records visible after applying the search filter. With no search term
   * this is just the full list. The matcher checks the record's label and
   * every property's key + formatted value (case-insensitive substring).
   */
  get visibleRecords(): RecordArrayItem[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.recordItems;
    return this.recordItems.filter(r => this.recordMatches(r, q));
  }

  /**
   * When search is active, force matching records open so their content is
   * visible without an extra click. Outside search mode the user's manual
   * expanded state wins.
   */
  isRecordExpanded(record: RecordArrayItem): boolean {
    if (this.searchTerm.trim()) return true;
    return record.expanded;
  }

  onSearchInput(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  private recordMatches(record: RecordArrayItem, q: string): boolean {
    if (record.label && record.label.toLowerCase().includes(q)) return true;
    for (const p of record.properties) {
      if (p.key.toLowerCase().includes(q)) return true;
      if (p.formattedValue.toLowerCase().includes(q)) return true;
    }
    return false;
  }

  toggleRecord(index: number): void {
    const item = this.recordItems[index];
    if (item) {
      item.expanded = !item.expanded;
    }
  }

  expandAll(): void {
    for (const item of this.recordItems) {
      item.expanded = true;
    }
  }

  collapseAll(): void {
    for (const item of this.recordItems) {
      item.expanded = false;
    }
  }

  getTypeIcon(type: AttributeValueTypeDto) {
    switch (type) {
      case AttributeValueTypeDto.BooleanDto:
        return checkboxCheckedIcon;
      case AttributeValueTypeDto.DateTimeDto:
      case AttributeValueTypeDto.DateTimeOffsetDto:
        return calendarIcon;
      case AttributeValueTypeDto.RecordDto:
      case AttributeValueTypeDto.RecordArrayDto:
        return folderIcon;
      case AttributeValueTypeDto.StringArrayDto:
      case AttributeValueTypeDto.IntegerArrayDto:
      case AttributeValueTypeDto.IntArrayDto:
        return listUnorderedIcon;
      default:
        return fileIcon;
    }
  }

  formatTypeName(type: AttributeValueTypeDto): string {
    return type.replace('_DTO', '').replace('DTO', '').replace('_', ' ');
  }

  private toRecordProperties(obj: unknown): RecordProperty[] {
    const props = this.getObjectProperties(obj);
    return props.map(prop => {
      const type = this.inferType(prop.value);
      return {
        key: prop.key,
        value: prop.value,
        formattedValue: this.formatValue(prop.value, type),
        type
      };
    });
  }

  private formatValue(value: unknown, type: AttributeValueTypeDto): string {
    if (value === null) return '<null>';
    if (value === undefined) return '<undefined>';
    if (value === '') return '<empty>';

    switch (type) {
      case AttributeValueTypeDto.BooleanDto:
        return value ? 'True' : 'False';
      case AttributeValueTypeDto.DateTimeDto:
      case AttributeValueTypeDto.DateTimeOffsetDto:
        try {
          const date = value instanceof Date ? value : new Date(String(value));
          return isNaN(date.getTime()) ? String(value) : date.toLocaleString();
        } catch {
          return String(value);
        }
      case AttributeValueTypeDto.RecordDto:
      case AttributeValueTypeDto.RecordArrayDto:
        return JSON.stringify(value, null, 2);
      case AttributeValueTypeDto.DoubleDto: {
        const num = Number(value);
        return isNaN(num) ? String(value) : num.toFixed(2);
      }
      default:
        if (Array.isArray(value)) {
          return value.length <= 5 ? `[${value.join(', ')}]` : `[${value.slice(0, 5).join(', ')}, ... +${value.length - 5} more]`;
        }
        return String(value);
    }
  }

  private getRecordLabel(obj: unknown): string | null {
    if (typeof obj !== 'object' || obj === null) return null;
    const record = obj as Record<string, unknown>;

    // OctoMesh RtRecord format
    if ('ckRecordId' in record) {
      return String(record['ckRecordId']);
    }

    // Try common name fields
    for (const key of ['name', 'Name', 'label', 'Label', 'id', 'Id']) {
      if (key in record && record[key] != null) {
        return String(record[key]);
      }
    }

    return null;
  }

  private getObjectProperties(obj: unknown): { key: string; value: unknown }[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }

    // OctoMesh RtRecord format: { ckRecordId, attributes: [{ attributeName, value }] }
    const maybeRecord = obj as Record<string, unknown>;
    if ('ckRecordId' in maybeRecord && 'attributes' in maybeRecord && Array.isArray(maybeRecord['attributes'])) {
      return (maybeRecord['attributes'] as { attributeName?: string; value?: unknown }[]).map(attr => ({
        key: attr.attributeName || 'unknown',
        value: attr.value
      }));
    }

    return Object.keys(maybeRecord).map(key => ({
      key,
      value: maybeRecord[key]
    }));
  }

  private inferType(value: unknown): AttributeValueTypeDto {
    if (value === null || value === undefined) return AttributeValueTypeDto.StringDto;
    if (typeof value === 'boolean') return AttributeValueTypeDto.BooleanDto;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? AttributeValueTypeDto.IntegerDto : AttributeValueTypeDto.DoubleDto;
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return AttributeValueTypeDto.DateTimeDto;
      return AttributeValueTypeDto.StringDto;
    }
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') return AttributeValueTypeDto.RecordArrayDto;
      if (value.length > 0 && typeof value[0] === 'string') return AttributeValueTypeDto.StringArrayDto;
      if (value.length > 0 && typeof value[0] === 'number') return AttributeValueTypeDto.IntegerArrayDto;
      return AttributeValueTypeDto.StringArrayDto;
    }
    if (typeof value === 'object') return AttributeValueTypeDto.RecordDto;
    return AttributeValueTypeDto.StringDto;
  }

  private formatAttributeName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
