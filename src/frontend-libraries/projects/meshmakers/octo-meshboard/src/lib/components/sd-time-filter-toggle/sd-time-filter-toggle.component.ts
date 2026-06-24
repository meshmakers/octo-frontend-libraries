import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { QueryFamily } from '../../utils/query-family';

/**
 * Per-widget opt-out toggle for the MeshBoard time-filter → stream-data binding.
 *
 * Stream-data persistent-query widgets auto-bind the active MeshBoard time
 * filter to `streamDataArgs.from/.to` (see
 * `MeshBoardStateService.resolveStreamDataTimeArgs`). This toggle lets the
 * designer opt a single widget out so the query's intrinsic time bounds win.
 *
 * The control renders only when the selected query is a stream-data query
 * (`family === 'streamData'`); for runtime queries the flag has no effect and
 * the toggle stays hidden.
 *
 * Two-way bindable:
 * ```html
 * <mm-sd-time-filter-toggle
 *   [family]="selectedQueryFamily"
 *   [(ignoreTimeFilter)]="ignoreTimeFilter">
 * </mm-sd-time-filter-toggle>
 * ```
 */
@Component({
  selector: 'mm-sd-time-filter-toggle',
  standalone: true,
  imports: [FormsModule, InputsModule],
  template: `
    @if (visible) {
      <div class="form-field sd-time-filter-toggle">
        <label class="checkbox-label">
          <input
            type="checkbox"
            kendoCheckBox
            [ngModel]="ignoreTimeFilter"
            (ngModelChange)="onToggle($event)" />
          Ignore MeshBoard time filter
        </label>
        <p class="field-hint">
          When enabled, this widget keeps the saved query's own time range and
          ignores the dashboard time filter.
        </p>
      </div>
    }
  `,
  styles: [`
    .sd-time-filter-toggle .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .sd-time-filter-toggle .field-hint {
      font-size: 0.85em;
      margin-top: 4px;
      opacity: 0.7;
    }
  `]
})
export class SdTimeFilterToggleComponent {
  /** Family of the currently selected query. Toggle is shown only for 'streamData'. */
  @Input() family?: QueryFamily | null;

  /** Current opt-out value. */
  @Input() ignoreTimeFilter = false;

  /** Emits on change (enables `[(ignoreTimeFilter)]` two-way binding). */
  @Output() ignoreTimeFilterChange = new EventEmitter<boolean>();

  get visible(): boolean {
    return this.family === 'streamData';
  }

  onToggle(value: boolean): void {
    this.ignoreTimeFilter = value;
    this.ignoreTimeFilterChange.emit(value);
  }
}
