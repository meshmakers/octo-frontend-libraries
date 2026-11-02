import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarChartWidgetConfig, BarChartType, LineChartQuerySeries, PersistentQueryDataSource, SeriesDashType, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { QueryExecutorService, QueryResultRow, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { emptyQueryExecutionResult } from '../../utils/stream-data-scope';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { findCellForField } from '../../utils/widget-data-utils';
import { isIsoDateTime, formatInstant } from '../../utils/meshboard-datetime';
import { injectChartTheme } from '../../utils/chart-theme';
import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import {
  composeChartSeries,
  isCompleteFormulaSeries,
  isCompleteQuerySeries,
  isSourceHintShown,
  LineChartSourceHint,
  LineChartSourceProblem,
  PRIMARY_SOURCE_KEY,
  querySeriesLabel
} from '../line-chart-widget/line-chart-multi-source';
import {
  alignOnCategories,
  CategorySourceInput,
  CategoryValue,
  primaryRowsToCategorySeries,
  queryRowsToCategorySeries,
  uniqueLabels
} from './bar-chart-multi-source';

/** One source of a multi-source bar chart (AB#7953): the primary query or a query series. */
interface BarChartSourceEntry {
  key: string;
  label: string;
  dataSource: PersistentQueryDataSource;
  primary: boolean;
  /** Query series only. */
  categoryField?: string;
  valueField?: string;
}

/**
 * Series data for the bar chart
 */
interface SeriesData {
  name: string;
  data: unknown[];
  color?: string;
  /** Multi-source path (AB#8046): drawn as a line over the bars. */
  asLine?: boolean;
  /** Multi-source path (AB#8046): line style of a line series. */
  dashType?: SeriesDashType;
  /** Multi-source path (AB#8046): the line uses the second value axis. */
  secondaryAxis?: boolean;
}

/** Name of the second value axis of a bar chart with a line on it (AB#8046). */
const SECONDARY_AXIS = 'secondary';

/**
 * Mapping from our chart types to Kendo chart configuration
 */
interface KendoChartConfig {
  type: 'column' | 'bar';
  stack: boolean | string;
}

const CHART_TYPE_MAPPING: Record<BarChartType, KendoChartConfig> = {
  column: { type: 'column', stack: false },
  bar: { type: 'bar', stack: false },
  stackedColumn: { type: 'column', stack: true },
  stackedBar: { type: 'bar', stack: true },
  stackedColumn100: { type: 'column', stack: '100%' },
  stackedBar100: { type: 'bar', stack: '100%' }
};

@Component({
  selector: 'mm-bar-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="bar-chart-widget" [class.loading]="isLoading()" [class.error]="error()">
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
        @if (sourceHints().length > 0) {
          <ul class="source-hints" aria-live="polite">
            @for (hint of sourceHints(); track hint.text) {
              <li class="source-hint" [class.error]="hint.kind === 'error'" [class.warn]="hint.kind === 'dependency'">
                @if (hint.kind !== 'noData') {<span aria-hidden="true">⚠ </span>}{{ hint.text }}
              </li>
            }
          </ul>
        }
        <kendo-chart class="chart-container" [plotArea]="{ background: 'transparent', margin: plotAreaMargin() }">
          <kendo-chart-area [background]="'transparent'"></kendo-chart-area>
          <kendo-chart-category-axis>
            <kendo-chart-category-axis-item
              [categories]="categories()"
              [axisCrossingValue]="axisCrossingValues()"
              [line]="{ visible: false }"
              [majorGridLines]="{ visible: false }">
              <kendo-chart-category-axis-item-labels
                [rotation]="labelRotation()"
                [color]="chartTheme().muted"
                [content]="categoryLabelContent">
              </kendo-chart-category-axis-item-labels>
            </kendo-chart-category-axis-item>
          </kendo-chart-category-axis>

          <kendo-chart-value-axis>
            <kendo-chart-value-axis-item
              [line]="{ visible: false }"
              [labels]="{ color: chartTheme().muted }"
              [majorGridLines]="{ color: chartTheme().grid }">
            </kendo-chart-value-axis-item>
            @if (hasSecondaryAxis()) {
              <!-- Second value axis on the right for line series (AB#8046). -->
              <kendo-chart-value-axis-item
                [name]="secondaryAxisName"
                [line]="{ visible: false }"
                [labels]="{ color: chartTheme().muted }"
                [majorGridLines]="{ visible: false }">
              </kendo-chart-value-axis-item>
            }
          </kendo-chart-value-axis>

          <kendo-chart-series>
            @for (series of seriesData(); track series.name) {
              <kendo-chart-series-item
                [type]="series.asLine ? 'line' : kendoChartType()"
                [data]="series.data"
                [name]="series.name"
                [color]="series.color"
                [field]="hasColorThresholds() ? 'value' : ''"
                [colorField]="hasColorThresholds() && !series.asLine ? '_color' : ''"
                [border]="{ width: 0 }"
                [gap]="0.8"
                [axis]="series.secondaryAxis ? secondaryAxisName : ''"
                [dashType]="series.dashType ?? 'solid'"
                [missingValues]="'gap'"
                [markers]="{ visible: !!series.asLine }"
                [stack]="series.asLine ? false : stackConfig()">
                @if (config.showDataLabels) {
                  <kendo-chart-series-item-labels
                    [visible]="true"
                    [color]="chartTheme().text"
                    [format]="dataLabelFormat()">
                  </kendo-chart-series-item-labels>
                }
              </kendo-chart-series-item>
            }
          </kendo-chart-series>

          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'right'"
            [labels]="{ color: chartTheme().text }">
          </kendo-chart-legend>

          @if (isMultiSource()) {
            <!-- Multi-source (AB#7953): one tooltip per category with every drawn series; no bar shows "–". -->
            <kendo-chart-tooltip [shared]="true">
              <ng-template kendoChartSharedTooltipTemplate let-category="category">
                <div class="chart-tooltip">
                  <strong>{{ category }}</strong>
                  @for (row of tooltipRows(category); track row.name) {
                    <br/>{{ row.name }}: {{ row.text }}
                  }
                </div>
              </ng-template>
            </kendo-chart-tooltip>
          } @else {
            <kendo-chart-tooltip>
              <ng-template kendoChartSeriesTooltipTemplate let-value="value" let-category="category" let-series="series">
                <div class="chart-tooltip">
                  <strong>{{ category }}</strong><br/>
                  {{ series.name }}: {{ formatValue(value) }}
                </div>
              </ng-template>
            </kendo-chart-tooltip>
          }
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

    .bar-chart-widget {
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

    .bar-chart-widget.loading,
    .bar-chart-widget.error {
      opacity: 0.7;
    }

    .loading-indicator,
    .error-message,
    .no-config-overlay {
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

    .no-config-overlay span {
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
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

    /* Per-source hints of a multi-source chart (AB#7953), same look as the line chart's. */
    .source-hints {
      position: absolute;
      top: 4px;
      left: 6px;
      z-index: 2;
      max-width: calc(100% - 12px);
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
  `]
})
export class BarChartWidgetComponent implements DashboardWidget<BarChartWidgetConfig, SeriesData[]>, OnInit, OnChanges {
  private readonly queryExecutor = inject(QueryExecutorService);
  /** Text / grid colours of the current theme, re-resolved on a live theme switch (AB#5568). */
  protected readonly chartTheme = injectChartTheme();


  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtSimpleQueryRow',
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  @Input() config!: BarChartWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _categories = signal<string[]>([]);
  private readonly _seriesData = signal<SeriesData[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly seriesData = this._seriesData.asReadonly();
  readonly error = this._error.asReadonly();

  // Multi-source path (AB#7953): per-source hints and whether the last load went through it.
  private readonly _sourceHints = signal<LineChartSourceHint[]>([]);
  readonly sourceHints = this._sourceHints.asReadonly();
  private readonly _multiSource = signal(false);
  readonly isMultiSource = this._multiSource.asReadonly();

  readonly data = computed(() => this._seriesData());

  /** Name of the second value axis (template binding, AB#8046). */
  get secondaryAxisName(): string { return SECONDARY_AXIS; }

  /** A drawn line series uses the second value axis (AB#8046). */
  readonly hasSecondaryAxis = computed(() => this._seriesData().some(s => s.secondaryAxis));

  /**
   * Where the value axes cross the category axis: with a second axis it sits at the far end (right),
   * otherwise Kendo's default.
   */
  readonly axisCrossingValues = computed((): number[] | undefined =>
    this.hasSecondaryAxis() ? [0, Number.MAX_SAFE_INTEGER] : undefined);

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      if (!ds.queryRtId || !this.config?.categoryField) return true;

      // Dynamic Series Mode: seriesGroupField + valueField
      if (this.config?.seriesGroupField && this.config?.valueField) {
        return false;
      }

      // Static Series Mode: series array with at least one entry
      return !(this.config?.series?.length > 0);
    }

    return true; // Unknown data source type
  }

  readonly kendoChartType = computed(() => {
    const chartType = this.config?.chartType ?? 'column';
    return CHART_TYPE_MAPPING[chartType]?.type ?? 'column';
  });

  readonly stackConfig = computed(() => {
    const chartType = this.config?.chartType ?? 'column';
    return CHART_TYPE_MAPPING[chartType]?.stack ?? false;
  });

  readonly labelRotation = computed(() => {
    // Rotate labels for column charts if many categories
    const isColumn = this.kendoChartType() === 'column';
    const categoryCount = this._categories().length;
    return isColumn && categoryCount > 5 ? -45 : 0;
  });

  /** Extra margin so long category axis labels are not clipped. */
  readonly plotAreaMargin = computed(() => {
    const isBar = this.kendoChartType() === 'bar';
    // Horizontal bar charts need more left margin for category labels on the Y-axis
    return isBar ? { top: 0, right: 0, bottom: 0, left: 10 } : { top: 0, right: 0, bottom: 0, left: 0 };
  });

  /** Truncates long category axis labels to prevent overflow. */
  categoryLabelContent = (e: { value: string }): string => {
    const maxLen = 18;
    return e.value.length > maxLen ? e.value.substring(0, maxLen) + '...' : e.value;
  };

  ngOnInit(): void {
    this.loadData();
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
      if (!ds.queryRtId || !this.config.categoryField) return false;

      // Dynamic Series Mode: seriesGroupField + valueField
      if (this.config.seriesGroupField && this.config.valueField) {
        return true;
      }

      // Static Series Mode: series array with at least one entry
      return !!(this.config.series?.length > 0);
    }

    return false;
  }

  /**
   * Checks if using dynamic series mode (seriesGroupField + valueField)
   */
  private isDynamicSeriesMode(): boolean {
    return !!(this.config.seriesGroupField && this.config.valueField);
  }

  /** Whether the chart reads series from more than its primary query or has formula series (AB#7953). */
  hasAdditionalSeries(): boolean {
    return (this.config?.additionalSeries ?? []).some(s => this.isLoadableQuerySeries(s) || isCompleteFormulaSeries(s));
  }

  private isLoadableQuerySeries(s: unknown): s is LineChartQuerySeries {
    return isCompleteQuerySeries(s as LineChartQuerySeries) && !!(s as LineChartQuerySeries).categoryField;
  }

  /**
   * Shared tooltip rows of the multi-source path (AB#7953): one row per drawn series for the
   * hovered category; no bar (null) shows "–".
   */
  tooltipRows(category: string): { name: string; text: string }[] {
    const index = this._categories().indexOf(category);
    if (index < 0) return [];
    return this._seriesData().map(s => {
      const raw = s.data[index];
      const value = raw !== null && typeof raw === 'object' ? (raw as { value: number | null }).value : raw as number | null | undefined;
      return { name: s.name, text: value === null || value === undefined ? '–' : this.formatValue(value) };
    });
  }

  formatValue(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  private async loadData(): Promise<void> {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    if (this.hasAdditionalSeries()) {
      await this.loadMultiSource();
      return;
    }
    this._multiSource.set(false);
    this._sourceHints.set([]);

    // Note: isNotConfigured() check ensures dataSource and queryRtId are set
    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);
      // queryFamily may be undefined for legacy widget configs — the executor
      // falls back to a one-time lookup by rtId. streamDataArgs is sent
      // unconditionally because the runtime path ignores it.
      // Entity-selector scope (AB#7721): pending → stay in the loading state and
      // send no query (the view refreshes once the scope is known); empty → render
      // the empty chart without querying the persisted (unscoped) scope.
      const scope = this.stateService.resolveStreamDataScope(queryDataSource.entitySelectorId, queryDataSource.queryFamily, queryDataSource.ignoreTimeFilter);
      if (scope.kind === 'pending') {
        return;
      }
      const streamDataArgs = this.buildStreamDataArgs();

      const result = scope.kind === 'empty'
        ? emptyQueryExecutionResult(queryDataSource.queryFamily)
        : await firstValueFrom(
          this.queryExecutor.execute(queryDataSource.queryFamily, queryDataSource.queryRtId, {
            fieldFilter: fieldFilter ?? undefined,
            streamDataArgs,
            // Runtime queries: `rtId IN` field filter (AB#7725); stream data: arg.rtIds.
            scopeRtIds: scope.kind === 'scoped' ? scope.rtIds : undefined
          }).pipe(
            catchError(err => {
              console.error('Error loading Bar Chart data:', err);
              throw err;
            })
          )
        );

      const filteredRows = result.rows.filter(row =>
        BarChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')
      );

      if (this.isDynamicSeriesMode()) {
        this.processDynamicSeriesData(filteredRows);
      } else {
        this.processStaticSeriesData(filteredRows);
      }

      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Bar Chart data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  /**
   * Multi-source load (AB#7953): the primary query plus every complete query series, each with its
   * own scope and time-filter opt-out, matched per category value.
   *
   * 1. Scope per source: any `pending` → stay loading, no query; `empty` → no series for that
   *    source and a "No data for <source>" hint.
   * 2. All sources load in parallel; a failing source gives an error hint, the others render.
   * 3. `valueScale` is applied to every source value, then {@link alignOnCategories} builds the
   *    union of categories (chronological when all are date-times); a category a source lacks is
   *    no bar for its series.
   * 4. `composeChartSeries` (shared with the line chart) evaluates formula series per category,
   *    drops hidden series and adds "depends on <source>, which failed" hints.
   */
  private async loadMultiSource(): Promise<void> {
    const primaryDs = this.config.dataSource as PersistentQueryDataSource;
    const sources: BarChartSourceEntry[] = [
      { key: PRIMARY_SOURCE_KEY, label: primaryDs.queryName?.trim() || 'Primary query', dataSource: primaryDs, primary: true },
      ...(this.config.additionalSeries ?? [])
        .filter((s): s is LineChartQuerySeries => this.isLoadableQuerySeries(s))
        .map(def => ({
          key: def.key,
          label: querySeriesLabel(def),
          dataSource: def.dataSource,
          primary: false,
          categoryField: def.categoryField,
          valueField: def.valueField
        }))
    ];

    this._isLoading.set(true);
    this._error.set(null);
    this._multiSource.set(true);

    const scopes = sources.map(s =>
      this.stateService.resolveStreamDataScope(s.dataSource.entitySelectorId, s.dataSource.queryFamily, s.dataSource.ignoreTimeFilter));
    if (scopes.some(s => s.kind === 'pending')) {
      return;
    }

    try {
      const hints: LineChartSourceHint[] = [];
      const problems = new Map<string, { label: string; problem: LineChartSourceProblem }>();
      const definitions = this.config.additionalSeries ?? [];
      // Hidden sources and zero-filled empty sources give no chart-level hint (AB#8046).
      const pushHint = (sourceKey: string, hint: LineChartSourceHint): void => {
        if (isSourceHintShown(sourceKey, hint.kind, definitions, this.config.primarySeries)) hints.push(hint);
      };
      const noData = (source: BarChartSourceEntry): void => {
        pushHint(source.key, { kind: 'noData', sourceLabel: source.label, text: `No data for ${source.label}` });
        problems.set(source.key, { label: source.label, problem: 'noData' });
      };

      const active: { source: BarChartSourceEntry; rtIds?: string[] }[] = [];
      sources.forEach((source, i) => {
        const scope = scopes[i];
        if (scope.kind === 'empty') noData(source);
        else active.push({ source, rtIds: scope.kind === 'scoped' ? scope.rtIds : undefined });
      });

      const fetched = await Promise.allSettled(active.map(a => this.fetchSourceRows(a.source, a.rtIds)));

      const valueScale = this.config.valueScale ?? 1;
      const categorySources: CategorySourceInput[] = [];
      fetched.forEach((f, i) => {
        const source = active[i].source;
        if (f.status === 'rejected') {
          console.error(`Error loading Bar Chart source "${source.label}":`, f.reason);
          pushHint(source.key, { kind: 'error', sourceLabel: source.label, text: `${source.label}: ${this.errorMessage(f.reason)}` });
          problems.set(source.key, { label: source.label, problem: 'error' });
          return;
        }
        const converted = source.primary
          ? primaryRowsToCategorySeries(f.value, this.config, valueScale)
          : (r => ({ categories: r.categories, series: [r.series] }))(
            queryRowsToCategorySeries(f.value, source.label, source.categoryField as string, source.valueField as string, valueScale));
        if (converted.categories.length === 0 || converted.series.length === 0) {
          noData(source);
          return;
        }
        categorySources.push({ sourceKey: source.key, sourceLabel: source.label, ...converted });
      });

      const aligned = alignOnCategories(categorySources);
      const composed = composeChartSeries({
        gridSeries: aligned.series,
        length: aligned.categories.length,
        definitions,
        primary: this.config.primarySeries,
        stackedChart: false,
        sourceProblems: problems,
        evaluator: this.expressionEvaluator,
        instants: aligned.categories.map(c => c.instant),
        // A horizontal bar chart cannot mix lines: `asLine` applies to column types only.
        barChart: this.kendoChartType() === 'column'
      });
      hints.push(...composed.hints);

      const colors = new Map((this.config.series ?? []).map(s => [s.name ?? s.field, s.color]));
      this._categories.set(this.categoryLabels(aligned.categories));
      this._seriesData.set(composed.series.map(s => ({
        name: s.name,
        data: this.hasColorThresholds() ? this.applyColorThresholds(s.data) : s.data,
        color: s.color ?? colors.get(s.name),
        ...(s.asLine && { asLine: true }),
        ...(s.dashType && { dashType: s.dashType }),
        ...(s.secondaryAxis && { secondaryAxis: true })
      })));
      this._sourceHints.set(hints);
      this._isLoading.set(false);
    } catch (err) {
      console.error('Error loading Bar Chart data:', err);
      this._error.set('Failed to load data');
      this._sourceHints.set([]);
      this._isLoading.set(false);
    }
  }

  /** Rows of one source of the multi-source path; widget filters apply to the primary query only. */
  private async fetchSourceRows(source: BarChartSourceEntry, scopeRtIds: string[] | undefined): Promise<QueryResultRow[]> {
    const ds = source.dataSource;
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    const streamDataArgs: StreamDataExecutionArgs | undefined = timeArgs || rtIds ? { ...timeArgs, rtIds } : undefined;
    const result = await firstValueFrom(this.queryExecutor.execute(ds.queryFamily, ds.queryRtId, {
      fieldFilter: source.primary ? this.convertFiltersToDto(this.config.filters) ?? undefined : undefined,
      streamDataArgs,
      scopeRtIds
    }));
    return result.rows.filter(row => BarChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? ''));
  }

  /**
   * Category labels of the multi-source path: date-times as dates when every category is a
   * different day (daily bars), else date and time as the single-query chart shows them; other
   * values as text. Repeated labels get " (2)" so every category keeps its slot.
   */
  private categoryLabels(categories: readonly CategoryValue[]): string[] {
    const mode = this.stateService.timeZoneMode();
    const allInstants = categories.length > 0 && categories.every(c => c.instant !== null);
    const dayOf = (c: CategoryValue): string =>
      formatInstant(new Date(c.instant as number), mode, { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '';
    const byDay = allInstants && new Set(categories.map(dayOf)).size === categories.length;
    return uniqueLabels(categories.map(c => {
      if (byDay) return dayOf(c);
      if (c.instant !== null) {
        return formatInstant(new Date(c.instant), mode, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) ?? String(c.raw);
      }
      return String(c.raw ?? '');
    }));
  }

  /** Short message of a failed source for its hint. */
  private errorMessage(reason: unknown): string {
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
    return message ? `Failed to load data (${message})` : 'Failed to load data';
  }

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    return { ...timeArgs, rtIds };
  }

  /**
   * Processes data in Static Series Mode.
   * Each series in config.series corresponds to a separate numeric field.
   */
  private processStaticSeriesData(filteredRows: QueryResultRow[]): void {
    const categories: string[] = [];
    const seriesMap = new Map<string, (number | null)[]>();

    // Initialize series map from config
    for (const seriesConfig of (this.config.series ?? [])) {
      seriesMap.set(seriesConfig.field, []);
    }

    for (const row of filteredRows) {
      // Exact match wins over the loose aggregation-suffix fallback so a group-by
      // category is not overwritten by an aggregation cell over the same attribute
      // (e.g. `state` vs `state_count`) — AB#4293.
      const categoryCell = findCellForField(row.cells, this.config.categoryField);
      const categoryValue = categoryCell ? this.formatCategoryValue(categoryCell.value) : '';

      const rowValues = new Map<string, number | null>();
      for (const seriesConfig of (this.config.series ?? [])) {
        const seriesCell = findCellForField(row.cells, seriesConfig.field);
        if (seriesCell) {
          rowValues.set(seriesConfig.field, BarChartWidgetComponent.toBarValue(seriesCell.value));
        }
      }

      if (categoryValue !== '') {
        categories.push(categoryValue);

        // Add values for each series
        for (const seriesConfig of (this.config.series ?? [])) {
          // A null cell (no data, e.g. an Integral over an empty day) stays null: no bar
          // instead of a 0 bar (AB#7975). A missing cell is still 0.
          const value = rowValues.has(seriesConfig.field) ? rowValues.get(seriesConfig.field)! : 0;
          seriesMap.get(seriesConfig.field)?.push(value);
        }
      }
    }

    // Convert to series data array
    const seriesData: SeriesData[] = (this.config.series ?? []).map(seriesConfig => {
      const rawData = seriesMap.get(seriesConfig.field) ?? [];
      return {
        name: seriesConfig.name ?? seriesConfig.field,
        data: this.hasColorThresholds() ? this.applyColorThresholds(rawData) : rawData,
        color: seriesConfig.color
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
  }

  /**
   * Processes data in Dynamic Series Mode.
   * Series are created dynamically from unique values of seriesGroupField.
   * Each row represents a combination of category + series group + value.
   *
   * Example data structure:
   * - Row 1: { legalEntityType: 'Company', billingType: 'Credit', quantity: 261721 }
   * - Row 2: { legalEntityType: 'Company', billingType: 'Debit', quantity: 65263 }
   * - ...
   *
   * Results in:
   * - Categories: ['Company', 'LegalPerson', 'LocalAuthority', 'NaturalPerson']
   * - Series 'Credit': [261721, 70343, 23140, 189794]
   * - Series 'Debit': [65263, 60153, 159636, 108225]
   */
  private processDynamicSeriesData(filteredRows: QueryResultRow[]): void {
    const categoryField = this.config.categoryField;
    const seriesGroupField = this.config.seriesGroupField!;
    const valueField = this.config.valueField!;

    // Build a map: category -> seriesGroup -> value
    const dataMap = new Map<string, Map<string, number | null>>();
    const allCategories = new Set<string>();
    const allSeriesGroups = new Set<string>();

    for (const row of filteredRows) {
      // Exact match wins over the loose aggregation-suffix fallback (AB#4293).
      const categoryCell = findCellForField(row.cells, categoryField);
      const seriesGroupCell = findCellForField(row.cells, seriesGroupField);
      const valueCell = findCellForField(row.cells, valueField);

      const categoryValue = categoryCell ? this.formatCategoryValue(categoryCell.value) : '';
      const seriesGroupValue = seriesGroupCell ? String(seriesGroupCell.value ?? '') : '';
      const numericValue = valueCell ? BarChartWidgetComponent.toBarValue(valueCell.value) : 0;

      if (categoryValue && seriesGroupValue) {
        allCategories.add(categoryValue);
        allSeriesGroups.add(seriesGroupValue);

        if (!dataMap.has(categoryValue)) {
          dataMap.set(categoryValue, new Map());
        }
        dataMap.get(categoryValue)!.set(seriesGroupValue, numericValue);
      }
    }

    // Convert to arrays (maintain insertion order)
    const categories = Array.from(allCategories);
    const seriesGroups = Array.from(allSeriesGroups);

    // Build series data
    const valueScale = this.config?.valueScale ?? 1;
    const seriesData: SeriesData[] = seriesGroups.map(seriesGroup => {
      const rawData = categories.map(category => {
        const cell = dataMap.get(category);
        // Missing combination → 0; a null cell (no data, AB#7975) → no bar.
        if (!cell?.has(seriesGroup)) return 0;
        const value = cell.get(seriesGroup)!;
        return value === null ? null : value * valueScale;
      });

      return {
        name: seriesGroup,
        data: this.hasColorThresholds() ? this.applyColorThresholds(rawData) : rawData
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
  }

  /**
   * Sanitizes field names for comparison.
   * Replaces dots with underscores (same as table widget).
   */
  readonly dataLabelFormat = computed(() => {
    const suffix = this.config?.dataLabelSuffix ?? '';
    return `{0:n0}${suffix}`;
  });

  hasColorThresholds(): boolean {
    return (this.config?.colorThresholds?.length ?? 0) > 0;
  }

  private applyColorThresholds(data: (number | null)[]): unknown[] {
    const thresholds = this.config.colorThresholds ?? [];
    const defaultColor = this.config.defaultBarColor ?? '#6b7280';
    return data.map(val => val === null ? { value: null } : ({
      value: val,
      _color: this.getColorForValue(val, thresholds, defaultColor)
    }));
  }

  /**
   * Bar value of a cell: a number, `null` for a null cell ("no data" — Kendo draws no
   * bar, AB#7975), and 0 for text that is not a number.
   */
  private static toBarValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(numValue) ? 0 : numValue;
  }

  private getColorForValue(val: number, thresholds: { value: number; color: string }[], defaultColor: string): string {
    for (const t of thresholds) {
      if (val <= t.value) return t.color;
    }
    return defaultColor;
  }

  private formatCategoryValue(value: unknown): string {
    // ISO-8601 date-time values are formatted on the board's timezone basis;
    // everything else passes through as a string.
    if (isIsoDateTime(value)) {
      const formatted = formatInstant(value, this.stateService.timeZoneMode(), {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      if (formatted !== null) {
        return formatted;
      }
    }
    return String(value ?? '');
  }

  /**
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
