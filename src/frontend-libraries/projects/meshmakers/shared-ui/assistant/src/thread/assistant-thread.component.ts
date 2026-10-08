import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AssistantMarkdownPipe } from '../assistant-markdown';
import { AssistantProposalCardComponent } from '../proposal-card/assistant-proposal-card.component';
import { OctoBotComponent } from '@meshmakers/shared-ui';
import { ASSISTANT_TOOL_CALL_COMPONENT, AssistantProposalDecision, AssistantThreadItem, AssistantMessages, assistantMessages } from '@meshmakers/shared-ui/assistant-core';

/**
 * The conversation (wireframe screen 6): user turns, assistant turns (markdown
 * via `renderAssistantMarkdown`: no images, safe links only; violet edge), tool-call rows and proposal cards. Tool calls
 * render with the `ASSISTANT_TOOL_CALL_COMPONENT` (an OctoMesh host passes `mm-ai-tool-call` from
 * `@meshmakers/octo-ai-console`, ui-concept §5.1 "do not rebuild"); proposals are emitted, never executed.
 *
 * A user turn sent through a slash command's `expand` (AB#5621) shows the expanded prompt with the
 * typed command (`slashCommand`) as a small label above it.
 *
 * While an assistant turn streams it shows the OctoBot `thinking` with "Thinking…" (AB#3444);
 * once the reply is complete the newest assistant turn keeps the OctoBot as a still frame. The
 * figure is decorative — the text carries the meaning — and appears at most once in the thread.
 *
 * The list is an `aria-live` log; it is `aria-busy` while a turn streams so a
 * screen reader announces finished messages instead of every token. Nothing
 * inside it carries its own live role, so each addition is announced once.
 */
@Component({
  selector: 'mm-assistant-thread',
  imports: [NgComponentOutlet, AssistantMarkdownPipe, AssistantProposalCardComponent, OctoBotComponent],
  templateUrl: './assistant-thread.component.html',
  styleUrl: './assistant-thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantThreadComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly items = input<AssistantThreadItem[]>([]);
  readonly proposalDecision = output<AssistantProposalDecision>();
  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);
  protected readonly toolCallComponent = inject(ASSISTANT_TOOL_CALL_COMPONENT);

  /** Id of the newest assistant turn: the only one that shows the resting OctoBot. */
  protected readonly lastAssistantId = computed(() => {
    const items = this.items();
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].kind === 'assistant') {
        return items[i].id;
      }
    }
    return null;
  });

  protected readonly streaming = computed(() => this.items().some(item => item.kind === 'assistant' && item.streaming));

  constructor() {
    // Keep the newest turn in view.
    effect(() => {
      this.items();
      queueMicrotask(() => {
        const element = this.host.nativeElement;
        element.scrollTop = element.scrollHeight;
      });
    });
  }
}
