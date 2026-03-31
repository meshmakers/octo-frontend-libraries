import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SummaryCardWidgetConfig, SummaryCardTile } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { GetDashboardEntityDtoGQL } from '../../graphQL/getDashboardEntity';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { firstValueFrom } from 'rxjs';

interface TileValue {
  id: string;
  label: string;
  value: string;
  prefix: string;
  suffix: string;
  color: string;
  fullWidth: boolean;
}

@Component({
  selector: 'mm-summary-card-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent],
  template: `
    <div class="summary-card-widget">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (error()) {
        <div class="error-message">{{ error() }}</div>
      } @else {
        <div class="summary-grid" [style.--columns]="config.columns ?? 2">
          @for (tile of tileValues(); track tile.id) {
            <div class="tile" [class]="tile.color" [class.full-width]="tile.fullWidth">
              <div class="tile-value">
                {{ tile.prefix }}{{ tile.value }}{{ tile.suffix }}
              </div>
              <div class="tile-label">{{ tile.label }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .summary-card-widget {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(var(--columns, 2), 1fr);
      gap: 8px;
      padding: 8px 12px;
      width: 100%;
    }

    .tile {
      text-align: center;
      padding: 12px 8px;
      border-radius: 6px;
      background: var(--mm-summary-tile-bg, rgba(255, 255, 255, 0.03));
    }

    .tile-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: inherit;
    }

    .tile-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
      opacity: 0.6;
    }

    .tile.full-width { grid-column: 1 / -1; }

    .tile.primary .tile-value { color: var(--kendo-color-primary, #06b6d4); }
    .tile.success .tile-value { color: var(--kendo-color-success, #10b981); }
    .tile.warning .tile-value { color: var(--kendo-color-warning, #f59e0b); }
    .tile.error .tile-value { color: var(--kendo-color-error, #ef4444); }

    .error-message {
      text-align: center;
      padding: 16px;
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class SummaryCardWidgetComponent implements DashboardWidget<SummaryCardWidgetConfig, TileValue[]>, OnInit, OnChanges {
  private readonly entityGQL = inject(GetDashboardEntityDtoGQL);
  private readonly dataService = inject(DashboardDataService);

  @Input() config!: SummaryCardWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _tileValues = signal<TileValue[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._tileValues.asReadonly();
  readonly tileValues = this._tileValues.asReadonly();

  isNotConfigured(): boolean {
    return !this.config?.tiles?.length;
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
    if (this.isNotConfigured()) return;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Cache entities by rtId to avoid duplicate fetches
      const entityCache = new Map<string, Map<string, unknown>>();

      const results = await Promise.all(
        this.config.tiles.map(tile => this.fetchTileValue(tile, entityCache))
      );

      const tileValues: TileValue[] = this.config.tiles.map((tile, i) => ({
        id: tile.id,
        label: tile.label,
        value: this.formatValue(results[i]),
        prefix: tile.prefix ?? '',
        suffix: tile.suffix ?? '',
        color: tile.color ?? 'default',
        fullWidth: tile.size === 'full'
      }));

      this._tileValues.set(tileValues);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async fetchTileValue(tile: SummaryCardTile, entityCache: Map<string, Map<string, unknown>>): Promise<unknown> {
    if (tile.entitySource) {
      const { rtId, ckTypeId, attributePath } = tile.entitySource;

      if (!entityCache.has(rtId)) {
        const attrs = await this.fetchEntityAttributes(rtId, ckTypeId);
        entityCache.set(rtId, attrs);
      }

      return entityCache.get(rtId)?.get(attributePath) ?? null;
    }

    if (tile.aggregationSource) {
      const query = {
        id: tile.id,
        ckTypeId: tile.aggregationSource.ckTypeId,
        aggregation: tile.aggregationSource.aggregation as 'count' | 'sum' | 'avg' | 'min' | 'max',
        attribute: tile.aggregationSource.attribute,
        filters: tile.aggregationSource.filters
      };
      const results = await this.dataService.fetchAggregations([query]);
      return results.get(tile.id) ?? null;
    }

    return null;
  }

  private async fetchEntityAttributes(rtId: string, ckTypeId: string): Promise<Map<string, unknown>> {
    const result = await firstValueFrom(
      this.entityGQL.fetch({
        variables: { rtId, ckTypeId }
      })
    );

    const attrs = new Map<string, unknown>();
    const items = result.data?.runtime?.runtimeEntities?.items?.[0]?.attributes?.items ?? [];
    for (const item of items) {
      if (item?.attributeName) {
        attrs.set(item.attributeName, item.value);
      }
    }
    return attrs;
  }

  private formatValue(value: unknown): string {
    if (value == null) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('de-AT', {
        minimumFractionDigits: value % 1 !== 0 ? 1 : 0,
        maximumFractionDigits: 2
      });
    }
    return String(value);
  }
}
