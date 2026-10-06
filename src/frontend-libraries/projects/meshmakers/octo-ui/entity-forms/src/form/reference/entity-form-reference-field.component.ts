import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { EntityFormGetReferenceOptionsDtoGQL } from '../../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetReferenceOptionsWithAttributesDtoGQL } from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { EntityFormsMessages, formatEntityFormsMessage, mergeEntityFormsMessages } from '../../entity-forms.messages';
import { EntityReferenceDataSource, EntityReferenceItem } from './entity-reference-data-source';

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
 *   secret-safe {@link EntityReferenceDataSource}, which selects no attributes of the targets.
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
              <span class="mm-efref-name" [title]="item.ckTypeId + ' · ' + item.rtId">{{ item.displayName }}</span>
              @if (!isDisabled()) {
                <button kendoButton type="button" fillMode="flat" size="small" class="mm-efref-remove"
                        [attr.aria-label]="msg().remove + ' ' + item.displayName" [title]="msg().remove"
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
  readonly placeholder = input<string | null | undefined>(undefined);
  readonly readOnly = input(false);
  readonly messages = input<Partial<EntityFormsMessages>>({});

  protected readonly msg = computed(() => mergeEntityFormsMessages(this.messages()));
  protected readonly value = signal<EntityFormReferenceValue[]>([]);
  private readonly disabledByForm = signal(false);
  protected readonly isDisabled = computed(() => this.readOnly() || this.disabledByForm());

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
    }, this.displayAttributes(), this.attributesGql);
  });

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
