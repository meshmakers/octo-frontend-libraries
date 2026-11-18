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
 *
 * The KPI dialog adds `[offerShowChange]="true" [(showChange)]="showChange" [(increaseIsGood)]="increaseIsGood"` (AB#9245).
 */
@Component({
  selector: 'mm-sd-time-shift-editor',
  standalone: true,
  imports: [FormsModule, InputsModule, LabelModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <fieldset class="form-field sd-time-shift-editor" [disabled]="ignoreTimeFilter()" [attr.aria-describedby]="hintId">
        <legend [class.k-disabled]="ignoreTimeFilter()">Compare with</legend>
        <div class="choices">
          @for (option of options; track option.value) {
            <label class="choice" [class.k-disabled]="ignoreTimeFilter()">
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
            <kendo-label text="Periods back" [for]="periodsBox" [class.k-disabled]="ignoreTimeFilter()"></kendo-label>
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
          @if (offerShowChange()) {
            <div class="show-change">
              <span class="show-change-label" [class.k-disabled]="ignoreTimeFilter()">Show change</span>
              <label class="show-change-choice" [class.k-disabled]="ignoreTimeFilter()">
                <input
                  type="checkbox"
                  kendoCheckBox
                  [checked]="showChange()"
                  [disabled]="ignoreTimeFilter()"
                  (change)="onShowChange($any($event.target).checked)" />
                Show the change to the current period (value and %)
              </label>
            </div>
            @if (showChange()) {
              <fieldset class="change-direction">
                <legend class="change-direction-label" [class.k-disabled]="ignoreTimeFilter()">An increase is</legend>
                @for (option of directionOptions; track option.label) {
                  <label class="choice" [class.k-disabled]="ignoreTimeFilter()">
                    <input
                      type="radio"
                      kendoRadioButton
                      [name]="directionGroupName"
                      [value]="option.label"
                      [checked]="increaseIsGood() === option.good"
                      [disabled]="ignoreTimeFilter()"
                      (change)="increaseIsGood.set(option.good)" />
                    {{ option.label }}
                  </label>
                }
              </fieldset>
            }
          }
        }
        <p class="field-hint" [id]="hintId">{{ hint() }}</p>
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

    .show-change {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .change-direction {
      display: flex;
      align-items: center;
      gap: 4px 16px;
      flex-wrap: wrap;
      margin: 8px 0 0;
      padding: 0;
      border: none;
      min-width: 0;
    }

    .sd-time-shift-editor .change-direction-label {
      float: left;
      margin: 0;
    }

    .show-change-choice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
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

  /**
   * Offers "Show change" for a shift (KPI dialog only, AB#9245): shown with Previous period or Same
   * period last year, disabled like the shift while the time filter is ignored.
   */
  readonly offerShowChange = input(false);

  /** "Show the change to the current period"; only meaningful while {@link offerShowChange} is set. */
  readonly showChange = model(false);

  /** "An increase is good / bad" of the change line (AB#9245); `true` = good. */
  readonly increaseIsGood = model(true);

  readonly directionOptions: readonly { label: string; good: boolean }[] = [
    { label: 'good', good: true },
    { label: 'bad', good: false }
  ];

  readonly groupName = `mm-time-shift-${nextEditorId++}`;

  readonly directionGroupName = `${this.groupName}-direction`;

  readonly hintId = `${this.groupName}-hint`;

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
    : 'Shows the selected board period moved back. With Previous period a custom range of whole days moves by calendar days, a relative range or a custom range with a time of day by its exact length.');

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

  onShowChange(checked: boolean): void {
    this.showChange.set(checked);
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
