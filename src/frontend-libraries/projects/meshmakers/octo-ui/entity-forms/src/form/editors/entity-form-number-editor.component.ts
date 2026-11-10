import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { KENDO_TEXTBOX } from '@progress/kendo-angular-inputs';
import { IntlService } from '@progress/kendo-angular-intl';
import {
  formatLocaleNumber,
  formatLocaleNumberInput,
  LocaleNumberParse,
  LocaleNumberSymbols,
  parseLocaleNumber,
} from '../../core/locale-number';
import { ENTITY_FORMS_NUMBER_MESSAGES, EntityFormsMessages, formatEntityFormsMessage } from '../../entity-forms.messages';

/** Validation error key of a number text that does not parse; its value is `{ reason }` of the parse. */
export const NUMBER_FORMAT_ERROR = 'numberFormat';

const FALLBACK_SYMBOLS: LocaleNumberSymbols = { decimal: '.', group: ',' };

/**
 * Number editor of `mm-entity-form` (AB#8734): a text box that parses the typed text with
 * {@link parseLocaleNumber} instead of the Kendo numeric text box, which read "77.5" as 775 in a German locale.
 *
 * - "." and "," are both accepted as the decimal separator; a wrong grouping is refused (validation error
 *   {@link NUMBER_FORMAT_ERROR}), never guessed, and so is the locale's group symbol before exactly three digits
 *   ("1.234" in German: 1234 or 1,234?).
 * - Once the user edits the value, the parsed value is shown below the box in the locale's format
 *   ("Value: 77,5"), with a note when a single separator before three digits was read as a decimal separator.
 * - Value: a finite number, or `null` for an empty box and for text that does not parse (the validator then
 *   reports the error, so the form cannot be saved).
 * - The locale symbols come from Kendo's `IntlService` (the locale the Kendo inputs use).
 */
@Component({
  selector: 'mm-entity-form-number-editor',
  standalone: true,
  imports: [KENDO_TEXTBOX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EntityFormNumberEditorComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => EntityFormNumberEditorComponent), multi: true },
  ],
  template: `
    <kendo-textbox
      class="mm-ef-number"
      [value]="text()"
      [placeholder]="placeholder() ?? ''"
      [readonly]="readOnly()"
      [disabled]="disabled()"
      [inputAttributes]="{ inputmode: integer() ? 'numeric' : 'decimal' }"
      (valueChange)="onTextChange($event)"
      (blur)="onBlur()"
    ></kendo-textbox>
    @if (parsedText(); as parsed) {
      <div class="mm-ef-number__parsed" data-number-parsed aria-live="polite">{{ parsed }}</div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 4px; }
    .mm-ef-number__parsed { font-size: 12px; color: var(--theme-text-muted); }
  `],
})
export class EntityFormNumberEditorComponent implements ControlValueAccessor, Validator {
  private readonly intl = inject(IntlService, { optional: true });

  /** Whole numbers only (INT / INT_64 attributes): a non-zero fraction is refused. */
  readonly integer = input(false);
  readonly placeholder = input<string | null | undefined>(undefined);
  readonly readOnly = input(false);
  readonly messages = input.required<EntityFormsMessages>();

  protected readonly text = signal('');
  protected readonly disabled = signal(false);
  /** True once the user typed; the parsed value is shown from then on. */
  private readonly edited = signal(false);

  private readonly parse = computed<LocaleNumberParse>(() =>
    parseLocaleNumber(this.text(), { integer: this.integer(), symbols: this.symbols() }));

  /** "Value: 77,5" (with the ambiguity note when needed) while the user edits a parsable value; otherwise `null`. */
  protected readonly parsedText = computed<string | null>(() => {
    const parse = this.parse();
    if (!this.edited() || this.readOnly() || parse.kind !== 'number') {
      return null;
    }
    const m = this.messages();
    const value = formatLocaleNumber(parse.value, this.symbols());
    const text = parse.ambiguous
      ? m.numberParsedValueAmbiguous ?? ENTITY_FORMS_NUMBER_MESSAGES.numberParsedValueAmbiguous
      : m.numberParsedValue ?? ENTITY_FORMS_NUMBER_MESSAGES.numberParsedValue;
    return formatEntityFormsMessage(text, { value });
  });

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(value: unknown): void {
    const number = toNumber(value);
    const current = this.parse();
    if (number !== null && current.kind === 'number' && current.value === number) {
      return; // the text already shows this value (keep what the user typed)
    }
    this.text.set(number === null ? '' : formatLocaleNumberInput(number, this.symbols()));
    this.edited.set(false);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    const parse = this.parse();
    if (parse.kind !== 'invalid') {
      return null;
    }
    if (parse.reason === 'ambiguous') {
      // "1.234" in de-DE: name both readings in the locale ("1234" or "1,234").
      const text = this.text().trim();
      const decimal = this.symbols().decimal === ',' ? ',' : '.';
      return { [NUMBER_FORMAT_ERROR]: { reason: parse.reason, whole: text.replace(/[.,]/, ''), decimal: text.replace(/[.,]/, decimal) } };
    }
    return { [NUMBER_FORMAT_ERROR]: { reason: parse.reason } };
  }

  protected onTextChange(value: string | null | undefined): void {
    this.text.set(value ?? '');
    this.edited.set(true);
    const parse = this.parse();
    this.onChange(parse.kind === 'number' ? parse.value : null);
    this.onValidatorChange();
  }

  protected onBlur(): void {
    this.onTouched();
  }

  private symbols(): LocaleNumberSymbols {
    try {
      const symbols = this.intl?.numberSymbols() as Partial<LocaleNumberSymbols> | undefined;
      return symbols?.decimal && symbols.group ? { decimal: symbols.decimal, group: symbols.group } : FALLBACK_SYMBOLS;
    } catch {
      return FALLBACK_SYMBOLS;
    }
  }
}

/** A finite number from a form value (numbers, numeric strings), else `null`. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
