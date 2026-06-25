import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
import { matchesAttributePath } from '../../utils/widget-data-utils';

/**
 * Data item for the pie chart
 */
interface ChartDataItem {
  category: string;
  value: number;
}

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
        <kendo-chart class="chart-container" [plotArea]="{ background: 'transparent', margin: plotAreaMargin }">
          <kendo-chart-area [background]="'transparent'"></kendo-chart-area>
          <kendo-chart-series>
            <kendo-chart-series-item
              [type]="config.chartType"
              [data]="chartData()"
              field="value"
              categoryField="category"
              [labels]="labelSettings()">
            </kendo-chart-series-item>
          </kendo-chart-series>
          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'right'">
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
export class PieChartWidgetComponent implements DashboardWidget<PieChartWidgetConfig, ChartDataItem[]>, OnInit, OnChanges {
  private readonly queryExecutor = inject(QueryExecutorService);

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
  private readonly _chartData = signal<ChartDataItem[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly chartData = this._chartData.asReadonly();
  readonly error = this._error.asReadonly();

  readonly data = computed(() => this._chartData());

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

  /** Extra margin around the plot area so outsideEnd labels are not clipped by the SVG boundary. */
  readonly plotAreaMargin = { top: 30, right: 30, bottom: 30, left: 30 };

  private readonly _labelSettings = signal<{ visible: boolean; content: (e: { category: string; value: number }) => string }>({
    visible: false,
    content: (e) => e.category
  });
  readonly labelSettings = this._labelSettings.asReadonly();

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

    const chartData: ChartDataItem[] = result.items.map(item => ({
      category: item.category,
      value: item.value
    }));

    this._chartData.set(chartData);
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

    const chartData: ChartDataItem[] = result.rows
      .filter(row => PieChartWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? ''))
      .map(row => {
        let category = '';
        let value = 0;

        for (const cell of row.cells) {
          if (matchesAttributePath(cell.attributePath, this.config.categoryField)) {
            category = String(cell.value ?? '');
          }
          if (matchesAttributePath(cell.attributePath, this.config.valueField)) {
            const numValue = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
            value = isNaN(numValue) ? 0 : numValue;
          }
        }

        return { category, value };
      })
      .filter(item => item.category !== ''); // Filter out empty categories

    this._chartData.set(chartData);
    this._isLoading.set(false);
  }

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    return this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
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
