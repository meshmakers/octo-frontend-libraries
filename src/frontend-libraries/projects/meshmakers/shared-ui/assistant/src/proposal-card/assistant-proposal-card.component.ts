import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AssistantProposal, AssistantProposalDecisionKind, AssistantMessages, assistantMessages, formatAssistantMessage, proposalDecisionLabel } from '@meshmakers/shared-ui/assistant-core';

/**
 * A write the assistant proposes (ui-concept §5.3/§5.6, wireframe screen 6):
 * violet card with a parameter table and Run / Edit / Discard. The buttons only
 * emit — the card never executes anything; the host forwards the decision.
 */
@Component({
  selector: 'mm-assistant-proposal-card',
  templateUrl: './assistant-proposal-card.component.html',
  styleUrl: './assistant-proposal-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantProposalCardComponent {
  readonly proposal = input.required<AssistantProposal>();
  /** Set once the person ran or discarded the proposal; disables the buttons. */
  readonly decision = input<AssistantProposalDecisionKind | null>(null);

  readonly run = output<AssistantProposal>();
  readonly edit = output<AssistantProposal>();
  readonly discard = output<AssistantProposal>();
  /** Translations; members left out fall back to {@link ASSISTANT_MESSAGES}, then English. */
  readonly messages = input<Partial<AssistantMessages> | null>(null);
  protected readonly m = assistantMessages(this.messages);
  protected readonly cardLabel = computed(() => formatAssistantMessage(this.m().proposalLabel, { title: this.proposal().title }));

  protected readonly decisionLabel = computed(() => {
    const decision = this.decision();
    return decision ? proposalDecisionLabel(decision, this.m()) : null;
  });
}
