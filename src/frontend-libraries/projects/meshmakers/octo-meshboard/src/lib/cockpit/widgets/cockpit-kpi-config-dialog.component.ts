import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { WidgetConfigResult } from '../../services/widget-registry.service';

/** Result of the cockpit KPI config dialog. */
export interface CockpitKpiConfigResult extends WidgetConfigResult {
  showDetail: boolean;
  /** Only meaningful for "Pipeline executions 24 h". */
  showSparkline: boolean;
}

/**
 * Config dialog of the cockpit KPI widgets (AB#5558). The figures themselves are fixed (they use
 * the same rules as the pages they link to); the dialog only chooses what the tile shows. The
 * title is edited in the widget's general settings like for every widget.
 */
@Component({
  selector: 'mm-cockpit-kpi-config-dialog',
  standalone: true,
  imports: [FormsModule, ButtonsModule, InputsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="config-container">
      <div class="config-form">
        @if (description) {
          <p class="hint">{{ description }}</p>
        }
        <label class="choice">
          <input type="checkbox" kendoCheckBox [(ngModel)]="showDetail" />
          Show the detail line (e.g. hibernated, edge / local, not deployed)
        </label>
        @if (supportsSparkline) {
          <label class="choice">
            <input type="checkbox" kendoCheckBox [(ngModel)]="showSparkline" />
            Show the hourly sparkline
          </label>
        }
      </div>
      <div class="mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .config-form { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 16px; overflow-y: auto; }
    .choice { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .hint { opacity: 0.75; margin: 0; }
    .mm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }
  `]
})
export class CockpitKpiConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);

  @Input() initialShowDetail?: boolean;
  @Input() initialShowSparkline?: boolean;
  @Input() supportsSparkline = false;
  @Input() description?: string;

  showDetail = true;
  showSparkline = true;

  ngOnInit(): void {
    this.showDetail = this.initialShowDetail !== false;
    this.showSparkline = this.initialShowSparkline !== false;
  }

  onSave(): void {
    const result: CockpitKpiConfigResult = { ckTypeId: '', showDetail: this.showDetail, showSparkline: this.showSparkline };
    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
