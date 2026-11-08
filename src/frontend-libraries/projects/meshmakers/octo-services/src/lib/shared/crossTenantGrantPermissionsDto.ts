import {isHttpErrorLike} from './crossTenantGrantError';

/**
 * Body of `GET/PUT {issuer}{tenant}/v1/crossTenantGrantPermissions` (AB#8345): the target tenants whose
 * administrators may look up this (source) tenant's users by exact user name or e-mail and grant them access.
 * Empty = nobody, the default of every tenant. Contract: `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md` §6.
 *
 * The server trims, lower-cases and de-duplicates the entries; the answer of a `PUT` is the stored list.
 */
export interface CrossTenantGrantPermissionsDto {
  targetTenantIds: string[];
}

/**
 * The allow-list as `IdentityService.getCrossTenantGrantPermissions` / `setCrossTenantGrantPermissions` return it:
 * the list plus the version tag of the server (AB#8432, contract §6.1).
 *
 * Keep {@link etag} with the list you show and pass it back as `ifMatch` when you replace the list. When someone else
 * changed the list in between, the server answers `412` (`CrossTenantGrantPermissionsError` `Conflict`) and writes
 * nothing. The tag is opaque: pass it on exactly as received, never parse or build it.
 */
export interface CrossTenantGrantPermissionsResult extends CrossTenantGrantPermissionsDto {
  /** The `ETag` of the answer, `null` when the server sent none (identity without AB#8432) or did not expose it. */
  etag: string | null;
}

/**
 * What went wrong when reading or replacing the allow-list, for branching in the UI:
 *
 * - `Forbidden` — `403`: the caller is no administrator of this tenant (`UserManagement` and
 *   `TenantManagement`, token issued for this tenant). Show the "no permission" state.
 * - `Invalid` — `400` validation problem: the list was refused, nothing changed;
 *   {@link CrossTenantGrantPermissionsError.validationErrors} holds the server's readable reasons (own tenant,
 *   invalid characters, too long, too many entries).
 * - `NotAvailable` — `404`: the identity service does not contain AB#8345 yet.
 * - `Conflict` — `412`: the list was changed by someone else since it was read (`If-Match`, AB#8432); nothing was
 *   written. {@link CrossTenantGrantPermissionsError.currentEtag} holds the tag of the current list when the server
 *   sent it. Reload the list and apply the change again.
 * - `PreconditionRequired` — `428`: the server requires `If-Match` (`Identity:CrossTenantGrantPermissions:RequireIfMatch`)
 *   and the request had none; nothing was written. Read the list first and send its tag.
 */
export type CrossTenantGrantPermissionsErrorKind =
  'Forbidden' | 'Invalid' | 'NotAvailable' | 'Conflict' | 'PreconditionRequired';

const DEFAULT_MESSAGES: Record<CrossTenantGrantPermissionsErrorKind, string> = {
  Forbidden: 'You are not allowed to manage the cross-tenant access of this tenant.',
  Invalid: 'The list of tenants was refused.',
  NotAvailable: 'The identity service does not offer cross-tenant access settings yet.',
  Conflict: 'The list was changed by someone else. Reload and try again.',
  PreconditionRequired: 'The list must be read before it can be changed. Reload and try again.'
};

/**
 * Typed error of `IdentityService.getCrossTenantGrantPermissions` / `setCrossTenantGrantPermissions`. It carries
 * only the status, the server's title and the validation reasons — never the request body.
 */
export class CrossTenantGrantPermissionsError extends Error {
  override readonly name = 'CrossTenantGrantPermissionsError';

  constructor(
    readonly kind: CrossTenantGrantPermissionsErrorKind,
    readonly status: number,
    /** Readable server title, `null` when none. */
    readonly title: string | null,
    /** Readable reasons of a `400` validation problem (`Invalid`); empty otherwise. */
    readonly validationErrors: string[] = [],
    /** `Conflict`: the `ETag` of the current list as the server sent it with the `412`; `null` otherwise. */
    readonly currentEtag: string | null = null
  ) {
    super(validationErrors[0] ?? title ?? DEFAULT_MESSAGES[kind]);
  }
}

/** The HTTP statuses {@link toCrossTenantGrantPermissionsError} types; the caller handles them, not the interceptor. */
export const CROSS_TENANT_GRANT_PERMISSIONS_TYPED_STATUSES: readonly number[] = [400, 403, 404, 412, 428];

interface ValidationProblemBody {
  title?: unknown;
  message?: unknown;
  errors?: unknown;
}

function readBody(error: {error: unknown}): ValidationProblemBody | null {
  const body = error.error;
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed as ValidationProblemBody : null;
    } catch {
      return null;
    }
  }
  const isTransportEvent = typeof ProgressEvent !== 'undefined' && body instanceof ProgressEvent;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  return body && typeof body === 'object' && !isTransportEvent && !isBlob ? body as ValidationProblemBody : null;
}

/** Flattens the ASP.NET `errors` map (`{ field: [reason, …] }`) into readable reasons. */
function validationReasons(errors: unknown): string[] {
  if (!errors || typeof errors !== 'object') {
    return [];
  }
  return Object.values(errors as Record<string, unknown>)
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/** Reads a response header structurally (no `instanceof`, same rule as {@link isHttpErrorLike}). */
function readResponseHeader(response: unknown, name: string): string | null {
  const headers = (response as {headers?: {get?: (header: string) => string | null}} | null)?.headers;
  const value = typeof headers?.get === 'function' ? headers.get(name) : null;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Maps an `HttpErrorResponse` of the allow-list routes to a {@link CrossTenantGrantPermissionsError}. Returns
 * `null` for answers that are not typed (401, 5xx, transport errors); the caller then rethrows the original error.
 */
export function toCrossTenantGrantPermissionsError(error: unknown): CrossTenantGrantPermissionsError | null {
  if (!isHttpErrorLike(error)) {
    return null;
  }
  const body = readBody(error);
  const title = typeof body?.title === 'string' && body.title.length > 0 ? body.title
    : typeof body?.message === 'string' && body.message.length > 0 ? body.message : null;
  switch (error.status) {
    case 400:
      return new CrossTenantGrantPermissionsError('Invalid', 400, title, validationReasons(body?.errors));
    case 403:
      return new CrossTenantGrantPermissionsError('Forbidden', 403, title);
    case 404:
      return new CrossTenantGrantPermissionsError('NotAvailable', 404, title);
    case 412:
      return new CrossTenantGrantPermissionsError('Conflict', 412, title, [], readResponseHeader(error, 'ETag'));
    case 428:
      return new CrossTenantGrantPermissionsError('PreconditionRequired', 428, title);
    default:
      return null;
  }
}
