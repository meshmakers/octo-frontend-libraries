/**
 * `?edit=1` on a MeshBoard URL opens the board in edit mode once it has loaded (e.g. "Edit" in a
 * host's board list). Pure helpers so the rule is unit-testable without the view.
 */

/** Query parameter that requests edit mode. */
export const MESHBOARD_EDIT_QUERY_PARAM = 'edit';

/** Whether the URL asks for edit mode and the route allows it (ignored on read-only routes). */
export function wantsEditModeFromUrl(
  params: { get(name: string): string | null },
  readonly: boolean,
  alreadyEditing: boolean
): boolean {
  return params.get(MESHBOARD_EDIT_QUERY_PARAM) === '1' && !readonly && !alreadyEditing;
}

/**
 * The URL without the `edit` parameter (other query parameters and the fragment kept), or null
 * when it has none — so a reload or a copied link does not re-enter edit mode.
 */
export function urlWithoutEditParam(url: string): string | null {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.substring(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? url.substring(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex < 0) {
    return null;
  }
  const path = beforeHash.substring(0, queryIndex);
  const parts = beforeHash.substring(queryIndex + 1).split('&').filter(p => p !== '');
  const kept = parts.filter(p => decodeURIComponent(p.split('=')[0]) !== MESHBOARD_EDIT_QUERY_PARAM);
  if (kept.length === parts.length) {
    return null;
  }
  return `${path}${kept.length ? `?${kept.join('&')}` : ''}${fragment}`;
}
