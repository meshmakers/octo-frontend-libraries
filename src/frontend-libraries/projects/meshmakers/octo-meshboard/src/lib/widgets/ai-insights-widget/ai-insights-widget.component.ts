import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiInsightsWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { infoCircleIcon, exclamationCircleIcon, checkCircleIcon, xCircleIcon } from '@progress/kendo-svg-icons';
import { AiInsightsService, AiInsight, AiInsightContext } from './ai-insights.service';

@Component({
  selector: 'mm-ai-insights-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, WidgetNotConfiguredComponent],
  template: `
    <div class="ai-insights-widget">
      @if (isLoading() && !insights()) {
        <div class="loading-state">
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="loading-text">Generating AI insights...</span>
        </div>
      } @else if (error()) {
        <div class="error-state">{{ error() }}</div>
      } @else if (insights(); as items) {
        <div class="insights-list">
          @for (insight of items; track insight.title) {
            <div class="insight-card" [class]="'severity-' + insight.severity">
              <div class="insight-icon">
                <kendo-svg-icon [icon]="getIcon(insight.severity)" size="medium"></kendo-svg-icon>
              </div>
              <div class="insight-content">
                <div class="insight-title">{{ insight.title }}</div>
                <div class="insight-description">{{ insight.description }}</div>
              </div>
            </div>
          }
        </div>
        @if (isLoading()) {
          <div class="refresh-indicator">Aktualisierung...</div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .ai-insights-widget {
      height: 100%;
      overflow-y: auto;
      padding: 8px 12px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
      opacity: 0.6;
    }

    .loading-dots {
      display: flex;
      gap: 6px;

      span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--kendo-color-primary, #06b6d4);
        animation: pulse-dot 1.4s ease-in-out infinite;

        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
      }
    }

    @keyframes pulse-dot {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }

    .loading-text {
      font-size: 0.8rem;
    }

    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .insight-card {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid var(--mm-ai-border-color, #6b7280);
      background: var(--mm-ai-card-bg, rgba(255, 255, 255, 0.03));
    }

    .insight-icon {
      flex-shrink: 0;
      padding-top: 2px;
      color: var(--mm-ai-border-color, #6b7280);
    }

    .insight-content {
      flex: 1;
      min-width: 0;
    }

    .insight-title {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--kendo-color-on-app-surface, inherit);
    }

    .insight-description {
      font-size: 0.8rem;
      line-height: 1.4;
      opacity: 0.8;
    }

    .severity-info {
      --mm-ai-border-color: var(--mm-ai-info, #3b82f6);
    }

    .severity-warning {
      --mm-ai-border-color: var(--mm-ai-warning, #f59e0b);
    }

    .severity-success {
      --mm-ai-border-color: var(--mm-ai-success, #10b981);
    }

    .severity-critical {
      --mm-ai-border-color: var(--mm-ai-critical, #ef4444);
    }

    .refresh-indicator {
      text-align: center;
      padding: 8px;
      font-size: 0.7rem;
      opacity: 0.5;
    }

    .error-state {
      text-align: center;
      padding: 16px;
      color: var(--kendo-color-error, #dc3545);
    }
  `]
})
export class AiInsightsWidgetComponent implements DashboardWidget<AiInsightsWidgetConfig, AiInsight[]>, OnInit, OnChanges, OnDestroy {
  private readonly aiService = inject(AiInsightsService);
  private readonly stateService = inject(MeshBoardStateService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly infoIcon = infoCircleIcon;
  protected readonly warningIcon = exclamationCircleIcon;
  protected readonly successIcon = checkCircleIcon;
  protected readonly criticalIcon = xCircleIcon;

  @Input() config!: AiInsightsWidgetConfig;

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _insights = signal<AiInsight[] | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._insights.asReadonly();
  readonly insights = this._insights.asReadonly();

  isNotConfigured(): boolean {
    return false;
  }

  ngOnInit(): void {
    this.loadInsights();
    this.startAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.stopAutoRefresh();
      this.loadInsights();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  refresh(): void {
    this.loadInsights();
  }

  protected getIcon(severity: string) {
    switch (severity) {
      case 'warning': return this.warningIcon;
      case 'success': return this.successIcon;
      case 'critical': return this.criticalIcon;
      default: return this.infoIcon;
    }
  }

  private async loadInsights(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const widgets = this.stateService.widgets();
      const widgetSummaries = this.aiService.gatherWidgetContext(widgets);

      const context: AiInsightContext = {
        apiKey: this.config.apiKey,
        model: this.config.model,
        systemPrompt: this.config.systemPrompt,
        maxInsights: this.config.maxInsights ?? 4,
        domainContext: this.config.domainContext ?? 'energy management',
        widgetSummaries
      };

      const insights = await this.aiService.generateInsights(context);
      this._insights.set(insights);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      this._isLoading.set(false);
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    const interval = (this.config?.refreshInterval ?? 0) * 1000;
    if (interval > 0) {
      this.refreshTimer = setInterval(() => this.loadInsights(), interval);
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
