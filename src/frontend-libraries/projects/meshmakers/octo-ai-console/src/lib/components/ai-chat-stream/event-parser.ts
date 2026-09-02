import { AiSessionEventDto } from '../../models/ai-session-event';

/**
 * Token-usage summary extracted from an `assistant` or `result` payload.
 * Fields beyond `input` / `output` are optional because the upstream worker
 * (claude-code stream-json) sometimes omits them on rate-limited or
 * cache-only turns.
 */
export interface ParsedTokenUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead?: number;
  readonly cacheCreation?: number;
}

/**
 * A single content fragment inside an assistant event. The worker emits a
 * mix of `text` and `tool_use` parts per message — sometimes one of each in
 * the same payload — and the renderer needs to walk them in order to keep
 * the conversational flow intact (text → "I'll run X" → tool_use card).
 */
export type ParsedAssistantPart =
  | { readonly type: 'text'; readonly text: string }
  | {
    readonly type: 'tool_use';
    readonly id: string;
    readonly toolName: string;
    readonly input: unknown;
  };

/**
 * Discriminated union the chat-stream renders on. The component switches over
 * `kind` and pulls only the fields it needs per branch — no `any` walks of
 * the original payload at render time.
 *
 * `raw` is kept on every variant so a debug-view ("show me the original
 * stream-json") can surface it on demand without re-parsing.
 */
export type ParsedView =
  | {
    readonly kind: 'system';
    readonly subKind: 'init' | 'hook' | 'rate-limit' | 'other';
    readonly summary: string;
    readonly raw: unknown;
  }
  | {
    readonly kind: 'assistant';
    readonly parts: readonly ParsedAssistantPart[];
    readonly model: string | null;
    readonly usage: ParsedTokenUsage | null;
    readonly raw: unknown;
  }
  | {
    readonly kind: 'tool-result';
    readonly toolUseId: string;
    readonly content: string;
    readonly isError: boolean;
    readonly raw: unknown;
  }
  | {
    readonly kind: 'result';
    readonly text: string;
    readonly durationMs: number;
    readonly usage: ParsedTokenUsage | null;
    readonly costUsd: number | null;
    readonly reason: string;
    readonly isError: boolean;
    readonly raw: unknown;
  }
  | {
    readonly kind: 'status-change';
    readonly status: string;
    readonly raw: unknown;
  }
  | {
    readonly kind: 'unknown';
    readonly summary: string;
    readonly raw: unknown;
  };

/**
 * Result of one parse step — wraps the source event so the renderer can still
 * carry `sequence` / `at` / `actorRef` through to the template.
 */
export interface ParsedEvent {
  readonly event: AiSessionEventDto;
  readonly view: ParsedView;
}

/**
 * Parse one persisted session event into a `ParsedView`. Falls back to
 * `unknown` (never throws) when the payload is malformed — we'd rather show
 * "unrecognised event" than crash the whole transcript.
 */
