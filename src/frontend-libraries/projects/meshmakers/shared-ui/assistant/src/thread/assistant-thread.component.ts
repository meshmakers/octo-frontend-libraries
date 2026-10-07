import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AssistantMarkdownPipe } from '../assistant-markdown';
import { AssistantProposalCardComponent } from '../proposal-card/assistant-proposal-card.component';
import { ASSISTANT_TOOL_CALL_COMPONENT, AssistantProposalDecision, AssistantThreadItem, AssistantMessages, assistantMessages } from '@meshmakers/shared-ui/assistant-core';

/**
 * The conversation (wireframe screen 6): user turns, assistant turns (markdown
 * via `renderAssistantMarkdown`: no images, safe links only; violet edge), tool-call rows and proposal cards. Tool calls
 * render with the `ASSISTANT_TOOL_CALL_COMPONENT` (an OctoMesh host passes `mm-ai-tool-call` from
 * `@meshmakers/octo-ai-console`, ui-concept §5.1 "do not rebuild"); proposals are emitted, never executed.
 *
 * The list is an `aria-live` log; it is `aria-busy` while a turn streams so a
 * screen reader announces finished messages instead of every token. Nothing
 * inside it carries its own live role, so each addition is announced once.
 */
@Component({
  selector: 'mm-assistant-thread',
  imports: [NgComponentOutlet, AssistantMarkdownPipe, AssistantProposalCardComponent],
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
