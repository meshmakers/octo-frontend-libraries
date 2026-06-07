import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AiSessionEventDto } from '../../models/ai-session-event';

/**
 * Read-only transcript of a session, derived from the events stream. The
 * component takes the events as an input signal so the host owns lifetime —
 * a parent that's already wired `AiSessionStreamService.events$` into a
 * `toSignal()` just hands the same signal in.
 *
 * Markdown rendering is deliberately minimal in Phase 1: the component shows
 * the raw payload (already JSON or stream-json) in a `<pre>` block. The
 * concept §10 calls for proper markdown + code-block highlighting; that
 * upgrade lands behind a `markdown` Input once we've picked a renderer
 * (markdown-it vs marked) and verified its CSP behaviour.
 */
@Component({
  selector: 'mm-ai-chat-stream',
  imports: [],
  templateUrl: './ai-chat-stream.component.html',
  styleUrl: './ai-chat-stream.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatStreamComponent {
  readonly events = input.required<AiSessionEventDto[]>();

  /**
   * Sorted by sequence so out-of-order arrival (the SignalR + REST backfill
   * union) renders deterministically.
   */
  protected readonly orderedEvents = computed(() =>
    [...this.events()].sort((a, b) => a.sequence - b.sequence),
  );

  protected variant(kind: AiSessionEventDto['kind']): string {
    switch (kind) {
      case 'Message':
        return 'message';
      case 'ToolCall':
        return 'tool-call';
      case 'ToolResult':
        return 'tool-result';
      case 'StatusChange':
        return 'status';
      case 'Hook':
        return 'hook';
      case 'Error':
        return 'error';
      default:
        return 'message';
    }
  }
}
