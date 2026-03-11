import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeatmapWidgetConfig, HeatmapColorScheme, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';

/**
 * A single cell in the heatmap grid
 */
interface HeatmapDataItem {
  /** X-axis: date string (e.g. '2026-01-15') */
  date: string;
  /** Y-axis: hour label (e.g. '08:00') */
  hour: string;
  /** Color intensity value */
  value: number;
}

/**
 * Color range configuration for heatmap
 */
interface HeatmapColorRange {
  from: number;
  to: number;
  color: string;
  label?: string;
}

const COLOR_SCHEMES: Record<HeatmapColorScheme, (min: number, max: number) => HeatmapColorRange[]> = {
  green: (min, max) => buildGradientRanges(min, max, ['#e8f5e9', '#a5d6a7', '#66bb6a', '#2e7d32', '#1b5e20']),
  redGreen: (min, max) => buildGradientRanges(min, max, ['#ef5350', '#ff8a65', '#fff176', '#aed581', '#66bb6a']),
  blue: (min, max) => buildGradientRanges(min, max, ['#e3f2fd', '#90caf9', '#42a5f5', '#1565c0', '#0d47a1']),
  heat: (min, max) => buildGradientRanges(min, max, ['#fff9c4', '#ffcc02', '#ff9800', '#f44336', '#b71c1c'])
};

function buildGradientRanges(min: number, max: number, colors: string[]): HeatmapColorRange[] {
  if (max <= min) {
    return [{ from: min, to: min + 1, color: colors[0] }];
  }
  const step = (max - min) / colors.length;
  return colors.map((color, i) => ({
    from: min + i * step,
    to: min + (i + 1) * step,
    color
  }));
}

