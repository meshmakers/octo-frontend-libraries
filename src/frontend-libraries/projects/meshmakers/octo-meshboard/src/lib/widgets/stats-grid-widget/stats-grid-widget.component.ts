import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsGridWidgetConfig, AggregationDataSource, StatItem, PersistentQueryCellSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { QueryExecutorService, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { extractPersistentQueryCellValue } from '../../utils/persistent-query-cell';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';

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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './stats-grid-widget.component.scss'
})
export class StatsGridWidgetComponent implements OnInit, OnChanges {
  private readonly dataService = inject(MeshBoardDataService);
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

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
      // Runtime aggregation queries are only needed for stats WITHOUT a
      // per-stat persistent-query source — those run through the executor below.
      const dataSource = this.config.dataSource as AggregationDataSource;
      const aggregationQueries = dataSource?.type === 'aggregation' ? (dataSource.queries ?? []) : [];
      const aggregationResults = aggregationQueries.length > 0
        ? await this.dataService.fetchAggregations(aggregationQueries)
        : new Map<string, number>();

      // Resolve every stat's value (persistent-query stats execute in parallel).
      const updatedValues: StatValue[] = await Promise.all(
        this.config.stats.map(async stat => ({
          label: stat.label,
          value: await this.resolveStatValue(stat, aggregationResults),
          color: this.getColorClass(stat.color),
          prefix: stat.prefix,
          suffix: stat.suffix,
          isLoading: false
        }))
      );

      this._statValues.set(updatedValues);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load stats');
      // Set all to error state
      this._statValues.set(initialValues.map(v => ({ ...v, value: null, isLoading: false })));
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Resolves a single stat's value: a per-stat persistent query (runtime or
   * stream-data) when configured, otherwise the runtime aggregation result.
   */
  private async resolveStatValue(stat: StatItem, aggregationResults: Map<string, number>): Promise<number | null> {
    if (stat.persistentQuerySource) {
      return this.loadPersistentQueryValue(stat.persistentQuerySource);
    }
    return aggregationResults.get(stat.queryId) ?? null;
  }

  private async loadPersistentQueryValue(source: PersistentQueryCellSource): Promise<number | null> {
    try {
      const result = await firstValueFrom(
        this.queryExecutor.execute(source.queryFamily, source.queryRtId, {
          fieldFilter: this.convertFiltersToDto(source.filters),
          streamDataArgs: this.buildStreamDataArgs(source)
        })
      );
      return extractPersistentQueryCellValue(result, source);
    } catch (err) {
      console.error('Error loading stat persistent-query data:', err);
      return null;
    }
  }

  private buildStreamDataArgs(source: PersistentQueryCellSource): StreamDataExecutionArgs | undefined {
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(source.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(source.entitySelectorId);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    return { ...timeArgs, rtIds };
  }

  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables) ?? undefined;
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
