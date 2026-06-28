import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineChartWidgetConfig, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { QueryExecutorService, QueryExecutionResult, QueryResultRow, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto, QueryModeDto } from '@meshmakers/octo-services';
import { matchesAttributePath } from '../../utils/widget-data-utils';
import { formatInstant } from '../../utils/meshboard-datetime';

/** Series colours so a series' min/max band and its avg line share one hue. */
const SERIES_PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

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
          <span class="data-count" [title]="'Loaded rows · distinct category points (totalCount ' + info.total + ')'">
            {{ info.rows }} rows · {{ info.points }} pts
          </span>
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

          <kendo-chart-tooltip>
            <ng-template kendoChartSeriesTooltipTemplate let-value="value" let-category="category" let-series="series">
              <div class="chart-tooltip">
                <strong>{{ category }}</strong><br/>
                {{ series.name }}: {{ formatValue(value) }}{{ getUnitForSeries(series.name) }}
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

  /**
   * Page size for the raw-rows fallback (see `loadData`). Bounds the worst case
   * when downsampling collapsed to null buckets and we refetch unaggregated rows;
   * the fallback only fires for sparse ranges, so this ceiling is rarely reached.
   */
  private static readonly RAW_FALLBACK_FIRST = 5000;

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

  readonly isLoading = this._isLoading.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly seriesData = this._seriesData.asReadonly();
  readonly valueAxes = this._valueAxes.asReadonly();
  readonly error = this._error.asReadonly();
  readonly dataInfo = this._dataInfo.asReadonly();

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

  private async loadData(): Promise<void> {
    if (this.isNotConfigured()) return;

    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);
      // queryFamily may be undefined for legacy widget configs — the executor
      // falls back to a one-time lookup by rtId. streamDataArgs is sent
      // unconditionally because the runtime path ignores it.
      const streamDataArgs = this.buildStreamDataArgs();
      const downsampled = streamDataArgs?.queryMode === QueryModeDto.DownsamplingDto;
      // Remember the resolution used so a later resize can decide whether to re-query (FE-2).
      this.lastLimit = streamDataArgs?.limit ?? 0;

      let result = await this.runQuery(queryDataSource, fieldFilter, streamDataArgs);
      let filteredRows = this.supportedRows(result);
      this.processData(filteredRows, downsampled);

      // Downsampling fallback: the backend reduces a stream-data range to
      // evenly-spaced buckets, but returns null aggregates for *every* bucket
      // when the requested bucket count meets or exceeds the number of distinct
      // source timestamps (sparse data and/or a very wide chart). That yields
      // rows with no plottable values — the chart would read "No data available"
      // and the counter would show the bogus bucket total. Detect it (rows came
      // back but nothing plotted) and refetch once as raw, unaggregated rows,
      // which always plot and report the real row/point counts.
      if (downsampled && this._categories().length === 0 && filteredRows.length > 0) {
        const rawArgs: StreamDataExecutionArgs | undefined = streamDataArgs
          ? { ...streamDataArgs, limit: null, queryMode: QueryModeDto.DefaultDto }
          : undefined;
        this.lastLimit = 0; // raw load — width-driven resize re-query no longer applies
        result = await this.runQuery(queryDataSource, fieldFilter, rawArgs, LineChartWidgetComponent.RAW_FALLBACK_FIRST);
        filteredRows = this.supportedRows(result);
        this.processData(filteredRows, false);
      }

      this._dataInfo.set({ rows: filteredRows.length, points: this._categories().length, total: result.totalCount });
      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Line Chart data:', err);
      this._error.set('Failed to load data');
      this._dataInfo.set(null);
      this._isLoading.set(false);
    }
  }

  /** Runs one query pass through the executor (shared by the normal load and the raw fallback). */
  private runQuery(
    ds: PersistentQueryDataSource,
    fieldFilter: FieldFilterDto[] | undefined,
    streamDataArgs: StreamDataExecutionArgs | undefined,
    first?: number
  ): Promise<QueryExecutionResult> {
    return firstValueFrom(
      this.queryExecutor.execute(ds.queryFamily, ds.queryRtId, {
        first: first ?? undefined,
        fieldFilter: fieldFilter ?? undefined,
        streamDataArgs
      }).pipe(
        catchError(err => {
          console.error('Error loading Line Chart data:', err);
          throw err;
        })
      )
    );
  }

  /** Rows of a result that this chart knows how to plot. */
  private supportedRows(result: QueryExecutionResult): QueryResultRow[] {
    return result.rows.filter(row =>
      LineChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')
    );
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
        // Parse date for sorting
        if (!allCategories.has(categoryValue)) {
          allCategories.set(categoryValue, new Date(categoryValue));
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
