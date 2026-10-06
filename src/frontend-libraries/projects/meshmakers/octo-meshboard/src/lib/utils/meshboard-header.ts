/**
 * How much of its header a MeshBoard view shows (AB#5558). The header is a property of the
 * host page, not of the board: the same board is shown with its name in UI › MeshBoards and
 * without it on a host page that already names it (e.g. a Home tab under a greeting).
 *
 * - `full` (default): board name, description and the board controls.
 * - `compact`: no name and no description; the controls (time filter, entity selectors,
 *   refresh, and for editable boards manager / settings / edit / add / save) stay in a slim
 *   row aligned right.
 * - `none`: no header row at all — for hosts that offer their own controls. Hints (unselected
 *   entity selectors, variable errors) and the "not found" / "not available" help still show.
 *
 * Pure helpers so the rule is unit-testable without the view.
 */
export type MeshBoardHeaderMode = 'full' | 'compact' | 'none';

/** Route data key a route uses when it loads the view directly (no template to bind the input). */
export const MESHBOARD_HEADER_MODE_ROUTE_DATA = 'meshBoardHeaderMode';

const MODES: readonly MeshBoardHeaderMode[] = ['full', 'compact', 'none'];

/** Whether the value is a known header mode. */
export function isMeshBoardHeaderMode(value: unknown): value is MeshBoardHeaderMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

/**
 * The effective header mode: the bound input wins over the route data; unknown or missing
 * values fall back to `full`.
 */
export function resolveMeshBoardHeaderMode(inputMode: unknown, routeDataMode: unknown): MeshBoardHeaderMode {
  if (isMeshBoardHeaderMode(inputMode)) {
    return inputMode;
  }
  return isMeshBoardHeaderMode(routeDataMode) ? routeDataMode : 'full';
}
