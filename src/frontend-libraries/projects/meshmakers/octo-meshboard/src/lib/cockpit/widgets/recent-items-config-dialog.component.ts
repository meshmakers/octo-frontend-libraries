import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { DEFAULT_RECENT_ITEMS_MAX, MAX_RECENT_ITEMS } from './recent-items-widget.component';

/** Result of the "Recent items" config dialog. */
export interface RecentItemsConfigResult extends WidgetConfigResult {
  maxItems: number;
}

/**
 * Config dialog of the "Recent items" widget (AB#5558). The entries are personal (every viewer
 * sees their own history), so the board only stores how many rows are shown.
 */
@Component({
  selector: 'mm-recent-items-config-dialog',
  standalone: true,
  imports: [FormsModule, ButtonsModule, InputsModule, LabelModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="config-container">
      <div class="config-form">
        <p class="hint">Each viewer sees the pages, entities and boards they opened themselves, most recent first — the same history as the command palette.</p>
        <div class="form-group">
          <!-- kendo-label [for] targets the numeric textbox's focusable input. -->
          <kendo-label text="Items shown" [for]="maxItemsBox"></kendo-label>
          <kendo-numerictextbox #maxItemsBox [(ngModel)]="maxItems" [min]="1" [max]="maxLimit" [format]="'n0'" [decimals]="0"></kendo-numerictextbox>
          <small class="hint">Between 1 and {{ maxLimit }}. Give the widget enough rows on the board to show them.</small>
        </div>
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
    .config-form { flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px; overflow-y: auto; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .hint { display: block; opacity: 0.75; margin: 0; font-size: 0.85em; }
    .mm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }
  `]
})
export class RecentItemsConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);

  @Input() initialMaxItems?: number;

  readonly maxLimit = MAX_RECENT_ITEMS;
  maxItems = DEFAULT_RECENT_ITEMS_MAX;

  ngOnInit(): void {
    this.maxItems = this.initialMaxItems ?? DEFAULT_RECENT_ITEMS_MAX;
  }

  onSave(): void {
    const value = Math.round(this.maxItems || DEFAULT_RECENT_ITEMS_MAX);
    const result: RecentItemsConfigResult = { ckTypeId: '', maxItems: Math.min(MAX_RECENT_ITEMS, Math.max(1, value)) };
    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
