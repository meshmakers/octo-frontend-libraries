import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ComboBoxModule } from '@progress/kendo-angular-dropdowns';
import { SwitchModule, TextBoxModule } from '@progress/kendo-angular-inputs';
import { folderOpenIcon } from '@progress/kendo-svg-icons';
import { AttributeItem, AttributeSelectorService } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { AttributeSelectorDialogService } from '../../../attribute-selector-dialog/attribute-selector-dialog.service';
import { DataPointPickerComponent } from '../../../data-point-picker/data-point-picker.component';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
import { CoverageEntityRef } from './mapping-coverage-tree.models';
import {
  computeExpressionPreview,
  MappingExpressionEvaluatorFn,
} from './mapping-expression-preview';

/**
 * Shared settings applied to every mapping created by the bulk flow: one
 * target entity plus one source data point / target attribute / expression for
 * all selected sources. Per-source values (the MapsFrom association and the
 * generated name) are derived by the caller.
 */
export interface BulkMappingValue {
  targetRtId: string;
  targetCkTypeId: string;
  targetName?: string;
  sourceAttributePath: string;
  targetAttributePath: string;
  mappingExpression: string;
  enabled: boolean;
}

export interface BulkMappingDialogData {
  /** The selected source entities (orphan-tab multi-select). */
  sources: CoverageEntityRef[];
  title?: string;
  /**
   * Optional host-provided expression evaluator. When set, the dialog shows a
   * live preview of the mapping expression applied to the FIRST selected
   * source's current data-point value.
   */
  expressionEvaluator?: MappingExpressionEvaluatorFn;
}

export type BulkMappingDialogResult =
  | { confirmed: true; value: BulkMappingValue }
  | { confirmed: false };

/**
 * Bulk variant of the mapping editor: creates the SAME mapping shape (source
 * data point → target attribute, one shared target entity) for N selected
 * source entities in one go. The source data-point options are loaded from the
 * FIRST selected source — the usual bulk case is a set of same-typed controls
 * exposing identical states; free text stays possible for mixed sets.
 */
