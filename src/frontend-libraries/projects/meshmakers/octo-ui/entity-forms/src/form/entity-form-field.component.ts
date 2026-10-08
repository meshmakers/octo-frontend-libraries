import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { formatSecretStatus } from '@meshmakers/octo-services';
import { EntityFormsMessages, formatEntityFormsMessage, secretStatusLabelsOf } from '../entity-forms.messages';
import { ResolvedField } from '../models/entity-form.models';
import { firstErrorKey } from './entity-form-controls';

/**
 * Secret state shown next to a secret field (AB#5542 / AB#5544 item 4): set on the server, not set
 * (`needsReEntry` for a required SECRET — same wording as the secrets inventory),
 * stored but unreadable (`keyMissing`, re-entry needed), clear staged for the next save, or `null`
 * (not a secret, or create mode — then the plain "Secret" badge is shown).
 */
export type EntityFormSecretState = 'set' | 'notSet' | 'needsReEntry' | 'keyMissing' | 'clearStaged' | null;

/**
 * Field shell of `mm-entity-form`: label (with required marker and secret badge), the projected
 * editor, help text and the first validation error. Purely presentational; the parent bumps
 * `revision` whenever the form's value, status or touched state changes so this OnPush shell
 * re-renders its error line.
 */
@Component({
  selector: 'mm-entity-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mm-ef-field',
    '[class.mm-ef-field--full]': "field().width === 'full'",
    '[class.mm-ef-field--half]': "field().width === 'half'",
    '[class.mm-ef-field--invalid]': 'errorText() !== null',
    '[class.mm-ef-field--readonly]': 'readOnly()',
    '[attr.data-field-key]': 'field().key',
  },
  template: `
    <div class="mm-ef-field__label-row">
      <label class="mm-ef-field__label">
        {{ field().label }}
        @if (showRequired()) {
          <span class="mm-ef-field__required" aria-hidden="true">*</span>
        }
      </label>
      @if (field().secret) {
        <span
          class="mm-ef-field__badge"
          [class.mm-ef-field__badge--set]="secretState() === 'set'"
          [class.mm-ef-field__badge--not-set]="secretState() === 'notSet' || secretState() === 'needsReEntry'"
          [class.mm-ef-field__badge--key-missing]="secretState() === 'keyMissing'"
          [class.mm-ef-field__badge--clear-staged]="secretState() === 'clearStaged'"
          [attr.data-secret-state]="secretState()"
          [attr.title]="messages().secretHelp"
        >{{ secretBadgeText() }}</span>
      }
    </div>
    <div class="mm-ef-field__editor">
      <ng-content></ng-content>
    </div>
    @if (errorText(); as err) {
      <div class="mm-ef-field__error" role="alert">{{ err }}</div>
    } @else if (field().help) {
      <div class="mm-ef-field__help">{{ field().help }}</div>
    }
  `,
})
export class EntityFormFieldComponent {
  readonly field = input.required<ResolvedField>();
  readonly control = input<AbstractControl | null>(null);
  readonly messages = input.required<EntityFormsMessages>();
  readonly secretState = input<EntityFormSecretState>(null);
  /** When the current secret value was set (badge "Set · set at …"); null for legacy values. */
  readonly secretSetAt = input<Date | null>(null);
  readonly readOnly = input(false);
  /** Whether the field is required in the current mode (secrets: only when not set). */
  readonly required = input(false);
  /** Change counter from the parent form; read so `errorText` recomputes on every form event. */
  readonly revision = input(0);

  private readonly locale = inject(LOCALE_ID);

  protected readonly showRequired = computed(() => this.required() && !this.readOnly());

  /**
   * Badge text: visible to read-only users too (Q15). Set / not set / key missing use the shared
   * octo-services `formatSecretStatus` (one wording everywhere; labels from the messages).
   */
  protected readonly secretBadgeText = computed(() => {
    const m = this.messages();
    const state = this.secretState();
    switch (state) {
      case 'set':
      case 'notSet':
      case 'keyMissing':
        return formatSecretStatus(
          { isSet: state === 'set', keyMissing: state === 'keyMissing', setAt: state === 'set' ? this.secretSetAt() : null },
          (date) => formatDate(date, 'medium', this.locale),
          secretStatusLabelsOf(m),
        );
      case 'needsReEntry':
        return m.secretStatusNeedsReEntry;
      case 'clearStaged':
        return m.secretStatusClearStaged;
      default:
        return m.secretBadge;
    }
  });

  protected readonly errorText = computed<string | null>(() => {
    this.revision();
    const control = this.control();
    if (!control || control.disabled || !control.invalid || !(control.touched || control.dirty)) {
      return null;
    }
    const key = firstErrorKey(control.errors);
    const m = this.messages();
    const f = this.field();
    switch (key) {
      case null:
        return null;
      case 'required':
        return m.validationRequired;
      case 'min':
        return formatEntityFormsMessage(m.validationMin, { min: f.min ?? '' });
      case 'max':
        return formatEntityFormsMessage(m.validationMax, { max: f.max ?? '' });
      case 'pattern':
        return formatEntityFormsMessage(m.validationPattern, { pattern: f.pattern ?? '' });
      case 'email':
        return m.validationEmail;
      case 'url':
        return m.validationUrl;
      case 'json':
        return m.validationJson;
      default:
        return m.formInvalid;
    }
  });
}
