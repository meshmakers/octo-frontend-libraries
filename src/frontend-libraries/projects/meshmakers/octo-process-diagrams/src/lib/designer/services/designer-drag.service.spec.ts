import { TestBed } from '@angular/core/testing';
import { DesignerDragService } from './designer-drag.service';
import { DesignerCoordinateService } from './designer-coordinate.service';
import { DesignerStateService } from './designer-state.service';

describe('DesignerDragService', () => {
  let service: DesignerDragService;
  let stateService: DesignerStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DesignerDragService,
        DesignerCoordinateService,
        DesignerStateService
      ]
    });

    service = TestBed.inject(DesignerDragService);
    stateService = TestBed.inject(DesignerStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('initial state', () => {
    it('should start with isDragging false', () => {
      expect(service.isDragging()).toBeFalse();
    });

    it('should have null draggedItemId', () => {
      expect(service.draggedItemId()).toBeNull();
    });

    it('should have null draggedItemType', () => {
      expect(service.draggedItemType()).toBeNull();
    });

    it('should have initial state with null values', () => {
      const state = service.state();
      expect(state.isDragging).toBeFalse();
      expect(state.itemId).toBeNull();
      expect(state.itemType).toBeNull();
      expect(state.startPosition).toBeNull();
      expect(state.startMousePosition).toBeNull();
      expect(state.currentMousePosition).toBeNull();
    });
  });

  // ============================================================================
  // Start Drag
  // ============================================================================

  describe('startDrag', () => {
    it('should set isDragging to true', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      expect(service.isDragging()).toBeTrue();
    });

    it('should store item ID', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      expect(service.draggedItemId()).toBe('item-1');
    });

    it('should store item type', () => {
      service.startDrag('item-1', 'primitive', { x: 100, y: 200 }, { x: 150, y: 250 });
      expect(service.draggedItemType()).toBe('primitive');
    });

    it('should store start position', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      expect(service.state().startPosition).toEqual({ x: 100, y: 200 });
    });

    it('should store start mouse position', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      expect(service.state().startMousePosition).toEqual({ x: 150, y: 250 });
    });

    it('should clone positions to prevent external mutation', () => {
      const startPos = { x: 100, y: 200 };
      const mousePos = { x: 150, y: 250 };

      service.startDrag('item-1', 'element', startPos, mousePos);

      startPos.x = 999;
      mousePos.x = 888;

      expect(service.state().startPosition).toEqual({ x: 100, y: 200 });
      expect(service.state().startMousePosition).toEqual({ x: 150, y: 250 });
    });

    it('should handle group item type', () => {
      service.startDrag('group-1', 'group', { x: 0, y: 0 }, { x: 50, y: 50 });
      expect(service.isDraggingGroup()).toBeTrue();
      expect(service.isDraggingPrimitive()).toBeTrue();
    });

    it('should handle symbol item type', () => {
      service.startDrag('symbol-1', 'symbol', { x: 0, y: 0 }, { x: 50, y: 50 });
      expect(service.draggedItemType()).toBe('symbol');
      expect(service.isDraggingGroup()).toBeFalse();
    });
  });

  // ============================================================================
  // End Drag
  // ============================================================================

  describe('endDrag', () => {
    it('should return null when not dragging', () => {
      const result = service.endDrag();
      expect(result).toBeNull();
    });

    it('should return final state when dragging', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.endDrag();

      expect(result).not.toBeNull();
      expect(result!.itemId).toBe('item-1');
      expect(result!.startPosition).toEqual({ x: 100, y: 200 });
    });

    it('should reset state after ending', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      service.endDrag();

      expect(service.isDragging()).toBeFalse();
      expect(service.draggedItemId()).toBeNull();
    });
  });

  describe('cancelDrag', () => {
    it('should reset state without returning it', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      service.cancelDrag();

      expect(service.isDragging()).toBeFalse();
      expect(service.draggedItemId()).toBeNull();
    });

    it('should not throw when not dragging', () => {
      expect(() => service.cancelDrag()).not.toThrow();
    });
  });

  // ============================================================================
  // Update Mouse Position
  // ============================================================================

  describe('updateMousePosition', () => {
    it('should not update when not dragging', () => {
      service.updateMousePosition({ x: 200, y: 300 });
      expect(service.state().currentMousePosition).toBeNull();
    });

    it('should update current mouse position when dragging', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      service.updateMousePosition({ x: 200, y: 300 });

      expect(service.state().currentMousePosition).toEqual({ x: 200, y: 300 });
    });

    it('should clone position to prevent external mutation', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });

      const mousePos = { x: 200, y: 300 };
      service.updateMousePosition(mousePos);
      mousePos.x = 999;

      expect(service.state().currentMousePosition).toEqual({ x: 200, y: 300 });
    });
  });

  // ============================================================================
  // Calculate Drag Position
  // ============================================================================

  describe('calculateDragPosition', () => {
    beforeEach(() => {
      // Disable grid snapping for predictable tests
      stateService.setSnapToGrid(false);
    });

    it('should return null when not dragging', () => {
      const result = service.calculateDragPosition({ x: 200, y: 300 });
      expect(result).toBeNull();
    });

    it('should calculate new position based on mouse delta', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });

      // Mouse moved by (50, 100)
      const result = service.calculateDragPosition({ x: 200, y: 350 });

      expect(result).not.toBeNull();
      expect(result!.newPosition).toEqual({ x: 150, y: 300 }); // 100+50, 200+100
    });

    it('should calculate delta correctly', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.calculateDragPosition({ x: 200, y: 350 });

      expect(result!.delta).toEqual({ x: 50, y: 100 });
    });

    it('should report hasMoved false when position unchanged', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.calculateDragPosition({ x: 150, y: 250 }); // Same as start

      expect(result!.hasMoved).toBeFalse();
    });

    it('should report hasMoved true when position changed', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.calculateDragPosition({ x: 200, y: 350 });

      expect(result!.hasMoved).toBeTrue();
    });

    it('should handle negative movement', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.calculateDragPosition({ x: 100, y: 200 }); // Move back

      expect(result!.newPosition).toEqual({ x: 50, y: 150 });
      expect(result!.delta).toEqual({ x: -50, y: -50 });
    });

    describe('with grid snapping', () => {
      beforeEach(() => {
        stateService.setSnapToGrid(true);
        stateService.setGridSize(20);
      });

      it('should snap position to grid when snap enabled', () => {
        service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
        const result = service.calculateDragPosition({ x: 165, y: 265 }, true);

        // New pos would be 115, 215 -> snapped to 120, 220
        expect(result!.newPosition).toEqual({ x: 120, y: 220 });
      });

      it('should not snap when snap parameter is false', () => {
        service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
        const result = service.calculateDragPosition({ x: 165, y: 265 }, false);

        expect(result!.newPosition).toEqual({ x: 115, y: 215 });
      });
    });
  });

  // ============================================================================
  // Calculate Drag Delta
  // ============================================================================

  describe('calculateDragDelta', () => {
    it('should return null when not dragging', () => {
      const result = service.calculateDragDelta({ x: 200, y: 300 });
      expect(result).toBeNull();
    });

    it('should calculate delta from start mouse position', () => {
      service.startDrag('item-1', 'element', { x: 100, y: 200 }, { x: 150, y: 250 });
      const result = service.calculateDragDelta({ x: 200, y: 350 });

      expect(result).toEqual({ x: 50, y: 100 });
    });
  });

  // ============================================================================
  // Calculate Multi-Item Positions
  // ============================================================================

  describe('calculateMultiItemPositions', () => {
    beforeEach(() => {
      stateService.setSnapToGrid(false);
    });

    it('should return empty map when not dragging', () => {
      const items = [
        { id: 'a', position: { x: 10, y: 20 } },
        { id: 'b', position: { x: 30, y: 40 } }
      ];

      const result = service.calculateMultiItemPositions(items, { x: 200, y: 300 });
      expect(result.size).toBe(0);
    });

    it('should calculate new positions for all items', () => {
      service.startDrag('item-1', 'group', { x: 0, y: 0 }, { x: 100, y: 100 });

      const items = [
        { id: 'a', position: { x: 10, y: 20 } },
        { id: 'b', position: { x: 30, y: 40 } }
      ];

      // Mouse moved by (50, 60)
      const result = service.calculateMultiItemPositions(items, { x: 150, y: 160 });

      expect(result.get('a')).toEqual({ x: 60, y: 80 }); // 10+50, 20+60
      expect(result.get('b')).toEqual({ x: 80, y: 100 }); // 30+50, 40+60
    });

    it('should snap all positions when snap enabled', () => {
      stateService.setSnapToGrid(true);
      stateService.setGridSize(20);

      service.startDrag('item-1', 'group', { x: 0, y: 0 }, { x: 100, y: 100 });

      const items = [
        { id: 'a', position: { x: 10, y: 20 } },
        { id: 'b', position: { x: 30, y: 40 } }
      ];

      // Mouse moved by (55, 65)
      const result = service.calculateMultiItemPositions(items, { x: 155, y: 165 }, true);

      // a: 10+55=65 -> 60, 20+65=85 -> 80
      expect(result.get('a')).toEqual({ x: 60, y: 80 });
      // b: 30+55=85 -> 80, 40+65=105 -> 100
      expect(result.get('b')).toEqual({ x: 80, y: 100 });
    });
  });

  // ============================================================================
  // State Queries
  // ============================================================================

  describe('isDraggingItem', () => {
    it('should return false when not dragging', () => {
      expect(service.isDraggingItem('item-1')).toBeFalse();
    });

    it('should return true for the dragged item', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(service.isDraggingItem('item-1')).toBeTrue();
    });

    it('should return false for different item', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(service.isDraggingItem('item-2')).toBeFalse();
    });
  });

  describe('getCurrentDelta', () => {
    it('should return zero when not dragging', () => {
      expect(service.getCurrentDelta()).toEqual({ x: 0, y: 0 });
    });

    it('should return zero when current position not set', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 100, y: 100 });
      // currentMousePosition is set to startMousePosition initially
      expect(service.getCurrentDelta()).toEqual({ x: 0, y: 0 });
    });

    it('should return delta after mouse move', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 100, y: 100 });
      service.updateMousePosition({ x: 150, y: 180 });

      expect(service.getCurrentDelta()).toEqual({ x: 50, y: 80 });
    });
  });

  describe('getDragDistance', () => {
    it('should return 0 when not dragging', () => {
      expect(service.getDragDistance()).toBe(0);
    });

    it('should calculate distance correctly', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      service.updateMousePosition({ x: 3, y: 4 }); // 3-4-5 triangle

      expect(service.getDragDistance()).toBe(5);
    });
  });

  describe('hasMovedBeyondThreshold', () => {
    it('should return false when not dragging', () => {
      expect(service.hasMovedBeyondThreshold()).toBeFalse();
    });

    it('should return false for small movement', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      service.updateMousePosition({ x: 1, y: 1 }); // ~1.41 pixels

      expect(service.hasMovedBeyondThreshold(3)).toBeFalse();
    });

    it('should return true for movement beyond threshold', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      service.updateMousePosition({ x: 3, y: 4 }); // 5 pixels

      expect(service.hasMovedBeyondThreshold(3)).toBeTrue();
    });

    it('should use default threshold of 3', () => {
      service.startDrag('item-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
      service.updateMousePosition({ x: 2, y: 2 }); // ~2.83 pixels

      expect(service.hasMovedBeyondThreshold()).toBeFalse();

      service.updateMousePosition({ x: 3, y: 3 }); // ~4.24 pixels
      expect(service.hasMovedBeyondThreshold()).toBeTrue();
    });
  });

  // ============================================================================
  // Computed Signals
  // ============================================================================

  describe('computed signals', () => {
    describe('isDraggingGroup', () => {
      it('should be false for element', () => {
        service.startDrag('elem-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingGroup()).toBeFalse();
      });

      it('should be true for group', () => {
        service.startDrag('group-1', 'group', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingGroup()).toBeTrue();
      });

      it('should be false for primitive', () => {
        service.startDrag('prim-1', 'primitive', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingGroup()).toBeFalse();
      });
    });

    describe('isDraggingPrimitive', () => {
      it('should be false for element', () => {
        service.startDrag('elem-1', 'element', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingPrimitive()).toBeFalse();
      });

      it('should be true for primitive', () => {
        service.startDrag('prim-1', 'primitive', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingPrimitive()).toBeTrue();
      });

      it('should be true for group (groups are primitives)', () => {
        service.startDrag('group-1', 'group', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingPrimitive()).toBeTrue();
      });

      it('should be false for symbol', () => {
        service.startDrag('symbol-1', 'symbol', { x: 0, y: 0 }, { x: 0, y: 0 });
        expect(service.isDraggingPrimitive()).toBeFalse();
      });
    });
  });
});
