import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ComboBoxModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { SwitchModule, TextBoxModule } from '@progress/kendo-angular-inputs';
import { arrowRotateCwIcon, folderOpenIcon, hyperlinkOpenIcon } from '@progress/kendo-svg-icons';
import { AttributeItem, AttributeSelectorService } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { AttributeSelectorDialogService } from '../../../attribute-selector-dialog/attribute-selector-dialog.service';
import { DataPointPickerComponent } from '../../../data-point-picker/data-point-picker.component';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';

/**
 * Editable view-model for one DataPointMapping. The fields mirror the CK
 * attributes (Name, Enabled, SourceAttributePath, MappingExpression,
 * TargetAttributePath) plus both the MapsFrom source-entity reference and
 * the MapsTo target-entity reference. The `_originalSource*` and
 * `_originalTarget*` snapshots let the caller decide whether the
 * corresponding association needs an update on save.
 *
 * `rtId === ''` denotes a not-yet-persisted mapping (orphan-tab "Map…"
 * flow). The caller branches on this to choose CreateEntities vs.
 * UpdateRuntimeEntities.
 */
export interface MappingEditValue {
  rtId: string;
  ckTypeId: string;
  name: string;
  enabled: boolean;
  sourceRtId?: string;
  sourceCkTypeId?: string;
  sourceName?: string;
  sourceAttributePath: string;
  mappingExpression: string;
  /** MapsTo target entity reference. Empty for new mappings until the user picks one. */
  targetRtId?: string;
  targetCkTypeId?: string;
  targetName?: string;
  targetAttributePath: string;
  /** Source rtId at dialog-open time — used to detect MapsFrom changes. */
  _originalSourceRtId?: string;
  _originalSourceCkTypeId?: string;
  /** Target rtId at dialog-open time — used to detect MapsTo changes. */
  _originalTargetRtId?: string;
  _originalTargetCkTypeId?: string;
}

export interface MappingEditDialogData {
  mapping: MappingEditValue;
  title?: string;
  /**
   * Default CK type id for the Target Attribute Path autocomplete when the
   * mapping has no target picked yet. Once the user picks a target entity,
   * the model's `targetCkTypeId` takes over.
   * @deprecated Set `mapping.targetCkTypeId` instead; this is kept for
   *   backward compatibility with the original (target-fixed) usage where
   *   the dialog was always opened for a specific tree node.
   */
  targetCkTypeId?: string;
}

export type MappingEditDialogResult =
  | { confirmed: true; mapping: MappingEditValue }
  | { confirmed: false };

/**
 * Focused single-mapping editor dialog. The host renders this via
 * `MappingEditDialogService.open(...)` and awaits the resulting promise:
 * `confirmed=true` means the user saved (caller persists), `confirmed=false`
 * means cancel.
 */
