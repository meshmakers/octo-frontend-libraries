import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServiceHealthWidgetConfig, ServiceCallDataSource } from '../../models/meshboard.models';
import { HealthService } from '@meshmakers/octo-services';
import { Subscription, interval } from 'rxjs';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'loading';

@Component({
  selector: 'mm-service-health-widget',
  standalone: true,
  imports: [CommonModule, WidgetNotConfiguredComponent],
  templateUrl: './service-health-widget.component.html',
  styleUrl: './service-health-widget.component.scss'
})
export class ServiceHealthWidgetComponent implements OnInit, OnChanges, OnDestroy {
  private readonly healthService = inject(HealthService);
  private readonly router = inject(Router);

  @Input() config!: ServiceHealthWidgetConfig;

  private readonly _healthStatus = signal<HealthStatus>('loading');
  private readonly _error = signal<string | null>(null);
  private readonly _lastChecked = signal<Date | null>(null);

  readonly healthStatus = this._healthStatus.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastChecked = this._lastChecked.asReadonly();

  /**
   * Check if widget is not configured (needs service call setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource as ServiceCallDataSource;
    return dataSource?.type !== 'serviceCall' || dataSource?.callType !== 'healthCheck';
  }

  private refreshSubscription?: Subscription;
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds

  ngOnInit(): void {
    this.checkHealth();
    this.startAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.checkHealth();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  refresh(): void {
    this.checkHealth();
  }

  onClick(): void {
    if (this.config.navigateOnClick && this.config.detailRoute) {
      this.router.navigate([this.config.detailRoute]);
    }
  }

  private startAutoRefresh(): void {
    this.refreshSubscription = interval(this.REFRESH_INTERVAL).subscribe(() => {
      this.checkHealth();
    });
  }

  private stopAutoRefresh(): void {
    this.refreshSubscription?.unsubscribe();
  }

  private async checkHealth(): Promise<void> {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    this._healthStatus.set('loading');
    this._error.set(null);

    try {
      const dataSource = this.config.dataSource as ServiceCallDataSource;

      const isHealthy = await this.performHealthCheck(dataSource);
      this._healthStatus.set(isHealthy ? 'healthy' : 'unhealthy');
      this._lastChecked.set(new Date());
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Health check failed');
      this._healthStatus.set('unhealthy');
    }
  }

  private async performHealthCheck(dataSource: ServiceCallDataSource): Promise<boolean> {
    let healthCheck;

    switch (dataSource.serviceType) {
      case 'identity':
        healthCheck = await this.healthService.getIdentityServiceAsync();
        break;
      case 'asset-repository':
        healthCheck = await this.healthService.getAssetRepoServiceHealthAsync();
        break;
      case 'bot':
        healthCheck = await this.healthService.getBotServiceAsync();
        break;
      case 'communication-controller':
        healthCheck = await this.healthService.getCommunicationControllerServiceAsync();
        break;
      case 'mesh-adapter':
        healthCheck = await this.healthService.getMeshAdapterAsync();
        break;
      case 'custom':
        // Custom endpoints not yet supported
        return false;
      default:
        return false;
    }

    // HealthCheck is considered healthy if it exists and status is 'Healthy'
    return healthCheck?.status === 'Healthy';
  }

  get serviceName(): string {
    const dataSource = this.config.dataSource as ServiceCallDataSource;
    if (dataSource?.type !== 'serviceCall') return 'Unknown';

    switch (dataSource.serviceType) {
      case 'identity': return 'Identity';
      case 'asset-repository': return 'Asset Repository';
      case 'bot': return 'Bot';
      case 'communication-controller': return 'Communication';
      case 'mesh-adapter': return 'Mesh Adapter';
      case 'custom': return 'Custom Service';
      default: return 'Unknown';
    }
  }

  get statusLabel(): string {
    switch (this.healthStatus()) {
      case 'healthy': return 'Healthy';
      case 'unhealthy': return 'Unhealthy';
      case 'loading': return 'Checking...';
      default: return 'Unknown';
    }
  }

  get showPulse(): boolean {
    return this.config.showPulse !== false && this.healthStatus() === 'healthy';
  }

  get isClickable(): boolean {
    return !!this.config.navigateOnClick && !!this.config.detailRoute;
  }
}
