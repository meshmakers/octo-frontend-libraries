import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { EntityFormGetReferenceOptionsDtoGQL } from '../../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetReferenceOptionsWithAttributesDtoGQL } from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { EntityFormsMessages, formatEntityFormsMessage, mergeEntityFormsMessages } from '../../entity-forms.messages';
import { EntityReferenceDataSource, EntityReferenceItem } from './entity-reference-data-source';
import type { CkAttributeInfo } from '../../models/entity-form.models';

/** One selected reference target. The field value is always an array of these. */
export interface EntityFormReferenceValue {
  rtId: string;
  ckTypeId: string;
  displayName: string;
}

function toValue(item: EntityReferenceItem | EntityFormReferenceValue): EntityFormReferenceValue {
  return { rtId: item.rtId, ckTypeId: item.ckTypeId, displayName: item.displayName };
}

/**
 * Reference editor of `mm-entity-form` (association roles and rtId-holding STRING attributes).
 *
 * - **Value:** `EntityFormReferenceValue[]` (`{ rtId, ckTypeId, displayName }`), an array even for
 *   single selection; `[]` when nothing is selected.
 * - **Limit:** with `multiple = false` a new pick replaces the current one, so the value never
 *   grows beyond one entry; a written value with more entries is reported by the validator as
 *   `{ maxItems: { max: 1, actual } }`. With `multiple = true` picks are appended, de-duplicated by
 *   `rtId`.
 * - **Picker:** shared-ui `mm-entity-select-input` (typeahead plus grid dialog) over the
 *   secret-safe {@link EntityReferenceDataSource}, which selects only the non-secret `name` attribute of the targets.
 * - **Display attributes:** with `displayAttributes` the picker rows and the current value read
 *   `name · value1 · value2`, each value formatted by its CK value type (`displayAttributeInfo`):
 *   enum names, yes/no, dates. The current value's label is looked up once per rtId; it only
 *   changes what is shown, never the field value.
 */
@Component({
  selector: 'mm-entity-form-reference-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonsModule, EntitySelectInputComponent],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EntityFormReferenceFieldComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => EntityFormReferenceFieldComponent), multi: true }
  ],
  template: `
    <div class="mm-efref" [class.mm-efref--disabled]="isDisabled()">
      @if (value().length > 0) {
        <ul class="mm-efref-list">
          @for (item of value(); track item.rtId) {
            <li class="mm-efref-item" [attr.data-rtid]="item.rtId">
              <span class="mm-efref-name" [title]="labelOf(item) + ' (' + item.ckTypeId + ' · ' + item.rtId + ')'">{{ labelOf(item) }}</span>
              @if (!isDisabled()) {
                <button kendoButton type="button" fillMode="flat" size="small" class="mm-efref-remove"
                        [attr.aria-label]="msg().remove + ' ' + labelOf(item)" [title]="msg().remove"
                        (click)="remove(item.rtId)">×</button>
              }
            </li>
          }
        </ul>
      } @else if (isDisabled()) {
        <span class="mm-efref-empty">{{ msg().emptyReferences }}</span>
      }
      @if (!isDisabled() && dataSource(); as ds) {
        <mm-entity-select-input
          class="mm-efref-input"
          [dataSource]="ds"
          [dialogDataSource]="ds"
          [multiSelect]="multiple()"
          [minSearchLength]="1"
          [placeholder]="placeholder() || msg().referencePlaceholder"
          [dialogTitle]="msg().select"
          (entitySelected)="onPicked([$event])"
          (entitiesSelected)="onPicked($event)">
        </mm-entity-select-input>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .mm-efref { display: flex; flex-direction: column; gap: 6px; }
    .mm-efref-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .mm-efref-item {
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 10px;
      border: 1px solid var(--theme-border-subtle); border-radius: 12px;
      background: var(--theme-bg-elevated); color: var(--theme-text-primary);
    }
    .mm-efref--disabled .mm-efref-item { padding-right: 10px; }
    .mm-efref-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
    .mm-efref-remove { min-width: 0; padding: 0 4px; line-height: 1; }
    .mm-efref-empty { color: var(--theme-text-secondary); font-style: italic; }
  `]
})
export class EntityFormReferenceFieldComponent implements ControlValueAccessor, Validator {
  private readonly gql = inject(EntityFormGetReferenceOptionsDtoGQL);
  private readonly attributesGql = inject(EntityFormGetReferenceOptionsWithAttributesDtoGQL);

  readonly targetCkTypeId = input.required<string>();
  readonly multiple = input(false);
  /** Non-secret target attributes shown next to the name (AB#5547). */
  readonly displayAttributes = input<readonly string[]>([]);
  /** CK metadata of the display attributes on the target type; formats their values (AB#5547). */
  readonly displayAttributeInfo = input<readonly CkAttributeInfo[]>([]);
  readonly placeholder = input<string | null | undefined>(undefined);
  readonly readOnly = input(false);
  readonly messages = input<Partial<EntityFormsMessages>>({});

