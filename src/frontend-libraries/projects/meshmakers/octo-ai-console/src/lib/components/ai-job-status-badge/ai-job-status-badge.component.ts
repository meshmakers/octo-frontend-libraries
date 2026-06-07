import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AiSessionStatus } from '../../models/ai-session';

/**
 * Status pill that mirrors the eight values `AiSessionStatus` carries on the
 * wire. The component is purely visual — it takes a status string in and emits
 * a CSS class + display label that the host's stylesheet can theme via the
 * `--mm-ai-status-*` custom properties.
 */
@Component({
  selector: 'mm-ai-job-status-badge',
  imports: [],
  templateUrl: './ai-job-status-badge.component.html',
  styleUrl: './ai-job-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiJobStatusBadgeComponent {
  readonly status = input.required<AiSessionStatus>();

  protected readonly variant = computed(() => {
    switch (this.status()) {
      case 'Running':
        return 'running';
      case 'Queued':
        return 'queued';
      case 'Paused':
        return 'paused';
      case 'Completed':
        return 'completed';
      case 'Failed':
      case 'Cancelled':
        return 'failed';
      case 'QuotaBlocked':
      case 'RateLimited':
        return 'blocked';
      default:
        return 'queued';
    }
  });
}
