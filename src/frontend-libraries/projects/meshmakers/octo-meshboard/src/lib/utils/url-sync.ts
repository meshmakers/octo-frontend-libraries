/**
 * Pure helper for syncing the loaded MeshBoard rtId into the browser URL.
 *
 * Rewriting the URL is only safe when the active route can actually represent
 * the rtId. Appending an rtId to a route without a matching `<path>/:rtId`
 * sibling falls through to the app's `'**'` wildcard (bounce to home) or fails
 * with a NavigationError (AB#4457), so append mode is opt-in.
 */
export interface UrlWithRtIdInput {
  /** Current router URL including the query string (`Router.url`). */
  currentUrl: string;
  /** rtId of the MeshBoard that was just loaded. */
  rtId: string;
  /** Whether the active route has an `:rtId` param (`paramMap.has('rtId')`). */
  hasRtIdParam: boolean;
  /** The `meshBoardSyncUrl` route data flag — opts in to append mode. */
  syncUrlOptIn: boolean;
}

/**
 * Returns the URL to navigate to after a board load/switch, or `null` when the
 * URL must not be rewritten.
 *
 * - Route has an `:rtId` param → the last path segment is replaced.
 * - `meshBoardSyncUrl: true` route data → the rtId is appended (the host app
 *   guarantees a matching `<path>/:rtId` sibling route).
 * - Otherwise → `null` (embedded boards never rewrite the URL).
 *
 * Query parameters are preserved in all cases.
 */
export function buildUrlWithRtId(input: UrlWithRtIdInput): string | null {
  const { currentUrl, rtId, hasRtIdParam, syncUrlOptIn } = input;
  const [pathPart, queryPart] = currentUrl.split('?');
  const querySuffix = queryPart ? '?' + queryPart : '';

  if (hasRtIdParam) {
    const lastSlashIndex = pathPart.lastIndexOf('/');
    return pathPart.substring(0, lastSlashIndex + 1) + rtId + querySuffix;
  }
  if (syncUrlOptIn) {
    return `${pathPart}/${rtId}${querySuffix}`;
  }
  return null;
}

export interface InitialUrlWithRtIdInput extends Omit<UrlWithRtIdInput, 'rtId'> {
  /** rtId of the board the initial load resolved to, `null` when none loaded. */
  loadedRtId: string | null;
  /** The `:rtId` route param the view was opened with, `null` when absent. */
  rtIdFromRoute: string | null;
}

/**
 * Returns the URL to navigate to after the *initial* board load, or `null`
 * when the URL must not be rewritten.
 *
 * The constructor effect skips URL sync during the initial load (it would race
 * with the transient board `loadInitialMeshBoard` puts up first), so the view
 * syncs once after loading settles. Nothing to do when no board loaded or the
 * URL already carried the rtId; otherwise the `buildUrlWithRtId` rules apply.
 */
export function buildInitialUrlWithRtId(input: InitialUrlWithRtIdInput): string | null {
  const { loadedRtId, rtIdFromRoute, ...rest } = input;
  if (!loadedRtId || rtIdFromRoute) {
    return null;
  }
  return buildUrlWithRtId({ ...rest, rtId: loadedRtId });
}
