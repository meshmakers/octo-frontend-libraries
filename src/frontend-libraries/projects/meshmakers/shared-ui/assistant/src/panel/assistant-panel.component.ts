import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import {
  ASSISTANT_PANEL_OPTIONS,
  AssistantMessages,
  AssistantPanelMode,
  AssistantProposalDecision,
  AssistantService,
  AssistantSessionSummary,
  DEFAULT_ASSISTANT_PANEL_MAX_WIDTH,
  DEFAULT_ASSISTANT_PANEL_MIN_WIDTH,
  DEFAULT_ASSISTANT_PANEL_STORAGE_KEY,
  assistantMessages,
  formatAssistantMessage
} from '@meshmakers/shared-ui/assistant-core';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import { clockArrowRotateIcon, plusIcon, trashIcon, xIcon } from '@progress/kendo-svg-icons';
import { AssistantComposerComponent } from '../composer/assistant-composer.component';
import { AssistantThreadComponent } from '../thread/assistant-thread.component';
import { OctoBotComponent } from '@meshmakers/shared-ui';

/** Width of the panel before anyone resized it (CSS: 400 px, 340 px ≤ 1180 px), used until measured. */
const FALLBACK_WIDTH = 400;
/** Window width the handle always leaves to the content. */
const MIN_CONTENT_WIDTH = 240;
/** Keyboard step of the resize handle in px (Shift: four times). */
const RESIZE_STEP = 16;

/** The persisted width, or null when absent, invalid or storage is unavailable. */
function readStoredWidth(key: string | null): number | null {
  if (!key) {
    return null;
  }
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const width = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(width) && width > 0 ? width : null;
  } catch {
    return null;
  }
}

/** Best effort: storage may be missing, full or blocked. */
function writeStoredWidth(key: string | null, width: number | null): void {
  if (!key) {
    return;
  }
  try {
    if (width === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, String(Math.round(width)));
    }
  } catch {
    // Persistence is best effort.
  }
}

/**
 * Right-side assistant panel (ui-concept §5.3, wireframe screen 6): header,
 * removable context chips, thread, composer. Non-modal: the page stays usable.
 * Opening focuses the composer, Esc closes and focus returns to where it was
 * (AssistantService). Below 640 px it covers the screen under the top bar and
 * becomes a modal dialog (`aria-modal`, Tab trapped) so the page behind is out
 * of reach. Removing a context chip moves focus to the next chip, else the composer.
 *
 * Host it only while {@link AssistantService.enabled} is set and the panel is open
 * (`@if (assistant.enabled && assistant.isOpen()) { <mm-assistant-panel /> }`); the thread
 * lives in the service, so closing and navigating keep it.
 *
 * Optional transport capabilities (AB#5621) add UI only when the transport has them:
 * - **sessions** — "New chat" and "Chats" in the header; the chat list replaces the thread
 *   (open a chat, delete with an inline confirmation; Esc returns to the chat);
 * - **starter questions** — shown as buttons on an empty thread; clicking one sends it;
 * - **attachments** — the composer's "Attach file" button (see `mm-assistant-composer`).
 *
 * Header actions ("New chat", "Chats", close) are icon buttons with tooltip and `aria-label` from
 * the messages, so they never wrap in a narrow panel (AB#5621).
 *
 * **Layout (AB#5621)** — inputs, else {@link ASSISTANT_PANEL_OPTIONS}, else the defaults:
 * - `resizable` (default `false`, so no handle and no extra tab stop; opt in per input or token):
 *   a handle on the left edge (`role="separator"`) changes the width by dragging or with ←/→
 *   (Shift: bigger steps), Home/End (min/max); a double click forgets the chosen width. The width
 *   stays within `minWidth`..`maxWidth` (320..720 px, and at least 240 px of the window stay free)
 *   and is kept in `localStorage` under `storageKey` (`mm-assistant-panel-width`; `null` = not
 *   kept). Without `resizable`, or until someone resizes it, the panel keeps its CSS width (400 px,
 *   340 px ≤ 1180 px). Unavailable storage only means the width is not kept.
 * - `mode`: `docked` (default, pushes the content) or `overlay` (floats over it, `position: fixed`
 *   at the right edge below `--mm-assistant-overlay-top`, default 48 px; stacking via
 *   `--mm-assistant-overlay-z-index`, default 20).
 * On phones neither applies: the panel is the full-screen dialog.
 */
