/*
 * Public API Surface of @meshmakers/shared-ui/assistant (AB#5621)
 */

/**
 * The assistant side panel of the OctoMesh Refinery Studio as an app-agnostic building block:
 * panel (header, removable context chips, thread, composer with slash commands), proposal cards,
 * "✦ Explain" directives and the {@link AssistantService} state. It never answers by itself —
 * turns come from an {@link AssistantTransport} the host provides.
 *
 * Usage:
 *
 * ```ts
 * import { AssistantPanelComponent, AssistantService, ASSISTANT_ENABLED, ASSISTANT_TRANSPORT,
 *          assistantHotkey } from '@meshmakers/shared-ui/assistant';
 *
 * // app.config.ts — off by default; without a transport the panel says "backend not available"
 * providers: [
 *   { provide: ASSISTANT_ENABLED, useValue: true },
 *   { provide: ASSISTANT_TRANSPORT, useExisting: MyChatTransport },
 * ]
 *
 * // AppComponent
 * template: `@if (assistant.enabled && assistant.isOpen()) { <mm-assistant-panel /> }`
 * @HostListener('document:keydown', ['$event'])
 * onKeydown(event: KeyboardEvent): void {
 *   if (this.assistant.enabled && assistantHotkey(event)) { event.preventDefault(); this.assistant.toggle(); }
 * }
 * ```
 *
 * Wire the top bar toggle of `@meshmakers/shared-ui/shell` with
 * `[assistantAvailable]="assistant.enabled" [assistantOpen]="assistant.isOpen()" (assistantToggle)="assistant.toggle()"`.
 * Proposal decisions (Run / Edit / Discard) are only published on `AssistantService.proposalDecisions$`.
 *
 * Tokens:
 * - `ASSISTANT_ENABLED` (default `false`) — the single feature flag;
 * - `ASSISTANT_TRANSPORT` (default {@link NotConnectedAssistantTransport}) — where turns come from;
 * - `ASSISTANT_PAGE_CONTEXT` (optional) — area/tab labels for the page chip;
 * - `ASSISTANT_TOOL_CALL_COMPONENT` (default {@link AssistantToolCallRowComponent}) — tool-call renderer
 *   (OctoMesh hosts: `AiToolCallComponent` of `@meshmakers/octo-ai-console`);
 * - `ASSISTANT_SLASH_COMMANDS` (default {@link DEFAULT_ASSISTANT_SLASH_COMMANDS}) — composer commands; a
 *   command with `expand(command, args)` is sent (and shown) as the prompt it returns (AB#5621);
 * - `ASSISTANT_PANEL_OPTIONS` (optional) — panel layout: `mode` (`docked` | `overlay`), `resizable` (off by default),
 *   `minWidth` / `maxWidth`, `storageKey` of the persisted width (AB#5621);
 * - `ASSISTANT_MESSAGES` — translations (`Partial<AssistantMessages>`; component `messages` inputs win).
 *
 * Requires the `marked` package (markdown of assistant turns).
 *
 * The startup-needed, `marked`-free part (service, hotkey, tokens, transports, models, messages,
 * Explain directives) lives in `@meshmakers/shared-ui/assistant-core` and is re-exported here with
 * the same identity. Import from `assistant-core` in eagerly loaded code and load the panel lazily.
 * {@link FakeAssistantTransport} is a scriptable transport for host specs.
 *
 * Optional transport capabilities (AB#5621) — the panel adds UI only for what the transport has:
 * `sessions` + `loadSession` (+ `refreshSessions`, `deleteSession`, `newSession`, `activeSessionId`)
 * → "New chat" / "Chats" list; `attachments` → composer file picker, files on
 * `AssistantSendRequest.files`; `starterQuestions()` → clickable questions on an empty thread.
 */

// Startup part — re-exported from assistant-core so tokens and classes keep a single identity.
export {
  ASSISTANT_ENABLED,
  ASSISTANT_TRANSPORT,
  ASSISTANT_PAGE_CONTEXT,
  ASSISTANT_TOOL_CALL_COMPONENT,
  ASSISTANT_SLASH_COMMANDS,
  DEFAULT_ASSISTANT_SLASH_COMMANDS,
  ASSISTANT_PANEL_OPTIONS,
  DEFAULT_ASSISTANT_PANEL_MIN_WIDTH,
  DEFAULT_ASSISTANT_PANEL_MAX_WIDTH,
  DEFAULT_ASSISTANT_PANEL_STORAGE_KEY,
  DEFAULT_ASSISTANT_MESSAGES,
  ASSISTANT_MESSAGES,
  resolveAssistantMessages,
  formatAssistantMessage,
  proposalDecisionLabel,
  AssistantService,
  assistantHotkey,
  NotConnectedAssistantTransport,
  ASSISTANT_NOT_CONNECTED_MESSAGE,
  FakeAssistantTransport,
  deriveAssistantContext,
  selectAssistantAttachments,
  assistantFileAccepted,
  formatAssistantFileSize,
  AssistantToolCallRowComponent,
  IfAssistantDirective,
  AssistantExplainDirective,
} from '@meshmakers/shared-ui/assistant-core';
export type {
  AssistantTransportStatus,
  AssistantContextKind,
  AssistantContextChip,
  AssistantExplainTarget,
  AssistantOpenRequest,
  AssistantProposal,
  AssistantToolCall,
  AssistantPageContext,
  AssistantThreadItem,
  AssistantProposalDecisionKind,
  AssistantProposalDecision,
  AssistantSendRequest,
  AssistantStreamEvent,
  AssistantTransport,
  AssistantSlashCommand,
  AssistantMessages,
  AssistantContextSource,
  AssistantAttachmentRef,
  AssistantAttachmentOptions,
  AssistantSessionSummary,
  AssistantStarterQuestions,
  AssistantAsyncResult,
  AssistantAttachmentSelection,
  AssistantPanelOptions,
  AssistantPanelMode,
} from '@meshmakers/shared-ui/assistant-core';

// --- Markdown (needs `marked`) ---
export { renderAssistantMarkdown, classifyAssistantHref, AssistantMarkdownPipe } from './assistant-markdown';

// --- Panel components ---
export { AssistantPanelComponent } from './panel/assistant-panel.component';
export { AssistantComposerComponent } from './composer/assistant-composer.component';
export { AssistantThreadComponent } from './thread/assistant-thread.component';
export { AssistantProposalCardComponent } from './proposal-card/assistant-proposal-card.component';
