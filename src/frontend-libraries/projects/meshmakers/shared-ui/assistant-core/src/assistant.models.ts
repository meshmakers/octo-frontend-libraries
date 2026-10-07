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
  | {
    kind: 'user';
    id: string;
    /** What was sent — for a slash command with `expand`, the expanded prompt. */
    text: string;
    attachments?: readonly AssistantAttachmentRef[];
    /**
     * The slash command as typed (e.g. `/open March`) when {@link text} is its expansion (AB#5621).
     * The thread shows it as a subtle label above the prompt. A transport may store it and return it
     * from `loadSession` so reopened chats show the label too; without it they show the prompt only.
     */
    slashCommand?: string;
  }
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
  /** The typed text; may be empty when the turn only carries {@link files}. */
  text: string;
  /** The chips that remained after the user removed what they did not want to share. */
  context: AssistantContextChip[];
  /**
   * Files attached in the composer. Only set when the transport declares
   * {@link AssistantTransport.attachments} and the person attached at least one file
   * (already checked against `accept`, `maxFiles` and `maxFileSizeBytes`).
   */
  files?: File[];
  /**
   * The slash command as typed (e.g. `/open March`) when {@link text} is the prompt its
   * {@link AssistantSlashCommand.expand} produced (AB#5621). `text` is always what the model should
   * read; store `text` as the turn so a reopened chat matches the live thread, and optionally keep
   * this alongside it (returned as `slashCommand` on the restored user item) for the label.
   */
  slashCommand?: string;
}

/** Name (and size) of a file sent with a user turn, shown under the turn in the thread. */
export interface AssistantAttachmentRef {
  name: string;
  /** Bytes, when known. */
  size?: number;
}

/**
 * File attachments a transport accepts (AB#5621). Declaring {@link AssistantTransport.attachments}
 * shows an "Attach file" button in the composer; without it there is no attachment UI.
 */
export interface AssistantAttachmentOptions {
  /**
   * Accepted types, in the syntax of `<input type="file" accept>`: comma separated MIME types
   * (`application/pdf`, `image/*`) and/or extensions (`.pdf`). Empty or omitted = any type.
   */
  accept?: string;
  /** How many files one turn may carry (default 1). */
  maxFiles?: number;
  /** Largest accepted file in bytes; omitted = no limit in the UI. */
  maxFileSizeBytes?: number;
}

/** A saved conversation of the person, as listed by {@link AssistantTransport.sessions}. */
export interface AssistantSessionSummary {
  id: string;
  title: string;
  /** ISO 8601 timestamp; shown as a secondary line when present. */
  createdAt?: string;
}

/** Starter questions as a transport can provide them: synchronously, as a promise or as an observable (first value counts). */
export type AssistantStarterQuestions =
  | readonly string[]
  | Promise<readonly string[]>
  | Observable<readonly string[]>;

/** A result a session method may return: a promise or an observable (its last value counts). */
export type AssistantAsyncResult<T> = Promise<T> | Observable<T>;

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

  // --- Optional capabilities (AB#5621). The panel only shows the matching UI when present. ---

  /**
   * Accepted file attachments. When set, the composer gets an "Attach file" button and
   * {@link AssistantSendRequest.files} carries the files; a turn may then have empty text.
   */
  readonly attachments?: AssistantAttachmentOptions | null;

  /**
   * Example questions for an empty thread, in the UI language. Read each time the panel opens;
   * clicking one sends it as if it had been typed. An observable need not complete: its first
   * emitted value is taken (later emissions are ignored until the next opening).
   */
  starterQuestions?(): AssistantStarterQuestions;

  /**
   * Saved sessions of the signed-in person, newest first. Together with {@link loadSession} it
   * enables the panel's chat list ("Chats" and "New chat" in the header).
   */
  readonly sessions?: Signal<readonly AssistantSessionSummary[]>;
  /** The session the next send writes to; `null` = a fresh chat. Marks the current row in the list. */
  readonly activeSessionId?: Signal<string | null>;
  /** Reloads {@link sessions}; called when the chat list is opened. */
  refreshSessions?(): AssistantAsyncResult<void>;
  /** Makes a saved session active and returns its thread. */
  loadSession?(id: string): AssistantAsyncResult<AssistantThreadItem[]>;
  /** Deletes a saved session. Without it the chat list has no delete buttons. */
  deleteSession?(id: string): AssistantAsyncResult<void>;
  /** Starts a fresh chat: the next send creates a new session. */
  newSession?(): void;
}

