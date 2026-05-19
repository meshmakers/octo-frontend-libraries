import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ComboBoxModule } from '@progress/kendo-angular-dropdowns';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { SwitchModule, TextBoxModule } from '@progress/kendo-angular-inputs';
import { folderOpenIcon, hyperlinkOpenIcon } from '@progress/kendo-svg-icons';
import { AttributeItem, AttributeSelectorService } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { AttributeSelectorDialogService } from '../../../attribute-selector-dialog/attribute-selector-dialog.service';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';

/**
 * Editable view-model for one DataPointMapping. The fields here mirror the
 * CK attributes (Name, Enabled, SourceAttributePath, MappingExpression,
 * TargetAttributePath) plus the MapsFrom source-entity reference. The
 * `_originalSourceRtId`/`_originalSourceCkTypeId` snapshots let the caller
 * decide whether the MapsFrom association needs an update on save.
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
  targetAttributePath: string;
  /** Source rtId at dialog-open time — used to detect MapsFrom changes. */
  _originalSourceRtId?: string;
  _originalSourceCkTypeId?: string;
}

export interface MappingEditDialogData {
  mapping: MappingEditValue;
  title?: string;
  /**
   * CK type id of the target entity (the tree node the mapping points to via
   * MapsTo). Used to populate the Target Attribute Path autocomplete.
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
  ],
  template: `
    <div class="mapping-edit">
      <div class="mapping-edit-body">
      <div class="field-row">
        <label>Name</label>
        <kendo-textbox [(value)]="model().name"
          placeholder="Mapping name">
        </kendo-textbox>
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
        <label>
          Source Attribute Path
          @if (sourceAttributesLoading()) { <span class="loading-pill">loading…</span> }
        </label>
        <div class="combo-row">
          <kendo-combobox
            [data]="sourceAttributeList()"
            [value]="model().sourceAttributePath"
            (valueChange)="onSourceAttributePathChange($event)"
            [textField]="'attributePath'"
            [valueField]="'attributePath'"
            [valuePrimitive]="true"
            [allowCustom]="true"
            [filterable]="true"
            (filterChange)="onSourceAttributeFilter($event)"
            [popupSettings]="{ appendTo: 'root', animate: true }"
            placeholder="e.g. tempActual, CurrentValue">
            <ng-template kendoComboBoxItemTemplate let-item>
              <div class="attribute-option">
                <span class="attribute-path">{{ item.attributePath }}</span>
                <span class="attribute-type">{{ item.attributeValueType }}</span>
              </div>
            </ng-template>
          </kendo-combobox>
          <button kendoButton fillMode="flat" size="small"
            [svgIcon]="icons.browse"
            [disabled]="!model().sourceCkTypeId"
            (click)="browseSourceAttribute()"
            title="Browse all attributes (incl. navigation properties)"></button>
        </div>
        <span class="hint">
          @if (model().sourceCkTypeId) {
            Direct attributes on <code>{{ model().sourceCkTypeId }}</code>. Click
            the browse button for navigation properties or to escape autocomplete.
          } @else {
            Pick a source entity above to see available attribute paths.
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
            [disabled]="!targetCkTypeId"
            (click)="browseTargetAttribute()"
            title="Browse all attributes (incl. navigation properties)"></button>
        </div>
        <span class="hint">
          @if (targetCkTypeId) {
            Direct attributes on <code>{{ targetCkTypeId }}</code>. Click the
            browse button for navigation properties or to escape autocomplete.
          } @else {
            Attribute on the target entity to update.
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
  };

  /** Set by the service before the dialog content is shown. */
  public data: MappingEditDialogData = {
    mapping: this.emptyValue(),
  };

  /** Reactive working copy — the form binds to this. */
  protected readonly model = signal<MappingEditValue>(this.emptyValue());

  /** Full attribute catalogue per ck type — captured once when the type loads. */
  private readonly sourceAttributes = signal<AttributeItem[]>([]);
  private readonly targetAttributes = signal<AttributeItem[]>([]);

