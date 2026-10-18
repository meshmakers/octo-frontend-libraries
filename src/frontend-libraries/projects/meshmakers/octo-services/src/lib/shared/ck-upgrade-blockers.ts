import {
  CK_UPGRADE_BLOCKED_CODE,
  CkUpgradeBlockedProblemDto,
  CkUpgradeBlockerDto
} from './ck-model-catalog.dto';

/**
 * Null-safe helpers for the tenant upgrade guard members of the CK library REST DTOs (CK v2 F2.5, AB#6872).
 * Every member is optional on the wire: an older asset repository sends none of them, and these helpers then
 * answer "not blocked" so a page renders exactly as before.
 */

/** The blockers of a DTO that may carry them; never null. */
export function ckBlockersOf(source: { blockers?: CkUpgradeBlockerDto[] | null } | null | undefined): CkUpgradeBlockerDto[] {
  return Array.isArray(source?.blockers) ? source.blockers : [];
}

/** True when the DTO says it is blocked, or carries at least one blocker (older/newer servers may send only one). */
export function isCkBlocked(source: { isBlocked?: boolean | null; blockers?: CkUpgradeBlockerDto[] | null } | null | undefined): boolean {
  return source?.isBlocked === true || ckBlockersOf(source).length > 0;
}

/**
 * The text of the first blocker, with its resolve hint: used as tooltip of a disabled action. Returns a generic
 * sentence when a blocked source carries no blocker detail, and null when the source is not blocked.
 */
export function ckFirstBlockerReason(source: { isBlocked?: boolean | null; blockers?: CkUpgradeBlockerDto[] | null } | null | undefined): string | null {
  if (!isCkBlocked(source)) return null;
  const first = ckBlockersOf(source)[0];
  if (!first) return 'The update would break an installed model.';
  const message = first.message || `${first.dependent} would break (${first.kind}: ${first.subject})`;
  return first.resolveHint ? `${message} (${first.resolveHint})` : message;
}

/**
 * Reads the problem details of an import refused by the tenant upgrade guard (`409 CK_UPGRADE_BLOCKED`) out of a
 * failed HTTP call. Structural check on purpose (no `instanceof HttpErrorResponse`): a host that compiles this
 * library from source next to its own `@angular/common` sees two class identities. Returns null for every other
 * error, so the caller keeps its normal error path.
 */
export function parseCkUpgradeBlockedError(error: unknown): CkUpgradeBlockedProblemDto | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status, error: body } = error as { status?: unknown; error?: unknown };
  if (status !== 409 || typeof body !== 'object' || body === null) return null;
  const problem = body as Partial<CkUpgradeBlockedProblemDto>;
  if (problem.code !== CK_UPGRADE_BLOCKED_CODE) return null;
  return { ...problem, code: CK_UPGRADE_BLOCKED_CODE, blockers: ckBlockersOf(problem) } as CkUpgradeBlockedProblemDto;
}
