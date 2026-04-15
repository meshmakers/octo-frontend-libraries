import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { TextBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { ListViewComponent } from '@meshmakers/shared-ui';
import { searchIcon } from '@progress/kendo-svg-icons';
import { EntitySelectorDialogData, EntitySelectorDialogResult } from './entity-selector-dialog.models';

@Component({
  selector: 'mm-entity-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TextBoxModule,
    LabelModule,
    SVGIconModule,
    ListViewComponent,
  ],
  template: `
    <div class="entity-selector">
      <div class="input-section">
        <div class="input-group">
          <label>Entity Identifier (ckTypeId&#64;rtId):</label>
          <kendo-textbox
            [(value)]="entityIdentifier"
            placeholder="e.g. EnergyIQ/Space@6789a00000000000000011d1"
            (valueChange)="onIdentifierChange($event)"
          ></kendo-textbox>
        </div>

        @if (parsedCkTypeId && parsedRtId) {
          <div class="parsed-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ parsedCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">RtId:</span>
              <span class="value">{{ parsedRtId }}</span>
            </div>
          </div>
        }

        @if (parseError) {
          <div class="error-message">{{ parseError }}</div>
        }
      </div>

      <div class="dialog-actions">
        <button kendoButton themeColor="primary" [disabled]="!isValid" (click)="onConfirm()">
          Select
        </button>
        <button kendoButton (click)="onCancel()">
          Cancel
        </button>
      </div>
    </div>
  `,
  styles: [`
    .entity-selector {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      height: 100%;
    }

    .input-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--kendo-color-subtle, #6c757d);
      }
    }

    .parsed-info {
      padding: 12px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
    }

    .info-row {
      display: flex;
      gap: 8px;
      padding: 2px 0;

      .label {
        font-weight: 600;
        min-width: 50px;
        color: var(--kendo-color-subtle, #6c757d);
      }

      .value {
        font-family: monospace;
      }
    }

    .error-message {
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.85rem;
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: auto;
    }
  `],
})
export class EntitySelectorDialogComponent {
  private readonly dialogRef = inject(DialogRef);

  data: EntitySelectorDialogData = {};

  entityIdentifier = '';
  parsedCkTypeId = '';
  parsedRtId = '';
  parseError = '';
  isValid = false;

  protected readonly searchIcon = searchIcon;

  onIdentifierChange(value: string): void {
    this.entityIdentifier = value;
    this.parseIdentifier(value);
  }

  private parseIdentifier(value: string): void {
    this.parseError = '';
    this.parsedCkTypeId = '';
    this.parsedRtId = '';
    this.isValid = false;

    if (!value || !value.includes('@')) {
      if (value) {
        this.parseError = 'Format: ckTypeId@rtId (e.g. EnergyIQ/Space@6789a00...)';
      }
      return;
    }

    const atIndex = value.lastIndexOf('@');
    const ckTypeId = value.substring(0, atIndex);
    const rtId = value.substring(atIndex + 1);

    if (!ckTypeId || !rtId) {
      this.parseError = 'Both ckTypeId and rtId are required';
      return;
    }

    if (!ckTypeId.includes('/')) {
      this.parseError = 'ckTypeId should contain a "/" (e.g. EnergyIQ/Space)';
      return;
    }

    this.parsedCkTypeId = ckTypeId;
    this.parsedRtId = rtId;
    this.isValid = true;
  }

  onConfirm(): void {
    if (this.isValid) {
      const result: EntitySelectorDialogResult = {
        rtId: this.parsedRtId,
        ckTypeId: this.parsedCkTypeId,
      };
      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
