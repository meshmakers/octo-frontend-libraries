import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { WidgetConfigResult } from '../../services/widget-registry.service';

export interface StatusListConfigResult extends WidgetConfigResult {
  ckTypeId: string;
  labelField: string;
  statusField: string;
  statusColors?: Record<string, { color: string; label?: string }>;
}

@Component({
  selector: 'mm-status-list-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule],
  template: `
    <div class="config-container">
      <div class="config-form">
        <div class="form-field">
          <label>Entity Type <span class="required">*</span></label>
          <kendo-textbox [(ngModel)]="form.ckTypeId" placeholder="e.g. Environment/ComplianceRecord"></kendo-textbox>
          <p class="field-hint">Full CK type ID</p>
        </div>

        <div class="form-field">
          <label>Label Field <span class="required">*</span></label>
          <kendo-textbox [(ngModel)]="form.labelField" placeholder="e.g. name"></kendo-textbox>
          <p class="field-hint">Attribute name for the item label</p>
        </div>

        <div class="form-field">
          <label>Status Field <span class="required">*</span></label>
          <kendo-textbox [(ngModel)]="form.statusField" placeholder="e.g. complianceStatus"></kendo-textbox>
          <p class="field-hint">Attribute name for the status value (enum)</p>
        </div>

        <div class="form-section">
          <h4>Status Colors</h4>
          <p class="field-hint">Map status values to badge colors and labels.</p>
          @for (entry of statusColorEntries; track $index) {
            <div class="color-row">
              <kendo-textbox [(ngModel)]="entry.key" placeholder="Status value" style="width: 120px;"></kendo-textbox>
              <kendo-textbox [(ngModel)]="entry.color" placeholder="#10b981" style="width: 100px;"></kendo-textbox>
              <kendo-textbox [(ngModel)]="entry.label" placeholder="Badge label" style="flex: 1;"></kendo-textbox>
              <button kendoButton fillMode="flat" (click)="removeStatusColor($index)">Remove</button>
            </div>
          }
          <button kendoButton fillMode="flat" (click)="addStatusColor()">+ Add Status Color</button>
        </div>
      </div>

      <div class="action-bar mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" [disabled]="!isValid" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .config-form { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .action-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-weight: 600; font-size: 0.9rem; }
    .required { color: var(--kendo-color-error, #dc3545); }
    .field-hint { margin: 0; font-size: 0.8rem; color: var(--kendo-color-subtle, #6c757d); }
    .form-section { margin-top: 8px; }
    .form-section h4 { margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 600; }
    .color-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  `]
})
export class StatusListConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);

  @Input() initialCkTypeId?: string;
  @Input() initialLabelField?: string;
  @Input() initialStatusField?: string;
  @Input() initialStatusColors?: Record<string, { color: string; label?: string }>;

  form = {
    ckTypeId: '',
    labelField: '',
    statusField: ''
  };

  statusColorEntries: { key: string; color: string; label: string }[] = [];

  get isValid(): boolean {
    return !!this.form.ckTypeId && !!this.form.labelField && !!this.form.statusField;
  }

  ngOnInit(): void {
    this.form.ckTypeId = this.initialCkTypeId ?? '';
    this.form.labelField = this.initialLabelField ?? '';
    this.form.statusField = this.initialStatusField ?? '';

    if (this.initialStatusColors) {
      this.statusColorEntries = Object.entries(this.initialStatusColors).map(([key, val]) => ({
        key,
        color: val.color,
        label: val.label ?? ''
      }));
    }
  }

  addStatusColor(): void {
    this.statusColorEntries.push({ key: '', color: '#10b981', label: '' });
  }

  removeStatusColor(index: number): void {
    this.statusColorEntries.splice(index, 1);
  }

  onSave(): void {
    const statusColors: Record<string, { color: string; label?: string }> = {};
    for (const entry of this.statusColorEntries) {
      if (entry.key) {
        statusColors[entry.key] = { color: entry.color, label: entry.label || undefined };
      }
    }

    this.windowRef.close({
      ckTypeId: this.form.ckTypeId,
      labelField: this.form.labelField,
      statusField: this.form.statusField,
      statusColors: Object.keys(statusColors).length > 0 ? statusColors : undefined
    } as StatusListConfigResult);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
