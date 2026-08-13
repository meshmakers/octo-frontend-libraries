/**
 * The two ways a server refuses an authenticated call: the caller is not signed in any more,
 * or is signed in without the role the route requires.
 */
export type AuthorizationRefusal = 'unauthorized' | 'forbidden';

/**
 * Classifies an HTTP failure as an authorization refusal, or `null` when it is anything else.
 *
 * Hosts phrase the outcome themselves - one app wants an i18n key, another a translated string,
 * and the public landing pages deliberately merge both cases because an anonymous visitor cannot
 * act on the difference. What they share is reading `status`, and six copies of that read is how
 * the six drift apart.
 *
 * Takes `unknown` because that is how the error arrives: through a rejected promise, a `catch`
 * block, or a rethrow that may have stripped the `HttpErrorResponse` prototype along the way.
 * The status is therefore read structurally and must be a `number` - a body that merely carries
 * `"403"` is not a refusal.
 *
 * @example
 * ```typescript
 * switch (authorizationRefusal(error)) {
 *   case 'forbidden': return this.translate.instant('pipeline.forbidden');
 *   case 'unauthorized': return this.translate.instant('pipeline.unauthorized');
 *   default: return null;
 * }
 * ```
 */
export function authorizationRefusal(error: unknown): AuthorizationRefusal | null {
  const status = (error as { status?: unknown } | null)?.status;

  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return null;
}