/** The assistant's transport; defaults to the honest "not connected" one. */
export const ASSISTANT_TRANSPORT = new InjectionToken<AssistantTransport>('ASSISTANT_TRANSPORT', {
  providedIn: 'root',
  factory: () => inject(NotConnectedAssistantTransport)
});

/** A composer slash command (ui-concept §5.3). */
export interface AssistantSlashCommand {
  /** The command word with its slash, lower-case, e.g. `/explain`. */
  command: string;
  description: string;
  /**
   * Turns the typed command into the prompt that is sent (AB#5621). Called by
   * `AssistantService.send` when the text is `<command>` or `<command> <args>`: `command` is this
   * command's word, `args` the trimmed rest (`''` when none). The returned text — synchronously or
   * as a promise — is what goes to the transport **and** what the live thread shows (with the typed
   * command as a small label), so a chat reopened from the transport reads the same.
   *
   * If it throws, rejects or returns an empty text, nothing is sent: an error row is added and the
   * draft is restored. Without `expand` the typed text is sent unchanged (default behaviour).
   *
   * ```ts
   * { command: '/open', description: 'Open items',
   *   expand: (_command, args) => args ? `Which items are open for ${args}?` : 'Which items are open?' }
   * ```
   */
  expand?: (command: string, args: string) => string | Promise<string>;
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

/**
 * Layout of `mm-assistant-panel` (AB#5621); every member is optional and the panel's inputs of the
 * same name win. Defaults keep the original look: a docked panel 400 px wide (340 px ≤ 1180 px)
 * that pushes the content, with a resize handle on its left edge.
 */
export interface AssistantPanelOptions {
  /**
   * `docked` (default): the panel takes its own column and pushes the content.
   * `overlay`: it floats over the content at the right edge (`position: fixed`), from
   * `--mm-assistant-overlay-top` (default 48 px, the shell's top bar) to the bottom.
   */
  mode?: AssistantPanelMode;
  /** Shows the drag handle on the left edge (default `true`; never on phones). */
  resizable?: boolean;
  /** Smallest width in px the handle allows (default {@link DEFAULT_ASSISTANT_PANEL_MIN_WIDTH}). */
  minWidth?: number;
  /**
   * Largest width in px the handle allows (default {@link DEFAULT_ASSISTANT_PANEL_MAX_WIDTH});
   * further capped so at least 240 px of the window stay free.
   */
  maxWidth?: number;
  /**
   * `localStorage` key of the width the person chose (default
   * {@link DEFAULT_ASSISTANT_PANEL_STORAGE_KEY}); `null` = do not persist. Storage that is missing or
   * throws (private mode, blocked site data) is ignored — the width then lasts as long as the panel.
   */
  storageKey?: string | null;
}

export type AssistantPanelMode = 'docked' | 'overlay';

export const DEFAULT_ASSISTANT_PANEL_MIN_WIDTH = 320;
export const DEFAULT_ASSISTANT_PANEL_MAX_WIDTH = 720;
export const DEFAULT_ASSISTANT_PANEL_STORAGE_KEY = 'mm-assistant-panel-width';

/** App-wide {@link AssistantPanelOptions}; optional. */
export const ASSISTANT_PANEL_OPTIONS = new InjectionToken<AssistantPanelOptions>('ASSISTANT_PANEL_OPTIONS');
