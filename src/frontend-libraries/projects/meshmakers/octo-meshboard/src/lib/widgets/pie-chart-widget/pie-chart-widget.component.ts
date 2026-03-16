import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PieChartWidgetConfig, PersistentQueryDataSource, ConstructionKitQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';

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
        <kendo-chart class="chart-container">
          <kendo-chart-plot-area [margin]="plotAreaMargin"></kendo-chart-plot-area>
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
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
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
    // Convert widget filters to GraphQL format
    const fieldFilter = this.convertFiltersToDto(this.config.filters);

    const result = await firstValueFrom(
      this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: dataSource.queryRtId,
          fieldFilter
        }
      }).pipe(
        catchError(err => {
          console.error('Error loading Pie Chart data:', err);
          throw err;
        })
      )
    );

    const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];

    if (queryItems.length === 0) {
      this._chartData.set([]);
      this._isLoading.set(false);
      return;
    }

    const queryResult = queryItems[0];
    if (!queryResult) {
      this._chartData.set([]);
      this._isLoading.set(false);
      return;
    }

    // Extract columns to find field indices
    const columns = (queryResult.columns ?? [])
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map(c => this.sanitizeFieldName(c.attributePath ?? ''));

    const categoryFieldIndex = columns.indexOf(this.sanitizeFieldName(this.config.categoryField));
    const valueFieldIndex = columns.indexOf(this.sanitizeFieldName(this.config.valueField));

    if (categoryFieldIndex === -1 || valueFieldIndex === -1) {
      this._error.set('Configured fields not found in query result');
      this._isLoading.set(false);
      return;
    }

    // Extract rows and transform to chart data
    const rows = queryResult.rows?.items ?? [];
    const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

    const chartData: ChartDataItem[] = rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter(row => supportedRowTypes.includes(row.__typename ?? ''))
      .map(row => {
        const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
        const cells = queryRow.cells?.items ?? [];

        let category = '';
        let value = 0;

        for (const cell of cells) {
          if (!cell?.attributePath) continue;

          const sanitizedPath = this.sanitizeFieldName(cell.attributePath);

          if (sanitizedPath === this.sanitizeFieldName(this.config.categoryField)) {
            category = String(cell.value ?? '');
          }

          if (sanitizedPath === this.sanitizeFieldName(this.config.valueField)) {
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

  /**
   * Sanitizes field names for comparison.
   * Replaces dots with underscores (same as table widget).
   */
  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
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
