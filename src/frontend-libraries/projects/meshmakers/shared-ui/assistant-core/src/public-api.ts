/*
 * Public API Surface of @meshmakers/shared-ui/assistant-core (AB#5621)
 */

/**
 * The startup part of the assistant: state ({@link AssistantService}), the Cmd/Ctrl+J hotkey,
 * the injection tokens with their defaults, the "not connected" transport, models, messages and the
 * "✦ Explain" directives. It never imports `marked` or the panel, so a host can wire the assistant
 * in `app.config.ts` / its root component without pulling the panel into the initial bundle and load
 * `AssistantPanelComponent` from `@meshmakers/shared-ui/assistant` lazily (e.g. with `@defer`).
 *
 * `@meshmakers/shared-ui/assistant` re-exports everything from here (same symbols, same tokens),
 * so both entry points can be mixed freely.
 */

// --- Contract and tokens ---
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
} from './assistant.models';
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
  AssistantAttachmentRef,
  AssistantAttachmentOptions,
  AssistantSessionSummary,
  AssistantStarterQuestions,
  AssistantAsyncResult,
  AssistantPanelOptions,
  AssistantPanelMode,
} from './assistant.models';

// --- Messages / i18n ---
export {
  DEFAULT_ASSISTANT_MESSAGES,
  ASSISTANT_MESSAGES,
  resolveAssistantMessages,
  formatAssistantMessage,
  proposalDecisionLabel,
  /** Internal helper of the panel components (signal of resolved messages); not part of the stable API. */
  assistantMessages,
} from './assistant.messages';
export type { AssistantMessages } from './assistant.messages';

// --- Services / transports ---
export { AssistantService, assistantHotkey } from './assistant.service';
export { NotConnectedAssistantTransport, ASSISTANT_NOT_CONNECTED_MESSAGE } from './not-connected.transport';
export { FakeAssistantTransport } from './testing/fake-assistant-transport';

// --- Pure functions ---
export { deriveAssistantContext } from './assistant-context';
export type { AssistantContextSource } from './assistant-context';
export { selectAssistantAttachments, assistantFileAccepted, formatAssistantFileSize } from './assistant-attachments';
export type { AssistantAttachmentSelection } from './assistant-attachments';

// --- Components / directives ---
export { AssistantToolCallRowComponent } from './assistant-tool-call-row.component';
export { IfAssistantDirective, AssistantExplainDirective } from './assistant-explain.directive';
