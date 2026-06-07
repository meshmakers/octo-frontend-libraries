import { AiSessionStatus } from './ai-session';

/**
 * Event kinds emitted as stream-json lines by the Claude Code worker (and synthetic
 * lines from the orchestrator). Mirrors `RtAiSessionEventKindEnum` in System.Ai-3.
 */
export type AiSessionEventKind =
  | 'Message'
  | 'ToolCall'
  | 'ToolResult'
  | 'StatusChange'
  | 'Hook'
  | 'Error';

/**
 * Payload pushed by the adapter's SignalR `OnSessionEventAsync` callback. Mirrors
 * `SessionEventEnvelope` on the C# side.
 */
export interface AiSessionEventDto {
  readonly sessionId: string;
  readonly kind: AiSessionEventKind;
  readonly sequence: number;
  readonly payload: string;
  readonly actorRef: string;
  readonly at: string;
}

/**
 * Payload pushed by `OnSessionStatusChangedAsync`. Mirrors
 * `SessionStatusChangedEnvelope` on the C# side.
 */
export interface AiSessionStatusChangedDto {
  readonly sessionId: string;
  readonly newStatus: AiSessionStatus;
  readonly reason?: string | null;
  readonly at: string;
}

/**
 * Decoded tool-call lifted from an `AiSessionEvent` payload. Owned by the UI
 * because the adapter wire format is a stream-json string and the components
 * render structured fields.
 */
export interface AiToolCallDto {
  readonly sessionId: string;
  readonly callId: string;
  readonly toolName: string;
  readonly arguments: unknown;
  readonly result?: unknown;
  readonly status: 'Pending' | 'Approved' | 'Rejected' | 'Succeeded' | 'Failed';
  readonly startedAt: string;
  readonly completedAt?: string | null;
  readonly durationMs?: number | null;
}