@Component({
  selector: 'mm-heatmap-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="heatmap-widget" [class.loading]="isLoading()" [class.error]="error()">
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
        <kendo-chart class="chart-container">
          <kendo-chart-x-axis>
            <kendo-chart-x-axis-item [categories]="xCategories()" [title]="{ text: '' }">
              <kendo-chart-x-axis-item-labels
                [rotation]="-45"
                [content]="xLabelContent">
              </kendo-chart-x-axis-item-labels>
            </kendo-chart-x-axis-item>
          </kendo-chart-x-axis>

          <kendo-chart-y-axis>
            <kendo-chart-y-axis-item [categories]="yCategories()" [title]="{ text: '' }">
            </kendo-chart-y-axis-item>
          </kendo-chart-y-axis>

          <kendo-chart-series>
            <kendo-chart-series-item
              type="heatmap"
              [data]="heatmapData()"
              xField="date"
              yField="hour"
              field="value"
              [color]="seriesColor()">
            </kendo-chart-series-item>
          </kendo-chart-series>

          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'bottom'">
          </kendo-chart-legend>

          <kendo-chart-tooltip>
            <ng-template kendoChartSeriesTooltipTemplate let-value="value" let-dataItem="dataItem">
              <div class="chart-tooltip">
                <strong>{{ dataItem.date }}</strong> {{ dataItem.hour }}<br/>
                Value: {{ formatValue(value) }}
              </div>
            </ng-template>
          </kendo-chart-tooltip>
        </kendo-chart>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .heatmap-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .heatmap-widget.loading,
    .heatmap-widget.error {
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
export class HeatmapWidgetComponent implements DashboardWidget<HeatmapWidgetConfig, HeatmapDataItem[]>, OnInit, OnChanges {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: HeatmapWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _heatmapData = signal<HeatmapDataItem[]>([]);
  private readonly _xCategories = signal<string[]>([]);
  private readonly _yCategories = signal<string[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly heatmapData = this._heatmapData.asReadonly();
  readonly xCategories = this._xCategories.asReadonly();
  readonly yCategories = this._yCategories.asReadonly();
  readonly error = this._error.asReadonly();

  readonly data = computed(() => this._heatmapData());

  readonly seriesColor = computed(() => {
    const scheme = this.config?.colorScheme ?? 'green';
    const data = this._heatmapData();
    if (data.length === 0) return '#66bb6a';

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const ranges = COLOR_SCHEMES[scheme](min, max);

    // Return the middle color as the base series color
    return ranges[Math.floor(ranges.length / 2)]?.color ?? '#66bb6a';
  });

  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      return !ds.queryRtId || !this.config?.dateField;
    }

    return true;
  }

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
      return !!(ds.queryRtId && this.config.dateField);
    }

    return false;
  }

  formatValue(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  xLabelContent = (e: { value: string }): string => {
    // Truncate date labels if needed
    const maxLen = 10;
    return e.value.length > maxLen ? e.value.substring(0, maxLen) : e.value;
  };

  private async loadData(): Promise<void> {
    if (this.isNotConfigured()) {
      return;
    }

    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      const result = await firstValueFrom(
        this.executeRuntimeQueryGQL.fetch({
          variables: {
            rtId: queryDataSource.queryRtId,
            fieldFilter
          }
        }).pipe(
          catchError(err => {
            console.error('Error loading Heatmap data:', err);
            throw err;
          })
        )
      );

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];

      if (queryItems.length === 0) {
        this._heatmapData.set([]);
        this._xCategories.set([]);
        this._yCategories.set([]);
        this._isLoading.set(false);
        return;
      }

      const queryResult = queryItems[0];
      if (!queryResult) {
        this._heatmapData.set([]);
        this._xCategories.set([]);
        this._yCategories.set([]);
        this._isLoading.set(false);
        return;
      }

      const rows = queryResult.rows?.items ?? [];
      const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

      const filteredRows = rows
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .filter(row => supportedRowTypes.includes(row.__typename ?? ''));

      this.processHeatmapData(filteredRows);

      this._isLoading.set(false);
    } catch (err) {
      console.error('Error loading Heatmap data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  /**
   * Processes query rows into heatmap data.
   * When dateEndField is configured, auto-detects the interval width and shows sub-hour columns.
   * Otherwise aggregates into hourly buckets.
   */
  private processHeatmapData(filteredRows: unknown[]): void {
    const dateField = this.sanitizeFieldName(this.config.dateField);
    const dateEndField = this.config.dateEndField ? this.sanitizeFieldName(this.config.dateEndField) : null;
    const valueField = this.config.valueField ? this.sanitizeFieldName(this.config.valueField) : null;
    const aggregation = this.config.aggregation ?? 'count';

    // Parse all rows: extract dateFrom, dateTo, numericValue
    interface ParsedRow { dateFrom: Date; dateTo: Date | null; numericValue: number }
    const parsedRows: ParsedRow[] = [];

    for (const row of filteredRows) {
      const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      const cells = queryRow.cells?.items ?? [];

      let dateFrom: Date | null = null;
      let dateTo: Date | null = null;
      let numericValue = 1; // default for count

      for (const cell of cells) {
        if (!cell?.attributePath) continue;
        const sanitizedPath = this.sanitizeFieldName(cell.attributePath);

        if (sanitizedPath === dateField) {
          dateFrom = this.parseDate(cell.value);
        } else if (dateEndField && sanitizedPath === dateEndField) {
          dateTo = this.parseDate(cell.value);
        } else if (valueField && sanitizedPath === valueField) {
          const val = cell.value;
          numericValue = typeof val === 'number' ? val : parseFloat(String(val));
          if (isNaN(numericValue)) numericValue = 0;
        }
      }

      if (dateFrom) {
        parsedRows.push({ dateFrom, dateTo, numericValue });
      }
    }

    if (parsedRows.length === 0) {
      this._heatmapData.set([]);
      this._xCategories.set([]);
      this._yCategories.set([]);
      return;
    }

    // Detect interval width in minutes from the first row that has both from and to
    const intervalMinutes = this.detectIntervalMinutes(parsedRows);
    const hasSubHourIntervals = dateEndField && intervalMinutes > 0 && intervalMinutes < 60;

    if (hasSubHourIntervals) {
      this.processSubHourData(parsedRows, intervalMinutes, aggregation);
    } else {
      this.processHourlyData(parsedRows, aggregation);
    }
  }

  /**
   * Detects the interval width in minutes from the first row with from+to.
   */
  private detectIntervalMinutes(rows: { dateFrom: Date; dateTo: Date | null }[]): number {
    for (const row of rows) {
      if (row.dateTo) {
        const diffMs = row.dateTo.getTime() - row.dateFrom.getTime();
        if (diffMs > 0) {
          return Math.round(diffMs / 60000);
        }
      }
    }
    return 60; // default: hourly
  }

  /**
   * Processes data into hourly buckets (original behavior).
   */
  private processHourlyData(rows: { dateFrom: Date; numericValue: number }[], aggregation: string): void {
    const buckets = new Map<string, Map<number, number[]>>();

    for (const { dateFrom, numericValue } of rows) {
      const dateKey = this.formatDateKey(dateFrom);
      const hour = dateFrom.getUTCHours();

      if (!buckets.has(dateKey)) buckets.set(dateKey, new Map());
      const hourMap = buckets.get(dateKey)!;
      if (!hourMap.has(hour)) hourMap.set(hour, []);
      hourMap.get(hour)!.push(numericValue);
    }

    const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00');
    const yCategories = [...hourLabels].reverse();
    const sortedDates = Array.from(buckets.keys()).sort();

    const heatmapData: HeatmapDataItem[] = [];
    for (const date of sortedDates) {
      const hourMap = buckets.get(date)!;
      for (let h = 0; h < 24; h++) {
        const values = hourMap.get(h);
        const value = values ? this.aggregate(values, aggregation) : 0;
        heatmapData.push({ date, hour: hourLabels[h], value });
      }
    }

    this._heatmapData.set(heatmapData);
    this._xCategories.set(sortedDates);
    this._yCategories.set(yCategories);
  }

  /**
   * Processes data into sub-hour interval buckets.
   * Y-axis: hours (00:00..23:00), X-axis: interval labels (e.g. "00-15", "15-30", ...).
   * For multi-day data, X-axis labels are prefixed with the date.
   */
  private processSubHourData(
    rows: { dateFrom: Date; numericValue: number }[],
    intervalMinutes: number,
    aggregation: string
  ): void {
    const intervalsPerHour = Math.floor(60 / intervalMinutes);

    // Bucket: xKey (date+interval) -> hour -> values[]
    const buckets = new Map<string, Map<number, number[]>>();
    const allDates = new Set<string>();

    for (const { dateFrom, numericValue } of rows) {
      const dateKey = this.formatDateKey(dateFrom);
      allDates.add(dateKey);
      const hour = dateFrom.getUTCHours();
      const minute = dateFrom.getUTCMinutes();
      const intervalIndex = Math.floor(minute / intervalMinutes);
      const intervalStart = intervalIndex * intervalMinutes;
      const intervalEnd = intervalStart + intervalMinutes;
      const intervalLabel = intervalStart.toString().padStart(2, '0') + '-' + intervalEnd.toString().padStart(2, '0');

      // X-key: for single day just interval label, for multi-day prefix with date
      // We'll decide the format after collecting all dates
      const compositeKey = `${dateKey}|${intervalLabel}`;

      if (!buckets.has(compositeKey)) buckets.set(compositeKey, new Map());
      const hourMap = buckets.get(compositeKey)!;
      if (!hourMap.has(hour)) hourMap.set(hour, []);
      hourMap.get(hour)!.push(numericValue);
    }

    const sortedDates = Array.from(allDates).sort();
    const isMultiDay = sortedDates.length > 1;

    // Build interval labels for X-axis
    const intervalLabels: string[] = [];
    for (let i = 0; i < intervalsPerHour; i++) {
      const start = (i * intervalMinutes).toString().padStart(2, '0');
      const end = ((i + 1) * intervalMinutes).toString().padStart(2, '0');
      intervalLabels.push(`${start}-${end}`);
    }

    // Build X-axis categories (ordered: date × interval)
    const xCategories: string[] = [];
    for (const date of sortedDates) {
      for (const interval of intervalLabels) {
        xCategories.push(isMultiDay ? `${date} ${interval}` : interval);
      }
    }

    // Build hour labels for Y-axis
    const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00');
    const yCategories = [...hourLabels].reverse();

    // Build heatmap data: for each x-category × hour, aggregate values
    const heatmapData: HeatmapDataItem[] = [];
    for (const date of sortedDates) {
      for (const interval of intervalLabels) {
        const compositeKey = `${date}|${interval}`;
        const xLabel = isMultiDay ? `${date} ${interval}` : interval;
        const hourMap = buckets.get(compositeKey);

        for (let h = 0; h < 24; h++) {
          const values = hourMap?.get(h);
          const value = values ? this.aggregate(values, aggregation) : 0;
          heatmapData.push({ date: xLabel, hour: hourLabels[h], value });
        }
      }
    }

    this._heatmapData.set(heatmapData);
    this._xCategories.set(xCategories);
    this._yCategories.set(yCategories);
  }

  private aggregate(values: number[], aggregation: string): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      default:
        return values.length;
    }
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  }

  private formatDateKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
  }

  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
