import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AiApprovalDecisionDto,
  AiApprovalRequestedDto,
} from '../../models/ai-approval';

/**
 * Approval modal. The host opens it when a `AiApprovalRequestedDto` arrives on
 * the SignalR stream, fills the `request` input, and listens for the `decide`
 * output to call `AiAdapterClientService.decideApproval`. The modal itself is
 * presentation-only: no networking, no global state, no portal magic.
 *
 * The host is expected to wrap the modal in its own backdrop / focus-trap so
 * the library doesn't pull in a positioning dependency (CDK overlay, Kendo
 * window, ng-bootstrap, …) — each host shop already has one.
 */
@Component({
  selector: 'mm-ai-approval-modal',
  imports: [FormsModule],
  templateUrl: './ai-approval-modal.component.html',
  styleUrl: './ai-approval-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiApprovalModalComponent {
  readonly request = input.required<AiApprovalRequestedDto>();

  readonly decide = output<AiApprovalDecisionDto>();
  readonly dismiss = output<void>();

  protected readonly comment = signal('');

  protected readonly prettyPayload = computed(() => {
    try {
      return JSON.stringify(JSON.parse(this.request().payload), null, 2);
    } catch {
      return this.request().payload;
    }
  });

  protected approve(): void {
    this.decide.emit({
      outcome: 'Approved',
      comment: this.commentOrUndefined(),
    });
  }

  protected reject(): void {
    this.decide.emit({
      outcome: 'Rejected',
      comment: this.commentOrUndefined(),
    });
  }

  protected onDismiss(): void {
    this.dismiss.emit();
  }

  private commentOrUndefined(): string | undefined {
    const trimmed = this.comment().trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
