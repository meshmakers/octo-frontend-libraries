import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { GridModule } from '@progress/kendo-angular-grid';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  fileIcon, folderIcon, calendarIcon, checkboxCheckedIcon, listUnorderedIcon
} from '@progress/kendo-svg-icons';
import { AttributeValueTypeDto } from '../models/property-grid.models';

interface RecordProperty {
  key: string;
  value: unknown;
  formattedValue: string;
  type: AttributeValueTypeDto;
}

/**
 * Dialog component for displaying Record and RecordArray attribute values
 * in a Kendo Grid layout. This component intentionally does NOT import
 * PropertyGridComponent or PropertyValueDisplayComponent to avoid circular dependencies.
 */
@Component({
  selector: 'mm-record-detail-dialog',
  standalone: true,
  imports: [CommonModule, DialogsModule, ButtonModule, GridModule, SVGIconModule],
  template: `
    <kendo-dialog
      [title]="dialogTitle"
      [minWidth]="500"
      [width]="700"
      (close)="onClose()">

      <div class="record-detail-content">
        @if (isRecordArray && recordItems.length > 0) {
          <div class="record-array-list">
            @for (record of recordItems; track $index) {
              <div class="record-array-item">
                <div class="array-item-header">
                  <span class="array-item-index">[{{ $index }}]</span>
                  @if (record.label) {
                    <span class="array-item-label">{{ record.label }}</span>
                  }
                </div>
                <kendo-grid [data]="record.properties" [resizable]="true" class="detail-grid">
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

      <kendo-dialog-actions>
        <div class="mm-dialog-actions">
          <button kendoButton fillMode="flat" (click)="onClose()">Close</button>
        </div>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .record-detail-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 200px;
      max-height: 500px;
      overflow-y: auto;
    }

    .record-array-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .record-array-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .array-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .array-item-index {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8em;
      font-weight: 600;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .array-item-label {
      font-size: 0.85em;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .detail-grid {
      border: none;
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
      background: var(--kendo-color-base-subtle);
      color: var(--kendo-color-on-base);
    }

    .mm-dialog-actions {
      display: flex;
      justify-content: flex-end;
    }
  `]
})
export class RecordDetailDialogComponent implements OnInit {
  @Input() attributeName = 'Record';
  @Input() value: unknown;
  @Input() type: AttributeValueTypeDto = AttributeValueTypeDto.RecordDto;

  @Output() closed = new EventEmitter<void>();

  singleRecordProperties: RecordProperty[] = [];
  recordItems: { label: string | null; properties: RecordProperty[] }[] = [];

  // Icons
  readonly fileIcon = fileIcon;
  readonly folderIcon = folderIcon;
  readonly calendarIcon = calendarIcon;
  readonly checkboxCheckedIcon = checkboxCheckedIcon;
  readonly listUnorderedIcon = listUnorderedIcon;

  get isRecordArray(): boolean {
    return this.type === AttributeValueTypeDto.RecordArrayDto;
  }

  get dialogTitle(): string {
    const name = this.formatAttributeName(this.attributeName);
    if (this.isRecordArray && Array.isArray(this.value)) {
      return `${name} (${this.value.length} record${this.value.length !== 1 ? 's' : ''})`;
    }
    return name;
  }

  ngOnInit(): void {
    if (this.isRecordArray && Array.isArray(this.value)) {
      this.recordItems = this.value.map(item => ({
        label: this.getRecordLabel(item),
        properties: this.toRecordProperties(item)
      }));
    } else {
      this.singleRecordProperties = this.toRecordProperties(this.value);
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

  onClose(): void {
    this.closed.emit();
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
