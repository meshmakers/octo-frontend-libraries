import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineChartWidgetConfig, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { QueryExecutorService, QueryResultRow, SeriesResolutionResult, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { CkRollupFunctionDto, FieldFilterDto, QueryModeDto, SeriesResolutionSignalDto } from '@meshmakers/octo-services';
import { matchesAttributePath } from '../../utils/widget-data-utils';
import { formatInstant, toInstant } from '../../utils/meshboard-datetime';

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
                [content]="categoryLabelContent">
              </kendo-chart-category-axis-item-labels>
            </kendo-chart-category-axis-item>
          </kendo-chart-category-axis>

          @if (valueAxes().length > 0) {
            <kendo-chart-value-axis>
              @for (axis of valueAxes(); track axis.name) {
                <kendo-chart-value-axis-item
                  [name]="axis.name"
                  [title]="{ text: axis.unit }"
                  [line]="{ visible: false }"
                  [majorGridLines]="{ color: 'rgba(255,255,255,0.06)' }"
                  [plotBands]="plotBands()">
                </kendo-chart-value-axis-item>
              }
            </kendo-chart-value-axis>
          }

          @if (valueAxes().length === 0) {
            <kendo-chart-value-axis>
              <kendo-chart-value-axis-item
                [name]="''"
                [title]="{ text: config.valueAxisTitle ?? '' }"
                [line]="{ visible: false }"
                [majorGridLines]="{ color: 'rgba(255,255,255,0.06)' }"
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
                [type]="chartType()"
                [style]="'smooth'"
                [data]="series.data"
                [name]="series.name"
                [axis]="series.axisName ?? ''"
                [color]="series.color"
                [opacity]="0.7"
                [markers]="{ visible: config.showMarkers ?? false }">
              </kendo-chart-series-item>
            }
          </kendo-chart-series>

          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'right'">
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
                @for (point of points; track point.series.name) {
                  @if (!isBandSeries(point.series.name)) {
                    <br/>{{ point.series.name }}: {{ formatValue(point.value) }}{{ getUnitForSeries(point.series.name) }}
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

  /**
   * Resolution-aware hint (AB#4290): a short badge describing the archive-selection outcome —
   * `null` for a clean reduction (signal OK), a warning otherwise (fewer points delivered, or no
   * compatible rollup so the raw archive was returned unreduced). Mirrors the resolver's signal.
   */
  readonly resolutionHint = computed((): { text: string; title: string } | null => {
    const s = this._resolutionSignal();
    if (!s) return null;
    const diag = s.diagnostic ?? '';
    switch (s.signal) {
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
    switch (s.signal) {
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

    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      // Resolution-aware routing (AB#4290): let the server pick the archive/rollup for the visible
      // window + target point count, then downsample each source series against it. Requires a
      // stream-data query, a resolved time range, and a value field (which doubles as the series'
      // source path — the resolver matches it against the rollup's aggregation spec, case-insensitively).
      const timeArgs = this.stateService.resolveStreamDataTimeArgs(queryDataSource.ignoreTimeFilter);
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
          streamDataArgs
        }).pipe(
          catchError(err => {
            console.error('Error loading Line Chart data:', err);
            throw err;
          })
        )
      );

      const filteredRows = result.rows.filter(row =>
        LineChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')
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

    // Snap the query window to the resolver's effective-bucket grid. The downsampling engine only
    // aggregates a stored point into a bin when the bin width equals the data grain AND the window
    // start sits on that grid (from the epoch). An unaligned window — e.g. a relative "last N days"
    // filter ending at the current wall-clock time (…:42:54) — otherwise makes every bin miss the
    // hourly/interval data and yields an all-null (blank) chart. Aligning from + sizing to
    // points × bucket makes each bin land exactly on a stored point.
    let qFrom = from;
    let qTo = to;
    if (resolution.effectiveBucketMs > 0) {
      const bucket = resolution.effectiveBucketMs;
      const alignedFrom = Math.floor(from.getTime() / bucket) * bucket;
      qFrom = new Date(alignedFrom);
      qTo = new Date(alignedFrom + Math.max(1, resolution.points) * bucket);
    }

    // Group-aggregation mode (AB#4714): one downsampling call PER GROUP, each with the whole
    // group's rtIds, so the transient downsampling reduces over every member (per
    // requiredAggregation) into one aggregate line. Default mode: one call per source rtId, keeping
    // each source its own series. See loadGroupAggregatedRows / loadPerRtIdRows.
    const downsample = (rtIds: string[] | undefined, label: string): Promise<QueryResultRow[]> =>
      this.queryExecutor.downsampleByArchive({
        archiveRtId: resolution.archiveRtId,
        from: qFrom,
        to: qTo,
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
   * back to a single merged series when no group can be resolved.
   */
  private async loadGroupAggregatedRows(
    ckTypeId: string,
    sourceRtIds: string[] | undefined,
    downsample: (rtIds: string[] | undefined, label: string) => Promise<QueryResultRow[]>
  ): Promise<QueryResultRow[]> {
    const groups = await this.queryExecutor.fetchEntityGroups(ckTypeId, this.config.seriesGroupField, sourceRtIds);
    if (groups.size === 0) {
      // No group attribute resolved → a single merged line over the whole (optionally scoped) set.
      return downsample(sourceRtIds, this.config.seriesGroupField);
    }
    const perGroup = await Promise.all(
      Array.from(groups.entries()).map(([groupValue, rtIds]) => downsample(rtIds, groupValue))
    );
    return perGroup.flat();
  }

  /**
   * Default resolution-aware fan-out (AB#4290): one downsampling call per source rtId so each
   * register stays its own line, labeled from its `seriesGroupField` attribute. With no source
   * scope a single merged series is produced (labeled by the series-group field name).
   */
  private async loadPerRtIdRows(
    ckTypeId: string | null,
    sourceRtIds: string[] | undefined,
    downsample: (rtIds: string[] | undefined, label: string) => Promise<QueryResultRow[]>
  ): Promise<QueryResultRow[]> {
    const seriesRtIds: (string | undefined)[] = sourceRtIds && sourceRtIds.length > 0 ? sourceRtIds : [undefined];
    const labels = ckTypeId
      ? await this.queryExecutor.fetchSeriesLabels(ckTypeId, sourceRtIds ?? [], this.config.seriesGroupField)
      : new Map<string, string>();

    const perSeries = await Promise.all(
      seriesRtIds.map(rtId =>
        downsample(rtId ? [rtId] : undefined, rtId ? (labels.get(rtId) ?? rtId) : this.config.seriesGroupField))
    );
    return perSeries.flat();
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

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
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
   * Bucket count for backend downsampling, sized to the rendered width (~1 bucket / 2 px),
   * clamped to [50, 4000]. Falls back to 1500 before the host has a measured width.
   */
  private computeDownsampleLimit(): number {
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
            const val = cell.value;
            lineValue = typeof val === 'number' ? val : parseFloat(String(val));
            if (isNaN(lineValue)) lineValue = 0;
          }
        } else if (unitField && matchesAttributePath(path, unitField)) {
          unitValue = String(cell.value ?? '');
        }
      }

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