@Component({
  selector: 'mm-assistant-panel',
  imports: [AssistantThreadComponent, AssistantComposerComponent, SVGIconComponent, OctoBotComponent],
  templateUrl: './assistant-panel.component.html',
  styleUrl: './assistant-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'isPhone() ? "dialog" : "complementary"',
    '[attr.aria-modal]': 'isPhone() ? "true" : null',
    'aria-labelledby': 'assistant-panel-title',
    id: 'assistant-panel',
    '[class.mm-assistant-overlay]': 'overlay()',
    '[class.mm-assistant-resizing]': 'resizing()',
    '[attr.data-mode]': 'effectiveMode()',
    '[style.width.px]': 'isPhone() ? null : appliedWidth()',
    '(keydown.escape)': 'onEscape($event)',
    '(keydown.tab)': 'onTab($event)',
    '(keydown.shift.tab)': 'onTab($event)'
  }
})
export class AssistantPanelComponent {
  protected readonly assistant = inject(AssistantService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly composer = viewChild(AssistantComposerComponent);

  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);

  /** `docked` pushes the content, `overlay` floats over it (default: options token, else `docked`). */
  readonly mode = input<AssistantPanelMode | null>(null);
  /** Shows the resize handle (default: options token, else `false`). */
  readonly resizable = input<boolean | null>(null);
  /** Smallest width in px of the resize handle (default: options token, else 320). */
  readonly minWidth = input<number | null>(null);
  /** Largest width in px of the resize handle (default: options token, else 720). */
  readonly maxWidth = input<number | null>(null);
  /**
   * `localStorage` key of the chosen width; `null` = not kept. Left out (`undefined`): options
   * token, else `mm-assistant-panel-width`.
   */
  readonly storageKey = input<string | null | undefined>(undefined);

  protected readonly xIcon = xIcon;
  protected readonly plusIcon = plusIcon;
  protected readonly historyIcon = clockArrowRotateIcon;
  protected readonly trashIcon = trashIcon;

  private readonly options = inject(ASSISTANT_PANEL_OPTIONS, { optional: true });

  protected readonly effectiveMode = computed<AssistantPanelMode>(() => this.mode() ?? this.options?.mode ?? 'docked');
  protected readonly overlay = computed(() => this.effectiveMode() === 'overlay' && !this.isPhone());
  private readonly effectiveStorageKey = computed(() => {
    const key = this.storageKey();
    if (key !== undefined) {
      return key;
    }
    return this.options?.storageKey !== undefined ? this.options.storageKey : DEFAULT_ASSISTANT_PANEL_STORAGE_KEY;
  });
  protected readonly effectiveMin = computed(() =>
    Math.max(0, Math.round(this.minWidth() ?? this.options?.minWidth ?? DEFAULT_ASSISTANT_PANEL_MIN_WIDTH)));
  protected readonly effectiveMax = computed(() => {
    const configured = this.maxWidth() ?? this.options?.maxWidth ?? DEFAULT_ASSISTANT_PANEL_MAX_WIDTH;
    const viewport = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth - MIN_CONTENT_WIDTH : Infinity;
    return Math.round(Math.max(this.effectiveMin(), Math.min(configured, viewport)));
  });
  /** The handle is shown (never on phones). */
  protected readonly canResize = computed(() => (this.resizable() ?? this.options?.resizable ?? false) && !this.isPhone());

