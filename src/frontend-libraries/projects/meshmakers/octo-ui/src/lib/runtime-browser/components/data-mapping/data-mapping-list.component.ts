import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { TextBoxModule } from '@progress/kendo-angular-inputs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon, trashIcon } from '@progress/kendo-svg-icons';

export interface DataPointMappingItem {
  rtId?: string;
  name?: string;
  sourceAttributePath: string;
  mappingExpression: string;
  targetAttributePath: string;
  targetRtId?: string;
  targetCkTypeId?: string;
  targetName?: string;
  enabled?: boolean;
  /** Tracks the original target rtId at load time to detect changes on save. */
  _originalTargetRtId?: string;
}

@Component({
  selector: 'mm-data-mapping-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropDownListModule,
    TextBoxModule,
    SVGIconModule,
  ],
  template: `
    <div class="mapping-list">
      <div class="mapping-toolbar">
        <button kendoButton themeColor="primary" size="small" [svgIcon]="plusIcon"
          (click)="addMapping.emit()">Add Mapping</button>
      </div>

      @if (mappings.length === 0) {
        <div class="mapping-empty-hint">
          No data point mappings configured yet.
        </div>
      }

      @for (mapping of mappings; track mapping.rtId ?? $index) {
        <div class="mapping-card">
          <div class="mapping-card-header">
            <span class="mapping-name">{{ mapping.name || 'Mapping ' + ($index + 1) }}</span>
            <button kendoButton fillMode="flat" size="small" [svgIcon]="trashIcon"
              (click)="removeMapping.emit(mapping)"></button>
          </div>
          <div class="mapping-card-body">
            <div class="mapping-row">
              <label>Source Data Point</label>
              @if (sourceDataPoints.length > 0) {
                <kendo-dropdownlist
                  [data]="sourceDataPoints"
                  [value]="mapping.sourceAttributePath || 'currentValue'"
                  [valuePrimitive]="true"
                  (valueChange)="onSourceDataPointChange(mapping, $event)">
                </kendo-dropdownlist>
              } @else {
                <div class="target-display">
                  <span class="target-info">{{ mapping.sourceAttributePath || '(not set)' }}</span>
                  <button kendoButton fillMode="flat" size="small"
                    (click)="selectSourceAttribute.emit(mapping)">Select...</button>
                </div>
              }
            </div>
            <div class="mapping-row">
              <label>Expression</label>
              <kendo-textbox [(value)]="mapping.mappingExpression"
                placeholder="e.g. value > 0 ? value : 0"
                (valueChange)="mappingChanged.emit(mapping)">
              </kendo-textbox>
            </div>
            <div class="mapping-row">
              <label>Target Entity</label>
              <div class="target-display">
                <span class="target-info">{{ mapping.targetCkTypeId || '(not set)' }} {{ mapping.targetName || '' }}</span>
                <button kendoButton fillMode="flat" size="small"
                  (click)="selectTarget.emit(mapping)">Select...</button>
              </div>
            </div>
            <div class="mapping-row">
              <label>Target Attribute</label>
              <div class="target-display">
                <span class="target-info">{{ mapping.targetAttributePath || '(not set)' }}</span>
                <button kendoButton fillMode="flat" size="small"
                  [disabled]="!mapping.targetCkTypeId"
                  (click)="selectTargetAttribute.emit(mapping)">Select...</button>
              </div>
            </div>
          </div>
        </div>
      }

      @if (mappings.length > 0) {
        <div class="mapping-actions">
          <button kendoButton themeColor="primary" (click)="saveAll.emit()">
            Save All Mappings
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .mapping-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mapping-toolbar {
      display: flex;
      justify-content: flex-end;
    }

    .mapping-empty-hint {
      text-align: center;
      padding: 16px;
      color: var(--kendo-color-subtle, #6c757d);
      font-size: 0.85rem;
    }

    .mapping-card {
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 6px;
      overflow: hidden;
    }

    .mapping-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--kendo-color-on-primary, #ffffff);
      background: var(--kendo-color-primary, #ff6358);

      .mapping-name {
        flex: 1;
      }
    }

    .mapping-card-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mapping-row {
      display: flex;
      flex-direction: column;
      gap: 3px;

      label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--kendo-color-subtle, #6c757d);
      }
    }

    .target-display {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      min-height: 30px;

      .target-info {
        flex: 1;
        font-size: 0.85rem;
        font-family: monospace;
      }
    }

    .mapping-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 4px;
    }
  `],
})
export class DataMappingListComponent {
  @Input() mappings: DataPointMappingItem[] = [];
  @Input() sourceDataPoints: string[] = [];

  @Output() addMapping = new EventEmitter<void>();
  @Output() removeMapping = new EventEmitter<DataPointMappingItem>();
  @Output() selectTarget = new EventEmitter<DataPointMappingItem>();
  @Output() selectSourceAttribute = new EventEmitter<DataPointMappingItem>();
  @Output() selectTargetAttribute = new EventEmitter<DataPointMappingItem>();
  @Output() mappingChanged = new EventEmitter<DataPointMappingItem>();

  onSourceDataPointChange(mapping: DataPointMappingItem, value: string): void {
    mapping.sourceAttributePath = value;
    this.mappingChanged.emit(mapping);
  }
  @Output() saveAll = new EventEmitter<void>();

  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = trashIcon;
}
