import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AttentionListWidgetConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../../widgets/widget.interface';
import { AttentionFinding, AttentionSeverity } from '../attention/attention.models';
import { AttentionState, CockpitAttentionService } from '../attention/attention.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { CockpitContextService } from '../cockpit-context.service';
import { CockpitExplainTarget, CockpitLinkQueryParams } from '../cockpit-host';
import { CockpitWidgetMessages, formatCockpitMessage, injectCockpitWidgetMessages } from '../cockpit-messages';
import { formatCount } from '../kpi/cockpit-kpi';
import { COCKPIT_WIDGET_STYLES } from './cockpit-widget.styles';
import { reportCockpitContentHeight } from './content-height';

/** Findings shown before "and N more" when the config sets none. */
export const DEFAULT_ATTENTION_MAX_ITEMS = 6;

const SEVERITY_MESSAGE: Record<AttentionSeverity, keyof CockpitWidgetMessages> = {
  error: 'severityError',
  warning: 'severityWarning',
  info: 'severityInfo'
};

/** A finding link resolved for `routerLink` + `queryParams`. */
export interface AttentionLinkView {
  label: string;
  path: string | string[];
  queryParams: CockpitLinkQueryParams | null;
}

/** A finding with its links resolved to host URLs (unresolvable links are left out). */
export interface AttentionFindingView {
  finding: AttentionFinding;
  severityLabel: string;
  /** Formatted `finding.count`, or null when the finding has none. */
  count: string | null;
  countLabel: string | null;
  links: AttentionLinkView[];
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
    <div class="attention-widget">
      <div class="cw-content" #content>
      @if (error(); as message) {
        <p class="cw-message cw-error-text" role="status">{{ message }}</p>
      } @else if (state(); as current) {
        @if (current.visibleProviders === 0) {
          <p class="cw-message" role="status" data-state="unavailable">{{ isBuilder() ? texts().attentionNoChecksForRole : texts().notAvailable }}</p>
        } @else if (views().length === 0) {
          @if (current.loading) {
            <p class="cw-message" role="status" data-state="loading">{{ texts().attentionChecking }}</p>
          } @else {
            <p class="cw-message all-clear" role="status" data-state="clear"><span class="cw-status-chip cw-status-success">{{ texts().attentionAllClear }}</span> {{ texts().attentionNothingNeedsAttention }}</p>
          }
        } @else {
          <ul class="finding-list" role="list" [attr.aria-label]="texts().attentionListLabel">
            @for (view of shown(); track view.finding.id) {
              <li class="finding" [class]="'finding severity-' + view.finding.severity" [attr.data-finding]="view.finding.id">
                <span class="severity-bar" aria-hidden="true"></span>
                <div class="finding-body">
                  <div class="finding-head">
                    <span class="cw-status-chip" [class]="'cw-status-chip cw-status-' + view.finding.severity">{{ view.severityLabel }}</span>
                    <span class="finding-title">{{ view.finding.title }}</span>
                    @if (view.count !== null) {
                      <span class="finding-count" [attr.title]="view.countLabel"><span aria-hidden="true">{{ view.count }}</span><span class="cw-visually-hidden">{{ view.countLabel }}</span></span>
                    }
                  </div>
                  <p class="finding-text">{{ view.finding.text }}</p>
                  @if (view.links.length > 0 || view.explain) {
                    <div class="finding-links">
                      @for (link of view.links; track $index) {
                        <a class="link-chip" [routerLink]="link.path" [queryParams]="link.queryParams">{{ link.label }}</a>
                      }
                      @if (view.explain; as target) {
                        <button type="button" class="link-chip ai" (click)="explain(target)">{{ texts().attentionExplain }}</button>
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
          @if (hiddenCount() > 0) {
            <p class="cw-message more">{{ moreText() }}</p>
          }
        }
      } @else {
        <p class="cw-message" role="status" data-state="loading">{{ texts().attentionChecking }}</p>
      }
      </div>
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
    .finding-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      box-sizing: border-box;
      border-radius: 10px;
      background: color-mix(in srgb, var(--_cw-text) 10%, transparent);
      font-size: 0.75rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
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
  private readonly boardState = inject(MeshBoardStateService);

  @Input() config!: AttentionListWidgetConfig;

  /**
   * Translated texts for a widget used on its own (AB#5622); wins over `COCKPIT_WIDGET_MESSAGES`.
   * Missing members keep the English default.
   */
  readonly messages = input<Partial<CockpitWidgetMessages> | null>();

  /** Resolved texts: defaults < host token < `messages` input. */
  protected readonly texts = injectCockpitWidgetMessages(() => this.messages());

  /**
   * Unconstrained wrapper of the content: its height is reported so the phone tier grows the
   * tile to fit the stacked cards instead of clipping them (AB#5558).
   */
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  /** Builders see why no check runs; other viewers a neutral text and the widget collapses. */
  protected readonly isBuilder = signal(false);

  private readonly _state = signal<AttentionState | null>(null);
  /** Message member of the current error, so the text follows a language switch (AB#5622). */
  private readonly _error = signal<'noTenant' | 'attentionLoadFailed' | null>(null);
  private readonly tenantId = signal<string | null>(null);
  private subscription: Subscription | null = null;
  private loadToken = 0;

  readonly state = this._state.asReadonly();
  readonly error = computed(() => {
    const key = this._error();
    return key ? this.texts()[key] : null;
  });
  readonly isLoading = computed(() => this._state()?.loading ?? this._error() === null);
  readonly data = computed(() => this._state()?.findings ?? null);

  /** Findings with resolved links. */
  readonly views = computed<AttentionFindingView[]>(() => {
    const tenantId = this.tenantId();
    const findings = this._state()?.findings ?? [];
    const withExplain = this.context.explainEnabled && this.config?.showExplain !== false;
    const texts = this.texts();
    return findings.map(finding => {
      const count = typeof finding.count === 'number' && Number.isFinite(finding.count) ? formatCount(finding.count, texts.numberLocale) : null;
      return {
        finding,
        severityLabel: texts[SEVERITY_MESSAGE[finding.severity]] as string,
        count,
        countLabel: count === null ? null : formatCockpitMessage(texts.attentionCountLabel, { count }),
        links: tenantId ? this.resolveLinks(finding, tenantId) : [],
        explain: withExplain ? finding.explain ?? null : null
      };
    });
  });

  private readonly maxItems = signal(DEFAULT_ATTENTION_MAX_ITEMS);
  readonly shown = computed(() => this.views().slice(0, this.maxItems()));
  readonly hiddenCount = computed(() => Math.max(0, this.views().length - this.maxItems()));
  protected readonly moreText = computed(() => formatCockpitMessage(this.texts().attentionMore, { count: this.hiddenCount() }));

  constructor() {
    reportCockpitContentHeight(this.content, () => this.config?.id);
  }

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

  private resolveLinks(finding: AttentionFinding, tenantId: string): AttentionLinkView[] {
    const links: AttentionLinkView[] = [];
    for (const link of finding.links) {
      const resolved = this.context.resolveLinkTarget(link.target, tenantId);
      if (resolved) {
        links.push({ label: link.label, path: resolved.path, queryParams: resolved.queryParams ?? null });
      }
    }
    return links;
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.subscription?.unsubscribe();
    this.subscription = null;
    this._error.set(null);
    this.maxItems.set(Math.max(1, this.config?.maxItems ?? DEFAULT_ATTENTION_MAX_ITEMS));
    const [tenantId, builder] = await Promise.all([this.context.tenantId(), this.context.isBuilder()]);
    this.isBuilder.set(builder);
    if (token !== this.loadToken) {
      return;
    }
    if (!tenantId) {
      this._state.set(null);
      this._error.set('noTenant');
      return;
    }
    this.tenantId.set(tenantId);
    this.subscription = this.attention.state({ tenantId }, this.config?.providerIds).subscribe({
      // A refresh keeps the previous findings until the first provider answers (no flicker).
      next: state => {
        if (!(state.loading && state.findings.length === 0 && this._state() && !this._state()?.loading)) {
          this._state.set(state);
        }
        if (this.config?.id) {
          this.boardState.setWidgetHiddenForViewer(this.config.id, !builder && !state.loading && state.visibleProviders === 0);
        }
      },
      error: () => this._error.set('attentionLoadFailed')
    });
  }
}
