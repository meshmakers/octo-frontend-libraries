/**
 * Whether a MeshBoard view draws its own outer frame (AB#5558). Like the header mode this is a
 * property of the host page: a standalone board page frames the board, a host page that already
 * provides the surface and the gutter (e.g. a Home tab) embeds it plain.
 *
 * - `framed` (default): the view paints its own background, the header bar (background and
 *   bottom border) and the grid padding around the widgets.
 * - `plain`: no outer background, no header bar background or border and no outer padding — the
 *   widgets sit directly on the host page and align with its gutter. The widget frames (tile
 *   border, background, shadow) and the gap between the widgets stay unchanged.
 *
 * Pure helpers so the rule is unit-testable without the view.
 */
export type MeshBoardChrome = 'framed' | 'plain';

/** Route data key a route uses when it loads the view directly (no template to bind the input). */
export const MESHBOARD_CHROME_ROUTE_DATA = 'meshBoardChrome';

const CHROMES: readonly MeshBoardChrome[] = ['framed', 'plain'];

/** Whether the value is a known chrome. */
export function isMeshBoardChrome(value: unknown): value is MeshBoardChrome {
  return typeof value === 'string' && (CHROMES as readonly string[]).includes(value);
}

/**
 * The effective chrome: the bound input wins over the route data; unknown or missing values
 * fall back to `framed`.
 */
export function resolveMeshBoardChrome(inputChrome: unknown, routeDataChrome: unknown): MeshBoardChrome {
  if (isMeshBoardChrome(inputChrome)) {
    return inputChrome;
  }
  return isMeshBoardChrome(routeDataChrome) ? routeDataChrome : 'framed';
}
