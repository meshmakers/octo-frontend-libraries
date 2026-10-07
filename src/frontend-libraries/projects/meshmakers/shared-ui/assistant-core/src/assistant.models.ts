import { InjectionToken, Signal, Type, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NotConnectedAssistantTransport } from './not-connected.transport';
import { AssistantToolCallRowComponent } from './assistant-tool-call-row.component';

/**
 * The single feature flag of the assistant (ui-concept §5.3, AB#5549).
 * **Off by default.** While it is off nothing assistant-related renders or binds:
 * no top-bar ✦ button, no Cmd/Ctrl+J, no "✦ Explain" affordances, and the command
 * palette's `?` scope only shows "Assistant not available".
 *
 * Enable it for a host with `{ provide: ASSISTANT_ENABLED, useValue: true }`. The host gates its
 * own affordances (top-bar toggle, Cmd/Ctrl+J, palette row) on `AssistantService.enabled`.
 * Turning it on without a real {@link ASSISTANT_TRANSPORT} shows the panel with an
 * honest "Assistant backend not available yet" state — never canned answers.
 */
export const ASSISTANT_ENABLED = new InjectionToken<boolean>('ASSISTANT_ENABLED', {
  providedIn: 'root',
  factory: () => false
});

/** Connection state of the transport; only `ready` lets the composer send. */
export type AssistantTransportStatus = 'unavailable' | 'ready' | 'busy' | 'error';

/** Kinds of context the panel sends as structured data (ids, not DOM). */
export type AssistantContextKind = 'tenant' | 'page' | 'entity';

/** One removable chip of the context row. */
export interface AssistantContextChip {
  /** Stable per value (`<kind>:<value>`) so a removed chip stays removed until the value changes. */
  id: string;
  kind: AssistantContextKind;
  /** Visible text, e.g. "Integration › Adapters". */
  label: string;
  /** Structured value sent to the backend: tenant id, router URL, or entity id. */
  value: string;
  /** Optional CK type of an entity chip. */
  ckTypeId?: string;
}

/** What an "✦ Explain" entry point asks about. */
export interface AssistantExplainTarget {
  /** Human readable name of the object, e.g. "edge-plc-07" or "System.Communication/Adapter". */
  label: string;
  /** Runtime id of the object, when it is an entity. */
  rtId?: string;
  /** CK type id of the object (or the type itself for "explain this type"). */
  ckTypeId?: string;
  /** Overrides the composer prefill; defaults to `/explain <label>`. */
  prompt?: string;
}

/** A request to open the panel. */
export interface AssistantOpenRequest {
  /** Prefills the composer (never sent automatically). */
  prompt?: string;
  /** Adds (or replaces) the entity chip, e.g. from an Explain entry point. */
  entity?: AssistantExplainTarget;
}

/** A write the assistant wants to perform; rendered as a proposal card. */
export interface AssistantProposal {
  id: string;
  title: string;
  /** Markdown-free one-liner explaining the effect. */
  description?: string;
  /** MCP tool that would run on confirmation, e.g. `deploy_adapter`. */
  toolName: string;
  /** Parameter table shown on the card. */
  parameters: { name: string; value: string }[];
  /** True when the proposal writes to the tenant (the card says so). */
  writes: boolean;
}

/**
 * A tool call the assistant made, shown as a row of the thread. Structurally compatible with
 * `AiToolCallDto` of `@meshmakers/octo-ai-console`, so its events can be passed on unchanged.
 */
export interface AssistantToolCall {
  readonly callId: string;
  readonly toolName: string;
  /** E.g. 'Pending' | 'Approved' | 'Rejected' | 'Succeeded' | 'Failed'. */
  readonly status: string;
  readonly sessionId?: string;
  readonly arguments?: unknown;
  readonly result?: unknown;
  readonly startedAt?: string;
  readonly completedAt?: string | null;
  readonly durationMs?: number | null;
}

/**
 * The component that renders one tool call in the thread. It must have a `call` input taking an
 * {@link AssistantToolCall}. Default: a compact name + status row. An OctoMesh host passes
 * `AiToolCallComponent` of `@meshmakers/octo-ai-console` (collapsible details):
 * `{ provide: ASSISTANT_TOOL_CALL_COMPONENT, useValue: AiToolCallComponent }`.
 */
