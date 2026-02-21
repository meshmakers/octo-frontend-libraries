import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusIndicatorWidgetConfig, ServiceCallDataSource } from '../../models/meshboard.models';
import { CkModelService } from '@meshmakers/octo-services';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';

@Component({
  selector: 'mm-status-indicator-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent],
  templateUrl: './status-indicator-widget.component.html',
  styleUrl: './status-indicator-widget.component.scss'
})
export class StatusIndicatorWidgetComponent implements OnInit, OnChanges {
  private readonly ckModelService = inject(CkModelService);

  @Input() config!: StatusIndicatorWidgetConfig;

  private readonly _isLoading = signal(true);
  private readonly _error = signal<string | null>(null);
  private readonly _status = signal<boolean | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly status = this._status.asReadonly();

  /**
   * Check if widget is not configured (needs service call setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource as ServiceCallDataSource;
    return dataSource?.type !== 'serviceCall';
  }

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadStatus();
    }
  }

  refresh(): void {
    this.loadStatus();
  }

  private async loadStatus(): Promise<void> {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const dataSource = this.config.dataSource as ServiceCallDataSource;

      switch (dataSource.callType) {
        case 'modelAvailable':
          await this.checkModelAvailable(dataSource.modelName);
          break;
        case 'healthCheck':
          // For now, just show as healthy - real implementation would call health endpoint
          this._status.set(true);
          break;
        default:
          this._status.set(false);
      }
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to check status');
      this._status.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  private async checkModelAvailable(modelName?: string): Promise<void> {
    if (!modelName) {
      this._status.set(false);
      return;
    }

    try {
      const isAvailable = await this.ckModelService.isModelAvailable(modelName);
      this._status.set(isAvailable);
    } catch {
      this._status.set(false);
    }
  }

  get statusLabel(): string {
    if (this.isLoading()) return '...';
    if (this.error()) return 'ERROR';

    const isActive = this.status();
    if (isActive) {
      return this.config.trueLabel ?? 'ENABLED';
    } else {
      return this.config.falseLabel ?? 'DISABLED';
    }
  }

  get statusColor(): string {
    if (this.isLoading() || this.error()) return 'var(--kendo-color-subtle, #6c757d)';

    const isActive = this.status();
    if (isActive) {
      return this.config.trueColor ?? '#10b981';
    } else {
      return this.config.falseColor ?? '#ef4444';
    }
  }
}
