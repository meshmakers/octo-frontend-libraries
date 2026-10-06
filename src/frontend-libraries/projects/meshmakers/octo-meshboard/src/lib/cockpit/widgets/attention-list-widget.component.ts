import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AttentionListWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../../widgets/widget.interface';
import { AttentionFinding, AttentionSeverity } from '../attention/attention.models';
import { AttentionState, CockpitAttentionService } from '../attention/attention.service';
import { CockpitContextService } from '../cockpit-context.service';
import { CockpitExplainTarget } from '../cockpit-host';
import { COCKPIT_WIDGET_STYLES } from './cockpit-widget.styles';

/** Findings shown before "and N more" when the config sets none. */
export const DEFAULT_ATTENTION_MAX_ITEMS = 6;

const SEVERITY_LABEL: Record<AttentionSeverity, string> = { error: 'Error', warning: 'Warning', info: 'Info' };

/** A finding with its links resolved to host URLs (unresolvable links are left out). */
export interface AttentionFindingView {
  finding: AttentionFinding;
  severityLabel: string;
  links: { label: string; url: string }[];
  explain: CockpitExplainTarget | null;
}

/**
 * "Attention list" cockpit widget (AB#5558): rule-based health findings from the configured
 * providers, errors first. Each provider runs only when the viewer may open what it links to, so
 * a viewer never sees findings about objects outside their roles; with no visible provider the
 * widget says so instead of claiming "all clear".
 */
@Component({
  selector: 'mm-attention-list-widget',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="attention-widget" aria-live="polite">
      @if (error(); as message) {
        <p class="cw-message cw-error-text">{{ message }}</p>
      } @else if (state(); as current) {
        @if (current.visibleProviders === 0) {
          <p class="cw-message" data-state="unavailable">No health checks are available for your role.</p>
        } @else if (views().length === 0) {
          @if (current.loading) {
            <p class="cw-message" data-state="loading">Checking…</p>
          } @else {
            <p class="cw-message all-clear" data-state="clear"><span class="cw-status-chip cw-status-success">All clear</span> Nothing needs attention.</p>
          }
        } @else {
          <ul class="finding-list" aria-label="Needs attention">
            @for (view of shown(); track view.finding.id) {
              <li class="finding" [class]="'finding severity-' + view.finding.severity" [attr.data-finding]="view.finding.id">
                <span class="severity-bar" aria-hidden="true"></span>
                <div class="finding-body">
                  <div class="finding-head">
                    <span class="cw-status-chip" [class]="'cw-status-chip cw-status-' + view.finding.severity">{{ view.severityLabel }}</span>
                    <span class="finding-title">{{ view.finding.title }}</span>
                  </div>
                  <p class="finding-text">{{ view.finding.text }}</p>
                  @if (view.links.length > 0 || view.explain) {
                    <div class="finding-links">
                      @for (link of view.links; track link.url) {
                        <a class="link-chip" [routerLink]="link.url">{{ link.label }}</a>
                      }
                      @if (view.explain; as target) {
                        <button type="button" class="link-chip ai" (click)="explain(target)">✦ Explain</button>
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
          @if (hiddenCount() > 0) {
            <p class="cw-message more">and {{ hiddenCount() }} more</p>
          }
        }
      } @else {
        <p class="cw-message" data-state="loading">Checking…</p>
      }
    </div>
  `,
  styles: [COCKPIT_WIDGET_STYLES, `
    .attention-widget { height: 100%; overflow-y: auto; padding: 8px 12px; box-sizing: border-box; }
    .finding-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .finding {
      display: grid;
      grid-template-columns: 3px minmax(0, 1fr);
      gap: 10px;
      padding: 8px 12px 8px 0;
      background: var(--_cw-surface);
      border: 1px solid var(--_cw-border);
      border-radius: 6px;
      min-width: 0;
    }
    .severity-bar { border-radius: 0 2px 2px 0; background: var(--_cw-info); }
    .severity-error .severity-bar { background: var(--_cw-error); }
    .severity-warning .severity-bar { background: var(--_cw-warning); }
    .finding-body { min-width: 0; }
    .finding-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .finding-title { font-weight: 500; }
    .finding-text { margin: 4px 0 6px; color: var(--_cw-muted); font-size: 0.8125rem; }
    .finding-links { display: flex; flex-wrap: wrap; gap: 6px; }
    .link-chip {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 6px;
      border: 1px solid var(--_cw-border);
      border-radius: 4px;
      background: none;
      color: var(--_cw-muted);
      font: inherit;
      font-size: 0.75rem;
      text-decoration: none;
      cursor: pointer;
    }
    .link-chip:hover { color: var(--_cw-text); border-color: var(--_cw-border-strong); }
    .link-chip.ai { color: var(--_cw-ai); border-color: color-mix(in srgb, var(--_cw-ai) 35%, transparent); }
    .all-clear { display: flex; align-items: center; gap: 8px; }
    .cw-error-text { color: var(--_cw-error); }
    .more { padding: 6px 0 0; }
  `]
})
export class AttentionListWidgetComponent implements DashboardWidget<AttentionListWidgetConfig, AttentionFinding[]>, OnInit, OnChanges, OnDestroy {
  private readonly attention = inject(CockpitAttentionService);
  private readonly context = inject(CockpitContextService);

  @Input() config!: AttentionListWidgetConfig;

  private readonly _state = signal<AttentionState | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly tenantId = signal<string | null>(null);
  private subscription: Subscription | null = null;
  private loadToken = 0;

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isLoading = computed(() => this._state()?.loading ?? this._error() === null);
  readonly data = computed(() => this._state()?.findings ?? null);

  /** Findings with resolved links. */
  readonly views = computed<AttentionFindingView[]>(() => {
    const tenantId = this.tenantId();
    const findings = this._state()?.findings ?? [];
    const withExplain = this.context.explainEnabled && this.config?.showExplain !== false;
    return findings.map(finding => ({
      finding,
      severityLabel: SEVERITY_LABEL[finding.severity],
      links: tenantId
        ? finding.links
          .map(link => ({ label: link.label, url: this.context.resolveLink(link.target, tenantId) }))
          .filter((link): link is { label: string; url: string } => !!link.url)
        : [],
      explain: withExplain ? finding.explain ?? null : null
    }));
  });

  private readonly maxItems = signal(DEFAULT_ATTENTION_MAX_ITEMS);
  readonly shown = computed(() => this.views().slice(0, this.maxItems()));
  readonly hiddenCount = computed(() => Math.max(0, this.views().length - this.maxItems()));

  ngOnInit(): void {
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  refresh(): void {
    void this.load();
  }

  protected explain(target: CockpitExplainTarget): void {
    this.context.explain(target);
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.subscription?.unsubscribe();
    this.subscription = null;
    this._error.set(null);
    this.maxItems.set(Math.max(1, this.config?.maxItems ?? DEFAULT_ATTENTION_MAX_ITEMS));
    const tenantId = await this.context.tenantId();
    if (token !== this.loadToken) {
      return;
    }
    if (!tenantId) {
      this._state.set(null);
      this._error.set('No tenant selected.');
      return;
    }
    this.tenantId.set(tenantId);
    this.subscription = this.attention.state({ tenantId }, this.config?.providerIds).subscribe({
      // A refresh keeps the previous findings until the first provider answers (no flicker).
      next: state => {
        if (!(state.loading && state.findings.length === 0 && this._state() && !this._state()?.loading)) {
          this._state.set(state);
        }
      },
      error: () => this._error.set('The health checks could not be loaded.')
    });
  }
}