@Component({
  selector: 'mm-mapping-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ComboBoxModule,
    SVGIconModule,
    SwitchModule,
    TextBoxModule,
    DataPointPickerComponent,
  ],
  template: `
    <div class="mapping-edit">
      <div class="mapping-edit-body">
      <div class="field-row">
        <label>Name</label>
        <div class="combo-row">
          <kendo-textbox [(value)]="model().name"
            placeholder="Mapping name">
          </kendo-textbox>
          <button kendoButton fillMode="flat" size="small"
            [svgIcon]="icons.regenerate"
            [disabled]="!canGenerateName()"
            (click)="generateName()"
            title="Generate name from source + target"></button>
        </div>
      </div>

      <div class="field-row inline">
        <label>Enabled</label>
        <kendo-switch [(ngModel)]="model().enabled" size="small"></kendo-switch>
        @if (!model().enabled) {
          <span class="hint">Mapping is disabled — it will be skipped by data acquisition.</span>
        }
      </div>

      <div class="field-row">
        <label>Source Entity</label>
        @if (model().sourceRtId) {
          <div class="entity-display">
            <div class="entity-main">
              <span class="entity-name">{{ model().sourceName || model().sourceRtId }}</span>
              <button kendoButton fillMode="flat" size="small"
                (click)="pickSource()">Change…</button>
            </div>
            <div class="entity-meta">
              <span>{{ model().sourceCkTypeId }}</span>
              <span class="sep">@</span>
              <span>{{ model().sourceRtId }}</span>
            </div>
          </div>
        } @else {
          <div class="entity-display empty">
            <span class="hint">No source entity linked.</span>
            <button kendoButton fillMode="flat" size="small"
              (click)="pickSource()">Select…</button>
          </div>
        }
      </div>

      <div class="field-row">
        <label>Source Data Point</label>
        <mm-data-point-picker
          [entityRtId]="model().sourceRtId"
          [entityCkTypeId]="model().sourceCkTypeId"
          [value]="model().sourceAttributePath"
          [disabled]="!model().sourceRtId || !model().sourceCkTypeId"
          (valueChange)="onSourceAttributePathChange($event)">
        </mm-data-point-picker>
        <span class="hint">
          @if (model().sourceRtId && model().sourceCkTypeId) {
            Data points exposed by the source entity's
            <code>States</code> / <code>DataPoints</code> array, with
            <code>currentValue</code> as the default for single-state controls.
            Free text allowed.
          } @else {
            Pick a source entity above to load its available data points.
          }
        </span>
      </div>

      <div class="field-row">
        <label>Mapping Expression</label>
        <kendo-textbox [(value)]="model().mappingExpression"
          placeholder="e.g. value, value / 100, value > 50 ? 1 : 0">
        </kendo-textbox>
        <span class="hint">Optional. mXparser expression. <code>value</code> = raw source value.</span>
      </div>

      <div class="field-row">
        <label>Target Entity</label>
        @if (model().targetRtId) {
          <div class="entity-display">
            <div class="entity-main">
              <span class="entity-name">{{ model().targetName || model().targetRtId }}</span>
              <button kendoButton fillMode="flat" size="small"
                (click)="pickTarget()">Change…</button>
            </div>
            <div class="entity-meta">
              <span>{{ model().targetCkTypeId }}</span>
              <span class="sep">&#64;</span>
              <span>{{ model().targetRtId }}</span>
            </div>
          </div>
        } @else {
          <div class="entity-display empty">
            <span class="hint">No target entity linked.</span>
            <button kendoButton fillMode="flat" size="small"
              (click)="pickTarget()">Select…</button>
          </div>
        }
      </div>

      <div class="field-row">
        <label>
          Target Attribute Path
          @if (targetAttributesLoading()) { <span class="loading-pill">loading…</span> }
        </label>
        <div class="combo-row">
          <kendo-combobox
            [data]="targetAttributeList()"
            [value]="model().targetAttributePath"
            (valueChange)="onTargetAttributePathChange($event)"
            [textField]="'attributePath'"
            [valueField]="'attributePath'"
            [valuePrimitive]="true"
            [allowCustom]="true"
            [filterable]="true"
            (filterChange)="onTargetAttributeFilter($event)"
            [popupSettings]="{ appendTo: 'root', animate: true }"
            placeholder="e.g. Temperature, CO2Level">
            <ng-template kendoComboBoxItemTemplate let-item>
              <div class="attribute-option">
                <span class="attribute-path">{{ item.attributePath }}</span>
                <span class="attribute-type">{{ item.attributeValueType }}</span>
              </div>
            </ng-template>
          </kendo-combobox>
          <button kendoButton fillMode="flat" size="small"
            [svgIcon]="icons.browse"
            [disabled]="!effectiveTargetCkTypeId()"
            (click)="browseTargetAttribute()"
            title="Browse all attributes (incl. navigation properties)"></button>
        </div>
        <span class="hint">
          @if (effectiveTargetCkTypeId(); as t) {
            Direct attributes on <code>{{ t }}</code>. Click the browse button
            for navigation properties or to escape autocomplete.
          } @else {
            Pick a target entity above to see available attribute paths.
          }
        </span>
      </div>

      </div>
      <div class="dialog-actions">
        <button kendoButton (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()"
          [disabled]="!isValid()">Save</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .mapping-edit {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }

    .mapping-edit-body {
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

    .combo-row {
      display: flex;
      align-items: stretch;
      gap: 4px;

      kendo-combobox {
        flex: 1;
      }
    }

    .attribute-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 8px;
    }

    .attribute-option .attribute-path {
      flex: 1;
      font-family: monospace;
      font-size: 0.85rem;
    }

    .attribute-option .attribute-type {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 8px;
      background: color-mix(in srgb,
        var(--theme-bg-elevated, var(--kendo-color-surface-alt, #f0f0f0)) 80%,
        transparent);
      color: var(--theme-text-secondary, var(--kendo-color-subtle, #888));
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
  `],
})
export class MappingEditDialogComponent {
  private readonly windowRef = inject(WindowRef);
  private readonly entitySelector = inject(EntitySelectorDialogService);
  private readonly attributeSelectorDialog = inject(AttributeSelectorDialogService);
  private readonly attributeService = inject(AttributeSelectorService);

