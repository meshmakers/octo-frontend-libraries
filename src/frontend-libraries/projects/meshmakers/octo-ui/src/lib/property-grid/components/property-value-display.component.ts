import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { WindowService } from '@progress/kendo-angular-dialog';
import { chevronRightIcon, chevronDownIcon, downloadIcon, windowIcon } from '@progress/kendo-svg-icons';
import { AttributeValueTypeDto, PropertyDisplayMode, BinaryDownloadEvent } from '../models/property-grid.models';
import { RecordDetailDialogComponent } from './record-detail-dialog.component';

/** Shape of binary linked value from OctoMesh */
interface BinaryLinkedValue {
  binaryId?: string;
  downloadUri?: string;
  filename?: string;
  size?: number;
  contentType?: string;
}

/**
 * Component for displaying property values with appropriate formatting
 */
@Component({
  selector: 'mm-property-value-display',
  standalone: true,
  imports: [CommonModule, SVGIconModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="property-value-display" [ngClass]="'type-' + type.toLowerCase()">

      @if (expandableRecord) {
        <div class="expandable-record">
          <!-- Expand/Collapse Button and Summary -->
          <div class="record-header" (click)="toggleExpansion()">
            <kendo-svgicon
              [icon]="isExpanded ? chevronDownIcon : chevronRightIcon"
              class="expand-icon">
            </kendo-svgicon>
            <span class="record-summary">{{ recordSummary }}</span>
            <button
              kendoButton
              size="small"
              fillMode="flat"
              [svgIcon]="windowIcon"
              title="Show details"
              class="detail-button"
              (click)="openDetailDialog($event)">
            </button>
            <span class="type-indicator" [title]="typeDescription">
              {{ typeIndicator }}
            </span>
          </div>

          <!-- Expanded Content -->
          @if (isExpanded) {
            <div class="record-content">
              @if (useRecordArrayTable) {
                <!-- Uniform record array → compact table with sticky header -->
                <div class="record-table-container">
                  <table class="record-table">
                    <thead>
                      <tr>
                        <th class="row-index">#</th>
                        @for (col of recordArrayColumns; track col) {
                          <th>{{ col }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of recordArrayRows; track $index) {
                        <tr>
                          <td class="row-index">{{ $index }}</td>
                          @for (col of recordArrayColumns; track col) {
                            <td>
                              @let v = row[col];
                              @if (v !== null && v !== undefined) {
                                <mm-property-value-display
                                  [value]="v"
                                  [type]="getPropertyType(v)">
                                </mm-property-value-display>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else if (type === AttributeValueTypeDto.RecordArrayDto && Array.isArray(value)) {
                <!-- Heterogeneous array (or single item) — fallback to per-item nesting, capped height -->
                <div class="record-array-list">
                  @for (item of value; track $index) {
                    <div class="array-item">
                      <span class="array-index">[{{ $index }}]</span>
                      <div class="nested-properties">
                        @for (prop of getObjectProperties(item); track prop.key) {
                          <div class="nested-property">
                            <span class="property-key">{{ prop.key }}:</span>
                            <mm-property-value-display
                              [value]="prop.value"
                              [type]="getPropertyType(prop.value)">
                            </mm-property-value-display>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="nested-properties">
                  @for (prop of getObjectProperties(value); track prop.key) {
                    <div class="nested-property">
                      <span class="property-key">{{ prop.key }}:</span>
                      <mm-property-value-display
                        [value]="prop.value"
                        [type]="getPropertyType(prop.value)">
                      </mm-property-value-display>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else if (binaryLinkedWithDownload) {
        <!-- Binary Linked with download capability -->
        <div class="binary-linked-display">
          <div class="binary-info">
            @if (binaryFilename) {
              <span class="filename">{{ binaryFilename }}</span>
            }
            @if (binarySize) {
              <span class="file-size">({{ formattedBinarySize }})</span>
            }
            @if (binaryContentType) {
              <span class="content-type">{{ binaryContentType }}</span>
            }
          </div>
          <button
            kendoButton
            size="small"
            fillMode="flat"
            [svgIcon]="downloadIcon"
            title="Download file"
            (click)="onDownload()">
            Download
          </button>
        </div>
      } @else {
        <!-- Non-expandable value display -->
        @switch (displayMode) {
          @case (PropertyDisplayMode.Json) {
            <pre class="json-display">{{ formattedValue }}</pre>
          }
          @case (PropertyDisplayMode.Text) {
            <span class="text-display" [innerHTML]="formattedValue"></span>
          }
          @default {
            <span class="default-display">{{ formattedValue }}</span>
          }
        }

        @if (complexType && !expandableRecord) {
          <span class="type-indicator" [title]="typeDescription">
            {{ typeIndicator }}
          </span>
        }
      }

    </div>
  `,
  styles: [`
    .property-value-display {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .text-display, .default-display {
      word-break: break-word;
      white-space: pre-wrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .json-display {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8em;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      flex: 1;
      min-width: 0;
    }

    .type-indicator {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.7em;
      padding: 1px 5px;
      /* Derive both bg and text from the app surface text color so the badge stays */
      /* readable in both light and dark themes — the previous base-subtle/subtle pair */
      /* collapsed to nearly the same luminance on dark backgrounds. */
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 12%, transparent);
      border-radius: 3px;
      color: var(--kendo-color-on-app-surface, #1d1b20);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .expandable-record {
      width: 100%;
    }

    .record-header {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 2px 0;
      border-radius: 3px;
      transition: background-color 0.15s ease;
    }

    .record-header:hover {
      background-color: var(--kendo-color-base-subtle, rgba(0,0,0,0.04));
    }

    .expand-icon {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      color: var(--kendo-color-subtle);
    }

    .record-summary {
      color: var(--kendo-color-subtle);
      font-size: 0.85em;
      font-style: italic;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .detail-button {
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }

    .detail-button:hover {
      opacity: 1;
    }

    .record-content {
      margin-left: 20px;
      padding-left: 8px;
      border-left: 1px solid var(--kendo-color-border, #dee2e6);
    }

    .array-item {
      margin: 4px 0;
    }

    .array-index {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8em;
      color: var(--kendo-color-subtle);
    }

    /* Record-array fallback list (used when records are heterogeneous) — */
    /* cap height so 30+ items don't blow out the host card. */
    .record-array-list {
      max-height: 320px;
      overflow-y: auto;
    }

    /* Compact table for uniform record arrays. The container owns the */
    /* scroll so the table header can remain sticky. */
    .record-table-container {
      max-height: 320px;
      overflow: auto;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 3px;
      margin-top: 4px;
    }

    .record-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85em;
      table-layout: auto;
    }

    .record-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      color: var(--kendo-color-subtle);
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--kendo-color-border, #dee2e6);
      font-weight: 500;
      font-size: 0.85em;
      white-space: nowrap;
    }

    .record-table td {
      padding: 3px 8px;
      border-bottom: 1px solid color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 8%, transparent);
      vertical-align: top;
      word-break: break-word;
    }

    .record-table tr:last-child td {
      border-bottom: none;
    }

    .record-table tr:hover td {
      background: color-mix(in srgb, var(--kendo-color-on-app-surface, #1d1b20) 6%, transparent);
    }

    .record-table .row-index {
      color: var(--kendo-color-subtle);
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      text-align: right;
      width: 1px;
      white-space: nowrap;
    }

    .nested-properties {
      margin-left: 8px;
    }

    .nested-property {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 2px 0;
    }

    .property-key {
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
      color: var(--kendo-color-subtle);
      font-size: 0.85em;
    }

    /* Binary Linked Display */
    .binary-linked-display {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .binary-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .filename {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 0.85em;
      color: var(--kendo-color-subtle);
      flex-shrink: 0;
    }

    .content-type {
      font-size: 0.75em;
      padding: 2px 6px;
      background: var(--kendo-color-base-subtle);
      border-radius: 3px;
      color: var(--kendo-color-subtle);
      flex-shrink: 0;
    }
  `]
})
export class PropertyValueDisplayComponent implements OnInit, OnChanges {
  @Input() value: unknown;
  @Input() type: AttributeValueTypeDto = AttributeValueTypeDto.StringDto;
  @Input() displayMode: PropertyDisplayMode = PropertyDisplayMode.Text;
  @Input() attributeName = 'Record';

  /** Emitted when a binary download is requested */
  @Output() binaryDownload = new EventEmitter<BinaryDownloadEvent>();

  // Expansion state
  isExpanded = false;

  private readonly windowService = inject(WindowService);

  // Pre-computed template properties — recomputed in ngOnInit and ngOnChanges so Kendo Grid row recycling (cell component reuse with new inputs) does not display stale values.
  expandableRecord = false;
  complexType = false;
  binaryLinkedWithDownload = false;
  formattedValue = '';
  recordSummary = '';
  typeIndicator = '';
  typeDescription = '';
  binaryFilename: string | null = null;
  binarySize: number | null = null;
  binaryContentType: string | null = null;
  formattedBinarySize = '';

  // RecordArray table-mode state — used when the array is uniform enough to be
  // displayed as a compact table (one row per record, columns = union of keys).
  // Falls back to the per-item nested-property layout otherwise.
  useRecordArrayTable = false;
  recordArrayColumns: string[] = [];
  recordArrayRows: Record<string, unknown>[] = [];
  /** Hard cap so we don't render a horizontally-unmanageable table. */
  private static readonly MAX_TABLE_COLUMNS = 12;

  readonly PropertyDisplayMode = PropertyDisplayMode;
  readonly AttributeValueTypeDto = AttributeValueTypeDto;
  readonly Array = Array;
  readonly chevronRightIcon = chevronRightIcon;
  readonly chevronDownIcon = chevronDownIcon;
  readonly downloadIcon = downloadIcon;
  readonly windowIcon = windowIcon;

  ngOnInit() {
    this.recomputeDerivedValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Collapse any user-driven expansion carried over from a recycled cell
    // when the underlying data changes; displayMode changes do not qualify.
    if (changes['value'] || changes['type']) {
      this.isExpanded = false;
    }
    this.recomputeDerivedValues();
  }

  private recomputeDerivedValues(): void {
    this.expandableRecord = this.computeIsExpandableRecord();
    this.complexType = this.computeIsComplexType();
    this.binaryLinkedWithDownload = this.computeIsBinaryLinkedWithDownload();
    this.formattedValue = this.computeFormattedValue();
    this.recordSummary = this.computeRecordSummary();
    this.typeIndicator = this.computeTypeIndicator();
    this.typeDescription = this.computeTypeDescription();
    this.computeRecordArrayTable();

    if (this.binaryLinkedWithDownload) {
      const bv = this.value as BinaryLinkedValue;
      this.binaryFilename = bv?.filename || null;
      this.binarySize = bv?.size || null;
      this.binaryContentType = bv?.contentType || null;
      this.formattedBinarySize = this.formatFileSize(this.binarySize);
    } else {
      this.binaryFilename = null;
      this.binarySize = null;
      this.binaryContentType = null;
      this.formattedBinarySize = '';
    }
  }

  private computeFormattedValue(): string {
    if (this.value === null) {
      return '<null>';
    }

    if (this.value === undefined) {
      return '<undefined>';
    }

    if (this.value === '') {
      return '<empty>';
    }

    switch (this.type) {
      case AttributeValueTypeDto.BooleanDto:
        return this.value ? '✓ True' : '✗ False';

      case AttributeValueTypeDto.DateTimeDto:
      case AttributeValueTypeDto.DateTimeOffsetDto:
        return this.formatDateTime(this.value);

      case AttributeValueTypeDto.StringArrayDto:
      case AttributeValueTypeDto.IntegerArrayDto:
      case AttributeValueTypeDto.IntArrayDto:
        return this.formatArray(this.value);

      case AttributeValueTypeDto.RecordDto:
      case AttributeValueTypeDto.RecordArrayDto:
        return this.displayMode === PropertyDisplayMode.Json
          ? JSON.stringify(this.value, null, 2)
          : this.formatObject(this.value);

      case AttributeValueTypeDto.BinaryDto:
      case AttributeValueTypeDto.BinaryLinkedDto:
        return this.formatBinary(this.value);

      case AttributeValueTypeDto.IntDto:
      case AttributeValueTypeDto.IntegerDto:
      case AttributeValueTypeDto.Integer_64Dto:
      case AttributeValueTypeDto.Int_64Dto:
        return this.formatNumber(this.value, 0);

      case AttributeValueTypeDto.DoubleDto:
        return this.formatNumber(this.value, 2);

      default:
        return String(this.value);
    }
  }

  private computeIsExpandableRecord(): boolean {
    const isRecordType = this.type === AttributeValueTypeDto.RecordDto
      || this.type === AttributeValueTypeDto.RecordArrayDto;
    return isRecordType && this.value != null && typeof this.value === 'object';
  }

  /**
   * For RecordArray values, attempt to render as a compact table when the
   * records share enough structure: ≥ 2 items, every item is object-like, and
   * the union of keys stays within MAX_TABLE_COLUMNS. Columns are ordered by
   * first appearance. Rows are stored as plain objects keyed by column name
   * so the template can do `row[col]` lookups cheaply.
   */
  private computeRecordArrayTable(): void {
    this.useRecordArrayTable = false;
    this.recordArrayColumns = [];
    this.recordArrayRows = [];

    if (this.type !== AttributeValueTypeDto.RecordArrayDto) return;
    if (!Array.isArray(this.value) || this.value.length < 2) return;
    if (!this.value.every(item => item != null && typeof item === 'object')) return;

    const cols: string[] = [];
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const item of this.value) {
      const props = this.getObjectProperties(item);
      const row: Record<string, unknown> = {};
      for (const { key, value } of props) {
        if (!seen.has(key)) {
          seen.add(key);
          cols.push(key);
        }
        row[key] = value;
      }
      rows.push(row);
    }

    if (cols.length === 0 || cols.length > PropertyValueDisplayComponent.MAX_TABLE_COLUMNS) return;

    this.recordArrayColumns = cols;
    this.recordArrayRows = rows;
    this.useRecordArrayTable = true;
  }

  private computeIsComplexType(): boolean {
    const isComplexDataType = [
      AttributeValueTypeDto.RecordDto,
      AttributeValueTypeDto.RecordArrayDto,
      AttributeValueTypeDto.StringArrayDto,
      AttributeValueTypeDto.IntegerArrayDto,
      AttributeValueTypeDto.IntArrayDto,
      AttributeValueTypeDto.BinaryDto,
      AttributeValueTypeDto.BinaryLinkedDto
    ].includes(this.type);

    // Only show inline type indicator when the value is actually complex
    // (not when a simple string is passed for a complex-typed property)
    if (!isComplexDataType) return false;
    return this.value != null && typeof this.value === 'object';
  }

  private computeTypeIndicator(): string {
    switch (this.type) {
      case AttributeValueTypeDto.RecordDto:
        return 'RECORD';
      case AttributeValueTypeDto.RecordArrayDto:
        return 'ARR[RECORD]';
      case AttributeValueTypeDto.StringArrayDto:
        return 'ARR[STR]';
      case AttributeValueTypeDto.IntegerArrayDto:
      case AttributeValueTypeDto.IntArrayDto:
        return 'ARR[INT]';
      case AttributeValueTypeDto.BinaryDto:
      case AttributeValueTypeDto.BinaryLinkedDto:
        return 'BIN';
      default:
        return this.type.replace('_DTO', '').replace('DTO', '');
    }
  }

  private computeTypeDescription(): string {
    switch (this.type) {
      case AttributeValueTypeDto.RecordDto:
        return 'Complex object';
      case AttributeValueTypeDto.RecordArrayDto:
        return 'Array of complex objects';
      case AttributeValueTypeDto.StringArrayDto:
        return 'Array of strings';
      case AttributeValueTypeDto.IntegerArrayDto:
      case AttributeValueTypeDto.IntArrayDto:
        return 'Array of numbers';
      case AttributeValueTypeDto.BinaryDto:
      case AttributeValueTypeDto.BinaryLinkedDto:
        return 'Binary data';
      default:
        return `Type: ${this.type}`;
    }
  }

  /**
   * Format date/time values
   */
  private formatDateTime(value: unknown): string {
    try {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleString();
    } catch {
      return String(value);
    }
  }

  /**
   * Format array values
   */
  private formatArray(value: unknown): string {
    if (!Array.isArray(value)) {
      return String(value);
    }

    if (value.length === 0) {
      return '[]';
    }

    if (value.length <= 3) {
      return `[${value.join(', ')}]`;
    }

    return `[${value.slice(0, 3).join(', ')}, ... +${value.length - 3} more]`;
  }

  /**
   * Format object values
   */
  private formatObject(value: unknown): string {
    if (typeof value !== 'object' || value === null) {
      return String(value);
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }

    if (keys.length <= 2) {
      const preview = keys.map(key => `${key}: ${this.truncateValue(obj[key])}`).join(', ');
      return `{${preview}}`;
    }

    return `{${keys.slice(0, 2).map(key => `${key}: ${this.truncateValue(obj[key])}`).join(', ')}, ... +${keys.length - 2} more}`;
  }

  /**
   * Format binary data
   */
  private formatBinary(value: unknown): string {
    if (value instanceof ArrayBuffer) {
      return `<Binary: ${value.byteLength} bytes>`;
    }
    if (typeof value === 'string' && value.startsWith('data:')) {
      return '<Base64 Data>';
    }
    return '<Binary Data>';
  }

  /**
   * Format numeric values
   */
  private formatNumber(value: unknown, decimals: number): string {
    const num = Number(value);
    if (isNaN(num)) {
      return String(value);
    }
    return decimals > 0 ? num.toFixed(decimals) : num.toString();
  }

  /**
   * Truncate long values for preview
   */
  private truncateValue(value: unknown): string {
    const str = String(value);
    return str.length > 20 ? str.substring(0, 20) + '...' : str;
  }

  /**
   * Toggle expansion state
   */
  toggleExpansion(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Open the record-detail viewer in a Kendo Window. Using `WindowService.open`
   * (instead of an inline `<kendo-window>`) is what makes the window mount at
   * the application root with proper viewport positioning. An inline window
   * inherits its tile's `position: relative` ancestor and ends up anchored
   * inside that tile's box rather than on the meshboard surface.
   */
  openDetailDialog(event: Event): void {
    event.stopPropagation();
    const ref = this.windowService.open({
      title: this.computeDialogTitle(),
      content: RecordDetailDialogComponent,
      width: 720,
      height: 560,
      minWidth: 420,
      minHeight: 280,
    });
    const instance = ref.content.instance as RecordDetailDialogComponent;
    instance.attributeName = this.attributeName;
    instance.value = this.value;
    instance.type = this.type;
    instance.recompute();
  }

  private computeDialogTitle(): string {
    const formatted = this.attributeName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
    if (this.type === AttributeValueTypeDto.RecordArrayDto && Array.isArray(this.value)) {
      return `${formatted} (${this.value.length} record${this.value.length !== 1 ? 's' : ''})`;
    }
    return formatted;
  }

  /**
   * Compute summary text for record header
   */
  private computeRecordSummary(): string {
    if (this.type === AttributeValueTypeDto.RecordArrayDto && Array.isArray(this.value)) {
      return `${this.value.length} record${this.value.length !== 1 ? 's' : ''}`;
    }

    if (typeof this.value === 'object' && this.value !== null) {
      const maybeRecord = this.value as Record<string, unknown>;
      // OctoMesh RtRecord format
      if ('ckRecordId' in maybeRecord && 'attributes' in maybeRecord && Array.isArray(maybeRecord['attributes'])) {
        const attrs = maybeRecord['attributes'] as unknown[];
        return `Record (${attrs.length} attribute${attrs.length !== 1 ? 's' : ''})`;
      }
      const keys = Object.keys(this.value);
      return `Object with ${keys.length} propert${keys.length !== 1 ? 'ies' : 'y'}`;
    }

    return 'Complex object';
  }

  /**
   * Get properties of an object for display.
   * Handles OctoMesh RtRecord format: { ckRecordId, attributes: [{ attributeName, value }] }
   */
  getObjectProperties(obj: unknown): {key: string, value: unknown}[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }

    // OctoMesh RtRecord format: { ckRecordId: string, attributes: [{ attributeName, value }] }
    const maybeRecord = obj as Record<string, unknown>;
    if ('ckRecordId' in maybeRecord && 'attributes' in maybeRecord && Array.isArray(maybeRecord['attributes'])) {
      return (maybeRecord['attributes'] as {attributeName?: string, value?: unknown}[]).map(attr => ({
        key: attr.attributeName || 'unknown',
        value: attr.value
      }));
    }

    // Legacy format: array of { id: 'ckRecordId', name, value }
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && 'id' in obj[0] && obj[0].id === 'ckRecordId') {
      return obj.map((item: Record<string, unknown>) => ({
        key: String(item['name']),
        value: item['value']
      }));
    }

    const record = obj as Record<string, unknown>;
    return Object.keys(record).map(key => ({
      key,
      value: record[key]
    }));
  }

  /**
   * Determine the appropriate type for a nested property value
   */
  getPropertyType(value: unknown): AttributeValueTypeDto {
    if (value === null || value === undefined) {
      return AttributeValueTypeDto.StringDto;
    }

    if (typeof value === 'boolean') {
      return AttributeValueTypeDto.BooleanDto;
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? AttributeValueTypeDto.IntegerDto : AttributeValueTypeDto.DoubleDto;
    }

    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return AttributeValueTypeDto.DateTimeDto;
      }
      return AttributeValueTypeDto.StringDto;
    }

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'id' in value[0] && value[0].id === 'ckRecordId') {
        return AttributeValueTypeDto.RecordDto;
      }
      if (value.length > 0 && typeof value[0] === 'object') {
        return AttributeValueTypeDto.RecordArrayDto;
      }
      if (value.length > 0 && typeof value[0] === 'string') {
        return AttributeValueTypeDto.StringArrayDto;
      }
      if (value.length > 0 && typeof value[0] === 'number') {
        return AttributeValueTypeDto.IntegerArrayDto;
      }
      return AttributeValueTypeDto.StringArrayDto;
    }


    return AttributeValueTypeDto.StringDto;
  }

  // ========== Binary Linked Methods ==========

  private computeIsBinaryLinkedWithDownload(): boolean {
    if (this.type !== AttributeValueTypeDto.BinaryLinkedDto) {
      return false;
    }
    return !!this.value && typeof this.value === 'object' && ('binaryId' in this.value || 'downloadUri' in this.value);
  }

  /**
   * Format file size to human readable format
   */
  private formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === undefined) {
      return '';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }

  /**
   * Handle download button click
   */
  onDownload(): void {
    if (!this.value || typeof this.value !== 'object') {
      return;
    }

    const binaryValue = this.value as BinaryLinkedValue;

    if (binaryValue.downloadUri) {
      window.open(binaryValue.downloadUri, '_blank', 'noopener,noreferrer');
      return;
    }

    if (binaryValue.binaryId) {
      const event: BinaryDownloadEvent = {
        binaryId: binaryValue.binaryId,
        filename: binaryValue.filename,
        contentType: binaryValue.contentType
      };
      this.binaryDownload.emit(event);
    }
  }
}
