import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AiSessionDto } from '../../models/ai-session';
import { AiJobStatusBadgeComponent } from '../ai-job-status-badge/ai-job-status-badge.component';

/**
 * List view of an AI Adapter tenant's sessions. The host owns data fetching —
 * the component takes the array as an input signal and emits the rtId on
 * row click. Keeping it data-source-agnostic lets refinery wire its own
 * Apollo cache while a bastion CLI could pass static fixtures in a Storybook.
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

  protected readonly orderedSessions = computed(() =>
    [...this.sessions()].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    ),
  );

  protected onSelect(sessionRtId: string): void {
    this.sessionSelected.emit(sessionRtId);
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