  protected readonly icons = {
    link: hyperlinkOpenIcon,
    browse: folderOpenIcon,
    regenerate: arrowRotateCwIcon,
  };

  /** Set by the service before the dialog content is shown. */
  public data: MappingEditDialogData = {
    mapping: this.emptyValue(),
  };

  /** Reactive working copy — the form binds to this. */
  protected readonly model = signal<MappingEditValue>(this.emptyValue());

  /** Target CK-type attribute catalogue. The source side is now handled by
   *  the dedicated {@link DataPointPickerComponent}, which loads runtime state
   *  names from the entity itself instead of CK schema attributes. */
  private readonly targetAttributes = signal<AttributeItem[]>([]);
  private readonly targetFilter = signal<string>('');
  protected readonly targetAttributesLoading = signal(false);

  protected readonly targetAttributeList = computed(() =>
    filterAttributes(this.targetAttributes(), this.targetFilter()),
  );

  /**
   * Effective target CK type id — prefers the value picked by the user via
   * {@link pickTarget}; falls back to the optional {@link MappingEditDialogData.targetCkTypeId}
   * legacy default. Drives the Target Attribute Path autocomplete dropdown.
   */
  protected readonly effectiveTargetCkTypeId = computed<string | undefined>(() =>
    this.model().targetCkTypeId ?? this.data.targetCkTypeId,
  );

  public initialise(data: MappingEditDialogData): void {
    this.data = data;
    // Seed mapping.targetCkTypeId from the legacy data field when the caller
    // hasn't set it yet — covers the tree-context flow where the dialog was
    // opened for a fixed target node and the value was passed via data.
    const seededTargetCkTypeId = data.mapping.targetCkTypeId ?? data.targetCkTypeId;
    this.model.set({
      ...data.mapping,
      targetCkTypeId: seededTargetCkTypeId,
      _originalSourceRtId: data.mapping.sourceRtId,
      _originalSourceCkTypeId: data.mapping.sourceCkTypeId,
      _originalTargetRtId: data.mapping.targetRtId,
      _originalTargetCkTypeId: data.mapping.targetCkTypeId,
    });
    if (seededTargetCkTypeId) {
      void this.loadTargetAttributes(seededTargetCkTypeId);
    }
  }

  /**
   * Enabled when at least one labelled side of the mapping is filled enough
   * to produce a meaningful name. We require *some* identifying info on each
   * end so the generated name isn't just "(unset) → (unset)".
   */
  protected canGenerateName(): boolean {
    const m = this.model();
    const sourceLabel = m.sourceName || m.sourceRtId;
    const targetLabel = m.targetName || m.targetRtId;
    return !!(sourceLabel && targetLabel);
  }

  /**
   * Writes a deterministic, human-readable name into the mapping based on the
   * current source/target selection. Format:
   *   `{sourceName} {sourcePath} → {targetName} {targetPath}`
   * Falls back to rtId fragments when names are missing. The user can still
   * edit the result freely — this just gives them a sensible starting point
   * so they don't have to invent a name from scratch when finishing an
   * orphan-tab mapping.
   */
  protected generateName(): void {
    const m = this.model();
    const source = describeEnd(m.sourceName, m.sourceRtId, m.sourceAttributePath);
    const target = describeEnd(m.targetName, m.targetRtId, m.targetAttributePath);
    if (!source && !target) return;
    const generated = `${source || '(no source)'} → ${target || '(no target)'}`;
    this.model.update(curr => ({ ...curr, name: generated }));
  }

  protected isValid(): boolean {
    const m = this.model();
    // Both ends must be linked and the target attribute path filled — a
    // mapping without these can't actually fire on the runtime side.
    if (!m.sourceRtId || !m.sourceCkTypeId) return false;
    if (!m.targetRtId || !m.targetCkTypeId) return false;
    return !!m.targetAttributePath && m.targetAttributePath.trim().length > 0;
  }

