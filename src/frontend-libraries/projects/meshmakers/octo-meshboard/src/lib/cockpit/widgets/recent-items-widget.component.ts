import { ChangeDetectionStrategy, Component, DestroyRef, Input, NgZone, OnChanges, OnInit, SimpleChanges, computed, effect, inject, signal, untracked } from '@angular/core';
import { RecentItemsWidgetConfig } from '../../models/meshboard.models';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { DashboardWidget } from '../../widgets/widget.interface';
import { COCKPIT_RECENT_ITEMS, CockpitRecentItem, CockpitRecentItemKind } from '../cockpit-host';
import { COCKPIT_WIDGET_STYLES } from './cockpit-widget.styles';

/** Rows shown when the config sets none (the former Home panel showed eight). */
export const DEFAULT_RECENT_ITEMS_MAX = 8;
/** Upper bound of the config dialog. */
export const MAX_RECENT_ITEMS = 20;

const GLYPH: Record<CockpitRecentItemKind, string> = { page: '▤', entity: '◎', board: '#' };

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago" (the Cmd+K palette's wording). */
export function recentRelativeTime(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** A row with its glyph and time texts. */
interface RecentItemView {
  item: CockpitRecentItem;
  glyph: string;
  when: string;
  datetime: string;
  absolute: string;
}

/**
 * "Recent items" cockpit widget (AB#5558): the viewer's recently opened pages, entities and
 * boards as a list of real links, most recent first. The data is per user and comes from the
 * host (`COCKPIT_RECENT_ITEMS`), which also re-checks visibility and decides how an entry opens
 * (the Refinery Studio switches the mode first when needed). Without a host source the widget
 * says "Not available" and collapses outside edit mode.
 */
@Component({
  selector: 'mm-recent-items-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="recent-widget">
      @if (!source) {
        <p class="cw-message" role="status" data-state="unavailable">Not available</p>
      } @else if (error()) {
        <p class="cw-message cw-error-text" role="status" data-state="error">Recently opened items could not be read.</p>
      } @else if (views(); as rows) {
        @if (rows.length > 0) {
          <ul class="recent-list" role="list" [attr.aria-label]="config?.title || 'Recently opened'">
            @for (row of rows; track row.item.key) {
              <li>
                <a class="recent-row" [href]="row.item.href" [attr.data-recent]="row.item.key" (click)="open(row.item, $event)">
                  <span class="recent-glyph" aria-hidden="true">{{ row.glyph }}</span>
                  <span class="recent-text">
                    <span class="recent-label">{{ row.item.label }}</span>
                    <small class="recent-kind">{{ row.item.kindLabel }}</small>
                  </span>
                  <time class="recent-when" [attr.datetime]="row.datetime" [attr.title]="row.absolute">{{ row.when }}</time>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="cw-message" role="status" data-state="empty">Nothing opened yet. Pages, entities and boards you open appear here.</p>
        }
        @if (source.openPalette) {
          <button type="button" class="palette-hint" (click)="openPalette()" title="Open the command palette">
            <kbd>{{ source.paletteShortcut || 'Ctrl K' }}</kbd> shows the same list
          </button>
        }
      } @else {
        <p class="cw-message" role="status" data-state="loading">Loading…</p>
      }
    </div>
  `,
  styles: [COCKPIT_WIDGET_STYLES, `
    .recent-widget {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      padding: 6px;
      box-sizing: border-box;
    }
    .recent-list {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .recent-row {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      width: 100%;
      padding: 6px 8px;
      border-radius: 4px;
      color: var(--_cw-text);
      text-decoration: none;
    }
    .recent-row:hover { background: color-mix(in srgb, var(--_cw-text) 6%, transparent); }
    .recent-glyph { color: var(--_cw-muted); text-align: center; }
    .recent-text { display: flex; flex-direction: column; min-width: 0; }
    .recent-label, .recent-kind { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recent-kind, .recent-when { color: var(--_cw-muted); font-size: 0.75rem; }
    .recent-when { white-space: nowrap; }
    .palette-hint {
      align-self: flex-end;
      margin: auto 6px 0 0;
      padding: 6px 2px 2px;
      border: 0;
      background: none;
      color: var(--_cw-muted);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .palette-hint:hover { color: var(--_cw-text); }
    .palette-hint kbd { font-family: inherit; font-size: 0.6875rem; }
    .cw-error-text { color: var(--_cw-error); }
    @media (prefers-reduced-motion: no-preference) {
      .recent-row { transition: background-color 120ms ease; }
    }
  `]
})
export class RecentItemsWidgetComponent implements DashboardWidget<RecentItemsWidgetConfig, CockpitRecentItem[]>, OnInit, OnChanges {
  protected readonly source = inject(COCKPIT_RECENT_ITEMS, { optional: true });
  private readonly boardState = inject(MeshBoardStateService);

  @Input() config!: RecentItemsWidgetConfig;

  private readonly _items = signal<CockpitRecentItem[] | null>(null);
  private readonly _error = signal(false);
  /** Ticks every minute so "12 min ago" stays true while the board is open. */
  private readonly now = signal(Date.now());
  private loadToken = 0;
  private initialised = false;
  /** History revision of the last load, so the first effect run does not load twice. */
  private loadedRevision: unknown = undefined;

  readonly data = this._items.asReadonly();
  readonly isLoading = computed(() => this._items() === null && !this._error());
  readonly error = computed(() => this._error() ? 'Recently opened items could not be read.' : null);

  protected readonly views = computed<RecentItemView[] | null>(() => {
    const items = this._items();
    const now = this.now();
    return items?.map(item => {
      const date = new Date(item.lastVisitedAt);
      return {
        item,
        glyph: GLYPH[item.kind] ?? GLYPH.page,
        when: recentRelativeTime(item.lastVisitedAt, now),
        datetime: date.toISOString(),
        absolute: date.toLocaleString()
      };
    }) ?? null;
  });

  constructor() {
    // Re-read whenever the host's history changes (e.g. a visit recorded after the board opened).
    effect(() => {
      const revision = this.source?.revision?.();
      if (this.initialised && revision !== this.loadedRevision) {
        untracked(() => void this.load());
      }
    });
    // Outside the zone: a pending interval would keep the app (and tests) from ever being stable.
    const timer = inject(NgZone).runOutsideAngular(() => setInterval(() => this.now.set(Date.now()), 60_000));
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit(): void {
    this.initialised = true;
    if (!this.source && this.config?.id) {
      this.boardState.setWidgetHiddenForViewer(this.config.id, true);
    }
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      void this.load();
    }
  }

  refresh(): void {
    void this.load();
  }

  /** Rows shown: the configured count within 1…20. */
  protected maxItems(): number {
    const value = this.config?.maxItems ?? DEFAULT_RECENT_ITEMS_MAX;
    return Math.min(MAX_RECENT_ITEMS, Math.max(1, Math.round(value)));
  }

  /** A plain left click opens in the app through the host; modified clicks are left to the browser. */
  protected open(item: CockpitRecentItem, event: MouseEvent): void {
    if (!this.source || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    void this.source.open(item);
  }

  protected openPalette(): void {
    this.source?.openPalette?.();
  }

  private async load(): Promise<void> {
    if (!this.source) {
      return;
    }
    const token = ++this.loadToken;
    this.loadedRevision = untracked(() => this.source?.revision?.());
    try {
      const items = await this.source.items(this.maxItems());
      if (token === this.loadToken) {
        this._error.set(false);
        this.now.set(Date.now());
        this._items.set(items.slice(0, this.maxItems()));
      }
    } catch (error) {
      if (token === this.loadToken) {
        console.warn('Recent items could not be read', error);
        this._error.set(true);
      }
    }
  }
}
