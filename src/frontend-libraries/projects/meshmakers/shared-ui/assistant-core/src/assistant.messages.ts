import { computed, inject, InjectionToken, Signal } from '@angular/core';
import type { AssistantProposalDecisionKind } from './assistant.models';

/**
 * UI strings of the assistant (`mm-assistant-panel`, composer, thread, proposal card), the
 * context chips and the default "not connected" transport.
 *
 * Provide translations app wide with {@link ASSISTANT_MESSAGES} or per component with the
 * `messages` input (wins over the token). Missing, `undefined` or `null` members keep the English
 * default of {@link DEFAULT_ASSISTANT_MESSAGES}; `{name}` placeholders are filled with
 * {@link formatAssistantMessage}. Slash command descriptions come from `ASSISTANT_SLASH_COMMANDS`.
 */
export interface AssistantMessages {
  // --- Panel ---
  title: string;
  /** Chip in the header while a backend is connected. */
  readsWithYourPermissions: string;
  closeAssistant: string;
  /** `aria-label` of the context chip list. */
  contextLabel: string;
  /** `aria-label` of a chip's remove button; `{label}` = chip label. */
  removeContext: string;
  /** Fallback when the transport gives no status message. */
  notAvailable: string;
  /** Status message of the default transport (no backend). */
  notConnected: string;
  // --- Composer ---
  commandsLabel: string;
  composerLabel: string;
  composerPlaceholder: string;
  send: string;
  stop: string;
  // --- Thread ---
  conversationLabel: string;
  /** Screen-reader prefix of user turns. */
  youPrefix: string;
  /** Screen-reader prefix of assistant turns. */
  assistantPrefix: string;
  /** Screen-reader prefix of error rows. */
  errorPrefix: string;
  // --- Proposal card ---
  /** `aria-label` of a proposal card; `{title}` = proposal title. */
  proposalLabel: string;
  proposal: string;
  /** Card header addition for writing proposals (after "Proposal ·"). */
  writesToTenant: string;
  tool: string;
  runsAfterConfirm: string;
  run: string;
  edit: string;
  discard: string;
  runRequested: string;
  editRequested: string;
  discarded: string;
  // --- Context chips ---
  /** `{tenant}` = tenant id. */
  contextTenant: string;
  /** `{page}` = page label. */
  contextPage: string;
}

export const DEFAULT_ASSISTANT_MESSAGES: AssistantMessages = {
  title: 'Assistant',
  readsWithYourPermissions: 'Reads with your permissions',
  closeAssistant: 'Close assistant',
  contextLabel: 'Context sent with your message',
  removeContext: 'Remove context {label}',
  notAvailable: 'Assistant not available',
  notConnected: 'Assistant backend not available yet',
  commandsLabel: 'Commands',
  composerLabel: 'Message the assistant',
  composerPlaceholder: 'Ask something or type / for commands…',
  send: 'Send',
  stop: 'Stop',
  conversationLabel: 'Conversation',
  youPrefix: 'You: ',
  assistantPrefix: 'Assistant: ',
  errorPrefix: 'Error: ',
  proposalLabel: 'Proposal: {title}',
  proposal: 'Proposal',
  writesToTenant: 'writes to the tenant',
  tool: 'Tool',
  runsAfterConfirm: 'runs only after you confirm',
  run: 'Run',
  edit: 'Edit',
  discard: 'Discard',
  runRequested: 'Run requested',
  editRequested: 'Edit requested',
  discarded: 'Discarded',
  contextTenant: 'Tenant: {tenant}',
  contextPage: 'Page: {page}',
};

/** App-wide translations of the assistant (partial). */
export const ASSISTANT_MESSAGES = new InjectionToken<Partial<AssistantMessages>>('ASSISTANT_MESSAGES');

/** Merges overrides over {@link DEFAULT_ASSISTANT_MESSAGES}, later sources winning; null/undefined members are ignored. */
export function resolveAssistantMessages(...overrides: (Partial<AssistantMessages> | null | undefined)[]): AssistantMessages {
  const resolved: AssistantMessages = { ...DEFAULT_ASSISTANT_MESSAGES };
  for (const messages of overrides) {
    if (!messages) {
      continue;
    }
    for (const key of Object.keys(messages) as (keyof AssistantMessages)[]) {
      const value = messages[key];
      if (value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}

/** Replaces `{name}` placeholders; unknown placeholders stay as they are. */
export function formatAssistantMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/** The settled label of a proposal decision. */
export function proposalDecisionLabel(kind: AssistantProposalDecisionKind, messages: AssistantMessages): string {
  switch (kind) {
    case 'run': return messages.runRequested;
    case 'edit': return messages.editRequested;
    case 'discard': return messages.discarded;
  }
}

/**
 * {@link ASSISTANT_MESSAGES} merged with a component input (the input wins).
 * Call it in an injection context.
 * @internal
 */
export function assistantMessages(input: Signal<Partial<AssistantMessages> | null | undefined>): Signal<AssistantMessages> {
  const injected = inject(ASSISTANT_MESSAGES, { optional: true });
  return computed(() => resolveAssistantMessages(injected, input()));
}
