import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsGridWidgetConfig, AggregationDataSource } from '../../models/meshboard.models';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';

export interface StatValue {
  label: string;
  value: number | null;
  color: string;
  prefix?: string;
  suffix?: string;
  isLoading: boolean;
}

@Component({
  selector: 'mm-stats-grid-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent],
  templateUrl: './stats-grid-widget.component.html',
  styleUrl: './stats-grid-widget.component.scss'
})
export class StatsGridWidgetComponent implements OnInit, OnChanges {
  private readonly dataService = inject(MeshBoardDataService);

  @Input() config!: StatsGridWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _statValues = signal<StatValue[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly statValues = this._statValues.asReadonly();

  /**
   * Check if widget is not configured (needs stats configuration).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    return !this.config?.stats?.length;
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

  private async loadData(): Promise<void> {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    // Initialize stat values with loading state
    const initialValues: StatValue[] = this.config.stats.map(stat => ({
      label: stat.label,
      value: null,
      color: this.getColorClass(stat.color),
      prefix: stat.prefix,
      suffix: stat.suffix,
      isLoading: true
    }));
    this._statValues.set(initialValues);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const dataSource = this.config.dataSource as AggregationDataSource;
      if (dataSource?.type !== 'aggregation' || !dataSource.queries?.length) {
        // No aggregation queries configured - show zeros
        this._statValues.set(initialValues.map(v => ({ ...v, value: 0, isLoading: false })));
        return;
      }

      // Load all aggregation queries
      const results = await this.dataService.fetchAggregations(dataSource.queries);

      // Map results to stat values
      const updatedValues: StatValue[] = this.config.stats.map(stat => {
        const result = results.get(stat.queryId);
        return {
          label: stat.label,
          value: result ?? null,
          color: this.getColorClass(stat.color),
          prefix: stat.prefix,
          suffix: stat.suffix,
          isLoading: false
        };
      });

      this._statValues.set(updatedValues);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load stats');
      // Set all to error state
      this._statValues.set(initialValues.map(v => ({ ...v, value: null, isLoading: false })));
    } finally {
      this._isLoading.set(false);
    }
  }

  private getColorClass(color?: string): string {
    switch (color) {
      case 'mint': return 'stat-mint';
      case 'cyan': return 'stat-cyan';
      case 'violet': return 'stat-violet';
      case 'toffee': return 'stat-toffee';
      case 'lilac': return 'stat-lilac';
      case 'bubblegum': return 'stat-bubblegum';
      default: return 'stat-default';
    }
  }

  formatValue(stat: StatValue): string {
    if (stat.value === null) return '-';

    let formatted = stat.value.toLocaleString();
    if (stat.prefix) formatted = stat.prefix + formatted;
    if (stat.suffix) formatted = formatted + stat.suffix;
    return formatted;
  }

  get gridColumns(): number {
    return this.config?.columns ?? 3;
  }
}
