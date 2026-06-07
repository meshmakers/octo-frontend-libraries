import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { AiToolCallDto } from '../../models/ai-session-event';

/**
 * Expandable card surface for one tool invocation in a session transcript.
 * Click the header to toggle arguments + result; the body is rendered as
 * pretty-printed JSON so the host doesn't need its own json formatter.
 */
@Component({
  selector: 'mm-ai-tool-call',
  imports: [],
  templateUrl: './ai-tool-call.component.html',
  styleUrl: './ai-tool-call.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiToolCallComponent {
  readonly call = input.required<AiToolCallDto>();

  protected readonly expanded = signal(false);

  protected readonly statusVariant = computed(() => {
    const status = this.call().status;
    switch (status) {
      case 'Succeeded':
        return 'succeeded';
      case 'Failed':
        return 'failed';
      case 'Rejected':
        return 'rejected';
      case 'Approved':
      case 'Pending':
        return 'pending';
      default:
        return 'pending';
    }
  });

  protected readonly argumentsJson = computed(() =>
    this.format(this.call().arguments),
  );
  protected readonly resultJson = computed(() => {
    const result = this.call().result;
    return result === undefined ? null : this.format(result);
  });

  protected toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  private format(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
