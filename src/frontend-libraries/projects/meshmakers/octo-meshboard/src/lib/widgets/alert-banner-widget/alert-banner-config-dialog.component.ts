import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';

export interface AlertBannerConfigResult {
  ckTypeId: string;
  rotationInterval: number;
  showIcon: boolean;
  maxAlerts: number;
}

@Component({
  selector: 'mm-alert-banner-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, LabelModule],
  template: `
    <div class="config-form">
      <div class="form-group">
        <kendo-label text="CK Type ID">
          <kendo-textbox [(ngModel)]="ckTypeId"></kendo-textbox>
        </kendo-label>
      </div>
      <div class="form-group">
        <kendo-label text="Rotation Interval (ms)">
          <kendo-numerictextbox [(ngModel)]="rotationInterval" [min]="1000" [step]="1000" [format]="'n0'"></kendo-numerictextbox>
        </kendo-label>
      </div>
      <div class="form-group">
        <kendo-label text="Max Alerts">
          <kendo-numerictextbox [(ngModel)]="maxAlerts" [min]="1" [max]="100" [format]="'n0'"></kendo-numerictextbox>
        </kendo-label>
      </div>
      <div class="mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    .config-form { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .mm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  `]
})
export class AlertBannerConfigDialogComponent {
  private readonly windowRef = inject(WindowRef);

  ckTypeId = 'System.Notification/StatefulEvent';
  rotationInterval = 5000;
  showIcon = true;
  maxAlerts = 20;

  onSave(): void {
    const result: AlertBannerConfigResult = {
      ckTypeId: this.ckTypeId,
      rotationInterval: this.rotationInterval,
      showIcon: this.showIcon,
      maxAlerts: this.maxAlerts
    };
    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
