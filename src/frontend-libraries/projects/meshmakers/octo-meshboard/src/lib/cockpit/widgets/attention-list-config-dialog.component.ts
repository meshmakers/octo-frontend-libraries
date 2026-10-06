import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { AttentionProviderInfo, CockpitAttentionService } from '../attention/attention.service';
import { DEFAULT_ATTENTION_MAX_ITEMS } from './attention-list-widget.component';

/** Result of the attention list config dialog. */
export interface AttentionListConfigResult extends WidgetConfigResult {
  /** Empty = every registered check, including checks added later. */
  providerIds: string[];
  maxItems: number;
  showExplain: boolean;
}

/**
 * Config dialog of the "Attention list" widget (AB#5558): which health checks run (all, or a
 * selection of the registered providers), how many findings are shown and whether "✦ Explain"
 * appears. Each check still runs only for viewers with its roles.
 */
@Component({
  selector: 'mm-attention-list-config-dialog',
  standalone: true,
  imports: [FormsModule, ButtonsModule, InputsModule, LabelModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="config-container">
      <div class="config-form">
        <fieldset class="form-group">
          <legend>Health checks</legend>
          <label class="choice">
            <input type="radio" kendoRadioButton name="providerMode" value="all" [(ngModel)]="mode" />
            All checks, including checks added later
          </label>
          <label class="choice">
            <input type="radio" kendoRadioButton name="providerMode" value="selected" [(ngModel)]="mode" />
            Selected checks
          </label>
          @if (mode === 'selected') {
            <ul class="provider-list">
              @for (provider of providers; track provider.id) {
                <li>
                  <label class="choice">
                    <input type="checkbox" kendoCheckBox [checked]="isSelected(provider.id)" (change)="toggle(provider.id)" [attr.data-provider]="provider.id" />
                    <span>
                      <span class="provider-label">{{ provider.label }}</span>
                      <small class="hint">{{ provider.description }}</small>
                    </span>
                  </label>
                </li>
              }
            </ul>
            @if (selection.size === 0) {
              <p class="validation">Select at least one check.</p>
            }
          }
          <p class="hint">A check only runs for viewers who may open what it links to; others never see its findings.</p>
        </fieldset>

        <div class="form-group">
          <!-- kendo-label [for] targets the numeric textbox's focusable input. -->
          <kendo-label text="Findings shown" [for]="maxItemsBox"></kendo-label>
          <kendo-numerictextbox #maxItemsBox [(ngModel)]="maxItems" [min]="1" [max]="50" [format]="'n0'" [decimals]="0"></kendo-numerictextbox>
          <small class="hint">Further findings are summarised as "and N more".</small>
        </div>

        <label class="choice">
          <input type="checkbox" kendoCheckBox [(ngModel)]="showExplain" />
          Offer "✦ Explain" when the assistant is enabled
        </label>
      </div>
      <div class="mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" [disabled]="!canSave" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .config-container { display: flex; flex-direction: column; height: 100%; }
    .config-form { flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px; overflow-y: auto; }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: 0; }
    legend { font-weight: 600; margin-bottom: 4px; }
    .choice { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
    .provider-list { list-style: none; margin: 0 0 0 24px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .provider-label { display: block; }
    .hint { display: block; opacity: 0.7; font-size: 0.8em; margin: 0; }
    .validation { color: var(--kendo-color-error, #c62828); margin: 0; font-size: 0.85em; }
    .mm-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--kendo-color-border, #dee2e6); }
  `]
})
export class AttentionListConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);
  private readonly attention = inject(CockpitAttentionService);

  @Input() initialProviderIds?: string[];
  @Input() initialMaxItems?: number;
  @Input() initialShowExplain?: boolean;

  providers: AttentionProviderInfo[] = [];
  mode: 'all' | 'selected' = 'all';
  selection = new Set<string>();
  maxItems = DEFAULT_ATTENTION_MAX_ITEMS;
  showExplain = true;

  ngOnInit(): void {
    this.providers = this.attention.availableProviders();
    const known = new Set(this.providers.map(provider => provider.id));
    const initial = (this.initialProviderIds ?? []).filter(id => known.has(id));
    this.mode = initial.length > 0 ? 'selected' : 'all';
    this.selection = new Set(initial);
    this.maxItems = this.initialMaxItems ?? DEFAULT_ATTENTION_MAX_ITEMS;
    this.showExplain = this.initialShowExplain !== false;
  }

  get canSave(): boolean {
    return this.mode === 'all' || this.selection.size > 0;
  }

  isSelected(id: string): boolean {
    return this.selection.has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selection = next;
  }

  onSave(): void {
    if (!this.canSave) {
      return;
    }
    const result: AttentionListConfigResult = {
      ckTypeId: '',
      // Registration order, so the persisted list is stable.
      providerIds: this.mode === 'all' ? [] : this.providers.map(provider => provider.id).filter(id => this.selection.has(id)),
      maxItems: Math.max(1, Math.round(this.maxItems || DEFAULT_ATTENTION_MAX_ITEMS)),
      showExplain: this.showExplain
    };
    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