export const ASSISTANT_TOOL_CALL_COMPONENT = new InjectionToken<Type<unknown>>('ASSISTANT_TOOL_CALL_COMPONENT', {
  providedIn: 'root',
  factory: () => AssistantToolCallRowComponent
});

/**
 * Labels of the active area and tab of the shell, used for the "Page: Area › Tab" context chip.
 * Optional; without it the page chip falls back to the first breadcrumb. With
 * `@meshmakers/shared-ui/shell`:
 *
 * ```ts
 * { provide: ASSISTANT_PAGE_CONTEXT, useFactory: () => {
 *     const nav = inject(ShellNavigationService);
 *     return { areaText: () => nav.activeArea()?.text ?? null, tabText: () => nav.activeTab()?.text ?? null };
 * } }
 * ```
 *
 * Read inside a computed, so signal-backed functions keep the chips up to date.
 */
export interface AssistantPageContext {
  areaText(): string | null;
  tabText(): string | null;
}

export const ASSISTANT_PAGE_CONTEXT = new InjectionToken<AssistantPageContext>('ASSISTANT_PAGE_CONTEXT');

/** One rendered item of the thread. */
export type AssistantThreadItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; markdown: string; streaming: boolean }
  | { kind: 'tool-call'; id: string; call: AssistantToolCall }
  | { kind: 'proposal'; id: string; proposal: AssistantProposal; decision: AssistantProposalDecisionKind | null }
  | { kind: 'error'; id: string; text: string };

export type AssistantProposalDecisionKind = 'run' | 'edit' | 'discard';

/**
 * A decision on a proposal card. The card only emits it; whatever executes the
 * write (the backend's confirm round-trip, AB#5550) subscribes to
 * `AssistantService.proposalDecisions$`. Nothing in this library executes a proposal.
 */
export interface AssistantProposalDecision {
  kind: AssistantProposalDecisionKind;
  proposal: AssistantProposal;
}

/** What the composer hands to the transport. */
export interface AssistantSendRequest {
  text: string;
  /** The chips that remained after the user removed what they did not want to share. */
  context: AssistantContextChip[];
}

/** Events a transport streams back for one send. */
export type AssistantStreamEvent =
  | { type: 'message-delta'; messageId: string; text: string }
  | { type: 'message-end'; messageId: string }
  | { type: 'tool-call'; call: AssistantToolCall }
  | { type: 'proposal'; proposal: AssistantProposal }
  | { type: 'error'; message: string };

/**
 * Where assistant turns come from. The library ships **no** implementation that
 * answers: the default is {@link NotConnectedAssistantTransport}. A real one
 * (e.g. the OctoMesh AI services, AB#5550 delegated-identity chat sessions) provides
 * itself under {@link ASSISTANT_TRANSPORT}.
 */
export interface AssistantTransport {
  readonly status: Signal<AssistantTransportStatus>;
  /** Shown in the panel when the status is not `ready`. */
  readonly statusMessage: Signal<string | null>;
  /** One user turn; completes when the assistant turn is complete. */
  send(request: AssistantSendRequest): Observable<AssistantStreamEvent>;
}

/** The assistant's transport; defaults to the honest "not connected" one. */
export const ASSISTANT_TRANSPORT = new InjectionToken<AssistantTransport>('ASSISTANT_TRANSPORT', {
  providedIn: 'root',
  factory: () => inject(NotConnectedAssistantTransport)
});

/** A composer slash command (ui-concept §5.3). */
export interface AssistantSlashCommand {
  command: string;
  description: string;
}

/** The default slash commands (English descriptions). */
export const DEFAULT_ASSISTANT_SLASH_COMMANDS: readonly AssistantSlashCommand[] = [
  { command: '/explain', description: 'Explain the object in context' },
  { command: '/query', description: 'Turn a question into a query' },
  { command: '/summarise', description: 'Summarise events or a selection' },
  { command: '/draft-pipeline', description: 'Draft a pipeline as a diff' }
];

/** The composer's slash commands; provide your own list (or translated descriptions) to change them. */
export const ASSISTANT_SLASH_COMMANDS = new InjectionToken<readonly AssistantSlashCommand[]>('ASSISTANT_SLASH_COMMANDS', {
  providedIn: 'root',
  factory: () => DEFAULT_ASSISTANT_SLASH_COMMANDS
});
