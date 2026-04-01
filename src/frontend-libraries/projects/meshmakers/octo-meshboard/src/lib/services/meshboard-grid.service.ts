import { Injectable } from '@angular/core';
import { AnyWidgetConfig } from '../models/meshboard.models';

export interface GridCell {
  col: number;
  row: number;
}

export interface GridPosition {
  col: number;
  row: number;
}

/**
 * Service for MeshBoard grid layout calculations and collision detection.
 * Handles widget positioning, overlap detection, and finding available positions.
 */
@Injectable({
  providedIn: 'root'
})
export class MeshBoardGridService {

  /**
   * Returns all grid cells occupied by a widget at the given position/size.
   */
  getCells(col: number, row: number, colSpan: number, rowSpan: number): GridCell[] {
    const cells: GridCell[] = [];
    for (let c = col; c < col + colSpan; c++) {
      for (let r = row; r < row + rowSpan; r++) {
        cells.push({ col: c, row: r });
      }
    }
    return cells;
  }

  /**
   * Checks if placing a widget at the given position/size would overlap with any other widget.
   * Uses the model (not DOM) for accurate, predictable collision detection.
   */
  wouldCauseOverlap(
    widgets: AnyWidgetConfig[],
    widgetId: string,
    col: number,
    row: number,
    colSpan: number,
    rowSpan: number
  ): boolean {
    const widgetCells = this.getCells(col, row, colSpan, rowSpan);

    for (const other of widgets) {
      if (other.id === widgetId || other.zone === 'banner') continue;

      const otherCells = this.getCells(other.col, other.row, other.colSpan, other.rowSpan);

      for (const cell of widgetCells) {
        if (otherCells.some(c => c.col === cell.col && c.row === cell.row)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a widget would extend beyond the grid boundaries.
   */
  isOutOfBounds(col: number, colSpan: number, maxColumns: number): boolean {
    return col + colSpan - 1 > maxColumns;
  }

  /**
   * Finds an available position for a widget of the given size.
   */
  findAvailablePosition(
    widgets: AnyWidgetConfig[],
    colSpan: number,
    rowSpan: number,
    maxColumns: number
  ): GridPosition {
    const occupiedCells = this.getOccupiedCells(widgets);

    // Search row by row, column by column
    for (let row = 1; row <= 100; row++) {
      for (let col = 1; col <= maxColumns - colSpan + 1; col++) {
        const cells = this.getCells(col, row, colSpan, rowSpan);
        const fits = cells.every(c => c.col <= maxColumns && !occupiedCells.has(`${c.row},${c.col}`));

        if (fits) {
          return { col, row };
        }
      }
    }

    // Fallback: place at the bottom
    const maxRow = Math.max(...widgets.map(w => w.row + w.rowSpan), 1);
    return { col: 1, row: maxRow };
  }

  /**
   * Resolves overlapping widgets by moving them to non-overlapping positions.
   * Modifies the widgets array in place.
   * Returns the list of widgets that were moved.
   */
  resolveOverlaps(widgets: AnyWidgetConfig[], maxColumns: number): AnyWidgetConfig[] {
    const movedWidgets: AnyWidgetConfig[] = [];
    const occupiedCells = new Set<string>();

    for (const widget of widgets) {
      // Skip banner-zone widgets — they are rendered outside the grid
      // and should not participate in grid overlap detection.
      if (widget.zone === 'banner') continue;

      const cells = this.getCells(widget.col, widget.row, widget.colSpan, widget.rowSpan);
      const hasOverlap = cells.some(c => occupiedCells.has(`${c.row},${c.col}`));

      if (hasOverlap) {
        // Find a new position for this widget
        const newPos = this.findAvailablePositionWithOccupied(
          widget.colSpan,
          widget.rowSpan,
          maxColumns,
          occupiedCells
        );
        widget.col = newPos.col;
        widget.row = newPos.row;
        movedWidgets.push(widget);
      }

      // Mark cells as occupied
      const finalCells = this.getCells(widget.col, widget.row, widget.colSpan, widget.rowSpan);
      for (const cell of finalCells) {
        occupiedCells.add(`${cell.row},${cell.col}`);
      }
    }

    return movedWidgets;
  }

  /**
   * Gets all widgets that would be outside the grid if columns were reduced.
   */
  getWidgetsOutOfBounds(widgets: AnyWidgetConfig[], newColumns: number): AnyWidgetConfig[] {
    return widgets.filter(w => w.col + w.colSpan - 1 > newColumns);
  }

  /**
   * Calculates the maximum row used by any widget.
   */
  getMaxRow(widgets: AnyWidgetConfig[]): number {
    if (widgets.length === 0) return 0;
    return Math.max(...widgets.map(w => w.row + w.rowSpan - 1));
  }

  /**
   * Creates a set of all occupied cell keys from the widgets.
   */
  private getOccupiedCells(widgets: AnyWidgetConfig[]): Set<string> {
    const occupiedCells = new Set<string>();
    for (const widget of widgets) {
      const cells = this.getCells(widget.col, widget.row, widget.colSpan, widget.rowSpan);
      for (const cell of cells) {
        occupiedCells.add(`${cell.row},${cell.col}`);
      }
    }
    return occupiedCells;
  }

  /**
   * Finds an available position using a pre-computed set of occupied cells.
   */
  private findAvailablePositionWithOccupied(
    colSpan: number,
    rowSpan: number,
    maxColumns: number,
    occupiedCells: Set<string>
  ): GridPosition {
    // Search row by row, column by column
    for (let row = 1; row <= 100; row++) {
      for (let col = 1; col <= maxColumns - colSpan + 1; col++) {
        const cells = this.getCells(col, row, colSpan, rowSpan);
        const fits = cells.every(c => c.col <= maxColumns && !occupiedCells.has(`${c.row},${c.col}`));

        if (fits) {
          return { col, row };
        }
      }
    }

    // Fallback: place at the bottom (find highest row in occupied cells)
    let maxRow = 1;
    for (const key of occupiedCells) {
      const [row] = key.split(',').map(Number);
      maxRow = Math.max(maxRow, row + 1);
    }
    return { col: 1, row: maxRow };
  }
}

/** @deprecated Use MeshBoardGridService instead */
export const DashboardGridService = MeshBoardGridService;
