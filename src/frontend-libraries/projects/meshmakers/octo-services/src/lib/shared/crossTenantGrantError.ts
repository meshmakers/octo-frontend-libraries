import {HttpErrorResponse} from '@angular/common/http';

/** The part of an `HttpErrorResponse` the mapping reads. */
export type HttpErrorLike = Pick<HttpErrorResponse, 'status' | 'error'>;

/**
 * Structural check instead of an `instanceof` test, same rule as `MmHttpErrorInterceptor`: a host with a
 * second `@angular/common` copy sees two class identities, and `instanceof` would answer `false`.
 */
export function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === 'object'
    && error !== null
    && (error as {name?: unknown}).name === 'HttpErrorResponse'
    && typeof (error as {status?: unknown}).status === 'number';
}

/**
 * Problem codes of the tenant-scoped cross-tenant grant routes (`{tenant}/v1/externalTenantUserMappings`),
 * contract `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md` §5. Same values as the SDK's
 * `CrossTenantGrantProblemCodes`.
 */
export const CrossTenantGrantProblemCodes = {
  SourceUserNotFound: 'SourceUserNotFound',
  SourceUserLookupRateLimited: 'SourceUserLookupRateLimited',
  SourceTenantNotPermitted: 'SourceTenantNotPermitted',
  UnknownGroup: 'UnknownGroup',
  ExternalTenantUserMappingAlreadyExists: 'ExternalTenantUserMappingAlreadyExists'
} as const;

/** Codes of the identity role change guard (AB#7914, AB#7927) that can answer a mapping write. */
export const RoleChangeProblemCodes = ['self-grant', 'role-not-held', 'last-administrator'] as const;

/**
 * What went wrong, for branching in the UI:
 *
 * - `NotAvailable` — the lookup route answered `404` without a problem `code`: the identity service does
 *   not contain AB#8341 yet.
 * - `SourceUserLookupRateLimited` — too many lookups; wait {@link CrossTenantGrantError.retryAfterSeconds}.
 * - `SourceTenantNotPermitted` — create refused: the source tenant does not permit this tenant, or the user
 *   is unknown or blocked there (one answer for all of these).
 * - `UnknownGroup` — create refused: {@link CrossTenantGrantError.unknownGroupIds} are no groups of this tenant.
 * - `ExternalTenantUserMappingAlreadyExists` — a mapping for that user exists:
 *   {@link CrossTenantGrantError.existingMappingId}.
 * - `RoleChangeRefused` — the role change guard refused the write (`403 self-grant`, `403 role-not-held`,
 *   `409 last-administrator`); show {@link CrossTenantGrantError.title} unchanged.
 * - `Forbidden` — any other `403` (e.g. the caller lacks `UserManagement`); title passed through.
 */
export type CrossTenantGrantErrorKind =
  | 'NotAvailable'
  | 'SourceUserLookupRateLimited'
  | 'SourceTenantNotPermitted'
  | 'UnknownGroup'
  | 'ExternalTenantUserMappingAlreadyExists'
  | 'RoleChangeRefused'
  | 'Forbidden';

const DEFAULT_MESSAGES: Record<CrossTenantGrantErrorKind, string> = {
  NotAvailable: 'The identity service does not offer the cross-tenant user lookup yet.',
  SourceUserLookupRateLimited: 'Too many source user lookups. Try again later.',
  SourceTenantNotPermitted: 'The source tenant does not permit granting this user access to this tenant.',
  UnknownGroup: 'At least one group does not exist in this tenant.',
  ExternalTenantUserMappingAlreadyExists: 'This user already has access to this tenant.',
  RoleChangeRefused: 'The role change was refused.',
  Forbidden: 'Access is denied.'
};

/**
 * Typed error of the tenant-scoped cross-tenant grant methods of `IdentityService`. It carries only the
 * status, the problem code, the server's title and the documented extensions — never the request body, so a
 * looked-up identifier (user name or e-mail) cannot leak through it.
 */
export class CrossTenantGrantError extends Error {
  override readonly name = 'CrossTenantGrantError';

