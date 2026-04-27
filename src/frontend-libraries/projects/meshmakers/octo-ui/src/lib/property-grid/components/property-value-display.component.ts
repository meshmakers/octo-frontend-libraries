import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { ButtonModule } from '@progress/kendo-angular-buttons';
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
  imports: [CommonModule, SVGIconModule, ButtonModule, RecordDetailDialogComponent],
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
              @if (type === AttributeValueTypeDto.RecordArrayDto && Array.isArray(value)) {
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

      @if (showDetailDialog) {
        <mm-record-detail-dialog
          [attributeName]="attributeName"
          [value]="value"
          [type]="type"
          (closed)="closeDetailDialog()">
        </mm-record-detail-dialog>
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
  showDetailDialog = false;

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
   * Open detail dialog for record values
   */
  openDetailDialog(event: Event): void {
    event.stopPropagation();
    this.showDetailDialog = true;
  }

  /**
   * Close the detail dialog
   */
  closeDetailDialog(): void {
    this.showDetailDialog = false;
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