  /** Width chosen in this panel instance; `undefined` = not touched yet (stored width applies). */
  private readonly chosenWidth = signal<number | null | undefined>(undefined);
  private readonly storedWidth = computed(() => readStoredWidth(this.effectiveStorageKey()));
  /** The inline width in px, or null for the CSS default. */
  protected readonly appliedWidth = computed(() => {
    const chosen = this.chosenWidth();
    const width = chosen === undefined ? this.storedWidth() : chosen;
    return width === null || !this.canResize() ? null : this.clampWidth(width);
  });
  /** CSS width as rendered, for `aria-valuenow` before the first resize. */
  private readonly measuredWidth = signal(FALLBACK_WIDTH);
  protected readonly currentWidth = computed(() => this.appliedWidth() ?? this.clampWidth(this.measuredWidth()));
  protected readonly resizing = signal(false);
  private stopDrag: (() => void) | null = null;

  /** Phone layout (≤ 640 px, the shell's breakpoint): the panel is a modal dialog. */
  protected readonly isPhone = signal(false);

  protected readonly connected = computed(() => this.assistant.transportStatus() !== 'unavailable');

  /** `chat` = thread + composer; `sessions` = the saved chats list (session-capable transports only). */
  protected readonly view = signal<'chat' | 'sessions'>('chat');
  /** Session whose deletion waits for confirmation. */
  protected readonly confirmingDelete = signal<string | null>(null);
  /** Session being opened or deleted (its buttons are disabled meanwhile). */
  protected readonly busySession = signal<string | null>(null);

  /**
   * Greeting of an empty chat (AB#3444): the OctoBot waves once, then rests on its still frame.
   * Not shown while the assistant is unavailable (the panel says so instead).
   */
  protected readonly showGreeting = computed(() =>
    this.view() === 'chat' && this.assistant.thread().length === 0 && this.connected()
    && this.assistant.transportStatus() !== 'error');

  /** Starter questions on an empty thread (transports with `starterQuestions` only). */
  protected readonly showStarters = computed(() =>
    this.view() === 'chat' && this.assistant.thread().length === 0 && this.assistant.starterQuestions().length > 0);

  constructor() {
    const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)')
      : null;
    if (query) {
      this.isPhone.set(query.matches);
      const listener = (event: MediaQueryListEvent): void => this.isPhone.set(event.matches);
      query.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
    }

    this.assistant.loadStarterQuestions();

    afterNextRender(() => this.measure());
    inject(DestroyRef).onDestroy(() => this.stopDrag?.());

