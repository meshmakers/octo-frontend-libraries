import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { plusIcon } from '@progress/kendo-svg-icons';
import { MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import { duplicateValueLabelValues, ValueLabelRow } from '../../utils/chart-value-labels';

/**
 * Edits the names of a chart widget's raw values (`categoryLabels` / `seriesLabels`) in its config
 * dialog: one row per raw value with the name to show instead (e.g. an OBIS code and what it means).
 *
 * The dialog owns the rows (`[(rows)]`) and turns them into the label map on Save with
 * `fromValueLabelRows`, which drops unfinished rows.
 *
 * ```html
 * <mm-value-labels-editor [(rows)]="categoryLabelRows" subject="category"></mm-value-labels-editor>
 * ```
 */
@Component({
  selector: 'mm-value-labels-editor',
  standalone: true,
  imports: [FormsModule, ButtonsModule, InputsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="value-labels" role="group" [attr.aria-label]="subjectTitle() + ' names'">
      <p class="value-labels-hint">
        Optional. Shows a name instead of the raw {{ subject() }} value, e.g. for a code. Enter the value exactly as the
        data delivers it; values without a name are shown unchanged.
      </p>

      @if (rows().length === 0) {
        <p class="value-labels-empty" data-value-labels-empty>No names yet - values are shown as the data delivers them.</p>
      } @else {
        <div class="value-label-header" aria-hidden="true">
          <span>Value</span>
          <span>Name to display</span>
        </div>
      }

      @for (row of rows(); track row.id; let i = $index) {
        <div class="value-label-row" [attr.data-value-label-row]="row.id">
          <kendo-textbox class="value-input"
                         [ngModel]="row.value"
                         (ngModelChange)="edit(row.id, 'value', $event)"
                         placeholder="e.g. 1-1:2.9.0 G.03"
                         [inputAttributes]="{ 'aria-label': subjectTitle() + ' value, entry ' + (i + 1) }">
          </kendo-textbox>
          <kendo-textbox class="name-input"
                         [ngModel]="row.label"
                         (ngModelChange)="edit(row.id, 'label', $event)"
                         placeholder="e.g. Feed-in"
                         [inputAttributes]="{ 'aria-label': subjectTitle() + ' name, entry ' + (i + 1) }">
          </kendo-textbox>
          <button kendoButton fillMode="flat" type="button" class="remove-button" [svgIcon]="removeIcon"
                  [attr.aria-label]="'Remove ' + subject() + ' name, entry ' + (i + 1)" title="Remove"
                  (click)="remove(row.id)"></button>
        </div>
      }

      @if (duplicates().length > 0) {
        <p class="value-labels-warning" role="status" data-value-labels-duplicates>
          Listed more than once: {{ duplicates().join(', ') }}. The last entry is used.
        </p>
      }

      <button kendoButton fillMode="flat" type="button" [svgIcon]="addIcon" data-value-labels-action="add" (click)="add()">
        Add {{ subject() }} name
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      container-type: inline-size;
    }

    .value-labels-hint,
    .value-labels-empty {
      margin: 0 0 12px 0;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle);
    }

    .value-label-header,
    .value-label-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .value-label-header {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--kendo-color-on-app-surface);
    }

    .value-labels-warning {
      margin: 0 0 8px 0;
      font-size: 0.85rem;
      color: var(--kendo-color-warning);
    }

    @container (max-width: 420px) {
      .value-label-header {
        display: none;
      }

      .value-label-row {
        grid-template-columns: minmax(0, 1fr) 40px;
        grid-template-areas: 'value remove' 'name remove';
        margin-bottom: 12px;
      }

      .value-label-row .value-input { grid-area: value; }
      .value-label-row .name-input { grid-area: name; }
      .value-label-row .remove-button { grid-area: remove; }
    }
  `]
})
export class ValueLabelsEditorComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The editor rows (two-way: `[(rows)]`); the editor replaces the array on every change. */
  readonly rows = model<ValueLabelRow[]>([]);
  /** What the raw values are, used in the texts: `category` or `series`. */
  readonly subject = input('category');

  readonly subjectTitle = computed(() => {
    const subject = this.subject();
    return subject.charAt(0).toUpperCase() + subject.slice(1);
  });

  /** Raw values that more than one complete row lists; only the last of them takes effect. */
  readonly duplicates = computed(() => duplicateValueLabelValues(this.rows()));

  get addIcon(): typeof plusIcon { return plusIcon; }
  get removeIcon(): typeof MM_ACTION_ICONS.delete { return MM_ACTION_ICONS.delete; }

  add(): void {
    const id = this.rows().reduce((max, row) => Math.max(max, row.id), 0) + 1;
    this.rows.set([...this.rows(), { id, value: '', label: '' }]);
    this.focusRow(id);
  }

  remove(id: number): void {
    const rows = this.rows();
    const index = rows.findIndex(row => row.id === id);
    if (index < 0) {
      return;
    }
    const remaining = rows.filter(row => row.id !== id);
    this.rows.set(remaining);
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) {
      this.focusRow(next.id);
    } else {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-value-labels-action="add"]')?.focus());
    }
  }

  edit(id: number, field: 'value' | 'label', text: string | null): void {
    this.rows.set(this.rows().map(row => row.id === id ? { ...row, [field]: text ?? '' } : row));
  }

  private focusRow(id: number): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-value-label-row="${id}"] input`)?.focus());
  }
}
