import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEFAULT_CARRY_FORWARD_LOOKBACK_MINUTES, LineChartQuerySeries, LineChartWidgetConfig, PersistentQueryDataSource, SeriesDashType, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { QueryExecutorService, QueryResultRow, SeriesResolutionResult, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { CkRollupFunctionDto, FieldFilterDto, QueryModeDto, SeriesResolutionSignalDto } from '@meshmakers/octo-services';
import { findCellForField, matchesAttributePath } from '../../utils/widget-data-utils';
import { formatInstant, toInstant } from '../../utils/meshboard-datetime';
import { streamDataRowFieldValue } from '../../utils/stream-data-row-fields';
import { injectChartTheme } from '../../utils/chart-theme';
import { alignOnTimeGrid, TimeGridSourceInput } from '../../utils/time-grid-alignment';
import { alignOnFixedGrid, FixedBucketWindow, lastValue, snapWindowToBuckets } from '../../utils/series-options';
import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import {
  composeChartSeries,
  ComposedChartSeries,
  isCompleteFormulaSeries,
  isCompleteQuerySeries,
  isSourceHintShown,
  LineChartSourceHint,
  LineChartSourceProblem,
  PRIMARY_SOURCE_KEY,
  primaryRowsToSeries,
  queryRowsToSeries,
  querySeriesLabel,
  uniqueCategoryLabels,
  withoutExcludedSeriesGroups
} from './line-chart-multi-source';

/** Series colours so a series' min/max band and its avg line share one hue. */
const SERIES_PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/**
 * Resolution-aware routing (AB#4290): only surface the "resolution limited" warning when the line
 * would be *visibly* steppy — i.e. each delivered point spans at least this many pixels of chart
 * width. Falling short of the pixel-ideal target is not itself a problem: 240 points on a 1300px
 * chart (~5.4 px/point) reads perfectly smooth. Only a genuinely coarse rung (few points spread
 * over a wide chart) is worth flagging. Comparing against a raw point-count ratio cries wolf.
 */
const RESOLUTION_LIMIT_WARN_PX = 12;

/**
 * Series data for the line chart
 */
interface LineSeriesData {
  name: string;
  data: (number | null)[];
  /** min/max envelope per category (downsampling only); rendered as a rangeArea band. */
  band?: ({ from: number; to: number } | null)[];
  unit?: string;
  axisName?: string;
  color?: string;
  /** Multi-source path (AB#7952): stacked with the other stacked series. */
  stacked?: boolean;
  /** Multi-source path (AB#7952): drawn as a line over the stack of a stacked area chart. */
  asLine?: boolean;
  /** Multi-source path (AB#8046): line style of a series drawn as a line. */
  dashType?: SeriesDashType;
}

export type { LineChartSourceHint } from './line-chart-multi-source';

/** One source of a multi-source load (AB#7951): the primary data source or a query series. */
interface MultiSourceEntry {
  key: string;
  label: string;
  dataSource: PersistentQueryDataSource;
  valueField: string;
  primary: boolean;
}

/** Outcome of the preparation step of one source: the resolution-aware routing, if any. */
interface PreparedSource {
  timeArgs: { from?: Date; to?: Date } | undefined;
  rtIds: string[] | undefined;
  resolutionAware?: {
    resolution: SeriesResolutionResult | null;
    ckTypeId: string | null;
    scopeRtIds: string[] | undefined;
    from: Date;
    to: Date;
  };
}

/**
 * Value axis configuration
 */
interface ValueAxisConfig {
  name: string;
  unit: string;
  position: 'left' | 'right';
}

@Component({
  selector: 'mm-line-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="line-chart-widget" [class.loading]="isLoading()" [class.error]="error()">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (isLoading()) {
        <div class="loading-indicator">
          <span>...</span>
        </div>
      } @else if (error()) {
        <div class="error-message">
          <span>{{ error() }}</span>
        </div>
      } @else {
        @if (dataInfo(); as info) {
          @if (config.showDataBadge !== false || resolutionHint()) {
            <span class="data-count" [class.warn]="!!resolutionHint()" [class.has-info]="!!resolutionHint()"
                  [title]="badgeTitle(info.total)"
                  (click)="resolutionHint() && toggleResolutionInfo($event)">
              {{ info.rows }} rows · {{ info.points }} pts@if (resolutionHint(); as hint) {<span class="rl-flag"> · {{ hint.text }}</span>}
            </span>
          }
        }
        @if (sourceHints().length > 0) {
          <ul class="source-hints" aria-live="polite">
            @for (hint of sourceHints(); track hint.text) {
              <li class="source-hint" [class.error]="hint.kind === 'error'" [class.warn]="hint.kind === 'misaligned' || hint.kind === 'dependency'">
                @if (hint.kind !== 'noData') {<span aria-hidden="true">⚠ </span>}{{ hint.text }}
              </li>
            }
          </ul>
        }
        @if (showResolutionInfo() && resolutionExplanation(); as msg) {
          <div class="resolution-info">
            <div class="ri-head">
              <span>Resolution-aware</span>
              <button type="button" class="ri-close" (click)="closeResolutionInfo($event)" aria-label="Close">✕</button>
            </div>
            <p class="ri-body">{{ msg }}</p>
          </div>
        }
        <kendo-chart class="chart-container" [plotArea]="{ background: 'transparent', margin: { top: 0, right: 0, bottom: 0, left: 0 } }">
          <kendo-chart-area [background]="'transparent'"></kendo-chart-area>

          <kendo-chart-category-axis>
            <kendo-chart-category-axis-item
              [categories]="categories()"
              [line]="{ visible: false }"
              [majorGridLines]="{ visible: false }">
              <kendo-chart-category-axis-item-labels
                [rotation]="labelRotation()"
                [step]="labelStep()"
                [color]="chartTheme().muted"
                [content]="categoryLabelContent">
              </kendo-chart-category-axis-item-labels>
            </kendo-chart-category-axis-item>
          </kendo-chart-category-axis>

          @if (valueAxes().length > 0) {
            <kendo-chart-value-axis>
              @for (axis of valueAxes(); track axis.name) {
                <kendo-chart-value-axis-item
                  [name]="axis.name"
                  [title]="{ text: axis.unit, color: chartTheme().muted }"
                  [line]="{ visible: false }"
                  [labels]="{ color: chartTheme().muted }"
                  [majorGridLines]="{ color: chartTheme().grid }"
                  [plotBands]="plotBands()">
                </kendo-chart-value-axis-item>
              }
            </kendo-chart-value-axis>
          }

          @if (valueAxes().length === 0) {
            <kendo-chart-value-axis>
              <kendo-chart-value-axis-item
                [name]="''"
                [title]="{ text: config.valueAxisTitle ?? '', color: chartTheme().muted }"
                [line]="{ visible: false }"
                [labels]="{ color: chartTheme().muted }"
                [majorGridLines]="{ color: chartTheme().grid }"
                [plotBands]="plotBands()">
              </kendo-chart-value-axis-item>
            </kendo-chart-value-axis>
          }

          <kendo-chart-series>
            @for (series of seriesData(); track series.name) {
              @if (series.band) {
                <kendo-chart-series-item
                  [type]="'rangeArea'"
                  [data]="series.band"
                  [fromField]="'from'"
                  [toField]="'to'"
                  [name]="series.name + ' (min/max)'"
                  [axis]="series.axisName ?? ''"
                  [color]="series.color"
                  [opacity]="0.18"
                  [visibleInLegend]="false"
                  [markers]="{ visible: false }">
                </kendo-chart-series-item>
              }
              <kendo-chart-series-item
                [type]="series.asLine ? 'line' : chartType()"
                [style]="'smooth'"
                [data]="series.data"
                [name]="series.name"
                [axis]="series.axisName ?? ''"
                [color]="series.color"
                [opacity]="series.asLine ? 1 : 0.7"
                [stack]="series.stacked ?? stackSeries()"
                [missingValues]="missingValues()"
                [dashType]="series.dashType ?? 'solid'"
                [markers]="{ visible: config.showMarkers ?? false }">
              </kendo-chart-series-item>
            }
          </kendo-chart-series>

          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'right'"
            [labels]="{ color: chartTheme().text }">
          </kendo-chart-legend>

          <!--
            Shared (category) tooltip: keyed on the category under the cursor's X, so the
            reported point always matches the hovered time position. A non-shared tooltip
            selects the nearest point by 2D distance, which makes the highlight jump
            horizontally to an unrelated category whenever the cursor is off the (often flat)
            line — see AB#4258. The min/max envelope (rangeArea) series is filtered out.
          -->
          <kendo-chart-tooltip [shared]="true">
            <ng-template kendoChartSharedTooltipTemplate let-category="category" let-points="points">
              <div class="chart-tooltip">
                <strong>{{ category }}</strong>
                @if (isMultiSource()) {
                  <!-- Multi-source (AB#7952): every drawn series, a gap as "–" (Kendo leaves gap points out of points). -->
                  @for (row of tooltipRows(category); track row.name) {
                    <br/>{{ row.name }}: {{ row.text }}
                  }
                } @else {
                  @for (point of points; track point.series.name) {
                    @if (!isBandSeries(point.series.name)) {
                      <br/>{{ point.series.name }}: {{ formatValue(point.value) }}{{ getUnitForSeries(point.series.name) }}
                    }
                  }
                }
              </div>
            </ng-template>
          </kendo-chart-tooltip>
        </kendo-chart>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .line-chart-widget {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .data-count {
      position: absolute;
      top: 4px;
      right: 6px;
      z-index: 2;
      max-width: calc(100% - 12px);
      padding: 1px 7px;
      border-radius: 9px;
      font-size: 0.7rem;
      /* Roomy line-height + nowrap so the badge never wraps and gets clipped. */
      line-height: 1.5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--kendo-color-on-app-surface, #6c757d);
      background: color-mix(in srgb, var(--kendo-color-app-surface, #888) 12%, transparent);
      pointer-events: none;
      user-select: none;
      font-variant-numeric: tabular-nums;
    }

    /* Resolution-aware warning (AB#4290) folded into the top-right data-count badge. */
    .data-count.warn {
      color: var(--kendo-color-warning, #b8860b);
      background: color-mix(in srgb, var(--kendo-color-warning, #f0ad4e) 16%, transparent);
    }

    .data-count.has-info {
      pointer-events: auto;
      cursor: pointer;
    }

    .data-count .rl-flag {
      font-weight: 600;
    }

    .resolution-info {
      position: absolute;
      top: 26px;
      right: 6px;
      z-index: 5;
      max-width: min(340px, calc(100% - 12px));
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      line-height: 1.4;
      color: var(--kendo-color-on-app-surface, #212529);
      background: var(--kendo-color-app-surface, #fff);
      border: 1px solid color-mix(in srgb, var(--kendo-color-warning, #f0ad4e) 55%, transparent);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
      text-align: left;
    }

    .resolution-info .ri-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--kendo-color-warning, #b8860b);
    }

    .resolution-info .ri-close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 0.8rem;
      line-height: 1;
      color: var(--kendo-color-subtle, #6c757d);
      padding: 0 2px;
    }

    .resolution-info .ri-body {
      margin: 0;
    }

    /* Per-source hints of a multi-source chart (AB#7951), top-left so they never hide the badge. */
    .source-hints {
      position: absolute;
      top: 4px;
      left: 6px;
      z-index: 2;
      max-width: calc(100% - 140px);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.7rem;
      line-height: 1.4;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .source-hint {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-hint.error {
      color: var(--kendo-color-error, #dc3545);
    }

    .source-hint.warn {
      color: var(--kendo-color-warning, #b8860b);
    }

    .line-chart-widget.loading,
    .line-chart-widget.error {
      opacity: 0.7;
    }

    .loading-indicator,
    .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    .loading-indicator span {
      font-size: 1.5rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .error-message span {
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.875rem;
    }

    .chart-container {
      width: 100%;
      height: 100%;
    }

    kendo-chart {
      width: 100%;
      height: 100%;
    }

    .chart-tooltip {
      padding: 4px 8px;
    }
  `]
})
export class LineChartWidgetComponent implements DashboardWidget<LineChartWidgetConfig, LineSeriesData[]>, AfterViewInit, OnChanges, OnDestroy {
  private readonly queryExecutor = inject(QueryExecutorService);
  /** Text / grid colours of the current theme, re-resolved on a live theme switch (AB#5568). */
  protected readonly chartTheme = injectChartTheme();

  private readonly elementRef = inject(ElementRef);
  private readonly ngZone = inject(NgZone);

  // FE-2 resize handling: re-query at a new resolution when the chart is resized materially.
  private resizeObserver?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setTimeout>;
  /** The downsampling `limit` used by the last load; 0 when the last load wasn't downsampled. */
  private lastLimit = 0;

  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtSimpleQueryRow',
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  @Input() config!: LineChartWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _categories = signal<string[]>([]);
  private readonly _seriesData = signal<LineSeriesData[]>([]);
  private readonly _valueAxes = signal<ValueAxisConfig[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _seriesUnitMap = signal<Map<string, string>>(new Map());
  // Debug aid: how many rows came back vs. how many distinct category points
  // actually plotted. A large `rows` with tiny `points` flags a data collapse
  // (e.g. all rows sharing one category/timestamp).
  private readonly _dataInfo = signal<{ rows: number; points: number; total: number } | null>(null);
  // Resolution-aware routing outcome (AB#4290): drives the archive/rollup hint badge so the
  // user sees when the server delivered fewer points than requested or refused to reduce.
  private readonly _resolutionSignal = signal<SeriesResolutionResult | null>(null);
  // The point count the widget requested (pixel-driven), kept so the resolution-limited hint can
  // show delivered-vs-requested — the resolver only returns the delivered count in `points`.
  private readonly _resolutionTarget = signal<number | null>(null);
  // Whether the click-through explanation panel for the resolution warning is open.
  private readonly _showResolutionInfo = signal(false);
  readonly showResolutionInfo = this._showResolutionInfo.asReadonly();

  readonly isLoading = this._isLoading.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly seriesData = this._seriesData.asReadonly();
  readonly valueAxes = this._valueAxes.asReadonly();
  readonly error = this._error.asReadonly();
  readonly dataInfo = this._dataInfo.asReadonly();
  // Per-source hints of a multi-source chart (AB#7951); always empty for a single-query chart.
  private readonly _sourceHints = signal<LineChartSourceHint[]>([]);
  readonly sourceHints = this._sourceHints.asReadonly();

  /**
   * Resolution-aware hint (AB#4290): a short badge describing the archive-selection outcome —
   * `null` for a clean reduction (signal OK), a warning otherwise (fewer points delivered, or no
   * compatible rollup so the raw archive was returned unreduced). Mirrors the resolver's signal.
   * `CoverageLimited` (AB#5157) is a distinct badge: a finer rung was skipped for holding no data
   * over the window, which is a history gap rather than a density problem — so it is always shown,
   * bypassing the {@link RESOLUTION_LIMIT_WARN_PX} suppression that mutes a merely coarse line.
   */
  readonly resolutionHint = computed((): { text: string; title: string } | null => {
    const s = this._resolutionSignal();
    if (!s) return null;
    const diag = s.diagnostic ?? '';
    switch (s.signal) {
      case SeriesResolutionSignalDto.CoverageLimitedDto: {
        // Coverage, not density (AB#5157): the finer rung was skipped because it holds NO data
        // over the window, so the pixel-density suppression must not apply — a dense-looking
        // coarse line is still the wrong answer to "where is my history?". Always flagged.
        const availableFrom = formatInstant(s.finerRungAvailableFrom, this.stateService.timeZoneMode(), {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        return {
          text: '⚠ no history',
          title: availableFrom
            ? `History at this resolution is available from ${availableFrom}`
            : diag || 'A finer resolution exists but holds no data for this time range.'
        };
      }
      case SeriesResolutionSignalDto.ResolutionLimitedDto: {
        const delivered = s.actualPoints ?? s.points;
        const requested = this._resolutionTarget();
        // Only flag when the line would be *visibly* steppy — each point spans ≥ N px of chart
        // width. A dense-enough line (e.g. 240 pts on a 1300px chart ≈ 5 px/pt) reads fine even
        // below the pixel-ideal target, so it must not warn.
        const width = (this.elementRef.nativeElement as HTMLElement)?.offsetWidth ?? 0;
        if (width > 0 && delivered > 0 && width / delivered < RESOLUTION_LIMIT_WARN_PX) return null;
        const ofReq = requested && requested > delivered ? ` (of ${requested})` : '';
        return { text: `⚠ limited${ofReq}`, title: diag || 'Resolution limited: the coarsest available rollup delivers fewer points than requested for this range.' };
      }
      case SeriesResolutionSignalDto.NoSuitableRollupDto:
        return { text: '⚠ no rollup', title: diag || 'No compatible rollup for this aggregation — the raw archive was returned unreduced.' };
      case SeriesResolutionSignalDto.UnknownBaseGrainDto:
        return { text: '⚠ raw', title: diag || 'Base archive grain unknown — returned unreduced.' };
      case SeriesResolutionSignalDto.EmptyLadderDto:
        return { text: '⚠ no archive', title: diag || 'No resolvable archive for this series.' };
      default:
        return null;
    }
  });

  /**
   * Plain-language explanation shown when the user clicks the resolution warning — spells out why
   * fewer points were delivered and what to do about it, instead of the terse backend diagnostic.
   */
  readonly resolutionExplanation = computed((): string | null => {
    const s = this._resolutionSignal();
    if (!s || !this.resolutionHint()) return null;
    const delivered = s.actualPoints ?? s.points;
    const requested = this._resolutionTarget();
    const ofReq = requested ? ` (the chart could show ~${requested})` : '';
    const diag = s.diagnostic ?? '';
    switch (s.signal) {
      case SeriesResolutionSignalDto.CoverageLimitedDto: {
        const availableFrom = formatInstant(s.finerRungAvailableFrom, this.stateService.timeZoneMode(), {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const from = availableFrom
          ? ` That resolution only has history from ${availableFrom} onwards.`
          : '';
        return `A finer resolution exists for this series, but it holds no data for the selected time range, `
          + `so the chart fell back to a coarser one (${delivered} point(s)${ofReq}).${from} `
          + `The values are correct — narrow the range to a covered period to see finer detail.`
          + (diag ? ` ${diag}` : '');
      }
      case SeriesResolutionSignalDto.ResolutionLimitedDto:
        return `This chart auto-selects the coarsest stored resolution that still fits the view. `
          + `For this time range the finest matching rollup only provides ${delivered} point(s)${ofReq}, `
          + `so the line is drawn at a coarser resolution than the screen could show. The values are correct — `
          + `to see finer detail, narrow the time range or provision a finer rollup for this series.`;
      case SeriesResolutionSignalDto.NoSuitableRollupDto:
        return `No rollup matches this series' aggregation, so the raw archive was returned unreduced `
          + `(${delivered} points). Add a matching rollup to enable server-side reduction, or narrow the time range.`;
      case SeriesResolutionSignalDto.UnknownBaseGrainDto:
        return `The base archive's native resolution is undeclared, so the data was returned unreduced. `
          + `Set the archive's period/grain to enable resolution-aware selection.`;
      case SeriesResolutionSignalDto.EmptyLadderDto:
        return `No queryable archive was found for this series, so nothing could be plotted.`;
      default:
        return null;
    }
  });

  /** Toggles the click-through explanation panel for the resolution warning. */
  toggleResolutionInfo(event?: Event): void {
    event?.stopPropagation();
    this._showResolutionInfo.update(v => !v);
  }

  /** Closes the resolution explanation panel (e.g. its close button). */
  closeResolutionInfo(event?: Event): void {
    event?.stopPropagation();
    this._showResolutionInfo.set(false);
  }

  /**
   * Tooltip for the data-count badge: explains what `rows`/`pts` mean, and — when a resolution
   * warning is present — prefixes the diagnostic and prompts the click-through explanation.
   */
  badgeTitle(total: number): string {
    const legend = `rows = data rows fetched (points × series) · pts = distinct time points plotted (totalCount ${total})`;
    const hint = this.resolutionHint();
    return hint ? `${hint.title}\nClick for details.\n\n${legend}` : legend;
  }

  readonly data = computed(() => this._seriesData());

  readonly plotBands = computed(() => {
    if (!this.config?.referenceLines?.length) return [];
    return this.config.referenceLines.map(ref => {
      const lineColor = ref.color ?? '#ef4444';
      const bandWidth = ref.value * 0.002 || 1;
      return {
        from: ref.value - bandWidth,
        to: ref.value + bandWidth,
        color: lineColor,
        opacity: ref.opacity ?? 0.8,
        label: ref.label ? {
          text: ref.label,
          position: 'top' as const,
          align: 'right' as const,
          color: lineColor,
          font: '500 0.8rem sans-serif',
          padding: { top: 2, right: 4, bottom: 2, left: 4 }
        } : undefined
      };
    });
  });

  readonly chartType = computed((): 'line' | 'area' => {
    return this.config?.chartType ?? 'line';
  });

  /**
   * Stacking (AB#7951): only an area chart with `stacked` stacks; the series stack in their order
   * (primary series first, then `additionalSeries`). `false` is Kendo's default, so an existing
   * chart stacks exactly as before (not at all).
   */
  stackSeries(): boolean {
    return !!this.config?.stacked && this.chartType() === 'area';
  }

  /**
   * Kendo `missingValues` (AB#7951), always set explicitly. A stacked or multi-source chart uses
   * `'gap'`: a bucket without data is a gap, never drawn or stacked as 0 and never bridged.
   * Single-query unstacked charts get exactly Kendo's defaults — `'interpolate'` for a line,
   * `'zero'` for an area series — so they render as before.
   */
  missingValues(): 'gap' | 'interpolate' | 'zero' {
    if (this.stackSeries() || this.hasAdditionalSeries()) return 'gap';
    return this.chartType() === 'area' ? 'zero' : 'interpolate';
  }

  /** Whether the chart reads series from more than its primary query (AB#7951) or has formula series (AB#7952). */
  hasAdditionalSeries(): boolean {
    return (this.config?.additionalSeries ?? []).some(s => isCompleteQuerySeries(s) || isCompleteFormulaSeries(s));
  }

  /** Whether the last load went through the multi-source path (aligned grid, AB#7951/AB#7952). */
  private readonly _multiSource = signal(false);
  readonly isMultiSource = this._multiSource.asReadonly();

  /**
   * Shared tooltip rows of the multi-source path (AB#7952): one row per drawn series for the
   * hovered category; a gap (null) shows "–".
   */
  tooltipRows(category: string): { name: string; text: string }[] {
    const index = this._categories().indexOf(category);
    if (index < 0) return [];
    return this._seriesData().map(s => {
      const value = s.data[index];
      return {
        name: s.name,
        text: value === null || value === undefined ? '–' : `${this.formatValue(value)}${this.getUnitForSeries(s.name)}`
      };
    });
  }

  readonly labelRotation = computed(() => {
    const categoryCount = this._categories().length;
    return categoryCount > 5 ? -45 : 0;
  });

  /**
   * Step for category axis labels to avoid overcrowding.
   * Shows every Nth label depending on total count.
   */
  readonly labelStep = computed(() => {
    const count = this._categories().length;
    if (count <= 10) return 1;
    if (count <= 30) return Math.ceil(count / 10);
    if (count <= 100) return Math.ceil(count / 15);
    return Math.ceil(count / 20);
  });

  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      return !ds.queryRtId || !this.config?.categoryField || !this.config?.seriesGroupField || !this.config?.valueField;
    }

    return true;
  }

  categoryLabelContent = (e: { value: string }): string => {
    const maxLen = 18;
    return e.value.length > maxLen ? e.value.substring(0, maxLen) + '...' : e.value;
  };

  ngAfterViewInit(): void {
    // Defer the initial load to after view init so the host has a measured width — the
    // downsampling bucket count (FE-1) is derived from the rendered pixel width.
    this.loadData();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
  }

  /**
   * FE-2: when the chart is resized so the pixel-derived bucket count would change materially
   * (>15%), re-query at the new resolution after a 300 ms debounce. Only relevant while
   * downsampling is active (lastLimit > 0); raw charts don't depend on width.
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.elementRef.nativeElement as HTMLElement);
  }

  private onResize(): void {
    if (this.lastLimit <= 0) return; // last load wasn't downsampled (or hasn't completed yet)
    const newLimit = this.computeDownsampleLimit();
    if (Math.abs(newLimit - this.lastLimit) / this.lastLimit < 0.15) return;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.ngZone.run(() => this.loadData()), 300);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadData();
    }
  }

  refresh(): void {
    this.loadData();
  }

  hasValidConfig(): boolean {
    if (!this.config?.dataSource) return false;
    if (this.config.dataSource.type === 'persistentQuery') {
      const ds = this.config.dataSource as PersistentQueryDataSource;
      return !!(ds.queryRtId && this.config.categoryField && this.config.seriesGroupField && this.config.valueField);
    }
    return false;
  }

  formatValue(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  getUnitForSeries(seriesName: string): string {
    const unit = this._seriesUnitMap().get(seriesName);
    return unit ? ` ${unit}` : '';
  }

  /** The downsampling min/max envelope is rendered as a separate `<name> (min/max)` rangeArea
   *  series; it is excluded from the shared tooltip so only the actual value lines are listed. */
  isBandSeries(seriesName: string): boolean {
    return seriesName.endsWith(' (min/max)');
  }

  private async loadData(): Promise<void> {
    if (this.isNotConfigured()) return;
    this._multiSource.set(this.hasAdditionalSeries());
    if (this.hasAdditionalSeries()) {
      await this.loadMultiSource();
      return;
    }
    this._sourceHints.set([]);

    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Entity-selector scope (AB#7721): pending → stay in the loading state and
      // send no query (the view refreshes once the scope is known); empty → render
      // the empty chart without querying the persisted (unscoped) scope.
      const scope = this.stateService.resolveStreamDataScope(queryDataSource.entitySelectorId, queryDataSource.queryFamily, queryDataSource.ignoreTimeFilter);
      if (scope.kind === 'pending') {
        return;
      }
      if (scope.kind === 'empty') {
        this._resolutionSignal.set(null);
        this._resolutionTarget.set(null);
        this.processData([], false);
        this._dataInfo.set({ rows: 0, points: 0, total: 0 });
        this._isLoading.set(false);
        return;
      }

      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      // Resolution-aware routing (AB#4290): let the server pick the archive/rollup for the visible
      // window + target point count, then downsample each source series against it. Requires a
      // stream-data query, a resolved time range, and a value field (which doubles as the series'
      // source path — the resolver matches it against the rollup's aggregation spec, case-insensitively).
      const timeArgs = this.streamDataTimeArgs(queryDataSource.ignoreTimeFilter);
      if (queryDataSource.resolutionAware && queryDataSource.queryFamily === 'streamData'
          && this.config.valueField && timeArgs?.from && timeArgs?.to) {
        const sourceRtIds = this.stateService.resolveStreamDataRtIds(queryDataSource.entitySelectorId);
        const { rows, signal, requestedPoints } = await this.loadResolutionAware(
          queryDataSource, timeArgs.from, timeArgs.to, sourceRtIds, fieldFilter ?? undefined);
        this._resolutionSignal.set(signal);
        this._resolutionTarget.set(requestedPoints);
        this.lastLimit = signal?.points ?? this.computeDownsampleLimit();
        this.processData(rows, true);
        this._dataInfo.set({ rows: rows.length, points: this._categories().length, total: rows.length });
        this._isLoading.set(false);
        return;
      }
      this._resolutionSignal.set(null);
      this._resolutionTarget.set(null);

      // queryFamily may be undefined for legacy widget configs — the executor
      // falls back to a one-time lookup by rtId. streamDataArgs is sent
      // unconditionally because the runtime path ignores it.
      const streamDataArgs = this.buildStreamDataArgs();
      // Remember the resolution used so a later resize can decide whether to re-query (FE-2).
      this.lastLimit = streamDataArgs?.limit ?? 0;

      const result = await firstValueFrom(
        this.queryExecutor.execute(queryDataSource.queryFamily, queryDataSource.queryRtId, {
          fieldFilter: fieldFilter ?? undefined,
          streamDataArgs,
          // Runtime queries: `rtId IN` field filter (AB#7725); stream data: arg.rtIds.
          scopeRtIds: scope.kind === 'scoped' ? scope.rtIds : undefined
        }).pipe(
          catchError(err => {
            console.error('Error loading Line Chart data:', err);
            throw err;
          })
        )
      );

      const filteredRows = withoutExcludedSeriesGroups(
        result.rows.filter(row => LineChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')),
        this.config.seriesGroupField,
        this.excludedSeriesGroups()
      );

      const downsampled = streamDataArgs?.queryMode === QueryModeDto.DownsamplingDto;
      this.processData(filteredRows, downsampled);
      this._dataInfo.set({ rows: filteredRows.length, points: this._categories().length, total: result.totalCount });
      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Line Chart data:', err);
      this._error.set('Failed to load data');
      this._dataInfo.set(null);
      this._resolutionSignal.set(null);
      this._isLoading.set(false);
    }
  }

  /**
   * Resolution-aware routing (AB#4290): resolve the best archive/rollup for the window + target
   * point count, then downsample the source series against it. Two fan-out shapes, both reshaped
   * onto the widget's value/series fields so the shared {@link processData} pipeline renders them
   * unchanged:
   * - default: one call per source rtId → one line per register ({@link loadPerRtIdRows}).
   * - `aggregateSeriesByGroup` (AB#4714): one call per `seriesGroupField` value with the whole
   *   group's rtIds → one server-side-summed line per group ({@link loadGroupAggregatedRows}).
   */
  private async loadResolutionAware(
    ds: PersistentQueryDataSource,
    from: Date,
    to: Date,
    sourceRtIds: string[] | undefined,
    fieldFilter: FieldFilterDto[] | undefined
  ): Promise<{ rows: QueryResultRow[]; signal: SeriesResolutionResult | null; requestedPoints: number }> {
    const targetPoints = this.computeDownsampleLimit();
    const info = await this.queryExecutor.fetchQueryArchive(ds.queryRtId);
    if (!info) {
      throw new Error('Resolution-aware line chart: base archive not found for the selected query.');
    }

    // Source scope (AB#4818): an active entity-selector binding overrides; otherwise the persisted
    // query's RtIds pin applies — the transient downsampling bypasses the persisted query execution,
    // so without re-applying the pin a pinned widget would silently aggregate every entity captured
    // by the archive.
    const scopeRtIds = sourceRtIds && sourceRtIds.length > 0 ? sourceRtIds : (info.rtIds ?? undefined);

    // The Y-axis value field is the column being reduced, so it doubles as the resolver's
    // source path (matched case-insensitively against the rollup's aggregation spec).
    const sourcePath = this.config.valueField;
    const aggregation = (ds.requiredAggregation ?? 'SUM') as CkRollupFunctionDto;

    const resolution = await this.queryExecutor.resolveSeriesQuery({
      baseArchiveRtId: info.archiveRtId,
      from,
      to,
      targetPoints,
      requiredAggregation: aggregation,
      sourcePath,
      rtIds: scopeRtIds,
      // Resolve calendar rollups in the board's zone so civil-day buckets match the
      // window (computed on the same zone by resolveCurrentTimeRange) — AB#4190.
      timeZone: this.stateService.resolveStreamDataTimeZone()
    });
    if (!resolution) {
      return { rows: [], signal: null, requestedPoints: targetPoints };
    }

    // The requested window is passed through unchanged. The widget used to snap it to the
    // resolver's effective-bucket grid, because the downsampling engine binned from whatever start
    // it was handed and an unaligned window (a relative "last N days" filter ending at the current
    // wall clock) made every bin miss the stored points. That alignment now happens where the grain
    // is actually known — the engine snaps its own axis origin — and doing it here was wrong twice
    // over for a calendar rung (AB#5157 review): `effectiveBucketMs` is an average, so anchoring it
    // to the epoch landed the axis off the calendar boundaries and outside the requested window,
    // and sizing the end as points × bucket cut the running period off. No client can compute this
    // axis: neither the grain nor the rung's alignment is part of the query contract.
    // Group-aggregation mode (AB#4714): one downsampling call PER GROUP, each with the whole
    // group's rtIds, so the transient downsampling reduces over every member (per
    // requiredAggregation) into one aggregate line. Default mode: one call per source rtId, keeping
    // each source its own series. See loadGroupAggregatedRows / loadPerRtIdRows.
    const downsample = (rtIds: string[] | undefined, label: string): Promise<QueryResultRow[]> =>
      this.queryExecutor.downsampleByArchive({
        archiveRtId: resolution.archiveRtId,
        from,
        to,
        limit: Math.max(1, resolution.points),
        sourcePath,
        aggregation: resolution.reducingFunction,
        rtIds: rtIds && rtIds.length > 0 ? rtIds : undefined,
        fieldFilter
      }).then(seriesRows => seriesRows.map(r => this.reshapeResolutionRow(r, label)));

    const rows = ds.aggregateSeriesByGroup && info.ckTypeId
      ? await this.loadGroupAggregatedRows(info.ckTypeId, scopeRtIds, downsample)
      : await this.loadPerRtIdRows(info.ckTypeId, scopeRtIds, downsample);

    return { rows, signal: resolution, requestedPoints: targetPoints };
  }

  /**
   * Group-aggregation fan-out (AB#4714): buckets the source entities by `seriesGroupField` and runs
   * one downsampling call per group with the group's rtIds. The transient downsampling reduces over
   * the group's members server-side, yielding one aggregate line per distinct group value. Falls
   * back to a single merged series when no group can be resolved. Excluded series group values
   * (AB#8128) are not queried; when they remove every group, nothing is queried and there is no data.
   */
  private async loadGroupAggregatedRows(
    ckTypeId: string,
    sourceRtIds: string[] | undefined,
    downsample: (rtIds: string[] | undefined, label: string) => Promise<QueryResultRow[]>
  ): Promise<QueryResultRow[]> {
    const allGroups = await this.queryExecutor.fetchEntityGroups(ckTypeId, this.config.seriesGroupField, sourceRtIds);
    if (allGroups.size === 0) {
      // No group attribute resolved → a single merged line over the whole (optionally scoped) set.
      return downsample(sourceRtIds, this.config.seriesGroupField);
    }
    const excluded = this.excludedSeriesGroups();
    const groups = Array.from(allGroups.entries()).filter(([groupValue]) => !excluded.has(groupValue));
    if (groups.length === 0) return [];
    const perGroup = await Promise.all(groups.map(([groupValue, rtIds]) => downsample(rtIds, groupValue)));
    return perGroup.flat();
  }

  /**
   * Default resolution-aware fan-out (AB#4290): one downsampling call per source rtId so each
   * register stays its own line, labeled from its `seriesGroupField` attribute. With no source
   * scope a single merged series is produced (labeled by the series-group field name); when an
   * excluded series group value (AB#8128) occurs among the source entities, that series covers only
   * the source entities of the other values. Scoped sources whose label is excluded are not queried.
   * On that unscoped path the merged series is built from the `fetchEntityGroups` read, so entities
   * without a group value and entities beyond its 5000 cap are not in it (a full read measured 16-80 s
   * per load, and the downsampling query fails above ~10 000 rtIds).
   */
  private async loadPerRtIdRows(
    ckTypeId: string | null,
    sourceRtIds: string[] | undefined,
    downsample: (rtIds: string[] | undefined, label: string) => Promise<QueryResultRow[]>
  ): Promise<QueryResultRow[]> {
    const excluded = this.excludedSeriesGroups();
    if (!sourceRtIds || sourceRtIds.length === 0) {
      if (excluded.size === 0 || !ckTypeId) return downsample(undefined, this.config.seriesGroupField);
      const groups = await this.queryExecutor.fetchEntityGroups(ckTypeId, this.config.seriesGroupField);
      if (!Array.from(groups.keys()).some(groupValue => excluded.has(groupValue))) {
        return downsample(undefined, this.config.seriesGroupField);
      }
      const remaining = Array.from(groups.entries()).filter(([groupValue]) => !excluded.has(groupValue)).flatMap(([, rtIds]) => rtIds);
      return remaining.length > 0 ? downsample(remaining, this.config.seriesGroupField) : [];
    }
    const labels = ckTypeId
      ? await this.queryExecutor.fetchSeriesLabels(ckTypeId, sourceRtIds, this.config.seriesGroupField)
      : new Map<string, string>();
    const perSeries = await Promise.all(
      sourceRtIds
        .map(rtId => [rtId, labels.get(rtId) ?? rtId] as const)
        .filter(([, label]) => !excluded.has(label))
        .map(([rtId, label]) => downsample([rtId], label))
    );
    return perSeries.flat();
  }

  /** Raw series group values the chart leaves out (AB#8128). */
  private excludedSeriesGroups(): ReadonlySet<string> {
    return new Set(this.config.excludedSeriesGroupValues ?? []);
  }

  /**
   * Reshapes one downsampling bin onto the widget's configured value + series-group fields so the
   * shared {@link processData} path plots it. The transient row carries the reduced value under a
   * wire column name (e.g. `amountvalue_sum`) plus the bin `timestamp`; the value is re-emitted
   * under `valueField` and the series label under `seriesGroupField`.
   */
  private reshapeResolutionRow(row: QueryResultRow, seriesLabel: string): QueryResultRow {
    const valueCell = row.cells.find(c => c.attributePath.toLowerCase() !== 'timestamp');
    return {
      __typename: 'StreamDataQueryRow',
      rtId: row.rtId,
      timestamp: row.timestamp,
      cells: [
        { attributePath: this.config.valueField, value: valueCell?.value ?? null },
        { attributePath: this.config.seriesGroupField, value: seriesLabel }
      ]
    };
  }

  /**
   * Multi-source load (AB#7951): the primary data source plus every complete query series, each
   * with its own scope, time-filter opt-out and resolution-aware routing, aligned on one time grid.
   *
   * 1. Scope: any source pending → stay loading, no query; an empty scope → the source has no
   *    series and a "No data for <source>" hint.
   * 2. Prepare: resolution-aware sources resolve their rollup rung.
   * 3. Common bucket count: the smallest of the pixel-derived target and every resolved
   *    `points` (= the coarsest effective bucket). Every source is downsampled with this count over
   *    the same window, so all of them use the same bucket width.
   * 4. Fetch all sources in parallel; one failing source gives an error hint, the others render.
   * 5. {@link alignOnTimeGrid}: shared categories, gaps as null, misaligned sources left out with a hint.
   */
  private async loadMultiSource(): Promise<void> {
    const primaryDs = this.config.dataSource as PersistentQueryDataSource;
    const sources: MultiSourceEntry[] = [
      {
        key: PRIMARY_SOURCE_KEY,
        label: primaryDs.queryName?.trim() || 'Primary query',
        dataSource: primaryDs,
        valueField: this.config.valueField,
        primary: true
      },
      ...(this.config.additionalSeries ?? [])
        .filter(isCompleteQuerySeries)
        .map((def: LineChartQuerySeries) => ({
          key: def.key,
          label: querySeriesLabel(def),
          dataSource: def.dataSource,
          valueField: def.valueField,
          primary: false
        }))
    ];

    this._isLoading.set(true);
    this._error.set(null);

    const scopes = sources.map(s =>
      this.stateService.resolveStreamDataScope(s.dataSource.entitySelectorId, s.dataSource.queryFamily, s.dataSource.ignoreTimeFilter));
    if (scopes.some(s => s.kind === 'pending')) {
      return;
    }

    try {
      const hints: LineChartSourceHint[] = [];
      const definitions = this.config.additionalSeries ?? [];
      // Hidden sources and zero-filled empty sources give no chart-level hint (AB#8046).
      const pushHint = (sourceKey: string, hint: LineChartSourceHint): void => {
        if (isSourceHintShown(sourceKey, hint.kind, definitions, this.config.primarySeries)) hints.push(hint);
      };
      const problems = new Map<string, { label: string; problem: LineChartSourceProblem }>();
      const active: MultiSourceEntry[] = [];
      sources.forEach((source, i) => {
        if (scopes[i].kind === 'empty') {
          pushHint(source.key, { kind: 'noData', sourceLabel: source.label, text: `No data for ${source.label}` });
          problems.set(source.key, { label: source.label, problem: 'noData' });
        } else {
          active.push(source);
        }
      });

      const prepared = await Promise.allSettled(active.map(s => this.prepareSource(s)));

      let limit = this.computeDownsampleLimit();
      const targetPoints = limit;
      let signal: SeriesResolutionResult | null = null;
      for (const p of prepared) {
        const resolution = p.status === 'fulfilled' ? p.value.resolutionAware?.resolution : null;
        if (resolution) {
          limit = Math.min(limit, Math.max(1, resolution.points));
          signal ??= resolution;
        }
      }

      const fetched = await Promise.allSettled(active.map((source, i) => {
        const p = prepared[i];
        return p.status === 'fulfilled'
          ? this.fetchSource(source, p.value, limit)
          : Promise.reject(p.reason);
      }));

      // carryForward (AB#8046): the last value before the window is the start value of the series.
      const fixed = this.fixedBucketWindow();
      const seeds = await this.loadCarryForwardSeeds(active, prepared, limit, fixed);

      const gridSources: TimeGridSourceInput[] = [];
      let rowCount = 0;
      fetched.forEach((f, i) => {
        const source = active[i];
        if (f.status === 'rejected') {
          console.error(`Error loading Line Chart source "${source.label}":`, f.reason);
          pushHint(source.key, { kind: 'error', sourceLabel: source.label, text: `${source.label}: ${this.errorMessage(f.reason)}` });
          problems.set(source.key, { label: source.label, problem: 'error' });
          return;
        }
        rowCount += f.value.rows.length;
        const series = source.primary
          ? primaryRowsToSeries(f.value.rows, this.config, f.value.downsampled)
          : [queryRowsToSeries(f.value.rows, source.label, source.valueField, f.value.downsampled)];
        const withData = series.filter(s => s.points.size > 0);
        if (withData.length === 0) {
          pushHint(source.key, { kind: 'noData', sourceLabel: source.label, text: `No data for ${source.label}` });
          problems.set(source.key, { label: source.label, problem: 'noData' });
          return;
        }
        gridSources.push({ sourceKey: source.key, sourceLabel: source.label, series: withData });
      });

      // Fixed bucket size (AB#8046): the grid is every bucket of the snapped window; otherwise it
      // is derived from the data (AB#7951).
      const grid = fixed ? alignOnFixedGrid(gridSources, fixed) : alignOnTimeGrid(gridSources);
      for (const m of grid.misaligned) {
        pushHint(m.sourceKey, {
          kind: 'misaligned',
          sourceLabel: m.sourceLabel,
          text: `${m.sourceLabel}: its buckets do not match the chart's time grid and are not shown`
        });
        problems.set(m.sourceKey, { label: m.sourceLabel, problem: 'misaligned' });
      }

      // Formula series, per-series visibility and stacking (AB#7952).
      const composed = composeChartSeries({
        gridSeries: grid.series,
        length: grid.instants.length,
        definitions,
        primary: this.config.primarySeries,
        stackedChart: this.stackSeries(),
        sourceProblems: problems,
        evaluator: this.expressionEvaluator,
        instants: grid.instants,
        seeds
      });
      hints.push(...composed.hints);

      this.applyAlignedGrid(grid.instants, composed.series);
      this._sourceHints.set(hints);
      this._resolutionSignal.set(signal);
      this._resolutionTarget.set(signal ? targetPoints : null);
      this.lastLimit = limit;
      this._dataInfo.set({ rows: rowCount, points: grid.instants.length, total: rowCount });
      this._isLoading.set(false);
    } catch (err) {
      console.error('Error loading Line Chart data:', err);
      this._error.set('Failed to load data');
      this._dataInfo.set(null);
      this._resolutionSignal.set(null);
      this._sourceHints.set([]);
      this._isLoading.set(false);
    }
  }

  /**
   * Start values of `carryForward` query series (AB#8046): for each such series one extra
   * downsampling request over `[from - lookback, from)` with the chart's bucket width; the last
   * non-null bucket is the value at the window start. A failed look-back only means no start value.
   */
  private async loadCarryForwardSeeds(
    active: readonly MultiSourceEntry[],
    prepared: readonly PromiseSettledResult<PreparedSource>[],
    limit: number,
    fixed: FixedBucketWindow | null
  ): Promise<Map<string, number | null>> {
    const seeds = new Map<string, number | null>();
    const definitions = this.config.additionalSeries ?? [];
    await Promise.all(active.map(async (source, i) => {
      if (source.primary) return;
      const def = definitions.find(d => d.kind === 'query' && d.key === source.key);
      const p = prepared[i];
      if (def?.missingValues !== 'carryForward' || p.status !== 'fulfilled') return;
      const lookbackMs = Math.max(0, def.carryForwardLookbackMinutes ?? DEFAULT_CARRY_FORWARD_LOOKBACK_MINUTES) * 60_000;
      const range = p.value.resolutionAware ?? p.value.timeArgs;
      if (!lookbackMs || !range?.from || !range?.to) return;
      const from = range.from;
      const bucketMs = fixed?.bucketMs ?? Math.max(1, (range.to.getTime() - from.getTime()) / Math.max(1, limit));
      const lookbackLimit = Math.min(4000, Math.max(1, Math.ceil(lookbackMs / bucketMs)));
      const lookbackFrom = new Date(from.getTime() - lookbackLimit * bucketMs);
      const shifted: PreparedSource = {
        ...p.value,
        timeArgs: { from: lookbackFrom, to: from },
        resolutionAware: p.value.resolutionAware ? { ...p.value.resolutionAware, from: lookbackFrom, to: from } : undefined
      };
      try {
        const rows = await this.fetchSource(source, shifted, lookbackLimit);
        seeds.set(source.key, lastValue(queryRowsToSeries(rows.rows, source.label, source.valueField, rows.downsampled).points));
      } catch (err) {
        console.warn(`Line Chart: no start value for "${source.label}" (look-back failed):`, err);
      }
    }));
    return seeds;
  }

  /** Resolution-aware sources resolve their rung first (step 2 of {@link loadMultiSource}). */
  private async prepareSource(source: MultiSourceEntry): Promise<PreparedSource> {
    const ds = source.dataSource;
    const timeArgs = this.streamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    if (!(ds.resolutionAware && ds.queryFamily === 'streamData' && source.valueField && timeArgs?.from && timeArgs?.to)) {
      return { timeArgs, rtIds };
    }
    const info = await this.queryExecutor.fetchQueryArchive(ds.queryRtId);
    if (!info) {
      throw new Error('base archive not found for the selected query');
    }
    const scopeRtIds = rtIds && rtIds.length > 0 ? rtIds : (info.rtIds ?? undefined);
    const resolution = await this.queryExecutor.resolveSeriesQuery({
      baseArchiveRtId: info.archiveRtId,
      from: timeArgs.from,
      to: timeArgs.to,
      targetPoints: this.computeDownsampleLimit(),
      requiredAggregation: (ds.requiredAggregation ?? 'SUM') as CkRollupFunctionDto,
      sourcePath: source.valueField,
      rtIds: scopeRtIds,
      timeZone: this.stateService.resolveStreamDataTimeZone()
    });
    return {
      timeArgs,
      rtIds,
      resolutionAware: { resolution, ckTypeId: info.ckTypeId, scopeRtIds, from: timeArgs.from, to: timeArgs.to }
    };
  }

  /** Fetches one source with the common bucket count (step 4 of {@link loadMultiSource}). */
  private async fetchSource(
    source: MultiSourceEntry,
    prepared: PreparedSource,
    limit: number
  ): Promise<{ rows: QueryResultRow[]; downsampled: boolean }> {
    const ds = source.dataSource;
    // Widget filters belong to the primary query's type; query series run unfiltered.
    const fieldFilter = source.primary ? this.convertFiltersToDto(this.config.filters) ?? undefined : undefined;

    const ra = prepared.resolutionAware;
    if (ra) {
      const resolution = ra.resolution;
      if (!resolution) return { rows: [], downsampled: true };
      const downsample = (rtIds: string[] | undefined, label: string): Promise<QueryResultRow[]> =>
        this.queryExecutor.downsampleByArchive({
          archiveRtId: resolution.archiveRtId,
          from: ra.from,
          to: ra.to,
          limit,
          sourcePath: source.valueField,
          aggregation: resolution.reducingFunction,
          rtIds: rtIds && rtIds.length > 0 ? rtIds : undefined,
          fieldFilter
        }).then(rows => source.primary
          ? rows.map(r => this.reshapeResolutionRow(r, label))
          // The transient row's one value column is named after the reducer (`<field>_min` for MIN …);
          // re-emit it under the series' value field so no reducer suffix is mistaken for a band.
          : rows.map(r => ({ ...r, cells: [{ attributePath: source.valueField, value: r.cells.find(c => c.attributePath.toLowerCase() !== 'timestamp')?.value ?? null }] })));

      if (!source.primary) {
        // One source = one series: a single call over the whole scope, reduced server-side.
        return { rows: await downsample(ra.scopeRtIds, source.label), downsampled: true };
      }
      const rows = ds.aggregateSeriesByGroup && ra.ckTypeId
        ? await this.loadGroupAggregatedRows(ra.ckTypeId, ra.scopeRtIds, downsample)
        : await this.loadPerRtIdRows(ra.ckTypeId, ra.scopeRtIds, downsample);
      return { rows, downsampled: true };
    }

    const scope = this.stateService.resolveStreamDataScope(ds.entitySelectorId, ds.queryFamily, ds.ignoreTimeFilter);
    const timeArgs = prepared.timeArgs;
    const downsampled = ds.queryFamily === 'streamData' && !!timeArgs?.from && !!timeArgs?.to;
    const streamDataArgs: StreamDataExecutionArgs | undefined = downsampled
      ? { ...timeArgs, rtIds: prepared.rtIds, limit, queryMode: QueryModeDto.DownsamplingDto }
      : (timeArgs || prepared.rtIds ? { ...timeArgs, rtIds: prepared.rtIds } : undefined);
    const result = await firstValueFrom(this.queryExecutor.execute(ds.queryFamily, ds.queryRtId, {
      fieldFilter,
      streamDataArgs,
      scopeRtIds: scope.kind === 'scoped' ? scope.rtIds : undefined
    }));
    const rows = result.rows.filter(row => LineChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? ''));
    return {
      rows: source.primary ? withoutExcludedSeriesGroups(rows, this.config.seriesGroupField, this.excludedSeriesGroups()) : rows,
      downsampled
    };
  }

  /** Writes aligned series into the chart signals (multi-source path, AB#7951). */
  private applyAlignedGrid(instants: number[], series: ComposedChartSeries[]): void {
    const mode = this.stateService.timeZoneMode();
    const days = new Set(instants.map(t => formatInstant(new Date(t), mode, { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '?'));
    const needsTime = days.size < instants.length;
    const categories = uniqueCategoryLabels(instants, d => needsTime ? this.formatDateTime(d) : this.formatDate(d));

    const unitMap = new Map<string, string>();
    const seriesData: LineSeriesData[] = series.map((s, index) => {
      if (s.unit) unitMap.set(s.name, s.unit);
      return {
        name: s.name,
        data: s.data,
        unit: s.unit,
        color: s.color ?? SERIES_PALETTE[index % SERIES_PALETTE.length],
        stacked: s.stacked,
        asLine: s.asLine,
        dashType: s.dashType
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
    // One value axis: series of different queries share it (per-unit axes stay a single-query feature).
    this._valueAxes.set([]);
    this._seriesUnitMap.set(unitMap);
  }

  /** Short message of a failed source for its hint. */
  private errorMessage(reason: unknown): string {
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
    return message ? `Failed to load data (${message})` : 'Failed to load data';
  }

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    const timeArgs = this.streamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    // Auto-downsampling (FE-1): for stream-data queries with a resolved time range, ask the
    // backend to reduce to ~one bucket per 2 px of chart width instead of streaming every row.
    // Without a time range the backend can't downsample (needs from/to/limit) → raw fallback.
    if (ds.queryFamily === 'streamData' && timeArgs?.from && timeArgs?.to) {
      return { ...timeArgs, rtIds, limit: this.computeDownsampleLimit(), queryMode: QueryModeDto.DownsamplingDto };
    }
    return { ...timeArgs, rtIds };
  }

  /**
   * The board window snapped to the fixed bucket size (AB#8046), `null` without `bucketMinutes`, without
   * a time range or for an invalid size. `ignoreTimeFilter` sources have no window and get `null`.
   */
  private fixedBucketWindow(ignoreTimeFilter?: boolean): FixedBucketWindow | null {
    const minutes = this.config?.bucketMinutes;
    if (!minutes) return null;
    const range = this.stateService.resolveStreamDataTimeArgs(ignoreTimeFilter);
    if (!range?.from || !range?.to) return null;
    return snapWindowToBuckets(range.from, range.to, minutes, this.stateService.timeZoneMode());
  }

  /**
   * Stream-data window of a source: the board window, snapped to whole buckets when the chart has a
   * fixed bucket size (AB#8046), so `(to - from) / limit` is exactly the bucket size.
   */
  private streamDataTimeArgs(ignoreTimeFilter?: boolean): { from: Date; to: Date } | undefined {
    const fixed = this.fixedBucketWindow(ignoreTimeFilter);
    return fixed ? { from: fixed.from, to: fixed.to } : this.stateService.resolveStreamDataTimeArgs(ignoreTimeFilter);
  }

  /**
   * Bucket count for backend downsampling, sized to the rendered width (~1 bucket / 2 px),
   * clamped to [50, 4000]. Falls back to 1500 before the host has a measured width.
   */
  private computeDownsampleLimit(): number {
    const fixed = this.fixedBucketWindow();
    if (fixed) return fixed.count;
    const width = (this.elementRef.nativeElement as HTMLElement)?.offsetWidth ?? 0;
    const effective = width > 50 ? width : 1500;
    return Math.min(4000, Math.max(50, Math.round(effective / 2)));
  }

  /**
   * Processes query rows into line chart data.
   * Groups by seriesGroupField, orders by categoryField (date), supports multi-axis by unitField.
   */
  private processData(filteredRows: QueryResultRow[], downsample = false): void {
    const categoryField = this.config.categoryField;
    const seriesGroupField = this.config.seriesGroupField;
    const valueField = this.config.valueField;
    const unitField = this.config.unitField;

    // Collect data: category -> seriesGroup -> value (and, for downsampling, the min/max band)
    const dataMap = new Map<string, Map<string, number | null>>();
    const bandMap = new Map<string, Map<string, { from: number; to: number }>>();
    const allCategories = new Map<string, Date>(); // label -> parsed date for sorting
    const allSeriesGroups = new Set<string>();
    const seriesUnitMap = new Map<string, string>(); // seriesGroup -> unit

    for (const row of filteredRows) {
      // In downsampling mode the x-axis is the bucket timestamp (the persisted category column
      // comes back reduced, e.g. `window_start_max`); use the row's bin timestamp instead.
      let categoryValue = downsample && row.timestamp ? String(row.timestamp) : '';
      let seriesGroupValue = '';
      let lineValue: number | null = downsample ? null : 0;
      let minValue: number | null = null;
      let maxValue: number | null = null;
      let unitValue = '';

      for (const cell of row.cells) {
        const path = cell.attributePath;
        if (!downsample && matchesAttributePath(path, categoryField)) {
          categoryValue = String(cell.value ?? '');
        } else if (matchesAttributePath(path, seriesGroupField)) {
          seriesGroupValue = String(cell.value ?? '');
        } else if (matchesAttributePath(path, valueField)) {
          if (downsample) {
            // The value column is reduced to <field>_avg / _min / _max — split them out so the
            // avg drives the line and min/max form the envelope band.
            const lower = path.toLowerCase();
            if (lower.endsWith('_min')) minValue = this.toNumber(cell.value);
            else if (lower.endsWith('_max')) maxValue = this.toNumber(cell.value);
            else lineValue = this.toNumber(cell.value); // _avg (or an unsuffixed value)
          } else {
            // Exact cell first, so a null `<field>_integral` never overrides a usable `<field>`.
            const val = (findCellForField(row.cells, valueField) ?? cell).value;
            if (val === null || val === undefined) {
              // No data (e.g. an Integral over an empty bucket, AB#7975): no point, not 0.
              lineValue = null;
            } else {
              lineValue = typeof val === 'number' ? val : parseFloat(String(val));
              if (isNaN(lineValue)) lineValue = 0;
            }
          }
        } else if (unitField && matchesAttributePath(path, unitField)) {
          unitValue = String(cell.value ?? '');
        }
      }

      // Stream-data rows carry time stamp and source entity as row properties, not cells (AB#8069).
      if (!categoryValue) categoryValue = rowFieldText(row, categoryField);
      if (!seriesGroupValue) seriesGroupValue = rowFieldText(row, seriesGroupField);

      if (categoryValue && seriesGroupValue) {
        // Parse date for sorting. toInstant treats a naive wire timestamp (no zone designator)
        // as UTC — a bare `new Date(...)` would reinterpret it as browser-local time and shift
        // the axis by the UTC offset (AB#4818).
        if (!allCategories.has(categoryValue)) {
          allCategories.set(categoryValue, toInstant(categoryValue) ?? new Date(NaN));
        }

        allSeriesGroups.add(seriesGroupValue);

        if (!dataMap.has(categoryValue)) {
          dataMap.set(categoryValue, new Map());
        }
        dataMap.get(categoryValue)!.set(seriesGroupValue, lineValue);

        if (downsample && minValue !== null && maxValue !== null) {
          if (!bandMap.has(categoryValue)) {
            bandMap.set(categoryValue, new Map());
          }
          bandMap.get(categoryValue)!.set(seriesGroupValue, { from: minValue, to: maxValue });
        }

        // Track unit per series
        if (unitField && unitValue) {
          seriesUnitMap.set(seriesGroupValue, unitValue);
        }
      }
    }

    // Sort categories chronologically
    const sortedCategoryEntries = Array.from(allCategories.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime());

    // Detect if we need time precision (multiple data points per day). The
    // day-key is computed on the board's timezone basis so the date axis stays
    // consistent with the time filter and the rest of the board.
    const mode = this.stateService.timeZoneMode();
    const dateOnlySet = new Set(
      sortedCategoryEntries.map(([, date]) => formatInstant(date, mode, { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '?')
    );
    const needsTime = dateOnlySet.size < sortedCategoryEntries.length;

    const categories = sortedCategoryEntries.map(([, date]) =>
      needsTime ? this.formatDateTime(date) : this.formatDate(date)
    );
    const categoryKeys = sortedCategoryEntries.map(([key]) => key);
    const seriesGroups = Array.from(allSeriesGroups);

    // Build value axes based on unique units
    const valueAxes: ValueAxisConfig[] = [];
    if (unitField && seriesUnitMap.size > 0) {
      const uniqueUnits = Array.from(new Set(seriesUnitMap.values()));
      uniqueUnits.forEach((unit, index) => {
        valueAxes.push({
          name: `unit_${this.sanitizeAxisName(unit)}`,
          unit,
          position: index === 0 ? 'left' : 'right'
        });
      });
    }

    // Build series data
    const seriesData: LineSeriesData[] = seriesGroups.map((seriesGroup, index) => {
      const data = categoryKeys.map(categoryKey => {
        return dataMap.get(categoryKey)?.get(seriesGroup) ?? null;
      });

      // Build the min/max envelope band only when downsampling produced one for this series.
      const band = downsample && bandMap.size > 0
        ? categoryKeys.map(categoryKey => bandMap.get(categoryKey)?.get(seriesGroup) ?? null)
        : undefined;

      const unit = seriesUnitMap.get(seriesGroup);
      const axisName = unit ? `unit_${this.sanitizeAxisName(unit)}` : undefined;

      return {
        name: seriesGroup,
        data,
        band,
        unit,
        axisName,
        color: SERIES_PALETTE[index % SERIES_PALETTE.length]
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
    this._valueAxes.set(valueAxes);
    this._seriesUnitMap.set(seriesUnitMap);
  }

  /**
   * Formats a date for display on the category axis (date only).
   */
  private formatDate(date: Date): string {
    return formatInstant(date, this.stateService.timeZoneMode(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) ?? '?';
  }

  /**
   * Formats a date with time for display on the category axis.
   * Date and time parts are formatted separately (joined with a space) to keep
   * the compact axis label; both honor the board's timezone mode.
   */
  private formatDateTime(date: Date): string {
    const mode = this.stateService.timeZoneMode();
    const datePart = formatInstant(date, mode, { day: '2-digit', month: '2-digit' });
    const timePart = formatInstant(date, mode, { hour: '2-digit', minute: '2-digit' });
    if (datePart === null || timePart === null) return '?';
    return `${datePart} ${timePart}`;
  }

  private sanitizeAxisName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /** Parses a cell value to a number, or null when missing / non-numeric (renders as a gap). */
  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(n) ? null : n;
  }

  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}

/** Text of a stream-data row field (`timestamp` / `rtId`, AB#8069), '' when the field is none or empty. */
function rowFieldText(row: QueryResultRow, field: string): string {
  const value = streamDataRowFieldValue(row, field);
  if (value === null || value === undefined) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}