    // Every entry point bumps focusRequest; the composer gets focus once rendered.
    effect(() => {
      this.assistant.focusRequest();
      untracked(() => {
        this.view.set('chat');
        this.focusComposer();
      });
    });
  }

  /** Pointer drag on the handle: the panel sits on the right, so moving left widens it. */
  protected startResize(event: PointerEvent): void {
    if (event.button !== 0 || !this.canResize()) {
      return;
    }
    event.preventDefault();
    this.stopDrag?.();
    const startX = event.clientX;
    const startWidth = this.currentWidth();
    const move = (moveEvent: PointerEvent): void => this.setWidth(startWidth + startX - moveEvent.clientX, false);
    const end = (): void => {
      this.stopDrag?.();
      const width = this.chosenWidth();
      if (width !== undefined) {
        writeStoredWidth(this.effectiveStorageKey(), width);
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    this.resizing.set(true);
    this.stopDrag = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      this.resizing.set(false);
      this.stopDrag = null;
    };
  }

  /** ←/→ resize (Shift: ×4), Home/End jump to min/max; the width is kept right away. */
  protected onResizeKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
    let width: number;
    switch (event.key) {
      case 'ArrowLeft': width = this.currentWidth() + step; break;
      case 'ArrowRight': width = this.currentWidth() - step; break;
      case 'Home': width = this.effectiveMin(); break;
      case 'End': width = this.effectiveMax(); break;
      default: return;
    }
    event.preventDefault();
    this.setWidth(width, true);
  }

  /** Double click on the handle: back to the default width, forgetting the kept one. */
  protected resetWidth(): void {
    this.chosenWidth.set(null);
    writeStoredWidth(this.effectiveStorageKey(), null);
    afterNextRender(() => this.measure(), { injector: this.injector });
  }

  private setWidth(width: number, persist: boolean): void {
    const clamped = this.clampWidth(width);
    this.chosenWidth.set(clamped);
    if (persist) {
      writeStoredWidth(this.effectiveStorageKey(), clamped);
    }
  }

  private clampWidth(width: number): number {
    return Math.round(Math.min(this.effectiveMax(), Math.max(this.effectiveMin(), width)));
  }

  private measure(): void {
    const width = this.host.nativeElement.getBoundingClientRect().width;
    if (width > 0) {
      this.measuredWidth.set(width);
    }
  }

  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    if (this.confirmingDelete()) {
      this.cancelDelete();
    } else if (this.view() === 'sessions') {
      this.backToChat();
    } else {
      this.assistant.close();
    }
  }

  /** Shows the saved chats and reloads them. */
  protected showSessions(): void {
    this.confirmingDelete.set(null);
    this.view.set('sessions');
    void this.assistant.refreshSessions();
    this.focusSessionList();
  }

  protected backToChat(): void {
    this.confirmingDelete.set(null);
    this.view.set('chat');
    this.focusComposer();
  }

  protected newChat(): void {
    this.assistant.newThread();
    this.backToChat();
  }

  protected async openSession(session: AssistantSessionSummary): Promise<void> {
    this.busySession.set(session.id);
    try {
      await this.assistant.openSession(session.id);
    } finally {
      this.busySession.set(null);
    }
    this.backToChat();
  }

  protected askDelete(session: AssistantSessionSummary): void {
    this.confirmingDelete.set(session.id);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('.session-confirm .confirm-delete')?.focus(),
      { injector: this.injector });
  }

  protected cancelDelete(): void {
    const id = this.confirmingDelete();
    this.confirmingDelete.set(null);
    afterNextRender(() => Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.session-row'))
      .find(row => row.dataset['sessionId'] === id)?.querySelector<HTMLElement>('.session-delete')?.focus(),
    { injector: this.injector });
  }

  protected async confirmDelete(session: AssistantSessionSummary): Promise<void> {
    this.busySession.set(session.id);
    let deleted: boolean;
    try {
      deleted = await this.assistant.deleteSession(session.id);
    } finally {
      this.busySession.set(null);
      this.confirmingDelete.set(null);
    }
    if (deleted) {
      await this.assistant.refreshSessions();
      this.focusSessionList();
    } else {
      // The error row lives in the thread.
      this.backToChat();
    }
  }

  protected sendStarter(question: string): void {
    this.assistant.send(question);
  }

  /** Locale date + time of a session, or '' when absent or unparsable. */
  protected sessionDate(session: AssistantSessionSummary): string {
    if (!session.createdAt) {
      return '';
    }
    const date = new Date(session.createdAt);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }

  /** First chat of the list, else the back button. */
  private focusSessionList(): void {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      (root.querySelector<HTMLElement>('.session-open') ?? root.querySelector<HTMLElement>('.back'))?.focus();
    }, { injector: this.injector });
  }

  private focusComposer(): void {
    afterNextRender(() => this.composer()?.focus(), { injector: this.injector });
  }

  /** Phone dialog: Tab and Shift+Tab cycle inside the panel. */
  protected onTab(event: Event): void {
    if (!this.isPhone() || event.defaultPrevented) {
      return;
    }
    const focusable = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const backwards = (event as KeyboardEvent).shiftKey;
    if (backwards && (active === first || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!backwards && (active === last || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Drops a chip and keeps keyboard users in the row: next chip, else the composer. */
  protected removeChip(id: string, index: number): void {
    this.assistant.removeChip(id);
    afterNextRender(() => {
      const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.ctx-chip button');
      const next = buttons[Math.min(index, buttons.length - 1)];
      if (next) {
        next.focus();
      } else {
        this.composer()?.focus();
      }
    }, { injector: this.injector });
  }

  protected format(message: string, values: Record<string, string>): string {
    return formatAssistantMessage(message, values);
  }

  protected onDecision(decision: AssistantProposalDecision): void {
    this.assistant.decideProposal(decision.kind, decision.proposal);
  }
}
