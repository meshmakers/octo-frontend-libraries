import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { AssistantService, AssistantProposalDecision, AssistantMessages, AssistantSessionSummary, assistantMessages, formatAssistantMessage } from '@meshmakers/shared-ui/assistant-core';
import { AssistantComposerComponent } from '../composer/assistant-composer.component';
import { AssistantThreadComponent } from '../thread/assistant-thread.component';

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
 */
@Component({
  selector: 'mm-assistant-panel',
  imports: [AssistantThreadComponent, AssistantComposerComponent],
  templateUrl: './assistant-panel.component.html',
  styleUrl: './assistant-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'isPhone() ? "dialog" : "complementary"',
    '[attr.aria-modal]': 'isPhone() ? "true" : null',
    'aria-labelledby': 'assistant-panel-title',
    id: 'assistant-panel',
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

  /** Phone layout (≤ 640 px, the shell's breakpoint): the panel is a modal dialog. */
  protected readonly isPhone = signal(false);

  protected readonly connected = computed(() => this.assistant.transportStatus() !== 'unavailable');

  /** `chat` = thread + composer; `sessions` = the saved chats list (session-capable transports only). */
  protected readonly view = signal<'chat' | 'sessions'>('chat');
  /** Session whose deletion waits for confirmation. */
  protected readonly confirmingDelete = signal<string | null>(null);
  /** Session being opened or deleted (its buttons are disabled meanwhile). */
  protected readonly busySession = signal<string | null>(null);

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

    // Every entry point bumps focusRequest; the composer gets focus once rendered.
    effect(() => {
      this.assistant.focusRequest();
      untracked(() => {
        this.view.set('chat');
        this.focusComposer();
      });
    });
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
