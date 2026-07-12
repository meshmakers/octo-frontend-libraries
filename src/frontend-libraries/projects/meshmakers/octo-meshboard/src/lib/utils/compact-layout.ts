import { AnyWidgetConfig } from '../models/meshboard.models';

/**
 * Presentation-side compact layout for the MeshBoard grid (AB#4353).
 *
 * The Kendo TileLayout renders its configured column count at any container
 * width — on a 390px phone a 6-column board yields ~42px columns and crushes
 * every widget. Below the breakpoints the board therefore re-renders with a
 * reduced column count and drops the persisted col/row anchors so CSS grid
 * auto-flow re-packs the widgets in the reading order of the configured
 * layout. The persisted board config is never modified; editing (drag/resize)
 * is only offered in the native tier.
 */
export type MeshBoardCompactTier = 'none' | 'tablet' | 'phone';

/** Below this container width the board stacks in a single column. */
export const PHONE_MAX_WIDTH = 700;
/** Below this container width the board clamps to at most TABLET_MAX_COLUMNS. */
export const TABLET_MAX_WIDTH = 1100;
export const TABLET_MAX_COLUMNS = 3;

export function compactTierForWidth(width: number | null): MeshBoardCompactTier {
  if (width === null) {
    return 'none';
  }
  if (width < PHONE_MAX_WIDTH) {
    return 'phone';
  }
  if (width < TABLET_MAX_WIDTH) {
    return 'tablet';
  }
  return 'none';
}

export function columnsForTier(tier: MeshBoardCompactTier, configuredColumns: number): number {
  switch (tier) {
    case 'phone':
      return 1;
    case 'tablet':
      return Math.min(configuredColumns, TABLET_MAX_COLUMNS);
    default:
      return configuredColumns;
  }
}

/** Display placement for one grid widget; col/row are undefined in compact tiers (auto-flow). */
export interface WidgetPlacement {
  widget: AnyWidgetConfig;
  col?: number;
  row?: number;
  colSpan: number;
  rowSpan: number;
}

export function placeWidgetsForTier(
  widgets: AnyWidgetConfig[],
  tier: MeshBoardCompactTier,
  configuredColumns: number
): WidgetPlacement[] {
  if (tier === 'none') {
    return widgets.map(widget => ({
      widget,
      col: widget.col,
      row: widget.row,
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan
    }));
  }

  const columns = columnsForTier(tier, configuredColumns);
  return [...widgets]
    .sort((a, b) => (a.row - b.row) || (a.col - b.col))
    .map(widget => ({
      widget,
      colSpan: Math.max(1, Math.min(widget.colSpan, columns)),
      rowSpan: widget.rowSpan
    }));
}
