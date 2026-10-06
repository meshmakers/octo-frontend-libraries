import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { KENDO_BUTTON } from '@progress/kendo-angular-buttons';
import { KENDO_TEXTAREA, KENDO_TEXTBOX } from '@progress/kendo-angular-inputs';
import { EntityFormsMessages, formatEntityFormsMessage } from '../../entity-forms.messages';

/**
 * Editor of a write-only secret field (AB#5542, AB#5544 item 4, decisions 2026-10-06 Q8/Q10/Q15/Q17).
 *
 * - The stored value is never shown or prefilled; the status badge lives in the field shell.
 * - "Show" reveals only the value the user typed in this session (never a stored value); it is
 *   disabled while the input is empty and resets when the input is emptied.
 * - "Clear" stages removing an optional secret; the parent sends it on Save as
 *   `clearSecretAttributes`. Clear and a new value are mutually exclusive: Clear is disabled while a
 *   value is typed, and the input is replaced by a note with "Undo" while a clear is staged.
 * - `multiline` renders a monospace text area (PEM keys, `EntityFormField.Editor: multiline`). It is
 *   masked by rendering the text transparent (caret, selection and placeholder stay visible) and a
 *   status line says how many lines were entered. This works in every browser — unlike
 *   `-webkit-text-security`, which Firefox does not reliably support and which cannot keep line
 *   breaks visible; an `<input type="password">` would drop the PEM line breaks.
 * - The placeholder is also the input's tooltip, so it stays readable when a narrow panel (Data
 *   Explorer peek) truncates it.
 * - Read-only users get no editor at all (the badge is enough); without a key ring the input is
 *   disabled and a hint explains why (`writesDisabled`, the parent disables the control).
 */
@Component({
  selector: 'mm-entity-form-secret-editor',
  standalone: true,
  imports: [ReactiveFormsModule, KENDO_TEXTBOX, KENDO_TEXTAREA, KENDO_BUTTON],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mm-ef-secret' },
  template: `
    @if (!readOnly()) {
      @if (clearStaged()) {
        <div class="mm-ef-secret__staged" data-secret-clear-staged>
          <span>{{ messages().secretClearStagedNote }}</span>
          <button kendoButton type="button" size="small" fillMode="flat" data-secret-undo (click)="clearStagedChange.emit(false)">
            {{ messages().secretUndoClear }}
          </button>
        </div>
      } @else {
        <div class="mm-ef-secret__row">
          @if (multiline()) {
            <kendo-textarea
              class="mm-ef-mono mm-ef-secret__input"
              [class.mm-ef-secret__input--masked]="!revealed()"
              [formControl]="control()"
              [rows]="6"
              resizable="vertical"
              [placeholder]="placeholder()"
              [inputAttributes]="{ autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', 'data-secret-input': 'multiline' }"
              [attr.title]="placeholder() || null"
            ></kendo-textarea>
          } @else {
            <kendo-textbox
              class="mm-ef-secret__input"
              [formControl]="control()"
              [type]="revealed() ? 'text' : 'password'"
              [placeholder]="placeholder()"
              [inputAttributes]="{ autocomplete: 'new-password', spellcheck: 'false', 'data-secret-input': 'single' }"
              [attr.title]="placeholder() || null"
            ></kendo-textbox>
          }
          <button
            kendoButton
            type="button"
            size="small"
            fillMode="flat"
            data-secret-show
            [disabled]="!hasTypedValue()"
            [attr.aria-pressed]="revealed()"
            (click)="shown.set(!shown())"
          >{{ revealed() ? messages().secretHide : messages().secretShow }}</button>
          @if (canClear()) {
            <button
              kendoButton
              type="button"
              size="small"
              fillMode="flat"
              data-secret-clear
              [disabled]="hasTypedValue() || writesDisabled()"
              (click)="clearStagedChange.emit(true)"
            >{{ messages().secretClear }}</button>
          }
        </div>
      }
      @if (multiline() && !clearStaged() && hasTypedValue() && !revealed()) {
        <div class="mm-ef-secret__masked" data-secret-masked-status>{{ maskedStatus() }}</div>
      }
      @if (writesDisabled()) {
        <div class="mm-ef-secret__hint" data-secret-writes-disabled>{{ messages().secretWritesDisabled }}</div>
      }
    }
  `,
})
export class EntityFormSecretEditorComponent {
  readonly control = input.required<FormControl<unknown>>();
  readonly messages = input.required<EntityFormsMessages>();
  readonly placeholder = input('');
  readonly multiline = input(false);
  readonly readOnly = input(false);
  /** Offer "Clear": optional SECRET with a stored value, edit mode, write access. */
  readonly canClear = input(false);
  readonly clearStaged = input(false);
  /** No key ring (Q17): the input is disabled by the parent; this shows the hint. */
  readonly writesDisabled = input(false);
  /** Change counter of the parent form, read so `hasTypedValue` follows the control value. */
  readonly revision = input(0);

  readonly clearStagedChange = output<boolean>();

  /** The user asked to reveal the typed value. */
  protected readonly shown = signal(false);

  protected readonly hasTypedValue = computed(() => {
    this.revision();
    const v = this.control().value;
    return typeof v === 'string' && v.length > 0;
  });

  /** Only a typed value can be revealed; emptying the input masks it again. */
  protected readonly revealed = computed(() => this.shown() && this.hasTypedValue());

  /** Status line of a masked multiline value: the number of lines, never the content. */
  protected readonly maskedStatus = computed(() => {
    this.revision();
    const v = this.control().value;
    const lines = typeof v === 'string' && v.length > 0 ? v.split(/\r\n|\r|\n/).length : 0;
    return formatEntityFormsMessage(this.messages().secretMultilineMasked, { lines });
  });

  constructor() {
    effect(() => {
      if (!this.hasTypedValue()) {
        this.shown.set(false);
      }
    });
  }
}