@Component({
  selector: 'mm-bulk-mapping-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ComboBoxModule,
    SwitchModule,
    TextBoxModule,
    DataPointPickerComponent,
  ],
  template: `
    <div class="bulk-mapping">
      <div class="bulk-mapping-body">
        <div class="field-row">
          <label>Sources</label>
          <div class="source-summary">
            <span class="source-count">{{ sources().length }} entities selected</span>
            <span class="source-preview">{{ sourcePreview() }}</span>
          </div>
        </div>

        <div class="field-row inline">
          <label>Enabled</label>
          <kendo-switch [(ngModel)]="enabled" size="small"></kendo-switch>
        </div>

        <div class="field-row">
          <label>Source Data Point</label>
          <mm-data-point-picker
            [entityRtId]="firstSource()?.rtId"
            [entityCkTypeId]="firstSource()?.ckTypeId"
            [value]="sourceAttributePath()"
            (valueChange)="sourceAttributePath.set($event)">
          </mm-data-point-picker>
          <span class="hint">
            Applied to every selected source. Options come from the first
            selected entity's data points; free text is allowed.
          </span>
        </div>

        <div class="field-row">
          <label>Mapping Expression</label>
          <kendo-textbox [value]="mappingExpression()"
            (valueChange)="mappingExpression.set($event)"
            placeholder="e.g. value, value / 100, value > 50 ? 1 : 0">
          </kendo-textbox>
          <span class="hint">Optional. mXparser expression. <code>value</code> = raw source value.</span>
          @if (expressionPreview(); as p) {
            <div class="expression-preview" [class.expression-preview-error]="p.result !== null && !p.result.valid">
              <span class="preview-label">Preview ({{ firstSource()?.name }}):</span>
              <code>value = {{ p.valueLabel }}</code>
              @if (p.result; as r) {
                @if (r.valid) {
                  <span class="preview-arrow">→</span>
                  <code>{{ r.preview }}</code>
                  @if (p.passThrough) { <span class="preview-note">(pass-through)</span> }
                } @else {
                  <span class="preview-error-text">{{ r.error }}</span>
                }
              } @else {
                <span class="preview-note">(no evaluator available)</span>
              }
            </div>
          }
        </div>

        <div class="field-row">
          <label>Target Entity</label>
          @if (targetRtId()) {
            <div class="entity-display">
              <div class="entity-main">
                <span class="entity-name">{{ targetName() || targetRtId() }}</span>
                <button kendoButton fillMode="flat" size="small"
                  (click)="pickTarget()">Change…</button>
              </div>
              <div class="entity-meta">
                <span>{{ targetCkTypeId() }}</span>
                <span class="sep">&#64;</span>
                <span>{{ targetRtId() }}</span>
              </div>
            </div>
          } @else {
            <div class="entity-display empty">
              <span class="hint">No target entity linked.</span>
              <button kendoButton fillMode="flat" size="small"
                (click)="pickTarget()">Select…</button>
            </div>
          }
          <span class="hint">All created mappings point to this one entity.</span>
        </div>

        <div class="field-row">
          <label>
            Target Attribute Path
            @if (targetAttributesLoading()) { <span class="loading-pill">loading…</span> }
          </label>
          <div class="combo-row">
            <kendo-combobox
              [data]="targetAttributeList()"
              [value]="targetAttributePath()"
              (valueChange)="onTargetAttributePathChange($event)"
              [textField]="'attributePath'"
              [valueField]="'attributePath'"
              [valuePrimitive]="true"
              [allowCustom]="true"
              [filterable]="true"
              (filterChange)="targetFilter.set($event)"
              [popupSettings]="{ appendTo: 'root', animate: true }"
              placeholder="e.g. Temperature, CO2Level">
            </kendo-combobox>
            <button kendoButton fillMode="flat" size="small"
              [svgIcon]="browseIcon"
              [disabled]="!targetCkTypeId()"
              (click)="browseTargetAttribute()"
              title="Browse all attributes (incl. navigation properties)"></button>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button kendoButton (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()"
          [disabled]="!isValid()">Create {{ sources().length }} mappings</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .bulk-mapping {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }

    .bulk-mapping-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .field-row {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));
      }

      .hint {
        font-size: 0.7rem;
        color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));
        font-style: italic;
      }

      &.inline {
        flex-direction: row;
        align-items: center;
        gap: 8px;
      }
    }

    .source-summary {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      border: 1px solid var(--theme-border-subtle, var(--kendo-color-border, #dee2e6));
      border-radius: 4px;
      background: color-mix(in srgb,
        var(--theme-bg-elevated, var(--kendo-color-surface-alt, #f8f9fa)) 65%,
        transparent);

      .source-count {
        font-weight: 600;
        font-size: 0.85rem;
      }

      .source-preview {
        font-size: 0.72rem;
        color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));
      }
    }

    .entity-display {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      border: 1px solid var(--theme-border-subtle, var(--kendo-color-border, #dee2e6));
      border-radius: 4px;
      background: color-mix(in srgb,
        var(--theme-bg-elevated, var(--kendo-color-surface-alt, #f8f9fa)) 65%,
        transparent);

      &.empty {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .entity-main {
      display: flex;
      align-items: center;
      gap: 8px;

      .entity-name {
        flex: 1;
        font-weight: 600;
        font-size: 0.9rem;
      }
    }

    .entity-meta {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 0.7rem;
      font-family: monospace;
      color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));

      .sep {
        opacity: 0.7;
      }
    }

    .combo-row {
      display: flex;
      align-items: stretch;
      gap: 4px;

      kendo-combobox {
        flex: 1;
      }
    }

    .loading-pill {
      margin-left: 6px;
      font-size: 0.65rem;
      padding: 1px 6px;
      border-radius: 8px;
      background: color-mix(in srgb,
        var(--kendo-color-info, #0dcaf0) 18%, transparent);
      color: var(--kendo-color-info, #0dcaf0);
      text-transform: none;
      letter-spacing: 0;
      font-style: italic;
    }

    .expression-preview {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.75rem;
      background: color-mix(in srgb,
        var(--kendo-color-success, #28a745) 10%, transparent);

      &.expression-preview-error {
        background: color-mix(in srgb,
          var(--kendo-color-error, #dc3545) 10%, transparent);
      }

      .preview-label {
        font-weight: 600;
        color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));
      }

      code {
        font-family: monospace;
      }

      .preview-arrow {
        opacity: 0.7;
      }

      .preview-note {
        font-style: italic;
        color: var(--theme-text-secondary, var(--kendo-color-subtle, #6c757d));
      }

      .preview-error-text {
        color: var(--kendo-color-error, #dc3545);
      }
    }

    .dialog-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 18px;
      border-top: 1px solid var(--theme-border-subtle,
        var(--kendo-color-border, #dee2e6));
      background: color-mix(in srgb,
        var(--theme-bg-elevated,
          var(--kendo-color-surface-alt, #f8f9fa)) 70%,
        transparent);
    }
  `],
})
export class BulkMappingDialogComponent {
  private readonly windowRef = inject(WindowRef);
  private readonly entitySelector = inject(EntitySelectorDialogService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);
  private readonly attributeService = inject(AttributeSelectorService);

  protected readonly browseIcon = folderOpenIcon;

  protected readonly sources = signal<CoverageEntityRef[]>([]);
  protected readonly firstSource = computed(() => this.sources()[0] ?? null);
  protected readonly sourcePreview = computed(() => {
    const names = this.sources().map(s => s.name);
    const head = names.slice(0, 5).join(', ');
    return names.length > 5 ? `${head}, … (+${names.length - 5} more)` : head;
  });

