import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusListWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { firstValueFrom } from 'rxjs';

interface StatusListItem {
  label: string;
  status: string;
  color: string;
  displayLabel: string;
}

@Component({
  selector: 'mm-status-list-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent],
  template: `
    <div class="status-list-widget">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (error()) {
        <div class="error-message">{{ error() }}</div>
      } @else {
        <div class="status-list">
          @for (item of items(); track item.label) {
            <div class="status-list-item">
              <span class="item-label">{{ item.label }}</span>
              <span class="item-badge" [style.background-color]="item.color">
                {{ item.displayLabel }}
              </span>
            </div>
          }
          @if (!isLoading() && items().length === 0) {
            <div class="empty-message">No items found</div>
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

    .status-list-widget {
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 8px 0;
      overflow-y: auto;
    }

    .status-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0 12px;
    }

    .status-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 6px;
      background: var(--mm-status-list-item-bg, rgba(255, 255, 255, 0.04));
      border: 1px solid var(--mm-status-list-item-border, rgba(255, 255, 255, 0.06));
    }

    .item-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--kendo-color-on-app-surface, inherit);
    }

    .item-badge {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      border-radius: 4px;
      color: #fff;
      white-space: nowrap;
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
export class StatusListWidgetComponent implements DashboardWidget<StatusListWidgetConfig, StatusListItem[]>, OnInit, OnChanges {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);

  @Input() config!: StatusListWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _items = signal<StatusListItem[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._items.asReadonly();
  readonly items = this._items.asReadonly();

  isNotConfigured(): boolean {
    return !this.config?.ckTypeId || !this.config?.labelField || !this.config?.statusField;
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
      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId: this.config.ckTypeId,
            first: 50
          }
        })
      );

      const entities = result.data?.runtime?.runtimeEntities?.items ?? [];
      const items: StatusListItem[] = [];

      for (const entity of entities) {
        if (!entity) continue;
        const attrs = (entity.attributes?.items ?? [])
          .filter((a): a is NonNullable<typeof a> => a != null && a.attributeName != null);

        const label = this.getAttributeValue(attrs, this.config.labelField) ?? '';
        const status = this.getAttributeValue(attrs, this.config.statusField) ?? '';
        const colorConfig = this.config.statusColors?.[status];

        items.push({
          label,
          status,
          color: colorConfig?.color ?? '#6b7280',
          displayLabel: colorConfig?.label ?? status
        });
      }

      this._items.set(items);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      this._isLoading.set(false);
    }
  }

  private getAttributeValue(attrs: { attributeName?: string | null; value?: unknown }[], field: string): string | null {
    const attr = attrs.find(a => a.attributeName === field);
    return attr?.value != null ? String(attr.value) : null;
  }
}
