import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { AssistantService } from '../assistant.service';
import { AssistantComposerComponent } from '../composer/assistant-composer.component';
import { AssistantThreadComponent } from '../thread/assistant-thread.component';
import { AssistantProposalDecision } from '../assistant.models';
import { AssistantMessages, assistantMessages, formatAssistantMessage } from '../assistant.messages';

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
  private readonly composer = viewChild.required(AssistantComposerComponent);

  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);

  /** Phone layout (≤ 640 px, the shell's breakpoint): the panel is a modal dialog. */
  protected readonly isPhone = signal(false);

  protected readonly connected = computed(() => this.assistant.transportStatus() !== 'unavailable');

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

    // Every entry point bumps focusRequest; the composer gets focus once rendered.
    effect(() => {
      this.assistant.focusRequest();
      untracked(() => afterNextRender(() => this.composer().focus(), { injector: this.injector }));
    });
  }

  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    this.assistant.close();
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
        this.composer().focus();
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
