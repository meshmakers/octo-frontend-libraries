import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputsModule, NumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { DockviewApi } from 'dockview-core';
import { IDockviewPanelProps, DockviewPanelApi } from '../dockview/dockview.component';
import { SymbolSettings } from '../process-designer.component';

/**
 * Settings panel for symbol editing within dockview
 * Displays symbol metadata, canvas, and grid settings
 */
@Component({
  selector: 'mm-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, InputsModule, NumericTextBoxModule],
  template: `
    <div class="panel-container">
      <div class="settings-section">
        <h4>Symbol</h4>
        <div class="form-group">
          <label>Name</label>
          <input kendoTextBox [ngModel]="settings?.name" (ngModelChange)="onSettingChange('name', $event)"/>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea kendoTextArea [ngModel]="settings?.description" (ngModelChange)="onSettingChange('description', $event)" rows="2"></textarea>
        </div>
      </div>

      <div class="settings-section">
        <h4>Canvas</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Width (px)</label>
            <kendo-numerictextbox
              [ngModel]="settings?.canvasWidth"
              (ngModelChange)="onSettingChange('canvasWidth', $event)"
              [min]="50"
              [max]="2000"
              [step]="10"
              [format]="'n0'">
            </kendo-numerictextbox>
          </div>
          <div class="form-group">
            <label>Height (px)</label>
            <kendo-numerictextbox
              [ngModel]="settings?.canvasHeight"
              (ngModelChange)="onSettingChange('canvasHeight', $event)"
              [min]="50"
              [max]="2000"
              [step]="10"
              [format]="'n0'">
            </kendo-numerictextbox>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h4>Grid</h4>
        <div class="form-group">
          <label>Size (px)</label>
          <kendo-numerictextbox
            [ngModel]="settings?.gridSize"
            (ngModelChange)="onSettingChange('gridSize', $event)"
            [min]="1"
            [max]="100"
            [step]="1"
            [format]="'n0'">
          </kendo-numerictextbox>
        </div>
      </div>

      <div class="settings-section">
        <h4>Metadata</h4>
        <div class="form-group">
          <label>Version</label>
          <input kendoTextBox [ngModel]="settings?.version" (ngModelChange)="onSettingChange('version', $event)"/>
        </div>
        <div class="form-group">
          <label>Category</label>
          <input kendoTextBox [ngModel]="settings?.category" (ngModelChange)="onSettingChange('category', $event)"/>
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input kendoTextBox [ngModel]="settings?.tags" (ngModelChange)="onSettingChange('tags', $event)" placeholder="comma separated"/>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .panel-container {
      padding: 0.5rem;
      background: #fff;
    }

    .settings-section {
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e0e0e0;

      &:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
    }

    .settings-section h4 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      margin: 0 0 0.5rem;
      letter-spacing: 0.5px;
    }

    .form-group {
      margin-bottom: 0.5rem;

      label {
        display: block;
        font-size: 11px;
        color: #666;
        margin-bottom: 0.25rem;
      }

      input, textarea, kendo-numerictextbox {
        width: 100%;
      }
    }

    .form-row {
      display: flex;
      gap: 0.5rem;

      .form-group {
        flex: 1;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPanelComponent implements IDockviewPanelProps {
  api!: DockviewPanelApi;
  containerApi!: DockviewApi;
  params: Record<string, unknown> = {};

  get settings(): SymbolSettings | null {
    const settingsParam = this.params['settings'];
    if (typeof settingsParam === 'function') {
      return (settingsParam as () => SymbolSettings | null)();
    }
    return settingsParam as SymbolSettings | null ?? null;
  }

  get onSettingsChange(): ((key: string, value: string | number) => void) | undefined {
    return this.params['onSettingsChange'] as ((key: string, value: string | number) => void) | undefined;
  }

  onSettingChange(key: string, value: string | number): void {
    if (this.onSettingsChange) {
      this.onSettingsChange(key, value);
    }
  }
}
