import { TestBed } from '@angular/core/testing';
import { MeshBoardGridService } from './meshboard-grid.service';
import { AnyWidgetConfig } from '../models/meshboard.models';

/**
 * Creates a minimal mock widget config for testing grid operations.
 * Only includes the fields needed for grid calculations.
 */
function createMockWidget(
  id: string,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number
): AnyWidgetConfig {
  return {
    id,
    col,
    row,
    colSpan,
    rowSpan,
    type: 'kpi',
    title: `Widget ${id}`,
    dataSource: { type: 'static' }
  } as AnyWidgetConfig;
}

describe('MeshBoardGridService', () => {
  let service: MeshBoardGridService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MeshBoardGridService]
    });
    service = TestBed.inject(MeshBoardGridService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCells', () => {
    it('should return single cell for 1x1 widget', () => {
      const cells = service.getCells(1, 1, 1, 1);

      expect(cells.length).toBe(1);
      expect(cells[0]).toEqual({ col: 1, row: 1 });
    });

    it('should return correct cells for 2x2 widget', () => {
      const cells = service.getCells(1, 1, 2, 2);

      expect(cells.length).toBe(4);
      expect(cells).toContain(jasmine.objectContaining({ col: 1, row: 1 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 2, row: 1 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 1, row: 2 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 2, row: 2 }));
    });

    it('should return correct cells for 3x1 widget (horizontal)', () => {
      const cells = service.getCells(2, 3, 3, 1);

      expect(cells.length).toBe(3);
      expect(cells).toContain(jasmine.objectContaining({ col: 2, row: 3 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 3, row: 3 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 4, row: 3 }));
    });

    it('should return correct cells for 1x3 widget (vertical)', () => {
      const cells = service.getCells(5, 1, 1, 3);

      expect(cells.length).toBe(3);
      expect(cells).toContain(jasmine.objectContaining({ col: 5, row: 1 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 5, row: 2 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 5, row: 3 }));
    });

    it('should handle large widget (4x3)', () => {
      const cells = service.getCells(1, 1, 4, 3);

      expect(cells.length).toBe(12);
    });

    it('should handle widget starting at non-origin position', () => {
      const cells = service.getCells(5, 10, 2, 2);

      expect(cells.length).toBe(4);
      expect(cells).toContain(jasmine.objectContaining({ col: 5, row: 10 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 6, row: 10 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 5, row: 11 }));
      expect(cells).toContain(jasmine.objectContaining({ col: 6, row: 11 }));
    });
  });

  describe('wouldCauseOverlap', () => {
    it('should return false for empty widget list', () => {
      const result = service.wouldCauseOverlap([], 'new', 1, 1, 2, 2);

      expect(result).toBeFalse();
    });

    it('should return false when no overlap exists', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2)  // occupies cols 1-2, rows 1-2
      ];

      // Place new widget at col 3 - no overlap
      const result = service.wouldCauseOverlap(widgets, 'new', 3, 1, 2, 2);

      expect(result).toBeFalse();
    });

    it('should return true when widgets overlap', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2)  // occupies cols 1-2, rows 1-2
      ];

      // Place new widget at col 2 - overlaps with w1
      const result = service.wouldCauseOverlap(widgets, 'new', 2, 1, 2, 2);

      expect(result).toBeTrue();
    });

    it('should exclude the widget being moved from overlap check', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 4, 1, 2, 2)
      ];

      // Move w1 to its own position - should not overlap with itself
      const result = service.wouldCauseOverlap(widgets, 'w1', 1, 1, 2, 2);

      expect(result).toBeFalse();
    });

    it('should detect partial overlap', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 3, 3)  // occupies cols 1-3, rows 1-3
      ];

      // New widget at col 3, row 3 - overlaps at single cell (3,3)
      const result = service.wouldCauseOverlap(widgets, 'new', 3, 3, 2, 2);

      expect(result).toBeTrue();
    });

    it('should return false for adjacent widgets', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2)  // occupies cols 1-2, rows 1-2
      ];

      // Adjacent widgets should not overlap
      expect(service.wouldCauseOverlap(widgets, 'new', 3, 1, 1, 1)).toBeFalse(); // right
      expect(service.wouldCauseOverlap(widgets, 'new', 1, 3, 1, 1)).toBeFalse(); // below
    });

    it('should handle multiple existing widgets', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),   // cols 1-2, rows 1-2
        createMockWidget('w2', 4, 1, 2, 2),   // cols 4-5, rows 1-2
        createMockWidget('w3', 1, 4, 3, 1)    // cols 1-3, row 4
      ];

      // No overlap in gap
      expect(service.wouldCauseOverlap(widgets, 'new', 3, 1, 1, 2)).toBeFalse();

      // Overlap with w1
      expect(service.wouldCauseOverlap(widgets, 'new', 2, 2, 1, 1)).toBeTrue();

      // Overlap with w2
      expect(service.wouldCauseOverlap(widgets, 'new', 5, 1, 2, 1)).toBeTrue();

      // Overlap with w3
      expect(service.wouldCauseOverlap(widgets, 'new', 2, 4, 1, 1)).toBeTrue();
    });
  });

  describe('isOutOfBounds', () => {
    it('should return false when widget fits within grid', () => {
      expect(service.isOutOfBounds(1, 2, 6)).toBeFalse(); // cols 1-2 in 6-col grid
      expect(service.isOutOfBounds(5, 2, 6)).toBeFalse(); // cols 5-6 in 6-col grid
    });

    it('should return true when widget extends beyond grid', () => {
      expect(service.isOutOfBounds(6, 2, 6)).toBeTrue();  // cols 6-7 in 6-col grid
      expect(service.isOutOfBounds(5, 3, 6)).toBeTrue();  // cols 5-7 in 6-col grid
    });

    it('should handle edge case at boundary', () => {
      // Widget ending exactly at grid boundary
      expect(service.isOutOfBounds(5, 2, 6)).toBeFalse(); // cols 5-6 in 6-col grid (fits)
      expect(service.isOutOfBounds(6, 1, 6)).toBeFalse(); // col 6 in 6-col grid (fits)
    });

    it('should handle 1-column widget', () => {
      expect(service.isOutOfBounds(6, 1, 6)).toBeFalse();  // col 6 fits
      expect(service.isOutOfBounds(7, 1, 6)).toBeTrue();   // col 7 doesn't fit
    });
  });

  describe('findAvailablePosition', () => {
    it('should return (1,1) for empty grid', () => {
      const position = service.findAvailablePosition([], 2, 2, 6);

      expect(position).toEqual({ col: 1, row: 1 });
    });

    it('should find position after existing widget', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2)  // occupies cols 1-2, rows 1-2
      ];

      const position = service.findAvailablePosition(widgets, 2, 2, 6);

      // Should find position at col 3 or below
      expect(position.col).toBeGreaterThanOrEqual(1);
      expect(position.row).toBeGreaterThanOrEqual(1);

      // Verify the position doesn't overlap
      const wouldOverlap = service.wouldCauseOverlap(
        widgets, 'new', position.col, position.row, 2, 2
      );
      expect(wouldOverlap).toBeFalse();
    });

    it('should find position in gap between widgets', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),  // cols 1-2
        createMockWidget('w2', 5, 1, 2, 2)   // cols 5-6
      ];

      // There's a gap at cols 3-4
      const position = service.findAvailablePosition(widgets, 2, 2, 6);

      expect(position).toEqual({ col: 3, row: 1 });
    });

    it('should go to next row when current row is full', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 3, 2),  // cols 1-3
        createMockWidget('w2', 4, 1, 3, 2)   // cols 4-6
      ];

      // Row 1 is full, should place on row 3 (after rowSpan of 2)
      const position = service.findAvailablePosition(widgets, 2, 2, 6);

      expect(position.row).toBeGreaterThanOrEqual(3);
    });

    it('should respect maxColumns constraint', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 4, 1)  // cols 1-4
      ];

      // 3-column widget in 6-column grid with 4 cols occupied
      // Should go to next row since cols 5-7 would be out of bounds
      const position = service.findAvailablePosition(widgets, 3, 1, 6);

      // Position should be valid (not exceed maxColumns)
      expect(position.col + 2).toBeLessThanOrEqual(6); // col + colSpan - 1 <= maxColumns
    });

    it('should handle widget larger than available horizontal space', () => {
      // 4-column wide widget in 6-column grid
      const widgets = [
        createMockWidget('w1', 1, 1, 3, 1)  // cols 1-3
      ];

      const position = service.findAvailablePosition(widgets, 4, 1, 6);

      // Only cols 4-6 are free in row 1, but widget needs 4 cols
      // Should go to row 2
      expect(position.row).toBeGreaterThanOrEqual(2);
    });
  });

  describe('resolveOverlaps', () => {
    it('should return empty array when no overlaps exist', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 4, 1, 2, 2)
      ];

      const moved = service.resolveOverlaps(widgets, 6);

      expect(moved.length).toBe(0);
    });

    it('should move overlapping widget to new position', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 2, 1, 2, 2)  // overlaps with w1
      ];

      const moved = service.resolveOverlaps(widgets, 6);

      expect(moved.length).toBe(1);
      expect(moved[0].id).toBe('w2');

      // Verify w2 no longer overlaps with w1
      const stillOverlaps = service.wouldCauseOverlap(
        [widgets[0]], 'w2', widgets[1].col, widgets[1].row, 2, 2
      );
      expect(stillOverlaps).toBeFalse();
    });

    it('should handle multiple overlapping widgets', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 1, 1, 2, 2),  // overlaps with w1
        createMockWidget('w3', 1, 1, 2, 2)   // overlaps with w1 and w2
      ];

      const moved = service.resolveOverlaps(widgets, 6);

      // w2 and w3 should be moved
      expect(moved.length).toBe(2);

      // All widgets should have unique positions
      // Note: positions may not be unique strings if sizes differ, so check overlap
      for (let i = 0; i < widgets.length; i++) {
        for (let j = i + 1; j < widgets.length; j++) {
          const overlaps = service.wouldCauseOverlap(
            [widgets[i]], widgets[j].id, widgets[j].col, widgets[j].row, widgets[j].colSpan, widgets[j].rowSpan
          );
          expect(overlaps).toBeFalse();
        }
      }
    });

    it('should preserve first widget position (first-come wins)', () => {
      const widgets = [
        createMockWidget('w1', 3, 3, 2, 2),
        createMockWidget('w2', 3, 3, 2, 2)  // overlaps
      ];

      const originalW1Position = { col: widgets[0].col, row: widgets[0].row };

      service.resolveOverlaps(widgets, 6);

      // w1 should keep its position
      expect(widgets[0].col).toBe(originalW1Position.col);
      expect(widgets[0].row).toBe(originalW1Position.row);
    });

    it('should mutate widgets array in place', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 1, 1, 2, 2)
      ];

      const originalW2 = widgets[1];

      service.resolveOverlaps(widgets, 6);

      // Same reference, updated values
      expect(widgets[1]).toBe(originalW2);
      expect(widgets[1].col !== 1 || widgets[1].row !== 1).toBeTrue();
    });
  });

  describe('getWidgetsOutOfBounds', () => {
    it('should return empty array when all widgets fit', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),
        createMockWidget('w2', 4, 1, 2, 2)
      ];

      const outOfBounds = service.getWidgetsOutOfBounds(widgets, 6);

      expect(outOfBounds.length).toBe(0);
    });

    it('should return widgets that exceed new column limit', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),  // cols 1-2, fits in 4
        createMockWidget('w2', 4, 1, 2, 2),  // cols 4-5, exceeds 4
        createMockWidget('w3', 5, 1, 2, 2)   // cols 5-6, exceeds 4
      ];

      const outOfBounds = service.getWidgetsOutOfBounds(widgets, 4);

      expect(outOfBounds.length).toBe(2);
      expect(outOfBounds.map(w => w.id)).toContain('w2');
      expect(outOfBounds.map(w => w.id)).toContain('w3');
    });

    it('should handle widget at exact boundary', () => {
      const widgets = [
        createMockWidget('w1', 3, 1, 2, 2)  // cols 3-4
      ];

      // Widget ends at col 4, reducing to 4 cols should be fine
      expect(service.getWidgetsOutOfBounds(widgets, 4).length).toBe(0);

      // Reducing to 3 cols means col 4 is out
      expect(service.getWidgetsOutOfBounds(widgets, 3).length).toBe(1);
    });

    it('should handle empty widget list', () => {
      const outOfBounds = service.getWidgetsOutOfBounds([], 4);

      expect(outOfBounds.length).toBe(0);
    });
  });

  describe('getMaxRow', () => {
    it('should return 0 for empty widget list', () => {
      const maxRow = service.getMaxRow([]);

      expect(maxRow).toBe(0);
    });

    it('should return correct max row for single widget', () => {
      const widgets = [
        createMockWidget('w1', 1, 3, 2, 2)  // rows 3-4
      ];

      const maxRow = service.getMaxRow(widgets);

      expect(maxRow).toBe(4);
    });

    it('should return correct max row for multiple widgets', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 2, 2),  // rows 1-2
        createMockWidget('w2', 1, 5, 2, 3),  // rows 5-7
        createMockWidget('w3', 4, 3, 2, 2)   // rows 3-4
      ];

      const maxRow = service.getMaxRow(widgets);

      expect(maxRow).toBe(7);
    });

    it('should handle widgets at row 1', () => {
      const widgets = [
        createMockWidget('w1', 1, 1, 3, 1)  // row 1 only
      ];

      const maxRow = service.getMaxRow(widgets);

      expect(maxRow).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should correctly handle dashboard layout scenario', () => {
      // Simulate typical dashboard with various widget sizes
      const widgets: AnyWidgetConfig[] = [
        createMockWidget('kpi1', 1, 1, 2, 1),   // small KPI
        createMockWidget('kpi2', 3, 1, 2, 1),   // small KPI
        createMockWidget('chart', 5, 1, 2, 2),  // chart
        createMockWidget('table', 1, 2, 4, 3),  // large table
      ];

      const maxColumns = 6;

      // All widgets should not overlap
      for (let i = 0; i < widgets.length; i++) {
        const w = widgets[i];
        const others = widgets.filter((_, idx) => idx !== i);
        const overlaps = service.wouldCauseOverlap(
          others, w.id, w.col, w.row, w.colSpan, w.rowSpan
        );
        expect(overlaps).withContext(`Widget ${w.id} should not overlap`).toBeFalse();
      }

      // Find position for new widget
      const newPos = service.findAvailablePosition(widgets, 2, 2, maxColumns);
      expect(newPos).toBeTruthy();

      // Verify max row calculation
      const maxRow = service.getMaxRow(widgets);
      expect(maxRow).toBe(4); // table extends from row 2 to row 4
    });

    it('should handle column reduction scenario', () => {
      // Widgets laid out for 6 columns
      const widgets: AnyWidgetConfig[] = [
        createMockWidget('w1', 1, 1, 3, 2),
        createMockWidget('w2', 4, 1, 3, 2),  // cols 4-6
      ];

      // Reduce to 4 columns - w2 is out of bounds
      const outOfBounds = service.getWidgetsOutOfBounds(widgets, 4);
      expect(outOfBounds.length).toBe(1);
      expect(outOfBounds[0].id).toBe('w2');

      // Note: resolveOverlaps only fixes overlaps, not out-of-bounds
      // To fix out-of-bounds, manually move the widget first
      const outOfBoundsWidget = outOfBounds[0];
      const newPos = service.findAvailablePosition(
        widgets.filter(w => w.id !== outOfBoundsWidget.id),
        outOfBoundsWidget.colSpan,
        outOfBoundsWidget.rowSpan,
        4  // new maxColumns
      );
      outOfBoundsWidget.col = newPos.col;
      outOfBoundsWidget.row = newPos.row;

      // Now all should fit within 4 columns
      const stillOutOfBounds = service.getWidgetsOutOfBounds(widgets, 4);
      expect(stillOutOfBounds.length).toBe(0);

      // And no overlaps
      const w1 = widgets[0];
      const w2 = widgets[1];
      const overlaps = service.wouldCauseOverlap([w1], w2.id, w2.col, w2.row, w2.colSpan, w2.rowSpan);
      expect(overlaps).toBeFalse();
    });
  });
});
