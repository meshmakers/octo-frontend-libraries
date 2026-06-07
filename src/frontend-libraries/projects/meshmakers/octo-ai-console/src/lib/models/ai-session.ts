/**
 * Status names emitted by the adapter's session lifecycle (RtSessionStatusEnum in C#).
 * Wire format is the enum name so the UI does not need to know the underlying integer
 * mapping — this union mirrors the values currently emitted on the wire.
 */
export type AiSessionStatus =
  | 'Queued'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'QuotaBlocked'
  | 'RateLimited';

/**
 * Job kinds classify the prompt-template family + tool-policy track. Mirrors
 * RtJobKindEnum in System.Ai-3. Phase-1 default is `DataModel`.
 */
export type AiJobKind =
  | 'DataModel'
  | 'Application'
  | 'Deployment'
  | 'Investigation';

/**
 * Wire shape returned from every adapter session endpoint. Mirrors
 * `SessionResponse` on the C# side (src/AiServices/TenantApi/v1/Models).
 */
export interface AiSessionDto {
  readonly sessionRtId: string;
  readonly jobRtId: string;
  readonly goalSummary: string;
  readonly status: AiSessionStatus;
  readonly startedAt: string;
  readonly completedAt?: string | null;
  readonly tokensConsumed: number;
  readonly ownerUserId: string;
}

/**
 * Quota gate decision snapshot as observed at the moment a session was created (or
 * polled). Mirrors `QuotaSnapshot` server-side. `decision` is the enum name; useful
 * values are `Admit` / `Queue` / `BlockMonthlyCap` etc.
 */
export interface AiQuotaSnapshotDto {
  readonly decision: string;
  readonly concurrentJobsCap: number;
  readonly maxSessionsQueuedCap: number;
  readonly currentActive: number;
  readonly currentQueued: number;
  readonly queuePosition: number;
}

/**
 * Body for `POST /{tenantId}/v1/sessions`. The owning user is taken from the JWT
 * subject claim — clients never send a user id on the request.
 */
export interface CreateSessionRequestDto {
  readonly goal: string;
  readonly jobKind?: AiJobKind;
}

/**
 * Response for `POST /{tenantId}/v1/sessions`. Carries the freshly persisted
 * session plus the quota decision so the UI can render a "Running" pill or a
 * "Queued (3 / 10)" pill without a second round-trip.
 */
export interface CreateSessionResponseDto {
  readonly session: AiSessionDto;
  readonly quota: AiQuotaSnapshotDto;
}
