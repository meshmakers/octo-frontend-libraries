import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { AnyWidgetConfig, HeatmapWidgetConfig, MeshBoardTimeShift, PersistentQueryDataSource } from '../../models/meshboard.models';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { normalizeTimeShift } from '../../utils/time-shift';
import { isValidHeatmapTimeWindow } from '../../widgets/heatmap-widget/heatmap-buckets';
import { TimeShiftCaption, timeShiftCaption } from '../../utils/time-shift-caption';

/**
 * Caption and tooltip of a widget whose stream-data query applies a time shift, or `null` when the
 * shift has no effect: no persistent query, a runtime query, `ignoreTimeFilter`, a heatmap with its own
 * time window, no valid shift or no active time filter.
 */
export function resolveTimeShiftCaption(widget: AnyWidgetConfig | undefined, stateService: MeshBoardStateService): TimeShiftCaption | null {
  const shifted = resolveCaptionedShift(widget, stateService);
  return shifted ? timeShiftCaption(shifted.shift, shifted.period, stateService.timeZoneMode()) : null;
}

/** True when {@link resolveTimeShiftCaption} renders a caption, without formatting it. */
export function hasTimeShiftCaption(widget: AnyWidgetConfig | undefined, stateService: MeshBoardStateService): boolean {
  return resolveCaptionedShift(widget, stateService) !== null;
}

function resolveCaptionedShift(
  widget: AnyWidgetConfig | undefined,
  stateService: MeshBoardStateService
): { shift: MeshBoardTimeShift; period: NonNullable<ReturnType<MeshBoardStateService['resolveShiftedPeriod']>> } | null {
  if (widget?.dataSource?.type !== 'persistentQuery') {
    return null;
  }
  if (widget.type === 'heatmap' && isValidHeatmapTimeWindow((widget as HeatmapWidgetConfig).timeWindow)) {
    return null;
  }
  const query = widget.dataSource as PersistentQueryDataSource;
  const shift = normalizeTimeShift(query.timeShift);
  if (!shift || query.ignoreTimeFilter || query.queryFamily === 'runtime') {
    return null;
  }
  const period = stateService.resolveShiftedPeriod(shift);
  return period ? { shift, period } : null;
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

  readonly widget = input<AnyWidgetConfig | undefined>();

  readonly caption = computed(() => resolveTimeShiftCaption(this.widget(), this.stateService));
}
