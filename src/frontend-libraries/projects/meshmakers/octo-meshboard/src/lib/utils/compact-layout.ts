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

/**
 * Space of a tile around its widget body (header, borders, body padding) in px, used to turn a
 * reported content height into rows. Generous on purpose: one spare row beats a clipped card.
 */
export const TILE_CHROME_HEIGHT = 64;
/** Upper bound of a content-sized tile on the phone tier; beyond it the widget scrolls. */
export const MAX_CONTENT_ROWS = 8;

/**
 * Rows a tile needs for a widget whose content is `contentHeight` px high (AB#5558), at least
 * `minRows` and at most {@link MAX_CONTENT_ROWS}: `rows * rowHeight + (rows - 1) * gap` must hold
 * the content plus {@link TILE_CHROME_HEIGHT}.
 */
export function rowSpanForContent(contentHeight: number, rowHeight: number, gap: number, minRows: number): number {
  if (!(contentHeight > 0) || !(rowHeight > 0)) {
    return minRows;
  }
  const rows = Math.ceil((contentHeight + TILE_CHROME_HEIGHT + Math.max(0, gap)) / (rowHeight + Math.max(0, gap)));
  return Math.max(minRows, Math.min(MAX_CONTENT_ROWS, rows));
}

/** Content heights for {@link placeWidgetsForTier}: only used on the phone tier. */
export interface ContentSizing {
  /** Natural content height per widget id (`MeshBoardStateService.widgetContentHeights`). */
  heights: ReadonlyMap<string, number>;
  rowHeight: number;
  gap: number;
}

export function placeWidgetsForTier(
  widgets: AnyWidgetConfig[],
  tier: MeshBoardCompactTier,
  configuredColumns: number,
  contentSizing?: ContentSizing
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
  const placements = [...widgets]
    .sort((a, b) => (a.row - b.row) || (a.col - b.col))
    .map(widget => ({
      widget,
      colSpan: scaleColSpan(widget.colSpan, configuredColumns, columns),
      rowSpan: widget.rowSpan
    }));
  fitRowsToColumns(placements, configuredColumns, columns);
  if (tier === 'phone' && contentSizing) {
    // Single column (AB#5558): a content-sized widget (e.g. the cockpit attention list, whose
    // cards stack on a phone) grows its tile instead of clipping the content.
    for (const placement of placements) {
      const height = contentSizing.heights.get(placement.widget.id);
      if (height !== undefined) {
        placement.rowSpan = rowSpanForContent(height, contentSizing.rowHeight, contentSizing.gap, placement.rowSpan);
      }
    }
  }
  return placements;
}

/**
 * Keeps widgets that share a row side by side on the reduced grid (AB#5558): two span-3 widgets
 * of a 6-column board both round to 2 of 3 columns and would wrap onto two half-empty rows. When
 * the widgets starting in one configured row fit that row but their scaled spans do not fit the
 * tier, the tier's columns are shared out by largest remainder (each at least 1; ties go to the
 * wider, then the left widget) — 3 + 3 of 6 becomes 2 + 1 of 3. Mutates `placements`.
 */
function fitRowsToColumns(placements: WidgetPlacement[], configuredColumns: number, columns: number): void {
  if (configuredColumns <= 0 || columns >= configuredColumns) {
    return;
  }
  const rows = new Map<number, WidgetPlacement[]>();
  for (const placement of placements) {
    const row = rows.get(placement.widget.row) ?? [];
    row.push(placement);
    rows.set(placement.widget.row, row);
  }
  for (const row of rows.values()) {
    const configured = row.reduce((sum, p) => sum + p.widget.colSpan, 0);
    const scaled = row.reduce((sum, p) => sum + p.colSpan, 0);
    if (row.length < 2 || row.length > columns || configured > configuredColumns || scaled <= columns) {
      continue;
    }
    const shares = row.map(p => {
      const exact = p.widget.colSpan * columns / configuredColumns;
      return { p, span: Math.max(1, Math.floor(exact)), remainder: exact - Math.floor(exact) };
    });
    let left = columns - shares.reduce((sum, share) => sum + share.span, 0);
    const byRemainder = [...shares].sort((a, b) =>
      (b.remainder - a.remainder) || (b.p.widget.colSpan - a.p.widget.colSpan) || (a.p.widget.col - b.p.widget.col));
    for (const share of byRemainder) {
      if (left <= 0) break;
      share.span++;
      left--;
    }
    for (const share of shares) {
      share.p.colSpan = share.span;
    }
  }
}

/**
 * The span on a reduced grid, scaled proportionally (AB#5558): three span-2 tiles of a 6-column
 * board stay side by side on the 3-column tablet tier (2/6 → 1/3) instead of each filling a row
 * as a plain cap would. Rounded, at least 1, at most the tier's columns.
 */
export function scaleColSpan(colSpan: number, configuredColumns: number, columns: number): number {
  if (configuredColumns <= 0 || columns >= configuredColumns) {
    return Math.max(1, Math.min(colSpan, columns));
  }
  return Math.max(1, Math.min(columns, Math.round(colSpan * columns / configuredColumns)));
}

/**
 * Removes rows that no widget occupies any more (AB#5558: widgets collapsed for the viewer, e.g.
 * cockpit tiles an end user may not use), moving the widgets below up. Presentation only — the
 * persisted rows are untouched; widgets whose row does not change keep their object reference.
 */
export function collapseEmptyRows<T extends { row: number; rowSpan: number }>(widgets: readonly T[]): T[] {
  const occupied = new Set<number>();
  for (const widget of widgets) {
    for (let row = widget.row; row < widget.row + Math.max(1, widget.rowSpan); row++) {
      occupied.add(row);
    }
  }
  const emptyBefore = (row: number): number => {
    let count = 0;
    for (let r = 1; r < row; r++) {
      if (!occupied.has(r)) count++;
    }
    return count;
  };
  return widgets.map(widget => {
    const shift = emptyBefore(widget.row);
    return shift > 0 ? { ...widget, row: widget.row - shift } : widget;
  });
}
