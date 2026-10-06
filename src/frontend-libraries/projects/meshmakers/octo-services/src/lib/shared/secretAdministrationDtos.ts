/**
 * Bot services REST DTOs of the SECRET value type administration (AB#5528 / AB#5544, frontend
 * handover §9). Mirror `Meshmakers.Octo.Communication.Contracts.DataTransferObjects`
 * (`SecretEnvironmentStatusDto`, `SecretSweepRunDto`, `SecretSweepDumpDto`,
 * `SecretFormCountsReportDto`); enums travel as names, JSON is camelCase, timestamps are ISO-8601
 * strings. No DTO ever carries a secret value.
 */

/** Sweep modes. The Studio offers Verify, Encrypt and CleanupUnreadable; Reprotect stays ops / CLI. */
export type SecretSweepMode = 'Verify' | 'Encrypt' | 'Reprotect' | 'CleanupUnreadable';

/** Who started a sweep run. */
export type SecretSweepTrigger = 'Manual' | 'Recurring' | 'Restore';

/** Result of a sweep run (`Running` while it is in progress). */
export type SecretSweepOutcome = 'Succeeded' | 'CompletedWithFailures' | 'Skipped' | 'Failed' | 'Running';

/**
 * Environment-level secret encryption status (identical in every tenant):
 * `GET {tenantId}/v1/secrets/status`, readable by every user with tenant access.
 */
export interface SecretEnvironmentStatusDto {
  /** `false`: no key ring — secret inputs are disabled, writes would fail with `SecretEncryptionNotConfigured`. */
  keyRingConfigured: boolean;
  /** Active key id (`k1`); `null` when not configured. */
  activeKeyId: string | null;
  knownKeyIds: string[];
  legacyV1KeyConfigured: boolean;
  strictMode: boolean;
  /** ISO-8601 when strict mode is scheduled / active, else `null`. */
  strictModeSince: string | null;
  /** Cron of the recurring daily Verify sweep; `null` when disabled. */
  recurringVerifyCron: string | null;
  /** This tenant's last Verify run (ISO-8601), `null` if none. */
  lastVerifyAt: string | null;
  /**
   * Warning codes (AB#5534, handover §9): `NoKeyRing` when `keyRingConfigured` is false,
   * `NoLegacyV1Key` when the tenant's last completed sweep found enc:v1 values but no legacy key is
   * configured. Unknown codes are shown as a generic warning. Absent on older bots.
   */
  warnings?: string[];
}

/** `SecretEnvironmentStatusDto.warnings` codes (handover §9). */
export const SECRET_STATUS_WARNING_NO_KEY_RING = 'NoKeyRing';
export const SECRET_STATUS_WARNING_NO_LEGACY_V1_KEY = 'NoLegacyV1Key';

/** The pseudo key id of a legacy enc:v1 value (handover §10); shown as "legacy key (enc:v1)". */
export const SECRET_LEGACY_V1_KEY_ID = 'enc:v1';

/** Counts per storage form of a sweep run (`SecretFormCountsReportDto`). */
export interface SecretFormCountsDto {
  notSet: number;
  plaintext: number;
  encV1: number;
  encV2: number;
  /** enc:v2 values per key id. */
  encV2ByKeyId: Record<string, number>;
  /** Protected values whose key id is not in this environment's key ring. */
  unknownKeyId: number;
  unknownKeyIdByKeyId?: Record<string, number>;
  failed: number;
  total: number;
  legacy: number;
  /** Legacy placeholder count of the migration (placeholders were dropped, decision 2026-10-06). */
  placeholder?: number;
}

/** The pre-sweep tenant dump of a run. Never downloadable — the Studio only shows and deletes it. */
export interface SecretSweepDumpDto {
  fileName: string;
  exists: boolean;
  sizeBytes: number | null;
  createdAt: string;
  /** `createdAt` + 7 days. */
  expiresAt: string;
  /** Set when deleted early or expired. */
  deletedAt: string | null;
  deletedBy: string | null;
}