  protected readonly msg = computed(() => mergeEntityFormsMessages(this.messages()));
  protected readonly value = signal<EntityFormReferenceValue[]>([]);
  private readonly disabledByForm = signal(false);
  protected readonly isDisabled = computed(() => this.readOnly() || this.disabledByForm());
  /** Labels with display attributes, by rtId (from picks and from lookups of the current value). */
  private readonly labels = signal<ReadonlyMap<string, string>>(new Map());
  private readonly requested = new Set<string>();

  /** One data source per target type. */
  readonly dataSource = computed(() => {
    const target = this.targetCkTypeId();
    if (!target) {
      return null;
    }
    const m = this.msg();
    return new EntityReferenceDataSource(this.gql, target, {
      name: m.columnName,
      wellKnownName: m.columnWellKnownName,
      type: m.columnType,
      rtId: m.copyRtId
    }, this.displayAttributes(), this.attributesGql, {
      attributes: this.displayAttributeInfo(),
      yes: m.toggleOn,
      no: m.toggleOff
    });
  });

  constructor() {
    // The current value comes with the plain name only; read the display attributes of its targets.
    effect(() => {
      const ds = this.dataSource();
      const ids = this.value().map(v => v.rtId);
      if (!ds || !ds.displayAttributes.length) {
        return;
      }
      untracked(() => this.lookupLabels(ds, ids));
    });
  }

  /** Label shown for a selected target: with display attributes when known, else its display name. */
  labelOf(item: EntityFormReferenceValue): string {
    return this.labels().get(item.rtId) ?? item.displayName;
  }

  private readonly selectInput = viewChild(EntitySelectInputComponent);
  private onChange: (value: EntityFormReferenceValue[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  /** Current value (a copy). */
  getValue(): EntityFormReferenceValue[] {
    return [...this.value()];
  }

  writeValue(value: EntityFormReferenceValue[] | null | undefined): void {
    this.value.set(Array.isArray(value) ? value.filter(v => !!v?.rtId).map(toValue) : []);
  }

  registerOnChange(fn: (value: EntityFormReferenceValue[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    const count = this.value().length;
    if (!this.multiple() && count > 1) {
      return { maxItems: { max: 1, actual: count, message: formatEntityFormsMessage(this.msg().validationMaxItems, { max: 1 }) } };
    }
    return null;
  }

  /** Applies picked entities: replaces in single mode (first pick wins), appends unique in multi mode. */
  onPicked(items: (EntityReferenceItem | EntityFormReferenceValue)[] | null | undefined): void {
    const picked = (items ?? []).filter(i => !!i?.rtId).map(toValue);
    if (this.isDisabled() || picked.length === 0) {
      return;
    }
    if (this.displayAttributes().length) {
      // Picker rows already carry the display attributes in their label.
      this.labels.update(current => new Map([...current, ...picked.map(p => [p.rtId, p.displayName] as const)]));
    }
    let next: EntityFormReferenceValue[];
    if (this.multiple()) {
      const seen = new Set(this.value().map(v => v.rtId));
      next = [...this.value()];
      for (const item of picked) {
        if (!seen.has(item.rtId)) {
          seen.add(item.rtId);
          next.push(item);
        }
      }
    } else {
      next = [picked[0]];
    }
    this.commit(next);
    // The select input is only a picker; its own text is reset after every pick.
    this.selectInput()?.writeValue(null);
  }

  /** Removes one selected target. */
  remove(rtId: string): void {
    if (this.isDisabled()) {
      return;
    }
    this.commit(this.value().filter(v => v.rtId !== rtId));
  }

  private lookupLabels(ds: EntityReferenceDataSource, ids: string[]): void {
    const missing = ids.filter(id => !this.labels().has(id) && !this.requested.has(id));
    if (!missing.length) {
      return;
    }
    missing.forEach(id => this.requested.add(id));
    ds.lookup(missing).then(found => {
      if (found.size) {
        this.labels.update(current => new Map([...current, ...[...found.values()].map(i => [i.rtId, i.displayName] as const)]));
      }
    }).catch(() => {
      // Labels are cosmetic; the plain display name stays.
    });
  }

  private commit(next: EntityFormReferenceValue[]): void {
    const unchanged = next.length === this.value().length && next.every((v, i) => v.rtId === this.value()[i].rtId);
    this.onTouched();
    if (unchanged) {
      return;
    }
    this.value.set(next);
    this.onChange(this.getValue());
    this.onValidatorChange();
  }
}
