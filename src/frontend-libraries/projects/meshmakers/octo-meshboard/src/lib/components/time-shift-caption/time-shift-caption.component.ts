import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DataSource, PersistentQueryDataSource } from '../../models/meshboard.models';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { normalizeTimeShift } from '../../utils/time-shift';
import { TimeShiftCaption, timeShiftCaption } from '../../utils/time-shift-caption';

/**
 * Caption and tooltip of a widget whose stream-data query applies a time shift, or `null` when the
 * shift has no effect: no persistent query, a runtime query, `ignoreTimeFilter`, no valid shift or no
 * active time filter.
 */
export function resolveTimeShiftCaption(dataSource: DataSource | undefined, stateService: MeshBoardStateService): TimeShiftCaption | null {
  if (dataSource?.type !== 'persistentQuery') {
    return null;
  }
  const query = dataSource as PersistentQueryDataSource;
  const shift = normalizeTimeShift(query.timeShift);
  if (!shift || query.ignoreTimeFilter || query.queryFamily === 'runtime') {
    return null;
  }
  const period = stateService.resolveShiftedPeriod(shift);
  return period ? timeShiftCaption(shift, period, stateService.timeZoneMode()) : null;
}

/**
 * The shifted period of a widget, shown under its title: "September 2026", tooltip
 * "Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)". Renders nothing without an active shift.
 */
@Component({
  selector: 'mm-time-shift-caption',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (caption(); as shifted) {
      <span class="time-shift-caption" [attr.title]="shifted.tooltip">{{ shifted.caption }}</span>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .time-shift-caption {
      display: block;
      font-size: 0.75rem;
      font-weight: 400;
      line-height: 1.2;
      color: var(--kendo-color-subtle);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class TimeShiftCaptionComponent {
  private readonly stateService = inject(MeshBoardStateService);

  readonly dataSource = input<DataSource | undefined>();

  readonly caption = computed(() => resolveTimeShiftCaption(this.dataSource(), this.stateService));
}
