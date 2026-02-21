import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { ServiceCallDataSource } from '../../models/meshboard.models';

export interface StatusIndicatorConfigResult extends WidgetConfigResult {
  ckTypeId: string;
  callType: ServiceCallDataSource['callType'];
  modelName?: string;
  serviceType?: ServiceCallDataSource['serviceType'];
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;
}

interface CallTypeOption {
  value: ServiceCallDataSource['callType'];
  label: string;
}

interface ServiceTypeOption {
  value: ServiceCallDataSource['serviceType'];
  label: string;
}

@Component({
  selector: 'mm-status-indicator-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule
  ],
  template: `
    <kendo-dialog
      title="Status Indicator Configuration"
      [minWidth]="450"
      [width]="500"
      (close)="onCancel()">

      <div class="config-form">
        <!-- Check Type Selection -->
        <div class="form-field">
          <label>Check Type <span class="required">*</span></label>
          <kendo-dropdownlist
            [data]="callTypeOptions"
            textField="label"
            valueField="value"
            [valuePrimitive]="true"
            [(ngModel)]="form.callType"
            (valueChange)="onCallTypeChange($event)">
          </kendo-dropdownlist>
          <p class="field-hint">Select what to check for status.</p>
        </div>

        <!-- Model Name (for modelAvailable) -->
        @if (form.callType === 'modelAvailable') {
          <div class="form-field">
            <label>Model Name <span class="required">*</span></label>
            <kendo-textbox
              [(ngModel)]="form.modelName"
              placeholder="e.g., System.Communication">
            </kendo-textbox>
            <p class="field-hint">The Construction Kit model to check for availability.</p>
          </div>
        }

        <!-- Service Type (for healthCheck) -->
        @if (form.callType === 'healthCheck') {
          <div class="form-field">
            <label>Service Type <span class="required">*</span></label>
            <kendo-dropdownlist
              [data]="serviceTypeOptions"
              textField="label"
              valueField="value"
              [valuePrimitive]="true"
              [(ngModel)]="form.serviceType">
            </kendo-dropdownlist>
            <p class="field-hint">Select the service to check.</p>
          </div>
        }

        <!-- Display Options -->
        <div class="form-section">
          <h4>Labels</h4>

          <div class="form-row">
            <div class="form-field flex-1">
              <label>True Label</label>
              <kendo-textbox
                [(ngModel)]="form.trueLabel"
                placeholder="ENABLED">
              </kendo-textbox>
            </div>
            <div class="form-field flex-1">
              <label>False Label</label>
              <kendo-textbox
                [(ngModel)]="form.falseLabel"
                placeholder="DISABLED">
              </kendo-textbox>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Colors</h4>

          <div class="form-row">
            <div class="form-field flex-1">
              <label>True Color</label>
              <kendo-colorpicker
                [(ngModel)]="form.trueColor"
                [format]="'hex'"
                [view]="'palette'">
              </kendo-colorpicker>
            </div>
            <div class="form-field flex-1">
              <label>False Color</label>
              <kendo-colorpicker
                [(ngModel)]="form.falseColor"
                [format]="'hex'"
                [view]="'palette'">
              </kendo-colorpicker>
            </div>
          </div>
        </div>
      </div>

      <kendo-dialog-actions>
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 0;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field.flex-1 {
      flex: 1;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .form-section {
      padding: 16px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .form-section h4 {
      margin: 0 0 16px 0;
      font-size: 0.95rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .required {
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class StatusIndicatorConfigDialogComponent implements OnInit {
  @Input() initialCallType?: ServiceCallDataSource['callType'];
  @Input() initialModelName?: string;
  @Input() initialServiceType?: ServiceCallDataSource['serviceType'];
  @Input() initialTrueLabel?: string;
  @Input() initialFalseLabel?: string;
  @Input() initialTrueColor?: string;
  @Input() initialFalseColor?: string;

  @Output() save = new EventEmitter<StatusIndicatorConfigResult>();
  @Output() cancelled = new EventEmitter<void>();

  callTypeOptions: CallTypeOption[] = [
    { value: 'modelAvailable', label: 'Model Available' },
    { value: 'healthCheck', label: 'Health Check' }
  ];

  serviceTypeOptions: ServiceTypeOption[] = [
    { value: 'identity', label: 'Identity Service' },
    { value: 'asset-repository', label: 'Asset Repository' },
    { value: 'bot', label: 'Bot Service' },
    { value: 'communication-controller', label: 'Communication Controller' },
    { value: 'mesh-adapter', label: 'Mesh Adapter' }
  ];

  form = {
    callType: 'modelAvailable' as ServiceCallDataSource['callType'],
    modelName: '',
    serviceType: 'identity' as ServiceCallDataSource['serviceType'],
    trueLabel: 'ENABLED',
    falseLabel: 'DISABLED',
    trueColor: '#10b981',
    falseColor: '#ef4444'
  };

  get isValid(): boolean {
    if (!this.form.callType) return false;
    if (this.form.callType === 'modelAvailable' && !this.form.modelName?.trim()) return false;
    if (this.form.callType === 'healthCheck' && !this.form.serviceType) return false;
    return true;
  }

  ngOnInit(): void {
    this.form.callType = this.initialCallType ?? 'modelAvailable';
    this.form.modelName = this.initialModelName ?? '';
    this.form.serviceType = this.initialServiceType ?? 'identity';
    this.form.trueLabel = this.initialTrueLabel ?? 'ENABLED';
    this.form.falseLabel = this.initialFalseLabel ?? 'DISABLED';
    this.form.trueColor = this.initialTrueColor ?? '#10b981';
    this.form.falseColor = this.initialFalseColor ?? '#ef4444';
  }

  onCallTypeChange(callType: ServiceCallDataSource['callType']): void {
    this.form.callType = callType;
  }

  onSave(): void {
    this.save.emit({
      ckTypeId: '',
      callType: this.form.callType,
      modelName: this.form.callType === 'modelAvailable' ? this.form.modelName : undefined,
      serviceType: this.form.callType === 'healthCheck' ? this.form.serviceType : undefined,
      trueLabel: this.form.trueLabel || undefined,
      falseLabel: this.form.falseLabel || undefined,
      trueColor: this.form.trueColor || undefined,
      falseColor: this.form.falseColor || undefined
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