/** One sweep run: `GET {tenantId}/v1/secrets/sweep-runs?limit=`, newest first (last 50 kept). */
export interface SecretSweepRunDto {
  /** Hangfire job id. */
  runId: string;
  mode: SecretSweepMode;
  trigger: SecretSweepTrigger;
  outcome: SecretSweepOutcome;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string | null;
  /**
   * Why the run was skipped or failed, or a remark (e.g. "Interrupted (service restart)"); never a
   * value. `null` / absent while running or when there is nothing to say.
   */
  reason?: string | null;
  /** Counts per storage form BEFORE the run (as found by its own scan); = `totalsAfter` for Verify. */
  totals: SecretFormCountsDto;
  /**
   * Counts per storage form AFTER the run (follow-up Verify of a writing run, the own scan of a
   * Verify). `null` while running and when the run was skipped / failed before that scan; absent on
   * older bots — show `totalsAfter ?? totals`.
   */
  totalsAfter?: SecretFormCountsDto | null;
  /** Values written by this run (encrypted, re-protected, placeholders normalised, cleared). Absent on older bots. */
  valuesRewritten?: number;
  /** Values converted from plaintext / enc:v1 to enc:v2 by this run (part of `valuesRewritten`). Absent on older bots. */
  encryptedCount?: number;
  /**
   * Values left as stored because they changed while the run worked on them; > 0 makes a writing
   * run `CompletedWithFailures` ("run the sweep again"). Absent on older bots.
   */
  skippedConcurrentlyModified?: number;
  placeholdersNormalized: number;
  /** CleanupUnreadable only: enc:v1 values kept because only the legacy key is missing. Absent on older bots. */
  skippedLegacyV1KeyMissing?: number;
  unreadableCount: number;
  /** `null` for Verify (no dump). */
  dump: SecretSweepDumpDto | null;
}

/** Result of `DELETE {tenantId}/v1/secrets/sweep-runs/{runId}/dump`: 204 / 404 / 409. */
export type SecretSweepDumpDeleteResult = 'Deleted' | 'NotFound' | 'AlreadyDeleted';

/** Reference to one secret attribute of one entity (`SecretValueReferenceDto`) — never a value. */
export interface SecretValueReferenceDto {
  ckTypeId: string;
  rtId: string;
  /** camelCase; record members as `endpoints[key=prod].token`. */
  attributePath: string;
  /** Storage form before the step changed it (`NotSet`, `Plaintext`, `EncV1`, `EncV2`, …). */
  previousForm?: string;
}

/** A stored secret whose key id is unknown in this environment (`SecretUnreadableValueDto`). */
export interface SecretUnreadableValueDto {
  ckTypeId: string;
  rtId: string;
  attributePath: string;
  keyId: string | null;
}

/** A value a sweep step could not process (`SecretSweepFailureReportDto`); the reason never contains a value. */
export interface SecretSweepFailureDto {
  ckTypeId: string;
  rtId: string;
  attributePath: string;
  reason: string;
}

/** Counts of one secret slot (`SecretSlotCountsReportDto`). */
export interface SecretSlotCountsDto {
  ckTypeId: string;
  attributePath: string;
  counts: SecretFormCountsDto;
}

/** One step of a sweep run (`SecretSweepStepReportDto`). */
export interface SecretSweepStepReportDto {
  mode: SecretSweepMode;
  startedAt: string;
  completedAt: string | null;
  ckTypesScanned: number;
  entitiesScanned: number;
  entitiesRewritten: number;
  valuesRewritten: number;
  /** Values converted from plaintext / enc:v1 to enc:v2 by this step (part of `valuesRewritten`). Absent on older bots. */
  encryptedCount?: number;
  placeholdersNormalized: number;
  skippedConcurrentlyModified: number;
  /** CleanupUnreadable only: enc:v1 values kept because only the legacy key is missing. Absent on older bots. */
  skippedLegacyV1KeyMissing?: number;
  success: boolean;
  totals: SecretFormCountsDto;
  slots: SecretSlotCountsDto[];
  /** Only filled by CleanupUnreadable. */
  cleared: SecretValueReferenceDto[];
  unreadable: SecretUnreadableValueDto[];
  failures: SecretSweepFailureDto[];
}

/** Last sweep report of a tenant: `GET {tenantId}/v1/jobs/secret-sweep/report` (`SecretSweepReportDto`). */
export interface SecretSweepReportDto {
  tenantId: string;
  mode: SecretSweepMode;
  trigger: SecretSweepTrigger;
  outcome: SecretSweepOutcome;
  reason: string | null;
  startedAt: string;
  completedAt: string;
  backupFileName: string | null;
  activeKeyId: string | null;
  strictModeActive: boolean;
  strictModeViolation: boolean;
  remainingLegacyValues: number;
  steps: SecretSweepStepReportDto[];
  secretsToReEnter: SecretValueReferenceDto[];
  placeholdersNormalized: number;
  /** CleanupUnreadable only: enc:v1 values kept because only the legacy key is missing. Absent on older bots. */
  skippedLegacyV1KeyMissing?: number;
  /** Re-entry list of the run (decision 2026-10-06). */
  unreadable: SecretUnreadableValueDto[];
}
