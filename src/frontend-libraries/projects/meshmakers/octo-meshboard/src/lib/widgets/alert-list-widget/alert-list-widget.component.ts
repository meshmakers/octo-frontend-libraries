import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertListWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { firstValueFrom } from 'rxjs';
import { AlertItem, getAlertSeverityColor, getAlertSeverityIcon, getAlertSeverityOrder, DEFAULT_ALERT_CK_TYPE } from '../alert-shared/alert-severity.utils';
import { FieldFilterOperatorsDto, SortOrdersDto } from '@meshmakers/octo-services';

@Component({
  selector: 'mm-alert-list-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, WidgetNotConfiguredComponent],
  template: `
    <div class="alert-list-widget">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (error()) {
        <div class="error-message">{{ error() }}</div>
      } @else {
        <div class="alert-list">
          @for (item of items(); track item.rtId) {
            <div class="alert-item" [style.--alert-color]="getColor(item.level)">
              <kendo-svg-icon [icon]="getIcon(item.level)" class="alert-icon"></kendo-svg-icon>
              <span class="alert-badge" [style.background-color]="getColor(item.level)">
                {{ item.level }}
              </span>
              <span class="alert-message">{{ item.message }}</span>
              @if (config.showTimestamp !== false && item.timestamp) {
                <span class="alert-time">{{ formatTime(item.timestamp) }}</span>
              }
            </div>
          }
          @if (!isLoading() && items().length === 0) {
            <div class="empty-message">No active alerts</div>
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

    .alert-list-widget {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 8px 0;
    }

    .alert-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 12px;
    }

    .alert-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid var(--alert-color, #6b7280);
      background: var(--mm-alert-list-item-bg, rgba(255, 255, 255, 0.03));
    }

    .alert-icon {
      flex-shrink: 0;
      color: var(--alert-color, #6b7280);
    }

    .alert-badge {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 6px;
      border-radius: 3px;
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .alert-message {
      flex: 1;
      font-size: 0.8rem;
      color: var(--kendo-color-on-app-surface, inherit);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .alert-time {
      font-size: 0.7rem;
      opacity: 0.5;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .empty-message {
      text-align: center;
      padding: 16px;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .error-message {
      text-align: center;
      padding: 16px;
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class AlertListWidgetComponent implements DashboardWidget<AlertListWidgetConfig, AlertItem[]>, OnInit, OnChanges {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);

  @Input() config!: AlertListWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _items = signal<AlertItem[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._items.asReadonly();
  readonly items = this._items.asReadonly();

  isNotConfigured(): boolean {
    return false;
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

  protected getColor(level: string): string {
    return getAlertSeverityColor(level);
  }

  protected getIcon(level: string) {
    return getAlertSeverityIcon(level);
  }

  protected formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private async loadData(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const ckTypeId = this.config?.ckTypeId || DEFAULT_ALERT_CK_TYPE;

      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId,
            first: this.config?.maxAlerts ?? 50,
            fieldFilters: [
              { attributePath: 'state', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: '0' }
            ],
            sort: [
              { attributePath: 'level', sortOrder: SortOrdersDto.DescendingDto }
            ]
          }
        })
      );

      const entities = result.data?.runtime?.runtimeEntities?.items ?? [];
      const items: AlertItem[] = [];

      for (const entity of entities) {
        if (!entity) continue;
        const attrs = (entity.attributes?.items ?? [])
          .filter((a): a is NonNullable<typeof a> => a != null && a.attributeName != null);

        items.push({
          rtId: entity.rtId ?? '',
          message: this.getAttr(attrs, 'message') ?? '',
          level: this.getAttr(attrs, 'level') ?? 'INFORMATION',
          state: this.getAttr(attrs, 'state') ?? '',
          source: this.getAttr(attrs, 'source') ?? '',
          timestamp: entity.rtCreationDateTime ?? undefined
        });
      }

      if (this.config?.sortBySeverity !== false) {
        items.sort((a, b) => getAlertSeverityOrder(b.level) - getAlertSeverityOrder(a.level));
      }

      this._items.set(items);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      this._isLoading.set(false);
    }
  }

  private getAttr(attrs: { attributeName?: string | null; value?: unknown }[], name: string): string | null {
    const attr = attrs.find(a => a.attributeName === name);
    return attr?.value != null ? String(attr.value) : null;
  }
}
