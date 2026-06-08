import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiSessionEventDto } from '../../models/ai-session-event';
import { ParsedEvent, parseAndOrder } from './event-parser';

/**
 * Read-only transcript of a session, derived from the events stream.
 *
 * The component takes raw `AiSessionEventDto` entries, runs them through the
 * `event-parser` to produce a typed `ParsedView` per event, and renders each
 * kind with its own treatment — assistant bubbles for chat text, expandable
 * cards for tool calls + tool results, single-line collapsed strips for the
 * system / hook noise, and a stats panel for the terminal `result` summary.
 *
 * Markdown rendering inside assistant text is still deferred (concept §10);
 * for now the parser hands plain text to the template and the SCSS preserves
 * line breaks via `white-space: pre-wrap`. Picking a renderer (markdown-it vs
 * marked) is gated on a CSP review and a markdown-corpus regression test.
 */
@Component({
  selector: 'mm-ai-chat-stream',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-chat-stream.component.html',
  styleUrl: './ai-chat-stream.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatStreamComponent {
  readonly events = input.required<AiSessionEventDto[]>();

  /**
   * Sorted + parsed. Recomputes whenever the input signal changes; the sort
   * is stable so live appends from SignalR keep prior render positions.
   */
  protected readonly parsedEvents = computed<ParsedEvent[]>(() =>
    parseAndOrder(this.events()),
  );

  /**
   * Per-event "show raw JSON" toggle. Keyed by sequence so live appends
   * don't flicker existing toggles closed. A `Set<number>` rather than a
   * record so add / delete avoids `keyof` shenanigans.
   */
  private readonly expandedSet = signal<ReadonlySet<number>>(new Set());

  protected isExpanded(sequence: number): boolean {
    return this.expandedSet().has(sequence);
  }

  protected toggleRaw(sequence: number): void {
    this.expandedSet.update((prev) => {
      const next = new Set(prev);
      if (next.has(sequence)) {
        next.delete(sequence);
      } else {
        next.add(sequence);
      }
      return next;
    });
  }

  /**
   * `HH:MM:SS` formatter — full ISO is too noisy in a 30-event transcript.
   * Returns the input unchanged if parsing fails so we don't pretend events
   * we can't read are recent.
   */
  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleTimeString('de-AT', { hour12: false });
  }

  /** Compact "1234 tok" for the assistant header. */
  protected formatTokenCount(n: number): string {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)} ktok`;
    }
    return `${n} tok`;
  }

  /** Duration in either `ms` (sub-second) or `s.SS`. */
  protected formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)} ms`;
    }
    return `${(ms / 1000).toFixed(2)} s`;
  }

  /** Cost in EUR-style decimals; null + zero collapse to a dash. */
  protected formatCost(usd: number | null | undefined): string {
    if (usd == null || usd === 0) {
      return '—';
    }
    return `$${usd.toFixed(4)}`;
  }

  /** Pretty-print arbitrary tool_use input or raw blocks for the expandable detail panel. */
  protected formatRaw(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