  protected async pickSource(): Promise<void> {
    const current = this.model();
    const result = await this.entitySelector.openEntitySelector({
      title: 'Select Source Entity',
      currentTargetRtId: current.sourceRtId,
      currentTargetCkTypeId: current.sourceCkTypeId,
    });
    if (!result.confirmed || !result.entity) return;
    const changedType = result.entity.ckTypeId !== current.sourceCkTypeId;
    this.model.update(m => ({
      ...m,
      sourceRtId: result.entity!.rtId,
      sourceCkTypeId: result.entity!.ckTypeId,
      sourceName: result.entity!.name ?? result.entity!.rtId,
      // Reset the path when the type changes — the previous attribute likely
      // doesn't exist on the new type.
      sourceAttributePath: changedType ? '' : m.sourceAttributePath,
    }));
    // The data-point picker watches sourceCkTypeId/sourceRtId and refreshes
    // its option list on its own — no extra wiring needed here.
  }

  protected async pickTarget(): Promise<void> {
    const current = this.model();
    const result = await this.entitySelector.openEntitySelector({
      title: 'Select Target Entity',
      currentTargetRtId: current.targetRtId,
      currentTargetCkTypeId: current.targetCkTypeId,
    });
    if (!result.confirmed || !result.entity) return;
    const changedType = result.entity.ckTypeId !== current.targetCkTypeId;
    this.model.update(m => ({
      ...m,
      targetRtId: result.entity!.rtId,
      targetCkTypeId: result.entity!.ckTypeId,
      targetName: result.entity!.name ?? result.entity!.rtId,
      targetAttributePath: changedType ? '' : m.targetAttributePath,
    }));
    if (changedType) {
      this.targetFilter.set('');
      void this.loadTargetAttributes(result.entity.ckTypeId);
    }
  }

  protected onSourceAttributePathChange(value: string): void {
    this.model.update(m => ({ ...m, sourceAttributePath: value }));
  }

  protected onTargetAttributePathChange(value: string | null): void {
    this.model.update(m => ({ ...m, targetAttributePath: value ?? '' }));
  }

  protected onTargetAttributeFilter(filter: string): void {
    this.targetFilter.set(filter);
  }

  protected onSave(): void {
    if (!this.isValid()) return;
    const result: MappingEditDialogResult = { confirmed: true, mapping: this.model() };
    this.windowRef.close(result);
  }

  protected onCancel(): void {
    const result: MappingEditDialogResult = { confirmed: false };
    this.windowRef.close(result);
  }

  /**
   * Fetches the CK-schema attribute catalogue for the target side and stores
   * it for the target combobox dropdown. Navigation properties are excluded —
   * they drown out the direct attributes; the browse button below opens the
   * full {@link AttributeSelectorDialog} for users who need a deep path.
   *
   * (The source side now uses {@link DataPointPickerComponent}, which queries
   * the runtime entity's States RecordArray directly — runtime data points,
   * not CK schema attributes, are what the runtime engine matches against.)
   */
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

  protected async browseTargetAttribute(): Promise<void> {
    const ckTypeId = this.effectiveTargetCkTypeId();
    if (!ckTypeId) return;
    const current = this.model().targetAttributePath;
    const result = await this.attributeSelectorDialog.openAttributeSelector(
      ckTypeId,
      current ? [current] : undefined,
      'Select Target Attribute Path',
      true, // singleSelect
    );
    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.model.update(m => ({
        ...m,
        targetAttributePath: result.selectedAttributes[0].attributePath,
      }));
    }
  }

  private emptyValue(): MappingEditValue {
    return {
      rtId: '',
      ckTypeId: '',
      name: '',
      enabled: true,
      sourceAttributePath: '',
      mappingExpression: '',
      targetAttributePath: '',
    };
  }
}

/**
 * Client-side filter mirroring the substring search Kendo's combobox does
 * internally. Centralised here so the dropdown still shows a reasonable list
 * when the user types a path that hasn't been seen on this CK type yet.
 */
function filterAttributes(all: AttributeItem[], filter: string): AttributeItem[] {
  if (!filter || filter.trim().length === 0) return all;
  const needle = filter.toLowerCase();
  return all.filter(a => a.attributePath.toLowerCase().includes(needle));
}

/**
 * Produces the "{label} {path}" fragment used on either side of the generated
 * mapping name. Uses the entity name when present; otherwise a shortened rtId
 * suffix (last 6 hex chars) keeps the name compact while staying identifiable.
 * Returns an empty string when nothing useful is available.
 */
function describeEnd(
  entityName: string | undefined,
  rtId: string | undefined,
  attributePath: string,
): string {
  const label = entityName?.trim() || (rtId ? `…${rtId.slice(-6)}` : '');
  const path = attributePath?.trim();
  if (label && path) return `${label} ${path}`;
  return label || path || '';
}
