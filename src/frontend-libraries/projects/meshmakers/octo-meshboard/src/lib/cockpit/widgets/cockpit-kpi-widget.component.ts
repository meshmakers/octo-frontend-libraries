import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CockpitKpiWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../../widgets/widget.interface';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { CockpitContextService } from '../cockpit-context.service';
import { CockpitKpi, sparklineGeometry } from '../kpi/cockpit-kpi';
import { CockpitKpiKind, CockpitKpiResult, CockpitKpiService } from '../kpi/cockpit-kpi.service';
import { COCKPIT_WIDGET_STYLES } from './cockpit-widget.styles';

/**
 * The cockpit KPI widgets (AB#5558): "Adapter status", "CK model state" and "Pipeline executions
 * 24 h" — one component, the KPI follows the widget type. Value, status chip (dot + label), an
 * optional detail line and, for executions, an hourly sparkline whose `aria-label` names peak,
 * total and failures. The tile links to the page behind the figure when the host resolves one.
 * A viewer without the KPI's role / CK model sees why instead of an empty tile.
 */
@Component({
  selector: 'mm-cockpit-kpi-widget',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #tileBody let-k>
      <!-- The metric name is the widget title in the board chrome; repeat it for the link's accessible name. -->
      <span class="cw-visually-hidden">{{ k.label }}: </span>
      <span class="kpi-value">{{ k.value }}</span>
      <span class="kpi-meta">
        <span class="cw-status-chip" [class]="'cw-status-chip cw-status-' + k.status">{{ k.statusLabel }}</span>
        @if (showDetail() && k.detail) {
          <span class="kpi-detail" [title]="k.detail">{{ k.detail }}</span>
        }
      </span>
      @if (spark(); as s) {
        <svg class="kpi-spark" viewBox="0 0 120 36" preserveAspectRatio="none" role="img" [attr.aria-label]="k.sparklineLabel">
          <path class="spark-area" [attr.d]="s.area"></path>
          <path class="spark-line" [attr.d]="s.line"></path>
          <circle class="spark-dot" [attr.cx]="s.lastX" [attr.cy]="s.lastY" r="2.5"></circle>
        </svg>
      }
    </ng-template>
    @switch (result().state) {
      @case ('ready') {
        @if (kpi(); as k) {
          @if (url(); as link) {
            <a class="kpi-tile" [routerLink]="link" [attr.data-kpi]="k.id">
              <ng-container *ngTemplateOutlet="tileBody; context: { $implicit: k }"></ng-container>
            </a>
          } @else {
            <div class="kpi-tile" [attr.data-kpi]="k.id">
              <ng-container *ngTemplateOutlet="tileBody; context: { $implicit: k }"></ng-container>
            </div>
          }
        }
      }
      @case ('unavailable') {
        <p class="cw-message" role="status" data-state="unavailable">{{ reason() }}</p>
      }
      @case ('error') {
        <p class="cw-message cw-error-text" role="status" data-state="error">{{ reason() }}</p>
      }
      @default {
        <p class="cw-message" role="status" data-state="loading">Loading…</p>
      }
    }
  `,
  styles: [COCKPIT_WIDGET_STYLES, `
    .kpi-tile {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      height: 100%;
      box-sizing: border-box;
      padding: 8px 14px;
      color: inherit;
      text-decoration: none;
      min-width: 0;
    }
    a.kpi-tile:hover .kpi-value { text-decoration: underline; text-decoration-thickness: 1px; }
    .kpi-value {
      font-size: 1.75rem;
      line-height: 2.25rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .kpi-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
    .kpi-detail {
      color: var(--_cw-muted);
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .kpi-spark { display: block; width: 100%; height: 36px; margin-top: 6px; }
    .spark-area { fill: color-mix(in srgb, var(--_cw-accent) 16%, transparent); }
    .spark-line { fill: none; stroke: var(--_cw-accent); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .spark-dot { fill: var(--_cw-accent); }
    .cw-error-text { color: var(--_cw-error); }
  `]
})
export class CockpitKpiWidgetComponent implements DashboardWidget<CockpitKpiWidgetConfig, CockpitKpi>, OnInit, OnChanges, OnDestroy {
  private readonly kpiService = inject(CockpitKpiService);
  private readonly context = inject(CockpitContextService);
  private readonly boardState = inject(MeshBoardStateService);

  @Input() config!: CockpitKpiWidgetConfig;

  private readonly _result = signal<CockpitKpiResult>({ state: 'loading' });
  private readonly tenantId = signal<string | null>(null);
  private readonly options = signal<{ showDetail: boolean; showSparkline: boolean }>({ showDetail: true, showSparkline: true });
  private subscription: Subscription | null = null;

  readonly result = this._result.asReadonly();
  readonly isLoading = computed(() => this._result().state === 'loading');
  readonly data = computed(() => {
    const result = this._result();
    return result.state === 'ready' ? result.kpi : null;
  });
  readonly error = computed(() => {
    const result = this._result();
    return result.state === 'error' ? result.message : null;
  });

  protected readonly kpi = this.data;
  protected readonly showDetail = computed(() => this.options().showDetail);
  /** Role requirements only for builders; other viewers get a neutral "Not available" (AB#5558 review). */
  protected readonly reason = computed(() => {
    const result = this._result();
    if (result.state === 'unavailable') {
      return result.forBuilder ? result.reason : NOT_AVAILABLE_TEXT;
    }
    return result.state === 'error' ? result.message : '';
  });
  protected readonly spark = computed(() => {
    const kpi = this.data();
    return kpi?.sparkline && this.options().showSparkline ? sparklineGeometry(kpi.sparkline) : null;
  });
  protected readonly url = computed(() => {
    const kpi = this.data();
    const tenantId = this.tenantId();
    return kpi?.link && tenantId ? this.context.resolveLink(kpi.link, tenantId) : null;
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  refresh(): void {
    this.load();
  }

  private load(): void {
    this.subscription?.unsubscribe();
    const config = this.config;
    this.options.set({
      showDetail: config?.showDetail !== false,
      showSparkline: config?.type !== 'pipelineExecutions' || config.showSparkline !== false
    });
    void this.context.tenantId().then(tenantId => this.tenantId.set(tenantId));
    const previous = this._result();
    this.subscription = this.kpiService.kpi(kpiKindOf(config)).subscribe(result => {
      // A refresh keeps the last figure until the new one arrives (no flicker).
      if (result.state === 'loading' && previous.state === 'ready') {
        return;
      }
      this._result.set(result);
      // A tile a non-builder cannot use is collapsed on the board (outside edit mode).
      if (config?.id) {
        this.boardState.setWidgetHiddenForViewer(config.id, result.state === 'unavailable' && !result.forBuilder);
      }
    });
  }
}

/** What viewers without builder roles see instead of role requirements. */
export const NOT_AVAILABLE_TEXT = 'Not available';

/** The KPI a cockpit KPI widget shows. */
export function kpiKindOf(config: CockpitKpiWidgetConfig | undefined): CockpitKpiKind {
  switch (config?.type) {
    case 'ckModelState':
      return 'ckModelState';
    case 'pipelineExecutions':
      return 'pipelineExecutions';
    default:
      return 'adapterStatus';
  }
}
