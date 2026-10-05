import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { KENDO_CHIP } from '@progress/kendo-angular-buttons';
import { KENDO_TEXTBOX } from '@progress/kendo-angular-inputs';

/** Value shape of the chips editor: a flat array of strings or integers. */
export type EntityFormChipValue = string | number;

/**
 * Editor for STRING_ARRAY / INT_ARRAY attributes: a text box that adds a chip on
 * Enter or comma, and removable chips for the current items.
 *
 * With `numeric` set, input that does not parse as an integer is rejected and the
 * stored items are numbers. Duplicates are ignored. Value: `(string|number)[]`
 * (never `null`; an empty array means "no items").
 */
@Component({
  selector: 'mm-entity-form-chips-editor',
  standalone: true,
  imports: [KENDO_CHIP, KENDO_TEXTBOX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EntityFormChipsEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="mm-ef-chips">
      @if (items().length > 0) {
        <div class="mm-ef-chips__list">
          @for (item of items(); track $index) {
            <kendo-chip
              size="small"
              [label]="'' + item"
              [removable]="!disabled()"
              [disabled]="disabled()"
              (remove)="removeAt($index)"
            ></kendo-chip>
          }
        </div>
      }
      @if (!disabled()) {
        <kendo-textbox
          class="mm-ef-chips__input"
          [value]="draft()"
          [placeholder]="placeholder() ?? ''"
          (valueChange)="draft.set($event ?? '')"
          (keydown)="onKeyDown($event)"
          (blur)="onBlur()"
        ></kendo-textbox>
        @if (invalidDraft()) {
          <span class="mm-ef-chips__hint">{{ invalidMessage() }}</span>
        }
      }
      @if (disabled() && items().length === 0) {
        <span class="mm-ef-chips__empty">—</span>
      }
    </div>
  `,
  styles: [`
    .mm-ef-chips { display: flex; flex-direction: column; gap: 6px; }
    .mm-ef-chips__list { display: flex; flex-wrap: wrap; gap: 4px; }
    .mm-ef-chips__hint { font-size: 12px; color: var(--theme-status-error); }
    .mm-ef-chips__empty { color: var(--theme-text-muted); }
  `],
})
export class EntityFormChipsEditorComponent implements ControlValueAccessor {
  /** Store integers instead of strings (INT_ARRAY / INTEGER_ARRAY). */
  readonly numeric = input(false);
  readonly placeholder = input<string | null | undefined>(undefined);
  /** Shown below the input when a non-integer is entered in numeric mode. */
  readonly invalidMessage = input('Enter a whole number.');

  protected readonly items = signal<EntityFormChipValue[]>([]);
  protected readonly draft = signal('');
  protected readonly invalidDraft = signal(false);
  protected readonly disabled = signal(false);

  private onChange: (value: EntityFormChipValue[]) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  writeValue(value: unknown): void {
    this.items.set(Array.isArray(value) ? [...(value as EntityFormChipValue[])] : []);
    this.draft.set('');
    this.invalidDraft.set(false);
  }

  registerOnChange(fn: (value: EntityFormChipValue[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /** Adds the current draft (may contain several comma separated items). Returns true when something was consumed. */
  commitDraft(): boolean {
    const raw = this.draft().trim();
    if (!raw) {
      this.invalidDraft.set(false);
      return false;
    }
    const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    const parsed: EntityFormChipValue[] = [];
    for (const part of parts) {
      if (this.numeric()) {
        if (!/^[-+]?\d+$/.test(part)) {
          this.invalidDraft.set(true);
          return false;
        }
        parsed.push(parseInt(part, 10));
      } else {
        parsed.push(part);
      }
    }
    const next = [...this.items()];
    for (const p of parsed) {
      if (!next.includes(p)) {
        next.push(p);
      }
    }
    this.invalidDraft.set(false);
    this.draft.set('');
    this.emit(next);
    return true;
  }

  removeAt(index: number): void {
    const next = this.items().filter((_, i) => i !== index);
    this.emit(next);
    this.onTouched();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitDraft();
    } else if (event.key === 'Backspace' && this.draft() === '' && this.items().length > 0) {
      this.removeAt(this.items().length - 1);
    }
  }

  protected onBlur(): void {
    this.commitDraft();
    this.onTouched();
  }

  private emit(next: EntityFormChipValue[]): void {
    this.items.set(next);
    this.onChange(next);
  }
}