export function parseSessionEvent(event: AiSessionEventDto): ParsedEvent {
  const payload = safeJsonParse(event.payload);
  if (payload === parseFailure) {
    return {
      event,
      view: {
        kind: 'unknown',
        summary: 'Malformed event payload',
        raw: event.payload,
      },
    };
  }

  if (event.kind === 'StatusChange' && isRecord(payload)) {
    // The orchestrator emits a StatusChange wrapper around any non-content
    // worker event — system/init, hooks, rate-limit, etc. Demote based on the
    // wrapped `type` so the renderer can collapse the noise.
    if (isClaudeStreamFrame(payload)) {
      return { event, view: viewFromClaudeFrame(payload) };
    }
    const status = readString(payload, 'newStatus') ?? readString(payload, 'status');
    if (status) {
      return { event, view: { kind: 'status-change', status, raw: payload } };
    }
  }

  if (event.kind === 'Hook' && isRecord(payload)) {
    return { event, view: viewSystemHook(payload) };
  }

  if (event.kind === 'Message' && isRecord(payload)) {
    if (isClaudeStreamFrame(payload)) {
      return { event, view: viewFromClaudeFrame(payload) };
    }
    // Bare text Message — promote to a single-part assistant bubble so the
    // visual treatment is consistent.
    const text = readString(payload, 'text');
    if (text) {
      return {
        event,
        view: {
          kind: 'assistant',
          parts: [{ type: 'text', text }],
          model: null,
          usage: null,
          raw: payload,
        },
      };
    }
  }

  if (event.kind === 'ToolCall' && isRecord(payload)) {
    return {
      event,
      view: {
        kind: 'assistant',
        parts: [
          {
            type: 'tool_use',
            id: readString(payload, 'callId') ?? '',
            toolName: readString(payload, 'toolName') ?? 'tool',
            input: payload['arguments'] ?? null,
          },
        ],
        model: null,
        usage: null,
        raw: payload,
      },
    };
  }

  if (event.kind === 'ToolResult' && isRecord(payload)) {
    return {
      event,
      view: {
        kind: 'tool-result',
        toolUseId: readString(payload, 'callId') ?? readString(payload, 'toolUseId') ?? '',
        content: stringifyToolContent(payload['result'] ?? payload['content']),
        isError: readBoolean(payload, 'isError') ?? false,
        raw: payload,
      },
    };
  }

  if (event.kind === 'Error') {
    return {
      event,
      view: {
        kind: 'unknown',
        summary: typeof payload === 'string' ? payload : 'Error event',
        raw: payload,
      },
    };
  }

  return {
    event,
    view: { kind: 'unknown', summary: `Unhandled kind: ${event.kind}`, raw: payload },
  };
}

/**
 * Sort parsed events by sequence so out-of-order arrival (the REST backfill +
 * live SignalR union) renders deterministically. Kept here so the component
 * doesn't redo the sort logic every render cycle.
 */
