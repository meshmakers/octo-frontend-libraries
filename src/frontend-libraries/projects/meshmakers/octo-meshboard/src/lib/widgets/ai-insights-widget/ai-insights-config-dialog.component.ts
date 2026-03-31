import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';

export interface AiInsightsConfigResult {
  ckTypeId: string;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  refreshInterval?: number;
  maxInsights?: number;
  domainContext?: string;
}

@Component({
  selector: 'mm-ai-insights-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, LabelModule],
  template: `
    <div class="config-form">
      <div class="form-group">
        <kendo-label text="Anthropic API Key (optional for demo)">
          <kendo-textbox [(ngModel)]="apiKey" type="password" placeholder="sk-ant-..."></kendo-textbox>
        </kendo-label>
        <span class="hint">Without API key, simulated insights are shown.</span>
      </div>
      <div class="form-group">
        <kendo-label text="Model">
          <kendo-textbox [(ngModel)]="model"></kendo-textbox>
        </kendo-label>
      </div>
      <div class="form-group">
        <kendo-label text="Domain Context">
          <kendo-textbox [(ngModel)]="domainContext" placeholder="e.g. energy management"></kendo-textbox>
        </kendo-label>
      </div>
      <div class="form-row">
        <div class="form-group">
          <kendo-label text="Refresh Interval (seconds, 0=off)">
            <kendo-numerictextbox [(ngModel)]="refreshInterval" [min]="0" [step]="10" [format]="'n0'"></kendo-numerictextbox>
          </kendo-label>
        </div>
        <div class="form-group">
          <kendo-label text="Max Insights">
            <kendo-numerictextbox [(ngModel)]="maxInsights" [min]="1" [max]="8" [format]="'n0'"></kendo-numerictextbox>
          </kendo-label>
        </div>
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
    .form-row { display: flex; gap: 16px; .form-group { flex: 1; } }
    .mm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .hint { font-size: 0.75rem; opacity: 0.6; }
  `]
})
export class AiInsightsConfigDialogComponent {
  private readonly windowRef = inject(WindowRef);

  apiKey = '';
  model = 'claude-sonnet-4-20250514';
  domainContext = 'energy management';
  refreshInterval = 0;
  maxInsights = 4;

  onSave(): void {
    const result: AiInsightsConfigResult = {
      ckTypeId: '',
      apiKey: this.apiKey || undefined,
      model: this.model,
      domainContext: this.domainContext,
      refreshInterval: this.refreshInterval,
      maxInsights: this.maxInsights
    };
    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