  constructor(
    readonly kind: CrossTenantGrantErrorKind,
    readonly status: number,
    /** The problem `code` extension, when the server sent one. */
    readonly problemCode: string | null,
    /** Readable server title (problem `title`, or `message` of the older 403 shape); `null` when none. */
    readonly title: string | null,
    readonly details: {
      retryAfterSeconds?: number;
      unknownGroupIds?: string[];
      existingMappingId?: string;
      roleNames?: string[];
    } = {}
  ) {
    super(title ?? DEFAULT_MESSAGES[kind]);
  }

  /** Seconds until the next lookup is allowed (`SourceUserLookupRateLimited`), read from the body. */
  get retryAfterSeconds(): number | undefined {
    return this.details.retryAfterSeconds;
  }

  /** Group ids that are no groups of the current tenant (`UnknownGroup`). */
  get unknownGroupIds(): string[] | undefined {
    return this.details.unknownGroupIds;
  }

  /** Id of the existing mapping (`ExternalTenantUserMappingAlreadyExists`). */
  get existingMappingId(): string | undefined {
    return this.details.existingMappingId;
  }

  /** Built-in roles the caller does not hold (`RoleChangeRefused` with code `role-not-held`). */
  get roleNames(): string[] | undefined {
    return this.details.roleNames;
  }
}

/** Which route answered: the lookup knows the `NotAvailable` case, the mapping routes do not. */
export type CrossTenantGrantRoute = 'lookup' | 'mapping';

interface ProblemBody {
  code?: unknown;
  title?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
  unknownGroupIds?: unknown;
  existingMappingId?: unknown;
  roleNames?: unknown;
}

/** Reads the problem body of an error answer; Angular hands it over as object or (unparsed) text. */
function readProblemBody(error: HttpErrorLike): ProblemBody | null {
  const body: unknown = error.error;
  const isTransportEvent = typeof ProgressEvent !== 'undefined' && body instanceof ProgressEvent;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  if (body && typeof body === 'object' && !isTransportEvent && !isBlob) {
    return body as ProblemBody;
  }
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed as ProblemBody : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The problem `code` extension of an error answer, or `null` when it has none. */
export function problemCodeOf(error: HttpErrorLike): string | null {
  return asString(readProblemBody(error)?.code);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

/**
 * Maps an `HttpErrorResponse` of a cross-tenant grant route to a {@link CrossTenantGrantError}. Returns
 * `null` for answers the contract does not type (401, 5xx, a validation 400, the 404 of an unknown mapping
 * id, `SourceUserNotFound`); the caller then handles or rethrows the original error.
 */
export function toCrossTenantGrantError(error: unknown, route: CrossTenantGrantRoute): CrossTenantGrantError | null {
  if (!isHttpErrorLike(error)) {
    return null;
  }
  const problem = readProblemBody(error);
  const code = asString(problem?.code);
  const title = asString(problem?.title) ?? asString(problem?.message);
  const status = error.status;
  const make = (kind: CrossTenantGrantErrorKind, details: CrossTenantGrantError['details'] = {}) =>
    new CrossTenantGrantError(kind, status, code, title, details);

  switch (code) {
    case CrossTenantGrantProblemCodes.SourceUserLookupRateLimited: {
      const seconds = Number(problem?.retryAfterSeconds);
      return make('SourceUserLookupRateLimited',
        {retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined});
    }
    case CrossTenantGrantProblemCodes.SourceTenantNotPermitted:
      return make('SourceTenantNotPermitted');
    case CrossTenantGrantProblemCodes.UnknownGroup:
      return make('UnknownGroup', {unknownGroupIds: asStringArray(problem?.unknownGroupIds) ?? []});
    case CrossTenantGrantProblemCodes.ExternalTenantUserMappingAlreadyExists:
      return make('ExternalTenantUserMappingAlreadyExists',
        {existingMappingId: asString(problem?.existingMappingId) ?? undefined});
  }

  if (code && (RoleChangeProblemCodes as readonly string[]).includes(code)) {
    return make('RoleChangeRefused', {roleNames: asStringArray(problem?.roleNames)});
  }
  if (status === 403) {
    return make('Forbidden');
  }
  if (route === 'lookup' && status === 404 && !code) {
    return make('NotAvailable');
  }
  return null;
}
