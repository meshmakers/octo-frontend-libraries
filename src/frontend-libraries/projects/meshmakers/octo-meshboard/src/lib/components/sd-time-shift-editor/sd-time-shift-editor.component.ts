import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import type { MeshBoardTimeShift } from '../../models/meshboard.models';
import type { QueryFamily } from '../../utils/query-family';
import { normalizeTimeShift } from '../../utils/time-shift';

/** The choice of the "Compare with" group. */
export type TimeShiftChoice = 'none' | 'period' | 'year';

/** Largest "Periods back" value the editor accepts. */
export const MAX_TIME_SHIFT_PERIODS = 10;

let nextEditorId = 0;

/**
 * Editor of a stream-data query's time shift ({@link MeshBoardTimeShift}), shown under the
 * "Ignore MeshBoard time filter" toggle of the KPI, line, bar, pie and table dialogs. Visible only
 * for a stream-data query (same rule as the toggle); disabled while the time filter is ignored, so
 * a saved shift is kept but not applied.
 *
 * ```html
 * <mm-sd-time-shift-editor
 *   [family]="selectedQueryFamily"
 *   [ignoreTimeFilter]="ignoreTimeFilter"
 *   [(timeShift)]="timeShift">
 * </mm-sd-time-shift-editor>
 * ```
 */
@Component({
  selector: 'mm-sd-time-shift-editor',
  standalone: true,
  imports: [FormsModule, InputsModule, LabelModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <fieldset class="form-field sd-time-shift-editor" [disabled]="ignoreTimeFilter()">
        <legend>Compare with</legend>
        <div class="choices">
          @for (option of options; track option.value) {
            <label class="choice">
              <input
                type="radio"
                kendoRadioButton
                [name]="groupName"
                [value]="option.value"
                [checked]="choice() === option.value"
                [disabled]="ignoreTimeFilter()"
                (change)="onChoice(option.value)" />
              {{ option.label }}
            </label>
          }
        </div>
        @if (choice() !== 'none') {
          <div class="periods">
            <kendo-label text="Periods back" [for]="periodsBox"></kendo-label>
            <kendo-numerictextbox
              #periodsBox
              class="periods-box"
              [value]="periods()"
              [min]="1"
              [max]="maxPeriods"
              [step]="1"
              [decimals]="0"
              [format]="'n0'"
              [autoCorrect]="true"
              [spinners]="true"
              [disabled]="ignoreTimeFilter()"
              (valueChange)="onPeriods($event)">
            </kendo-numerictextbox>
          </div>
        }
        <p class="field-hint">{{ hint() }}</p>
      </fieldset>
    }
  `,
  styles: [`
    .sd-time-shift-editor {
      border: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }

    .sd-time-shift-editor legend {
      padding: 0;
      margin-bottom: 4px;
    }

    .choices {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }

    .choice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .periods {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .periods-box {
      width: 90px;
    }

    .field-hint {
      font-size: 0.85em;
      margin-top: 4px;
      opacity: 0.7;
    }
  `]
})
export class SdTimeShiftEditorComponent {
  /** Family of the selected query; the editor is shown only for `'streamData'`. */
  readonly family = input<QueryFamily | null | undefined>();

  /** "Ignore MeshBoard time filter" of the same dialog: disables the editor and changes its hint. */
  readonly ignoreTimeFilter = input(false);

  /** The shift, `undefined` for "None". */
  readonly timeShift = model<MeshBoardTimeShift | undefined>(undefined);

  readonly groupName = `mm-time-shift-${nextEditorId++}`;

  readonly options: readonly { value: TimeShiftChoice; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'period', label: 'Previous period' },
    { value: 'year', label: 'Same period last year' }
  ];

  private readonly lastPeriods = signal(1);

  readonly visible = computed(() => this.family() === 'streamData');

  readonly choice = computed<TimeShiftChoice>(() => normalizeTimeShift(this.timeShift())?.by ?? 'none');

  readonly periods = computed(() => {
    const shift = normalizeTimeShift(this.timeShift());
    return shift ? -shift.count : this.lastPeriods();
  });

  readonly hint = computed(() => this.ignoreTimeFilter()
    ? 'The shift has no effect while the MeshBoard time filter is ignored.'
    : 'Shows the selected board period moved back. Custom ranges move by their own length.');

  get maxPeriods(): number {
    return MAX_TIME_SHIFT_PERIODS;
  }

  onChoice(choice: TimeShiftChoice): void {
    if (choice === 'none') {
      this.timeShift.set(undefined);
      return;
    }
    this.timeShift.set({ by: choice, count: -this.periods() });
  }

  onPeriods(value: number | null): void {
    const periods = Math.min(MAX_TIME_SHIFT_PERIODS, Math.max(1, Math.round(value ?? 1)));
    this.lastPeriods.set(periods);
    const shift = normalizeTimeShift(this.timeShift());
    if (shift) {
      this.timeShift.set({ by: shift.by, count: -periods });
    }
  }
}