export function parseAndOrder(events: readonly AiSessionEventDto[]): ParsedEvent[] {
  return [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .map(parseSessionEvent);
}

// ────────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────────

const parseFailure = Symbol('parseFailure');

function safeJsonParse(raw: string): unknown | typeof parseFailure {
  try {
    return JSON.parse(raw);
  } catch {
    return parseFailure;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readString(rec: Record<string, unknown>, key: string): string | null {
  const v = rec[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(rec: Record<string, unknown>, key: string): number | null {
  const v = rec[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function readBoolean(rec: Record<string, unknown>, key: string): boolean | null {
  const v = rec[key];
  return typeof v === 'boolean' ? v : null;
}

/**
 * Claude Code's stream-json shapes a frame as `{ type, ... }` with a small
 * vocabulary: `system`, `assistant`, `user`, `result`, `rate_limit_event`.
 * We branch on `type` (+ optional `subtype` for `system`) and rely on every
 * other claim being optional — the renderer must not crash on a frame we've
 * never seen.
 */
function isClaudeStreamFrame(rec: Record<string, unknown>): boolean {
  return typeof rec['type'] === 'string';
}

function viewFromClaudeFrame(rec: Record<string, unknown>): ParsedView {
  const type = rec['type'];

  if (type === 'system') {
    const subtype = readString(rec, 'subtype');
    if (subtype === 'init') {
      return {
        kind: 'system',
        subKind: 'init',
        summary: `Worker initialised — ${readString(rec, 'model') ?? 'model'}`,
        raw: rec,
      };
    }
    if (subtype === 'hook_started' || subtype === 'hook_response') {
      const hookName = readString(rec, 'hook_name') ?? 'hook';
      return {
        kind: 'system',
        subKind: 'hook',
        summary:
          subtype === 'hook_started'
            ? `Hook started — ${hookName}`
            : `Hook completed — ${hookName}`,
        raw: rec,
      };
    }
    return {
      kind: 'system',
      subKind: 'other',
      summary: `System event${subtype ? ' — ' + subtype : ''}`,
      raw: rec,
    };
  }

  if (type === 'rate_limit_event') {
    const info = rec['rate_limit_info'];
    let summary = 'Rate-limit event';
    if (isRecord(info)) {
      const status = readString(info, 'status');
      const rateLimitType = readString(info, 'rateLimitType');
      if (status && rateLimitType) {
        summary = `Rate-limit ${status} (${rateLimitType})`;
      }
    }
    return { kind: 'system', subKind: 'rate-limit', summary, raw: rec };
  }

  if (type === 'assistant') {
    const message = rec['message'];
    if (isRecord(message)) {
      const parts = extractAssistantParts(message['content']);
      const model = readString(message, 'model');
      const usage = isRecord(message['usage']) ? extractUsage(message['usage']) : null;
      return {
        kind: 'assistant',
        parts,
        model,
        usage,
        raw: rec,
      };
    }
  }

  if (type === 'user') {
    // claude wraps tool_result inside a `user` frame's content. Extract the
    // first tool_result we find; if there isn't one, fall through to unknown.
    const message = rec['message'];
    if (isRecord(message) && Array.isArray(message['content'])) {
      for (const part of message['content']) {
        if (isRecord(part) && part['type'] === 'tool_result') {
          const rawContent = part['content'];
          return {
            kind: 'tool-result',
            toolUseId: readString(part, 'tool_use_id') ?? '',
            content: stringifyToolContent(rawContent),
            isError: readBoolean(part, 'is_error') ?? false,
            raw: rec,
          };
        }
      }
    }
  }

  if (type === 'result') {
    const usage = isRecord(rec['usage']) ? extractUsage(rec['usage']) : null;
    return {
      kind: 'result',
      text: readString(rec, 'result') ?? '',
      durationMs: readNumber(rec, 'duration_ms') ?? 0,
      usage,
      costUsd: readNumber(rec, 'total_cost_usd'),
      reason: readString(rec, 'terminal_reason') ?? readString(rec, 'stop_reason') ?? 'completed',
      isError: readBoolean(rec, 'is_error') ?? false,
      raw: rec,
    };
  }

  return {
    kind: 'unknown',
    summary: `Unrecognised claude frame type: ${typeof type === 'string' ? type : 'n/a'}`,
    raw: rec,
  };
}

function viewSystemHook(rec: Record<string, unknown>): ParsedView {
  // Hooks come through as a `Hook` event-kind on our side but the payload
  // shape matches claude's hook_started / hook_response stream-json.
  return viewFromClaudeFrame(rec);
}

function extractAssistantParts(content: unknown): readonly ParsedAssistantPart[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: ParsedAssistantPart[] = [];
  for (const part of content) {
    if (!isRecord(part)) {
      continue;
    }
    if (part['type'] === 'text') {
      const text = readString(part, 'text');
      if (text !== null) {
        parts.push({ type: 'text', text });
      }
    } else if (part['type'] === 'tool_use') {
      parts.push({
        type: 'tool_use',
        id: readString(part, 'id') ?? '',
        toolName: readString(part, 'name') ?? 'tool',
        input: part['input'] ?? null,
      });
    }
  }
  return parts;
}

function extractUsage(usage: Record<string, unknown>): ParsedTokenUsage {
  return {
    input: readNumber(usage, 'input_tokens') ?? 0,
    output: readNumber(usage, 'output_tokens') ?? 0,
    cacheRead: readNumber(usage, 'cache_read_input_tokens') ?? undefined,
    cacheCreation: readNumber(usage, 'cache_creation_input_tokens') ?? undefined,
  };
}

/**
 * Tool result `content` comes in many shapes: a plain string, an array of
 * `{type:'text', text:...}` blocks (the Anthropic content-block format), or
 * raw JSON. Flatten everything we recognise into a single string for the
 * UI; the consumer can still pop the raw payload for inspection.
 */
function stringifyToolContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (isRecord(block) && block['type'] === 'text') {
          return readString(block, 'text') ?? '';
        }
        return JSON.stringify(block);
      })
      .join('\n');
  }
  if (content === undefined || content === null) {
    return '';
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}
