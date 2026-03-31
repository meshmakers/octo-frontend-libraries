import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertBannerWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { firstValueFrom } from 'rxjs';
import { AlertItem, getAlertSeverityColor, getAlertSeverityIcon, getAlertSeverityOrder, DEFAULT_ALERT_CK_TYPE } from '../alert-shared/alert-severity.utils';
import { FieldFilterOperatorsDto, SortOrdersDto } from '@meshmakers/octo-services';

@Component({
  selector: 'mm-alert-banner-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, WidgetNotConfiguredComponent],
  template: `
    <div class="alert-banner-widget">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (error()) {
        <div class="error-message">{{ error() }}</div>
      } @else if (currentAlert()) {
        <div class="alert-banner" [class.critical]="currentAlert()!.level === 'CRITICAL'"
             [style.--alert-color]="currentColor()">
          @if (config.showIcon !== false) {
            <kendo-svg-icon [icon]="currentIcon()" class="alert-icon"></kendo-svg-icon>
          }
          <span class="alert-severity-badge">{{ currentAlert()!.level }}</span>
          <span class="alert-message">{{ currentAlert()!.message }}</span>
          @if (items().length > 1) {
            <span class="alert-counter">{{ currentIndex() + 1 }}/{{ items().length }}</span>
          }
        </div>
      } @else if (!isLoading()) {
        <div class="alert-banner no-alerts">
          <span class="alert-message">No active alerts</span>
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

    .alert-banner-widget {
      height: 100%;
      display: flex;
      align-items: center;
    }

    .alert-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px;
      border-left: 4px solid var(--alert-color, #6b7280);
      background: color-mix(in srgb, var(--alert-color, #6b7280) 10%, transparent);
    }

    .alert-banner.critical {
      animation: pulse-bg 1.5s ease-in-out infinite;
    }

    @keyframes pulse-bg {
      0%, 100% { background: color-mix(in srgb, var(--alert-color) 10%, transparent); }
      50% { background: color-mix(in srgb, var(--alert-color) 25%, transparent); }
    }

    .alert-icon {
      flex-shrink: 0;
      color: var(--alert-color, #6b7280);
    }

    .alert-severity-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 3px;
      background: var(--alert-color, #6b7280);
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .alert-message {
      flex: 1;
      font-size: 0.85rem;
      color: var(--kendo-color-on-app-surface, inherit);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .alert-counter {
      font-size: 0.7rem;
      opacity: 0.5;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .no-alerts {
      border-left-color: var(--mm-alert-debug, #6b7280);
      opacity: 0.5;
    }

    .error-message {
      text-align: center;
      padding: 16px;
      width: 100%;
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class AlertBannerWidgetComponent implements DashboardWidget<AlertBannerWidgetConfig, AlertItem[]>, OnInit, OnChanges, OnDestroy {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  @Input() config!: AlertBannerWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _items = signal<AlertItem[]>([]);
  private readonly _currentIndex = signal(0);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._items.asReadonly();
  readonly items = this._items.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();

  readonly currentAlert = computed(() => {
    const items = this._items();
    if (items.length === 0) return null;
    return items[this._currentIndex() % items.length];
  });

  readonly currentColor = computed(() => {
    const alert = this.currentAlert();
    return alert ? getAlertSeverityColor(alert.level) : '';
  });

  readonly currentIcon = computed(() => {
    const alert = this.currentAlert();
    return alert ? getAlertSeverityIcon(alert.level) : getAlertSeverityIcon('DEBUG');
  });

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

  ngOnDestroy(): void {
    this.stopRotation();
  }

  refresh(): void {
    this.loadData();
  }

  private startRotation(): void {
    this.stopRotation();
    const interval = this.config?.rotationInterval ?? 5000;
    if (this._items().length > 1) {
      this.rotationTimer = setInterval(() => {
        this._currentIndex.update(i => (i + 1) % this._items().length);
      }, interval);
    }
  }

  private stopRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
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
            first: this.config?.maxAlerts ?? 20,
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

      items.sort((a, b) => getAlertSeverityOrder(b.level) - getAlertSeverityOrder(a.level));
      this._items.set(items);
      this._currentIndex.set(0);
      this.startRotation();
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
