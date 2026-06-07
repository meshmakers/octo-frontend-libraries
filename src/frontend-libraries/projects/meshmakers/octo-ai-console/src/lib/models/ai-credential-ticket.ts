/**
 * Scopes a one-time credential-registration ticket authorises. Mirrors
 * `RtTicketScopeEnum` in System.Ai-3 (C# side: enum members
 * `CredentialRegister`, `DevSshKeyRegister`).
 */
export type AiCredentialTicketScope =
  | 'CredentialRegister'
  | 'DevSshKeyRegister';

/**
 * Body for `POST /{tenantId}/v1/credentials/tickets`. The admin in Refinery
 * Studio fills this in to mint a one-time code the developer / operator
 * redeems from their own machine (#4133). `ttlMinutes` is clamped server-side
 * to 60 minutes; omitting it defaults to 5 minutes.
 */
export interface IssueAiCredentialTicketRequestDto {
  readonly scope: AiCredentialTicketScope;
  readonly ttlMinutes?: number;
}

/**
 * Wire shape returned from `POST /{tenantId}/v1/credentials/tickets`. The
 * plaintext `code` is shown to the admin once and discarded after display —
 * the server stores only the SHA-256 hash, so a future GET cannot re-derive
 * it (#4133, concept §10).
 */
export interface IssueAiCredentialTicketResponseDto {
  readonly rtId: string;
  readonly code: string;
  readonly expiresAt: string;
  readonly scope: AiCredentialTicketScope;
}
