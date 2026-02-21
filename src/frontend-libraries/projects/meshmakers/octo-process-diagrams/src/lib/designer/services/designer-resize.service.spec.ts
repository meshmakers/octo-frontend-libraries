import { TestBed } from '@angular/core/testing';
import { DesignerResizeService, ResizeHandle, Bounds, ResizeChildData } from './designer-resize.service';
import { DesignerCoordinateService } from './designer-coordinate.service';
import { DesignerStateService } from './designer-state.service';

describe('DesignerResizeService', () => {
  let service: DesignerResizeService;
  let stateService: DesignerStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DesignerResizeService,
        DesignerCoordinateService,
        DesignerStateService
      ]
    });

    service = TestBed.inject(DesignerResizeService);
    stateService = TestBed.inject(DesignerStateService);

    // Disable grid snapping for predictable tests
    stateService.setSnapToGrid(false);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('initial state', () => {
    it('should start with isResizing false', () => {
      expect(service.isResizing()).toBeFalse();
    });

    it('should have null resizingItemId', () => {
      expect(service.resizingItemId()).toBeNull();
    });

    it('should have null activeHandle', () => {
      expect(service.activeHandle()).toBeNull();
    });

    it('should have initial state with null values', () => {
      const state = service.state();
      expect(state.isResizing).toBeFalse();
      expect(state.itemId).toBeNull();
      expect(state.itemType).toBeNull();
      expect(state.handle).toBeNull();
      expect(state.startBounds).toBeNull();
    });
  });

  // ============================================================================
  // Start Element Resize
  // ============================================================================

  describe('startElementResize', () => {
    it('should set isResizing to true', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      expect(service.isResizing()).toBeTrue();
    });

    it('should store item ID and type', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      expect(service.resizingItemId()).toBe('elem-1');
      expect(service.resizingItemType()).toBe('element');
    });

    it('should store handle', () => {
      service.startElementResize(
        'elem-1', 'element', 'nw',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 50, y: 50 }
      );
      expect(service.activeHandle()).toBe('nw');
    });

    it('should compute start bounds from size and position', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      expect(service.state().startBounds).toEqual({ x: 50, y: 50, width: 100, height: 80 });
    });

    it('should clone values to prevent external mutation', () => {
      const size = { width: 100, height: 80 };
      const position = { x: 50, y: 50 };

      service.startElementResize('elem-1', 'element', 'se', size, position, { x: 150, y: 130 });

      size.width = 999;
      position.x = 888;

      expect(service.state().startSize).toEqual({ width: 100, height: 80 });
      expect(service.state().startPosition).toEqual({ x: 50, y: 50 });
    });
  });

  // ============================================================================
  // Start Primitive Resize
  // ============================================================================

  describe('startPrimitiveResize', () => {
    it('should set isResizing to true', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 }
      );
      expect(service.isResizing()).toBeTrue();
    });

    it('should store bounds', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 }
      );
      expect(service.state().startBounds).toEqual({ x: 50, y: 50, width: 100, height: 80 });
    });

    it('should store group child data', () => {
      const childData: ResizeChildData[] = [
        { id: 'child-1', type: 'primitive', startBounds: { x: 60, y: 60, width: 30, height: 30 } },
        { id: 'child-2', type: 'symbol', startBounds: { x: 100, y: 60, width: 40, height: 40 } }
      ];

      service.startPrimitiveResize(
        'group-1', 'group', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 },
        childData
      );

      expect(service.state().groupChildData).toHaveSize(2);
      expect(service.state().groupChildData![0].id).toBe('child-1');
      expect(service.isResizingGroup()).toBeTrue();
    });
  });

  // ============================================================================
  // End Resize
  // ============================================================================

  describe('endResize', () => {
    it('should return null when not resizing', () => {
      const result = service.endResize();
      expect(result).toBeNull();
    });

    it('should return final state when resizing', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      const result = service.endResize();

      expect(result).not.toBeNull();
      expect(result!.itemId).toBe('elem-1');
      expect(result!.handle).toBe('se');
    });

    it('should reset state after ending', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      service.endResize();

      expect(service.isResizing()).toBeFalse();
      expect(service.resizingItemId()).toBeNull();
    });
  });

  describe('cancelResize', () => {
    it('should reset state', () => {
      service.startElementResize(
        'elem-1', 'element', 'se',
        { width: 100, height: 80 },
        { x: 50, y: 50 },
        { x: 150, y: 130 }
      );
      service.cancelResize();

      expect(service.isResizing()).toBeFalse();
      expect(service.resizingItemId()).toBeNull();
    });
  });

  // ============================================================================
  // Calculate Resize - SE Handle
  // ============================================================================

  describe('calculateResize - SE handle', () => {
    beforeEach(() => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 } // Mouse at bottom-right corner
      );
    });

    it('should return null when not resizing', () => {
      service.endResize();
      const result = service.calculateResize({ x: 200, y: 180 }, { snap: false });
      expect(result).toBeNull();
    });

    it('should increase size when dragging outward', () => {
      // Mouse moved +50, +50
      const result = service.calculateResize({ x: 200, y: 180 }, { snap: false });

      expect(result).not.toBeNull();
      expect(result!.bounds.width).toBe(150); // 100 + 50
      expect(result!.bounds.height).toBe(130); // 80 + 50
      expect(result!.bounds.x).toBe(50); // Unchanged
      expect(result!.bounds.y).toBe(50); // Unchanged
    });

    it('should decrease size when dragging inward', () => {
      // Mouse moved -30, -30
      const result = service.calculateResize({ x: 120, y: 100 }, { snap: false });

      expect(result!.bounds.width).toBe(70); // 100 - 30
      expect(result!.bounds.height).toBe(50); // 80 - 30
    });

    it('should respect minimum size', () => {
      // Mouse moved way inward
      const result = service.calculateResize({ x: 60, y: 60 }, { snap: false, minSize: 20 });

      expect(result!.bounds.width).toBe(20); // Clamped to minSize
      expect(result!.bounds.height).toBe(20);
    });

    it('should report hasChanged correctly', () => {
      const unchanged = service.calculateResize({ x: 150, y: 130 }, { snap: false });
      expect(unchanged!.hasChanged).toBeFalse();

      const changed = service.calculateResize({ x: 200, y: 180 }, { snap: false });
      expect(changed!.hasChanged).toBeTrue();
    });
  });

  // ============================================================================
  // Calculate Resize - NW Handle
  // ============================================================================

  describe('calculateResize - NW handle', () => {
    beforeEach(() => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'nw',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 50, y: 50 } // Mouse at top-left corner
      );
    });

    it('should move position when resizing from NW', () => {
      // Mouse moved -20, -20 (outward from corner)
      const result = service.calculateResize({ x: 30, y: 30 }, { snap: false });

      expect(result!.bounds.x).toBe(30); // Moved left
      expect(result!.bounds.y).toBe(30); // Moved up
      expect(result!.bounds.width).toBe(120); // 100 + 20
      expect(result!.bounds.height).toBe(100); // 80 + 20
    });

    it('should shrink from top-left corner', () => {
      // Mouse moved +30, +30 (inward)
      const result = service.calculateResize({ x: 80, y: 80 }, { snap: false });

      expect(result!.bounds.x).toBe(80);
      expect(result!.bounds.y).toBe(80);
      expect(result!.bounds.width).toBe(70); // 100 - 30
      expect(result!.bounds.height).toBe(50); // 80 - 30
    });
  });

  // ============================================================================
  // Calculate Resize - NE Handle
  // ============================================================================

  describe('calculateResize - NE handle', () => {
    beforeEach(() => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'ne',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 50 } // Mouse at top-right corner
      );
    });

    it('should expand from NE corner', () => {
      // Mouse moved +30, -20
      const result = service.calculateResize({ x: 180, y: 30 }, { snap: false });

      expect(result!.bounds.x).toBe(50); // X unchanged
      expect(result!.bounds.y).toBe(30); // Y moved up
      expect(result!.bounds.width).toBe(130); // 100 + 30
      expect(result!.bounds.height).toBe(100); // 80 + 20
    });
  });

  // ============================================================================
  // Calculate Resize - SW Handle
  // ============================================================================

  describe('calculateResize - SW handle', () => {
    beforeEach(() => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'sw',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 50, y: 130 } // Mouse at bottom-left corner
      );
    });

    it('should expand from SW corner', () => {
      // Mouse moved -20, +30
      const result = service.calculateResize({ x: 30, y: 160 }, { snap: false });

      expect(result!.bounds.x).toBe(30); // X moved left
      expect(result!.bounds.y).toBe(50); // Y unchanged
      expect(result!.bounds.width).toBe(120); // 100 + 20
      expect(result!.bounds.height).toBe(110); // 80 + 30
    });
  });

  // ============================================================================
  // Calculate Resize - Edge Handles
  // ============================================================================

  describe('calculateResize - edge handles', () => {
    it('should resize only horizontally for E handle', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'e',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 90 }
      );

      const result = service.calculateResize({ x: 200, y: 100 }, { snap: false });

      expect(result!.bounds.width).toBe(150); // +50
      expect(result!.bounds.height).toBe(80); // Unchanged
      expect(result!.bounds.x).toBe(50);
      expect(result!.bounds.y).toBe(50);
    });

    it('should resize only horizontally for W handle', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'w',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 50, y: 90 }
      );

      const result = service.calculateResize({ x: 30, y: 90 }, { snap: false });

      expect(result!.bounds.width).toBe(120); // +20
      expect(result!.bounds.height).toBe(80); // Unchanged
      expect(result!.bounds.x).toBe(30); // Moved
      expect(result!.bounds.y).toBe(50);
    });

    it('should resize only vertically for N handle', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'n',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 100, y: 50 }
      );

      const result = service.calculateResize({ x: 100, y: 20 }, { snap: false });

      expect(result!.bounds.width).toBe(100); // Unchanged
      expect(result!.bounds.height).toBe(110); // +30
      expect(result!.bounds.x).toBe(50);
      expect(result!.bounds.y).toBe(20); // Moved
    });

    it('should resize only vertically for S handle', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 's',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 100, y: 130 }
      );

      const result = service.calculateResize({ x: 100, y: 180 }, { snap: false });

      expect(result!.bounds.width).toBe(100); // Unchanged
      expect(result!.bounds.height).toBe(130); // +50
      expect(result!.bounds.x).toBe(50);
      expect(result!.bounds.y).toBe(50); // Unchanged
    });
  });

  // ============================================================================
  // Grid Snapping
  // ============================================================================

  describe('grid snapping', () => {
    beforeEach(() => {
      stateService.setSnapToGrid(true);
      stateService.setGridSize(20);

      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 40, y: 40, width: 100, height: 80 },
        { x: 140, y: 120 }
      );
    });

    it('should snap bounds to grid when enabled', () => {
      // Move to position that isn't on grid
      const result = service.calculateResize({ x: 155, y: 135 }, { snap: true });

      // Values should be snapped to grid
      expect(result!.bounds.x % 20).toBe(0);
      expect(result!.bounds.y % 20).toBe(0);
      expect(result!.bounds.width % 20).toBe(0);
      expect(result!.bounds.height % 20).toBe(0);
    });

    it('should not snap when disabled', () => {
      const result = service.calculateResize({ x: 155, y: 135 }, { snap: false });

      expect(result!.bounds.width).toBe(115); // 100 + 15, not snapped
      expect(result!.bounds.height).toBe(95); // 80 + 15, not snapped
    });
  });

  // ============================================================================
  // Scale Factors
  // ============================================================================

  describe('scale factors', () => {
    beforeEach(() => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 }
      );
    });

    it('should calculate scale factors', () => {
      const result = service.calculateResize({ x: 200, y: 180 }, { snap: false });

      expect(result!.scale.x).toBe(1.5); // 150/100
      expect(result!.scale.y).toBeCloseTo(1.625, 3); // 130/80
    });

    it('should return 1 for unchanged dimensions', () => {
      const result = service.calculateResize({ x: 150, y: 130 }, { snap: false });

      expect(result!.scale.x).toBe(1);
      expect(result!.scale.y).toBe(1);
    });

    it('should calculate via getScaleFactors', () => {
      const scale = service.getScaleFactors({ x: 50, y: 50, width: 200, height: 160 });

      expect(scale.x).toBe(2); // 200/100
      expect(scale.y).toBe(2); // 160/80
    });
  });

  // ============================================================================
  // Group Child Calculations
  // ============================================================================

  describe('calculateGroupChildBounds', () => {
    beforeEach(() => {
      const childData: ResizeChildData[] = [
        { id: 'child-1', type: 'primitive', startBounds: { x: 60, y: 60, width: 40, height: 30 } },
        { id: 'child-2', type: 'symbol', startBounds: { x: 110, y: 70, width: 30, height: 20 } }
      ];

      service.startPrimitiveResize(
        'group-1', 'group', 'se',
        { x: 50, y: 50, width: 100, height: 80 },
        { x: 150, y: 130 },
        childData
      );
    });

    it('should return empty map when not resizing', () => {
      service.endResize();
      const result = service.calculateGroupChildBounds({ x: 50, y: 50, width: 200, height: 160 });
      expect(result.size).toBe(0);
    });

    it('should calculate scaled positions for children', () => {
      // Scale group by 2x
      const newGroupBounds: Bounds = { x: 50, y: 50, width: 200, height: 160 };
      const result = service.calculateGroupChildBounds(newGroupBounds);

      expect(result.size).toBe(2);

      // child-1: was at (60, 60), relative to group (10, 10)
      // New position: (50 + 10*2, 50 + 10*2) = (70, 70)
      // New size: (40*2, 30*2) = (80, 60)
      const child1 = result.get('child-1')!;
      expect(child1.x).toBe(70);
      expect(child1.y).toBe(70);
      expect(child1.width).toBe(80);
      expect(child1.height).toBe(60);

      // child-2: was at (110, 70), relative to group (60, 20)
      // New position: (50 + 60*2, 50 + 20*2) = (170, 90)
      // New size: (30*2, 20*2) = (60, 40)
      const child2 = result.get('child-2')!;
      expect(child2.x).toBe(170);
      expect(child2.y).toBe(90);
      expect(child2.width).toBe(60);
      expect(child2.height).toBe(40);
    });

    it('should handle non-uniform scaling', () => {
      // Scale: 1.5x horizontal, 2x vertical
      const newGroupBounds: Bounds = { x: 50, y: 50, width: 150, height: 160 };
      const result = service.calculateGroupChildBounds(newGroupBounds);

      const child1 = result.get('child-1')!;
      // Relative (10, 10) -> (10*1.5, 10*2) = (15, 20) -> (65, 70)
      expect(child1.x).toBe(65);
      expect(child1.y).toBe(70);
      // Size: (40*1.5, 30*2) = (60, 60)
      expect(child1.width).toBe(60);
      expect(child1.height).toBe(60);
    });
  });

  // ============================================================================
  // State Queries
  // ============================================================================

  describe('isResizingItem', () => {
    it('should return false when not resizing', () => {
      expect(service.isResizingItem('item-1')).toBeFalse();
    });

    it('should return true for the resized item', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 100 }
      );
      expect(service.isResizingItem('prim-1')).toBeTrue();
    });

    it('should return false for different item', () => {
      service.startPrimitiveResize(
        'prim-1', 'primitive', 'se',
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 100 }
      );
      expect(service.isResizingItem('prim-2')).toBeFalse();
    });
  });

  describe('isHorizontalResize', () => {
    it('should return true for horizontal handles', () => {
      const horizontalHandles: ResizeHandle[] = ['e', 'w', 'ne', 'nw', 'se', 'sw'];

      for (const handle of horizontalHandles) {
        service.startPrimitiveResize('p', 'primitive', handle, { x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0 });
        expect(service.isHorizontalResize()).toBeTrue();
        service.endResize();
      }
    });

    it('should return false for vertical-only handles', () => {
      const verticalHandles: ResizeHandle[] = ['n', 's'];

      for (const handle of verticalHandles) {
        service.startPrimitiveResize('p', 'primitive', handle, { x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0 });
        expect(service.isHorizontalResize()).toBeFalse();
        service.endResize();
      }
    });
  });

  describe('isVerticalResize', () => {
    it('should return true for vertical handles', () => {
      const verticalHandles: ResizeHandle[] = ['n', 's', 'ne', 'nw', 'se', 'sw'];

      for (const handle of verticalHandles) {
        service.startPrimitiveResize('p', 'primitive', handle, { x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0 });
        expect(service.isVerticalResize()).toBeTrue();
        service.endResize();
      }
    });

    it('should return false for horizontal-only handles', () => {
      const horizontalHandles: ResizeHandle[] = ['e', 'w'];

      for (const handle of horizontalHandles) {
        service.startPrimitiveResize('p', 'primitive', handle, { x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0 });
        expect(service.isVerticalResize()).toBeFalse();
        service.endResize();
      }
    });
  });

  // ============================================================================
  // Static Methods
  // ============================================================================

  describe('getCursorForHandle', () => {
    it('should return correct cursor for each handle', () => {
      expect(DesignerResizeService.getCursorForHandle('nw')).toBe('nwse-resize');
      expect(DesignerResizeService.getCursorForHandle('se')).toBe('nwse-resize');
      expect(DesignerResizeService.getCursorForHandle('ne')).toBe('nesw-resize');
      expect(DesignerResizeService.getCursorForHandle('sw')).toBe('nesw-resize');
      expect(DesignerResizeService.getCursorForHandle('n')).toBe('ns-resize');
      expect(DesignerResizeService.getCursorForHandle('s')).toBe('ns-resize');
      expect(DesignerResizeService.getCursorForHandle('e')).toBe('ew-resize');
      expect(DesignerResizeService.getCursorForHandle('w')).toBe('ew-resize');
    });
  });
});
