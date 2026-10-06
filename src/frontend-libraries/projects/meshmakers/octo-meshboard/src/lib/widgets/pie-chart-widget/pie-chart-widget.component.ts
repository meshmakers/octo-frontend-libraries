import { Component, Input, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PieChartWidgetConfig, PersistentQueryDataSource, ConstructionKitQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { QueryExecutorService, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { findCellForField, matchesAttributePath } from '../../utils/widget-data-utils';
import { categoryStatus, humanizeCategory, responsiveLegendPosition, sameChartItems, statusColor } from '../../utils/chart-categories';
import { injectChartTheme } from '../../utils/chart-theme';

/**
 * Data item for the pie chart
 */
interface ChartDataItem {
  category: string;
  value: number;
  /** Status colour of a well-known state category (`RESOLVE_FAILED` → error); default series colour otherwise. */
  color?: string;
}

/** Plot area options of the pie / donut (stable references, AB#5568). */
export interface PieChartPlotArea {
  background: string;
  margin: { top: number; right: number; bottom: number; left: number };
}

const PLOT_AREA_WITH_LABELS: PieChartPlotArea = Object.freeze({ background: 'transparent', margin: Object.freeze({ top: 30, right: 30, bottom: 30, left: 30 }) });
const PLOT_AREA_WITHOUT_LABELS: PieChartPlotArea = Object.freeze({ background: 'transparent', margin: Object.freeze({ top: 4, right: 4, bottom: 4, left: 4 }) });

@Component({
  selector: 'mm-pie-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="pie-chart-widget" [class.loading]="isLoading()" [class.error]="error()">
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
        <kendo-chart class="chart-container" [plotArea]="plotArea()">
          <kendo-chart-area [background]="'transparent'"></kendo-chart-area>
          <kendo-chart-series>
            <kendo-chart-series-item
              [type]="config.chartType"
              [data]="chartData()"
              field="value"
              categoryField="category"
              colorField="color"
              [labels]="labelSettings()">
            </kendo-chart-series-item>
          </kendo-chart-series>
          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="legendPosition()"
            [labels]="{ font: '12px sans-serif', color: chartTheme().text }">
          </kendo-chart-legend>
          <kendo-chart-tooltip>
            <ng-template kendoChartSeriesTooltipTemplate let-value="value" let-category="category">
              <div class="chart-tooltip">
                <strong>{{ category }}</strong>: {{ formatValue(value) }}
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

    .pie-chart-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .pie-chart-widget.loading,
    .pie-chart-widget.error {
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
  `]
})
export class PieChartWidgetComponent implements DashboardWidget<PieChartWidgetConfig, ChartDataItem[]>, OnInit, OnChanges, AfterViewInit, OnDestroy {
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly elementRef = inject(ElementRef);
  private readonly ngZone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  /** Measured widget width (0 until measured). */
  private readonly width = signal(0);

  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtSimpleQueryRow',
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);
  private readonly dataService = inject(MeshBoardDataService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: PieChartWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  /** Raw categories and values as loaded; labels and status colours are derived in `chartData`. */
  private readonly _rawData = signal<{ category: string; value: number }[]>([]);
  /**
   * Text colours of the current theme; changes only on a real theme switch, so status colours,
   * legend and labels are resolved again then (Kendo keeps the load-time theme otherwise).
   */
  protected readonly chartTheme = injectChartTheme();
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  /** Keeps its reference while categories, values and colours are unchanged (AB#5568). */
  readonly chartData = computed<ChartDataItem[]>(() => {
    this.chartTheme();
    return this._rawData().map(item => this.toItem(item.category, item.value));
  }, { equal: sameChartItems });
  readonly error = this._error.asReadonly();

  readonly data = computed(() => this.chartData());

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      return !ds.queryRtId || !this.config?.categoryField || !this.config?.valueField;
    }

    if (dataSource.type === 'constructionKitQuery') {
      const ds = dataSource as ConstructionKitQueryDataSource;
      return !ds.queryTarget;
    }

    return true; // Unknown data source type
  }

  /**
   * Plot area: extra margin so outsideEnd labels are not clipped by the SVG boundary — only while
   * labels are shown; without labels it would shrink the pie for nothing. Returns one of two
   * constant objects: a new object per change detection made Kendo redraw (and re-animate) the
   * chart on every hover (AB#5568).
   */
  plotArea(): PieChartPlotArea {
    return this.config?.showLabels === true ? PLOT_AREA_WITH_LABELS : PLOT_AREA_WITHOUT_LABELS;
  }

  /** Margin of the plot area (see `plotArea`). */
  plotAreaMargin(): PieChartPlotArea['margin'] {
    return this.plotArea().margin;
  }

  /**
   * A legend beside a narrow widget (cockpit tiles are ~300 px wide) leaves the pie a dot; it moves
   * below the chart there. Method, not computed: `config` is a plain @Input.
   */
  legendPosition(): 'top' | 'bottom' | 'left' | 'right' {
    return responsiveLegendPosition(this.config?.legendPosition, this.width());
  }

  ngAfterViewInit(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    this.width.set(host.clientWidth ?? 0);
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width !== this.width()) {
        this.ngZone.run(() => this.width.set(width));
      }
    });
    this.resizeObserver.observe(host);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** Human label and status colour for a raw category value (exposed for tests). */
  toItem(rawCategory: string, value: number): ChartDataItem {
    const status = categoryStatus(rawCategory);
    return { category: humanizeCategory(rawCategory), value, ...(status ? { color: statusColor(status) } : {}) };
  }

  private readonly _labelSettings = signal<{ visible: boolean; content: (e: { category: string; value: number }) => string }>({
    visible: false,
    content: (e) => e.category
  });
  /** Series label options incl. the theme text colour (new object only when either changes). */
  readonly labelSettings = computed(() => ({ ...this._labelSettings(), color: this.chartTheme().text }));

  private updateLabelSettings(): void {
    this._labelSettings.set({
      visible: this.config?.showLabels === true,
      content: (e: { category: string; value: number }) => {
        const maxLen = 20;
        const name = e.category.length > maxLen ? e.category.substring(0, maxLen) + '...' : e.category;
        return `${name}: ${this.formatValue(e.value)}`;
      }
    });
  }

  ngOnInit(): void {
    this.updateLabelSettings();
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.updateLabelSettings();
      if (!changes['config'].firstChange) {
        this.loadData();
      }
    }
  }

  refresh(): void {
    this.loadData();
  }

  hasValidConfig(): boolean {
    if (!this.config?.dataSource) return false;

    if (this.config.dataSource.type === 'persistentQuery') {
      const ds = this.config.dataSource as PersistentQueryDataSource;
      return !!(ds.queryRtId && this.config.categoryField && this.config.valueField);
    }

    if (this.config.dataSource.type === 'constructionKitQuery') {
      const ds = this.config.dataSource as ConstructionKitQueryDataSource;
      return !!ds.queryTarget;
    }

    return false;
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

    const dataSource = this.config?.dataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      if (dataSource.type === 'constructionKitQuery') {
        await this.loadCkQueryData(dataSource as ConstructionKitQueryDataSource);
      } else if (dataSource.type === 'persistentQuery') {
        await this.loadPersistentQueryData(dataSource as PersistentQueryDataSource);
      } else {
        this._error.set(`Data source type '${dataSource.type}' is not supported`);
        this._isLoading.set(false);
      }
    } catch (err) {
      console.error('Error loading Pie Chart data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  /**
   * Loads data from Construction Kit query data source.
   */
  private async loadCkQueryData(dataSource: ConstructionKitQueryDataSource): Promise<void> {
    const result = await this.dataService.fetchCkQueryData(dataSource);

    const chartData = result.items.map(item => ({ category: item.category, value: item.value }));

    this._rawData.set(chartData);
    this._isLoading.set(false);
  }

  /**
   * Loads data from persistent query data source.
   * Note: isNotConfigured() check in loadData() ensures queryRtId is set.
   */
  private async loadPersistentQueryData(dataSource: PersistentQueryDataSource): Promise<void> {
    const fieldFilter = this.convertFiltersToDto(this.config.filters);
    // queryFamily may be undefined for legacy widget configs — the executor
    // falls back to a one-time lookup by rtId. streamDataArgs is sent
    // unconditionally because the runtime path ignores it.
    const streamDataArgs = this.buildStreamDataArgs();

    const result = await firstValueFrom(
      this.queryExecutor.execute(dataSource.queryFamily, dataSource.queryRtId, {
        fieldFilter: fieldFilter ?? undefined,
        streamDataArgs
      }).pipe(
        catchError(err => {
          console.error('Error loading Pie Chart data:', err);
          throw err;
        })
      )
    );

    // Extract columns to verify configured fields are present. Both forms (original CK
    // path and engine wire-form) are accepted so saved configs survive the engine's
    // switch to wire-form keys without a migration.
    const columnPaths = result.columns.map(c => c.attributePath);

    const categoryFieldPresent = columnPaths.some(p => matchesAttributePath(p, this.config.categoryField));
    const valueFieldPresent = columnPaths.some(p => matchesAttributePath(p, this.config.valueField));

    if (!categoryFieldPresent || !valueFieldPresent) {
      this._error.set('Configured fields not found in query result');
      this._isLoading.set(false);
      return;
    }

    const chartData = result.rows
      .filter(row => PieChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? ''))
      .map(row => {
        // Resolve each field to its best cell (exact match wins over the loose
        // aggregation-suffix fallback) so a `state` category is not overwritten
        // by the `state_count` aggregation cell — AB#4293.
        const categoryCell = findCellForField(row.cells, this.config.categoryField);
        const valueCell = findCellForField(row.cells, this.config.valueField);

        const category = categoryCell ? String(categoryCell.value ?? '') : '';
        let value = 0;
        if (valueCell) {
          const numValue = typeof valueCell.value === 'number' ? valueCell.value : parseFloat(String(valueCell.value));
          value = isNaN(numValue) ? 0 : numValue;
        }

        return { category, value };
      })
      .filter(item => item.category !== ''); // Filter out empty categories

    this._rawData.set(chartData);
    this._isLoading.set(false);
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
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