  protected enabled = true;
  protected readonly sourceAttributePath = signal<string>('');
  protected readonly mappingExpression = signal<string>('');
  protected readonly targetRtId = signal<string | null>(null);
  protected readonly targetCkTypeId = signal<string | null>(null);
  protected readonly targetName = signal<string | null>(null);
  protected readonly targetAttributePath = signal<string>('');

  private readonly targetAttributes = signal<AttributeItem[]>([]);
  protected readonly targetFilter = signal<string>('');
  protected readonly targetAttributesLoading = signal(false);

  /** The source data-point picker; carries the selected point's current value. */
  private readonly sourcePicker = viewChild(DataPointPickerComponent);

  /** Optional host-provided evaluator (set via initialise). */
  private expressionEvaluator: MappingExpressionEvaluatorFn | undefined;

  /**
   * Live "value = X → Y" preview of the shared mapping expression applied to
   * the FIRST selected source's data-point value (the usual bulk case is a
   * set of same-typed controls, so the first one is representative).
   */
  protected readonly expressionPreview = computed(() =>
    computeExpressionPreview(
      this.expressionEvaluator,
      this.mappingExpression(),
      this.sourcePicker()?.currentValue(),
    ),
  );
  protected readonly targetAttributeList = computed(() => {
    const filter = this.targetFilter().toLowerCase();
    const all = this.targetAttributes();
    return filter
      ? all.filter(a => a.attributePath.toLowerCase().includes(filter))
      : all;
  });

  public initialise(data: BulkMappingDialogData): void {
    this.sources.set(data.sources);
    this.expressionEvaluator = data.expressionEvaluator;
  }

  protected isValid(): boolean {
    return (
      this.sources().length > 0 &&
      !!this.targetRtId() &&
      !!this.targetCkTypeId() &&
      this.sourceAttributePath().trim().length > 0 &&
      this.targetAttributePath().trim().length > 0
    );
  }

  protected async pickTarget(): Promise<void> {
    const result = await this.entitySelector.openEntitySelector({
      title: 'Select Target Entity',
      currentTargetRtId: this.targetRtId() ?? undefined,
      currentTargetCkTypeId: this.targetCkTypeId() ?? undefined,
    });
    if (!result.confirmed || !result.entity) return;
    const changedType = result.entity.ckTypeId !== this.targetCkTypeId();
    this.targetRtId.set(result.entity.rtId);
    this.targetCkTypeId.set(result.entity.ckTypeId);
    this.targetName.set(result.entity.name ?? result.entity.rtId);
    if (changedType) {
      this.targetAttributePath.set('');
      this.targetFilter.set('');
      void this.loadTargetAttributes(result.entity.ckTypeId);
    }
  }

  protected onTargetAttributePathChange(value: string | null): void {
    this.targetAttributePath.set(value ?? '');
  }

  protected async browseTargetAttribute(): Promise<void> {
    const ckTypeId = this.targetCkTypeId();
    if (!ckTypeId) return;
    const current = this.targetAttributePath();
    const result = await this.attributeSelectorDialog.openAttributeSelector(
      ckTypeId,
      current ? [current] : undefined,
      'Select Target Attribute Path',
      true, // singleSelect
    );
    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.targetAttributePath.set(result.selectedAttributes[0].attributePath);
    }
  }

  protected onSave(): void {
    if (!this.isValid()) return;
    const result: BulkMappingDialogResult = {
      confirmed: true,
      value: {
        targetRtId: this.targetRtId() as string,
        targetCkTypeId: this.targetCkTypeId() as string,
        targetName: this.targetName() ?? undefined,
        sourceAttributePath: this.sourceAttributePath().trim(),
        targetAttributePath: this.targetAttributePath().trim(),
        mappingExpression: this.mappingExpression().trim(),
        enabled: this.enabled,
      },
    };
    this.windowRef.close(result);
  }

  protected onCancel(): void {
    const result: BulkMappingDialogResult = { confirmed: false };
    this.windowRef.close(result);
  }

  /** Direct CK attributes of the target type for the combobox (same rules as the single-mapping editor). */
  private async loadTargetAttributes(ckTypeId: string): Promise<void> {
    this.targetAttributesLoading.set(true);
    try {
      const result = await firstValueFrom(
        this.attributeService.getAvailableAttributes(
          ckTypeId,
          undefined, // filter
          500,       // first
          undefined, // after
          undefined, // attributeValueType
          undefined, // searchTerm
          false,     // includeNavigationProperties — keep the list focused
          0,         // maxDepth — direct attributes only
        ),
      );
      this.targetAttributes.set(result.items);
    } catch (err) {
      console.error(`Failed to load target attributes for ${ckTypeId}:`, err);
      this.targetAttributes.set([]);
    } finally {
      this.targetAttributesLoading.set(false);
    }
  }
}
