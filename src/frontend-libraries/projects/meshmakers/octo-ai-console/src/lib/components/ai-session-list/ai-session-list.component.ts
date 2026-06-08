import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AiSessionDto, AiSessionStatus } from '../../models/ai-session';
import { AiJobStatusBadgeComponent } from '../ai-job-status-badge/ai-job-status-badge.component';

/**
 * List view of an AI Adapter tenant's sessions. The host owns data fetching —
 * the component takes the array as an input signal and emits the rtId on
 * row click. Keeping it data-source-agnostic lets refinery wire its own
 * Apollo cache while a bastion CLI could pass static fixtures in a Storybook.
 *
 * Cancel and Delete are surfaced as inline per-row actions and emitted as
 * separate outputs — the host owns the confirmation dialog and the actual
 * REST call. The component only knows which actions are valid for which
 * status, so a Running session never offers Delete and a Completed session
 * never offers Cancel.
 */
@Component({
  selector: 'mm-ai-session-list',
  imports: [AiJobStatusBadgeComponent],
  templateUrl: './ai-session-list.component.html',
  styleUrl: './ai-session-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSessionListComponent {
  readonly sessions = input.required<AiSessionDto[]>();
  readonly selectedSessionId = input<string | null>(null);

  readonly sessionSelected = output<string>();
  readonly cancelRequested = output<string>();
  readonly deleteRequested = output<string>();

  protected readonly orderedSessions = computed(() =>
    [...this.sessions()].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    ),
  );

  /**
   * Terminal status set, kept in sync with the C# `AiAgentSessionService.IsTerminal`
   * predicate. Delete is gated to this set; Cancel is gated to its complement.
   * If the wire enum grows a new terminal kind, both predicates must be
   * updated here AND on the server.
   */
  private static readonly TERMINAL_STATUSES: ReadonlySet<AiSessionStatus> =
    new Set<AiSessionStatus>(['Completed', 'Failed', 'Cancelled']);

  protected canCancel(status: AiSessionStatus): boolean {
    return !AiSessionListComponent.TERMINAL_STATUSES.has(status);
  }

  protected canDelete(status: AiSessionStatus): boolean {
    return AiSessionListComponent.TERMINAL_STATUSES.has(status);
  }

  protected onSelect(sessionRtId: string): void {
    this.sessionSelected.emit(sessionRtId);
  }

  protected onCancel(sessionRtId: string, event: MouseEvent): void {
    // Without stopPropagation the row click also fires and selects this
    // session, which then redirects focus and tears the inline-action button
    // out from under the user mid-confirmation.
    event.stopPropagation();
    this.cancelRequested.emit(sessionRtId);
  }

  protected onDelete(sessionRtId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.deleteRequested.emit(sessionRtId);
  }

  protected age(startedAt: string): string {
    const started = Date.parse(startedAt);
    if (Number.isNaN(started)) {
      return '';
    }
    const now = Date.now();
    const seconds = Math.floor((now - started) / 1000);
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
