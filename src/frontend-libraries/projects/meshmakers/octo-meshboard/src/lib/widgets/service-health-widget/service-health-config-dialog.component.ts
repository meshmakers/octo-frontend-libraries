import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { ServiceCallDataSource } from '../../models/meshboard.models';

export interface ServiceHealthConfigResult extends WidgetConfigResult {
  ckTypeId: string;
  serviceType: ServiceCallDataSource['serviceType'];
  customEndpoint?: string;
  showPulse: boolean;
  navigateOnClick: boolean;
  detailRoute?: string;
}

interface ServiceTypeOption {
  value: ServiceCallDataSource['serviceType'];
  label: string;
}

@Component({
  selector: 'mm-service-health-config-dialog',
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
      title="Service Health Configuration"
      [minWidth]="450"
      [width]="500"
      (close)="onCancel()">

      <div class="config-form">
        <!-- Service Type Selection -->
        <div class="form-field">
          <label>Service Type <span class="required">*</span></label>
          <kendo-dropdownlist
            [data]="serviceTypeOptions"
            textField="label"
            valueField="value"
            [valuePrimitive]="true"
            [(ngModel)]="form.serviceType"
            (valueChange)="onServiceTypeChange($event)">
          </kendo-dropdownlist>
          <p class="field-hint">Select the service to monitor.</p>
        </div>

        <!-- Custom Endpoint (only for custom service) -->
        @if (form.serviceType === 'custom') {
          <div class="form-field">
            <label>Custom Endpoint <span class="required">*</span></label>
            <kendo-textbox
              [(ngModel)]="form.customEndpoint"
              placeholder="https://example.com/api/">
            </kendo-textbox>
            <p class="field-hint">The base URL for the health check (must end with /).</p>
          </div>
        }

        <!-- Display Options -->
        <div class="form-section">
          <h4>Display Options</h4>

          <div class="form-field">
            <kendo-switch
              [(ngModel)]="form.showPulse"
              [onLabel]="'Yes'"
              [offLabel]="'No'">
            </kendo-switch>
            <label class="switch-label">Show pulse animation when healthy</label>
          </div>

          <div class="form-field">
            <kendo-switch
              [(ngModel)]="form.navigateOnClick"
              [onLabel]="'Yes'"
              [offLabel]="'No'">
            </kendo-switch>
            <label class="switch-label">Navigate on click</label>
          </div>

          @if (form.navigateOnClick) {
            <div class="form-field">
              <label>Detail Route</label>
              <kendo-textbox
                [(ngModel)]="form.detailRoute"
                placeholder="/health/identity">
              </kendo-textbox>
              <p class="field-hint">The route to navigate to when clicked.</p>
            </div>
          }
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

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .switch-label {
      font-weight: 400 !important;
      margin-left: 8px;
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

    .required {
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class ServiceHealthConfigDialogComponent implements OnInit {
  @Input() initialServiceType?: ServiceCallDataSource['serviceType'];
  @Input() initialCustomEndpoint?: string;
  @Input() initialShowPulse?: boolean;
  @Input() initialNavigateOnClick?: boolean;
  @Input() initialDetailRoute?: string;

  @Output() save = new EventEmitter<ServiceHealthConfigResult>();
  @Output() cancelled = new EventEmitter<void>();

  serviceTypeOptions: ServiceTypeOption[] = [
    { value: 'identity', label: 'Identity Service' },
    { value: 'asset-repository', label: 'Asset Repository' },
    { value: 'bot', label: 'Bot Service' },
    { value: 'communication-controller', label: 'Communication Controller' },
    { value: 'mesh-adapter', label: 'Mesh Adapter' },
    { value: 'custom', label: 'Custom Endpoint' }
  ];

  form = {
    serviceType: 'identity' as ServiceCallDataSource['serviceType'],
    customEndpoint: '',
    showPulse: true,
    navigateOnClick: false,
    detailRoute: ''
  };

  get isValid(): boolean {
    if (!this.form.serviceType) return false;
    if (this.form.serviceType === 'custom' && !this.form.customEndpoint?.trim()) return false;
    if (this.form.navigateOnClick && !this.form.detailRoute?.trim()) return false;
    return true;
  }

  ngOnInit(): void {
    this.form.serviceType = this.initialServiceType ?? 'identity';
    this.form.customEndpoint = this.initialCustomEndpoint ?? '';
    this.form.showPulse = this.initialShowPulse ?? true;
    this.form.navigateOnClick = this.initialNavigateOnClick ?? false;
    this.form.detailRoute = this.initialDetailRoute ?? '';
  }

  onServiceTypeChange(serviceType: ServiceCallDataSource['serviceType']): void {
    this.form.serviceType = serviceType;
    if (serviceType !== 'custom') {
      this.form.customEndpoint = '';
    }
  }

  onSave(): void {
    this.save.emit({
      ckTypeId: '',
      serviceType: this.form.serviceType,
      customEndpoint: this.form.serviceType === 'custom' ? this.form.customEndpoint : undefined,
      showPulse: this.form.showPulse,
      navigateOnClick: this.form.navigateOnClick,
      detailRoute: this.form.navigateOnClick ? this.form.detailRoute : undefined
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
