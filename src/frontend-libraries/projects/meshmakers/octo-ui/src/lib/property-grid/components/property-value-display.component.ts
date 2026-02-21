import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { chevronRightIcon, chevronDownIcon, downloadIcon } from '@progress/kendo-svg-icons';
import { AttributeValueTypeDto, PropertyDisplayMode, BinaryDownloadEvent } from '../models/property-grid.models';

/**
 * Component for displaying property values with appropriate formatting
 */
@Component({
  selector: 'mm-property-value-display',
  standalone: true,
  imports: [CommonModule, SVGIconModule, ButtonModule],
  template: `
    <div class="property-value-display" [ngClass]="'type-' + type.toLowerCase()">

      @if (isExpandableRecord()) {
        <div class="expandable-record">
          <!-- Expand/Collapse Button and Summary -->
          <div class="record-header" (click)="toggleExpansion()">
            <kendo-svgicon
              [icon]="isExpanded ? chevronDownIcon : chevronRightIcon"
              class="expand-icon">
            </kendo-svgicon>
            <span class="record-summary">{{ getRecordSummary() }}</span>
            <span class="type-indicator" [title]="getTypeDescription()">
              {{ getTypeIndicator() }}
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
      } @else if (isBinaryLinkedWithDownload()) {
        <!-- Binary Linked with download capability -->
        <div class="binary-linked-display">
          <div class="binary-info">
            @if (getBinaryFilename()) {
              <span class="filename">{{ getBinaryFilename() }}</span>
            }
            @if (getBinarySize()) {
              <span class="file-size">({{ formatFileSize(getBinarySize()) }})</span>
            }
            @if (getBinaryContentType()) {
              <span class="content-type">{{ getBinaryContentType() }}</span>
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
            <pre class="json-display">{{ getFormattedValue() }}</pre>
          }
          @case (PropertyDisplayMode.Text) {
            <span class="text-display" [innerHTML]="getFormattedValue()"></span>
          }
          @default {
            <span class="default-display">{{ getFormattedValue() }}</span>
          }
        }

        @if (isComplexType() && !isExpandableRecord()) {
          <span class="type-indicator" [title]="getTypeDescription()">
            {{ getTypeIndicator() }}
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
      min-height: 20px;
      font-family: inherit;
      width: 100%;
    }

    .expandable-record {
      width: 100%;
    }

    .record-header {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .record-header:hover {
      background: var(--kendo-color-base-subtle);
    }

    .expand-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      transition: transform 0.2s;
    }

    .record-summary {
      flex: 1;
      font-size: 0.9em;
    }

    .record-content {
      margin-left: 22px;
      margin-top: 8px;
      border-left: 2px solid var(--kendo-color-border);
      padding-left: 12px;
      background: var(--kendo-color-base-subtle);
      border-radius: 0 4px 4px 0;
    }

    .nested-properties {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
    }

    .nested-property {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-height: 24px;
    }

    .property-key {
      font-weight: 500;
      color: var(--kendo-color-primary);
      min-width: 100px;
      flex-shrink: 0;
      font-size: 0.9em;
    }

    .array-item {
      border: 1px solid var(--kendo-color-border);
      border-radius: 4px;
      margin-bottom: 8px;
      background: transparent;
    }

    .array-index {
      display: inline-block;
      background: var(--kendo-color-primary);
      color: white;
      padding: 2px 8px;
      font-size: 0.8em;
      font-weight: bold;
      border-radius: 4px 0 4px 0;
      margin-bottom: 4px;
    }

    .json-display {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin: 0;
      padding: 4px 8px;
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
      max-width: 300px;
      overflow: auto;
    }

    .text-display,
    .default-display {
      flex: 1;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .type-boolean {
      .default-display {
        font-weight: 500;
        &.value-true { color: #28a745; }
        &.value-false { color: #dc3545; }
      }
    }

    .type-datetime,
    .type-datetimeoffset {
      .default-display {
        font-family: monospace;
        font-size: 0.9em;
      }
    }

    .type-int,
    .type-integer,
    .type-double {
      .default-display {
        font-family: monospace;
        text-align: right;
      }
    }

    .type-indicator {
      font-size: 0.75em;
      padding: 2px 6px;
      background: var(--kendo-color-primary);
      color: white;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: 500;
      flex-shrink: 0;
    }

    .empty-value {
      color: var(--kendo-color-subtle);
      font-style: italic;
    }

    .null-value {
      color: var(--kendo-color-error);
      font-style: italic;
    }

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
      color: var(--kendo-color-on-app-surface);
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
export class PropertyValueDisplayComponent implements OnInit {
  @Input() value: any;
  @Input() type: AttributeValueTypeDto = AttributeValueTypeDto.StringDto;
  @Input() displayMode: PropertyDisplayMode = PropertyDisplayMode.Text;

  /** Emitted when a binary download is requested */
  @Output() binaryDownload = new EventEmitter<BinaryDownloadEvent>();

  // Expansion state
  isExpanded = false;

  readonly PropertyDisplayMode = PropertyDisplayMode;
  readonly AttributeValueTypeDto = AttributeValueTypeDto;
  readonly Array = Array;
  readonly chevronRightIcon = chevronRightIcon;
  readonly chevronDownIcon = chevronDownIcon;
  readonly downloadIcon = downloadIcon;

  ngOnInit() {
    // Debug every property value display component creation
    console.log('PropertyValueDisplayComponent ngOnInit:', {
      type: this.type,
      value: this.value,
      valueType: typeof this.value,
      valueStringified: JSON.stringify(this.value),
      isExpandableRecord: this.isExpandableRecord()
    });
  }

  /**
   * Get formatted display value
   */
  getFormattedValue(): string {
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

  /**
   * Check if this is an expandable record type
   */
  isExpandableRecord(): boolean {
    // Comprehensive debug logging
    console.log('PropertyValueDisplay: isExpandableRecord check:', {
      type: this.type,
      typeString: String(this.type),
      typeOf: typeof this.type,
      AttributeValueTypeDtoRecordDto: AttributeValueTypeDto.RecordDto,
      AttributeValueTypeDtoRecordArrayDto: AttributeValueTypeDto.RecordArrayDto,
      typeIsRecordDto: this.type === AttributeValueTypeDto.RecordDto,
      typeIsRecordDtoString: this.type === 'RECORD',
      typeIsRecordArrayDto: this.type === AttributeValueTypeDto.RecordArrayDto,
      value: this.value,
      valueType: typeof this.value,
      valueIsNull: this.value == null,
      valueKeys: this.value && typeof this.value === 'object' ? Object.keys(this.value) : 'not object'
    });

    // Check for record types
    const isRecordDto = this.type === AttributeValueTypeDto.RecordDto;
    const isRecordArrayDto = this.type === AttributeValueTypeDto.RecordArrayDto;
    const isRecordType = isRecordDto || isRecordArrayDto;

    // Simple check: does it have a value?
    const hasValue = this.value != null;

    // Simple check: is it an object or array?
    const isObjectLike = typeof this.value === 'object' && this.value != null;

    const result = isRecordType && hasValue && isObjectLike;

    console.log('PropertyValueDisplay: Expandable result:', {
      isRecordDto,
      isRecordArrayDto,
      isRecordType,
      hasValue,
      isObjectLike,
      finalResult: result
    });

    return result;
  }

  /**
   * Check if the type is complex (object/array)
   */
  isComplexType(): boolean {
    return [
      AttributeValueTypeDto.RecordDto,
      AttributeValueTypeDto.RecordArrayDto,
      AttributeValueTypeDto.StringArrayDto,
      AttributeValueTypeDto.IntegerArrayDto,
      AttributeValueTypeDto.IntArrayDto,
      AttributeValueTypeDto.BinaryDto,
      AttributeValueTypeDto.BinaryLinkedDto
    ].includes(this.type);
  }

  /**
   * Get type indicator text
   */
  getTypeIndicator(): string {
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

  /**
   * Get type description for tooltip
   */
  getTypeDescription(): string {
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
  private formatDateTime(value: any): string {
    try {
      const date = value instanceof Date ? value : new Date(value);
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
  private formatArray(value: any): string {
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
  private formatObject(value: any): string {
    if (typeof value !== 'object' || value === null) {
      return String(value);
    }

    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }

    if (keys.length <= 2) {
      const preview = keys.map(key => `${key}: ${this.truncateValue(value[key])}`).join(', ');
      return `{${preview}}`;
    }

    return `{${keys.slice(0, 2).map(key => `${key}: ${this.truncateValue(value[key])}`).join(', ')}, ... +${keys.length - 2} more}`;
  }

  /**
   * Format binary data
   */
  private formatBinary(value: any): string {
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
  private formatNumber(value: any, decimals: number): string {
    const num = Number(value);
    if (isNaN(num)) {
      return String(value);
    }
    return decimals > 0 ? num.toFixed(decimals) : num.toString();
  }

  /**
   * Truncate long values for preview
   */
  private truncateValue(value: any): string {
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
   * Get summary text for record header
   */
  getRecordSummary(): string {
    if (this.type === AttributeValueTypeDto.RecordArrayDto && Array.isArray(this.value)) {
      return `Array with ${this.value.length} item${this.value.length !== 1 ? 's' : ''}`;
    }

    if (typeof this.value === 'object' && this.value !== null) {

      // Handle regular objects
      const keys = Object.keys(this.value);
      return `Object with ${keys.length} propert${keys.length !== 1 ? 'ies' : 'y'}`;
    }

    return 'Complex object';
  }

  /**
   * Get properties of an object for display
   */
  getObjectProperties(obj: any): {key: string, value: any}[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }

    if (Array.isArray(obj) && obj.length > 0 && obj[0].id === 'ckRecordId') {
      // Handle array of records
      return obj.map((item, _) => ({
        key: item.name,
        value: item.value
      }));
    }

    // Handle regular objects
    return Object.keys(obj).map(key => ({
      key,
      value: obj[key]
    }));
  }

  /**
   * Determine the appropriate type for a nested property value
   */
  getPropertyType(value: any): AttributeValueTypeDto {
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
      // Check if it looks like a date
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return AttributeValueTypeDto.DateTimeDto;
      }
      return AttributeValueTypeDto.StringDto;
    }

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object' && value[0].id === 'ckRecordId') {
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
      return AttributeValueTypeDto.StringArrayDto; // fallback
    }


    return AttributeValueTypeDto.StringDto;
  }

  // ========== Binary Linked Methods ==========

  /**
   * Check if this is a BINARY_LINKED type with download capability
   */
  isBinaryLinkedWithDownload(): boolean {
    if (this.type !== AttributeValueTypeDto.BinaryLinkedDto) {
      return false;
    }

    // Check if value has binaryId or downloadUri (LargeBinaryInfo structure)
    return this.value && typeof this.value === 'object' && ('binaryId' in this.value || 'downloadUri' in this.value);
  }

  /**
   * Get the filename from binary info
   */
  getBinaryFilename(): string | null {
    if (!this.value || typeof this.value !== 'object') {
      return null;
    }
    return this.value.filename || null;
  }

  /**
   * Get the file size from binary info
   */
  getBinarySize(): number | null {
    if (!this.value || typeof this.value !== 'object') {
      return null;
    }
    return this.value.size || null;
  }

  /**
   * Get the content type from binary info
   */
  getBinaryContentType(): string | null {
    if (!this.value || typeof this.value !== 'object') {
      return null;
    }
    return this.value.contentType || null;
  }

  /**
   * Format file size to human readable format
   */
  formatFileSize(bytes: number | null): string {
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
      console.warn('No binary value available');
      return;
    }

    // If downloadUri is available, open directly
    if (this.value.downloadUri) {
      window.open(this.value.downloadUri, '_blank', 'noopener,noreferrer');
      return;
    }

    // Otherwise, emit event for parent to handle (needs to load downloadUri)
    if (this.value.binaryId) {
      const event: BinaryDownloadEvent = {
        binaryId: this.value.binaryId,
        filename: this.value.filename,
        contentType: this.value.contentType
      };
      this.binaryDownload.emit(event);
    } else {
      console.warn('No binaryId or downloadUri available');
    }
  }
}