  /** Filter strings driven by combobox typing. */
  private readonly sourceFilter = signal<string>('');
  private readonly targetFilter = signal<string>('');

  protected readonly sourceAttributesLoading = signal(false);
  protected readonly targetAttributesLoading = signal(false);

  protected readonly sourceAttributeList = computed(() =>
    filterAttributes(this.sourceAttributes(), this.sourceFilter()),
  );
  protected readonly targetAttributeList = computed(() =>
    filterAttributes(this.targetAttributes(), this.targetFilter()),
  );

  /** Exposes ck type to the template hint without needing data() re-reads. */
  protected get targetCkTypeId(): string | undefined {
    return this.data.targetCkTypeId;
  }

  public initialise(data: MappingEditDialogData): void {
    this.data = data;
    this.model.set({
      ...data.mapping,
      _originalSourceRtId: data.mapping.sourceRtId,
      _originalSourceCkTypeId: data.mapping.sourceCkTypeId,
    });
    if (data.mapping.sourceCkTypeId) {
      void this.loadAttributes(data.mapping.sourceCkTypeId, 'source');
    }
    if (data.targetCkTypeId) {
      void this.loadAttributes(data.targetCkTypeId, 'target');
    }
  }

  protected isValid(): boolean {
    const m = this.model();
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
    if (changedType) {
      this.sourceFilter.set('');
      void this.loadAttributes(result.entity.ckTypeId, 'source');
    }
  }

  protected onSourceAttributePathChange(value: string | null): void {
    this.model.update(m => ({ ...m, sourceAttributePath: value ?? '' }));
  }

  protected onTargetAttributePathChange(value: string | null): void {
    this.model.update(m => ({ ...m, targetAttributePath: value ?? '' }));
  }

  protected onSourceAttributeFilter(filter: string): void {
    this.sourceFilter.set(filter);
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
   * Fetches the attribute catalogue for one CK type and stores it for the
   * combobox dropdown. Navigation properties are explicitly excluded — they
   * drown out the actual direct attributes (the column resolver expands one
   * row per association target, which can produce hundreds of paths even on
   * a small type like EnergyIQ/Space). Users who really want a navigation
   * path can open the full Attribute Selector dialog via the browse button.
   *
   * The combobox already does client-side substring filtering on the
   * populated list, so we don't refetch on every keystroke.
   */
  private async loadAttributes(ckTypeId: string, slot: 'source' | 'target'): Promise<void> {
    const loadingSig = slot === 'source' ? this.sourceAttributesLoading : this.targetAttributesLoading;
    const dataSig = slot === 'source' ? this.sourceAttributes : this.targetAttributes;
    loadingSig.set(true);
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
      dataSig.set(result.items);
    } catch (err) {
      console.error(`Failed to load ${slot} attributes for ${ckTypeId}:`, err);
      dataSig.set([]);
    } finally {
      loadingSig.set(false);
    }
  }

  /**
   * Opens the full AttributeSelectorDialog in single-select mode for the
   * configured CK type. The dialog exposes its own controls for navigation
   * properties and max depth, so power users who need a deep path can find
   * it there even though the inline combobox keeps things flat.
   */
  protected async browseSourceAttribute(): Promise<void> {
    const ckTypeId = this.model().sourceCkTypeId;
    if (!ckTypeId) return;
    const current = this.model().sourceAttributePath;
    const result = await this.attributeSelectorDialog.openAttributeSelector(
      ckTypeId,
      current ? [current] : undefined,
      'Select Source Attribute Path',
      true, // singleSelect
    );
    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.model.update(m => ({
        ...m,
        sourceAttributePath: result.selectedAttributes[0].attributePath,
      }));
    }
  }

  protected async browseTargetAttribute(): Promise<void> {
    const ckTypeId = this.data.targetCkTypeId;
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
