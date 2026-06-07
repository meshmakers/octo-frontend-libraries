/**
 * Approval outcome — mirrors the `ApprovalOutcome` enum the adapter writes back
 * after the user decides. The hub serialises the enum name on the wire.
 */
export type AiApprovalOutcome = 'Approved' | 'Rejected';

/**
 * Why the approval gate fired. Mirrors `RtApprovalReasonEnum` in System.Ai-3.
 * The strings match the C# enum value names verbatim — the adapter serialises
 * the enum name, not its integer value, on the wire.
 */
export type AiApprovalReason =
  | 'HighRiskTool'
  | 'PerToolOverride'
  | 'PolicyDenied'
  | 'TenantOverride'
  | 'TimeoutResume';

/**
 * Payload pushed by `OnApprovalRequestedAsync`. Mirrors
 * `ApprovalRequestedEnvelope` on the C# side.
 */
export interface AiApprovalRequestedDto {
  readonly requestId: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly payload: string;
  readonly reason: AiApprovalReason | string;
  readonly at: string;
}

/**
 * Payload pushed by `OnApprovalDecidedAsync`. Mirrors `ApprovalDecidedEnvelope`
 * on the C# side. Fanned to every connection so a UI in a sibling browser tab
 * dismisses its modal too.
 */
export interface AiApprovalDecidedDto {
  readonly requestId: string;
  readonly outcome: AiApprovalOutcome;
  readonly comment?: string | null;
  readonly decidedBy: string;
  readonly at: string;
}

/**
 * Body for `POST /{tenantId}/v1/sessions/{sessionId}/approvals/{requestId}`.
 * The UI sends the user's decision; the server fans out
 * `OnApprovalDecidedAsync` to every connection.
 */
export interface AiApprovalDecisionDto {
  readonly outcome: AiApprovalOutcome;
  readonly comment?: string;
}
