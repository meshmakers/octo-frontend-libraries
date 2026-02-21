import { Injectable, inject, signal, Signal, computed } from '@angular/core';
import { Position, Size } from '../../process-widget.models';
import { DesignerCoordinateService } from './designer-coordinate.service';

/**
 * Resize handle position type
 */
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

/**
 * Bounds rectangle
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Type of item being resized
 */
export type ResizeItemType = 'element' | 'primitive' | 'symbol' | 'group';

/**
 * Child item data for group resize
 */
export interface ResizeChildData {
  id: string;
  type: 'primitive' | 'symbol';
  startBounds: Bounds;
}

/**
 * Resize state for element/primitive resizing
 */
export interface ResizeState {
  /** Whether a resize operation is in progress */
  isResizing: boolean;
  /** ID of the item being resized */
  itemId: string | null;
  /** Type of item being resized */
  itemType: ResizeItemType | null;
  /** Which handle is being dragged */
  handle: ResizeHandle | null;
  /** Original size when resize started (for elements) */
  startSize: Size | null;
  /** Original position when resize started */
  startPosition: Position | null;
  /** Mouse position when resize started (in canvas coordinates) */
  startMousePosition: Position | null;
  /** Original bounds for primitives */
  startBounds: Bounds | null;
  /** Child data for group resize */
  groupChildData: ResizeChildData[] | null;
}

/**
 * Result of resize calculation
 */
export interface ResizeResult {
  /** New bounds after resize */
  bounds: Bounds;
  /** Scale factors */
  scale: { x: number; y: number };
  /** Whether bounds changed from start */
  hasChanged: boolean;
}

/**
 * Initial/empty resize state
 */
const INITIAL_RESIZE_STATE: ResizeState = {
  isResizing: false,
  itemId: null,
  itemType: null,
  handle: null,
  startSize: null,
  startPosition: null,
  startMousePosition: null,
  startBounds: null,
  groupChildData: null
};

/**
 * Designer Resize Service
 *
 * Manages the resize state for elements, primitives, and groups in the designer.
 * Provides helper methods for calculating new bounds during resize operations.
 *
 * Follows Single Responsibility Principle - only handles resize state and calculations.
 * Does NOT directly update the diagram - returns calculated bounds for the component to apply.
 *
 * Usage:
 * ```typescript
 * private readonly resizeService = inject(DesignerResizeService);
 *
 * // Start resize on handle mouse down
 * onResizeHandleMouseDown(event: MouseEvent, item: Item, handle: ResizeHandle) {
 *   const bounds = this.getItemBounds(item);
 *   this.resizeService.startResize(item.id, 'element', handle, bounds, canvasPos);
 * }
 *
 * // Update during mouse move
 * onMouseMove(event: MouseEvent) {
 *   if (!this.resizeService.isResizing()) return;
 *
 *   const canvasPos = this.coordService.getCanvasCoordinates(event);
 *   const result = this.resizeService.calculateResize(canvasPos, { snap: true, minSize: 20 });
 *   if (result) {
 *     this.updateItemBounds(this.resizeService.state().itemId, result.bounds);
 *   }
 * }
 *
 * // End resize on mouse up
 * onMouseUp() {
 *   if (this.resizeService.isResizing()) {
 *     this.resizeService.endResize();
 *     this.pushToHistory();
 *   }
 * }
 * ```
 */
@Injectable()
export class DesignerResizeService {

  private readonly coordService = inject(DesignerCoordinateService);

  // ============================================================================
  // Private State
  // ============================================================================

  private readonly _state = signal<ResizeState>({ ...INITIAL_RESIZE_STATE });

  // ============================================================================
  // Public Readonly Signals
  // ============================================================================

  /** Current resize state */
  readonly state: Signal<ResizeState> = this._state.asReadonly();

  /** Whether a resize operation is in progress */
  readonly isResizing = computed(() => this._state().isResizing);

  /** ID of the item being resized (or null) */
  readonly resizingItemId = computed(() => this._state().itemId);

  /** Type of item being resized */
  readonly resizingItemType = computed(() => this._state().itemType);

  /** Current resize handle */
  readonly activeHandle = computed(() => this._state().handle);

  /** Whether resizing a group */
  readonly isResizingGroup = computed(() => this._state().itemType === 'group');

  // ============================================================================
  // Resize Operations
  // ============================================================================

  /**
   * Start a resize operation for elements (with size and position).
   *
   * @param itemId ID of the item being resized
   * @param itemType Type of item
   * @param handle Which resize handle is being dragged
   * @param startSize Original size
   * @param startPosition Original position
   * @param startMousePosition Mouse position in canvas coordinates
   */
  startElementResize(
    itemId: string,
    itemType: ResizeItemType,
    handle: ResizeHandle,
    startSize: Size,
    startPosition: Position,
    startMousePosition: Position
  ): void {
    this._state.set({
      isResizing: true,
      itemId,
      itemType,
      handle,
      startSize: { ...startSize },
      startPosition: { ...startPosition },
      startMousePosition: { ...startMousePosition },
      startBounds: {
        x: startPosition.x,
        y: startPosition.y,
        width: startSize.width,
        height: startSize.height
      },
      groupChildData: null
    });
  }

  /**
   * Start a resize operation for primitives (with bounds).
   *
   * @param itemId ID of the primitive being resized
   * @param itemType Type (primitive or group)
   * @param handle Which resize handle is being dragged
   * @param startBounds Original bounds
   * @param startMousePosition Mouse position in canvas coordinates
   * @param groupChildData Optional child data for group resize
   */
  startPrimitiveResize(
    itemId: string,
    itemType: 'primitive' | 'group',
    handle: ResizeHandle,
    startBounds: Bounds,
    startMousePosition: Position,
    groupChildData?: ResizeChildData[]
  ): void {
    this._state.set({
      isResizing: true,
      itemId,
      itemType,
      handle,
      startSize: { width: startBounds.width, height: startBounds.height },
      startPosition: { x: startBounds.x, y: startBounds.y },
      startMousePosition: { ...startMousePosition },
      startBounds: { ...startBounds },
      groupChildData: groupChildData ? groupChildData.map(c => ({ ...c, startBounds: { ...c.startBounds } })) : null
    });
  }

  /**
   * End the current resize operation.
   * Returns the final resize state before resetting.
   *
   * @returns The resize state at the time of ending, or null if not resizing
   */
  endResize(): ResizeState | null {
    const state = this._state();
    if (!state.isResizing) return null;

    const finalState = { ...state };
    this._state.set({ ...INITIAL_RESIZE_STATE });
    return finalState;
  }

  /**
   * Cancel the current resize operation.
   */
  cancelResize(): void {
    this._state.set({ ...INITIAL_RESIZE_STATE });
  }

  // ============================================================================
  // Resize Calculations
  // ============================================================================

  /**
   * Calculate new bounds based on current mouse position.
   * Uses the bounds-based approach for corner and edge handles.
   *
   * @param currentMousePosition Current mouse position in canvas coordinates
   * @param options Resize options
   * @returns ResizeResult or null if not resizing
   */
  calculateResize(
    currentMousePosition: Position,
    options: {
      snap?: boolean;
      minSize?: number;
      maintainAspectRatio?: boolean;
    } = {}
  ): ResizeResult | null {
    const state = this._state();
    if (!state.isResizing || !state.startBounds || !state.handle || !state.startMousePosition) {
      return null;
    }

    const { snap = true, minSize = 10, maintainAspectRatio = false } = options;
    const startBounds = state.startBounds;

    let newBounds = this.calculateBoundsFromHandle(
      state.handle,
      startBounds,
      state.startMousePosition,
      currentMousePosition,
      minSize
    );

    // Maintain aspect ratio if requested
    if (maintainAspectRatio && startBounds.width > 0 && startBounds.height > 0) {
      newBounds = this.applyAspectRatio(newBounds, startBounds, state.handle);
    }

    // Snap to grid if enabled
    if (snap) {
      newBounds = this.snapBounds(newBounds);
    }

    // Calculate scale factors
    const scale = {
      x: startBounds.width > 0 ? newBounds.width / startBounds.width : 1,
      y: startBounds.height > 0 ? newBounds.height / startBounds.height : 1
    };

    const hasChanged =
      newBounds.x !== startBounds.x ||
      newBounds.y !== startBounds.y ||
      newBounds.width !== startBounds.width ||
      newBounds.height !== startBounds.height;

    return { bounds: newBounds, scale, hasChanged };
  }

  /**
   * Calculate bounds based on handle and mouse delta.
   * Uses delta-based calculation for more predictable behavior.
   */
  private calculateBoundsFromHandle(
    handle: ResizeHandle,
    startBounds: Bounds,
    startMousePos: Position,
    currentMousePos: Position,
    minSize: number
  ): Bounds {
    const deltaX = currentMousePos.x - startMousePos.x;
    const deltaY = currentMousePos.y - startMousePos.y;

    let { x, y, width, height } = startBounds;

    switch (handle) {
      case 'se':
        width = Math.max(minSize, startBounds.width + deltaX);
        height = Math.max(minSize, startBounds.height + deltaY);
        break;

      case 'sw':
        width = Math.max(minSize, startBounds.width - deltaX);
        height = Math.max(minSize, startBounds.height + deltaY);
        x = startBounds.x + startBounds.width - width;
        break;

      case 'ne':
        width = Math.max(minSize, startBounds.width + deltaX);
        height = Math.max(minSize, startBounds.height - deltaY);
        y = startBounds.y + startBounds.height - height;
        break;

      case 'nw':
        width = Math.max(minSize, startBounds.width - deltaX);
        height = Math.max(minSize, startBounds.height - deltaY);
        x = startBounds.x + startBounds.width - width;
        y = startBounds.y + startBounds.height - height;
        break;

      case 'n':
        height = Math.max(minSize, startBounds.height - deltaY);
        y = startBounds.y + startBounds.height - height;
        break;

      case 's':
        height = Math.max(minSize, startBounds.height + deltaY);
        break;

      case 'e':
        width = Math.max(minSize, startBounds.width + deltaX);
        break;

      case 'w':
        width = Math.max(minSize, startBounds.width - deltaX);
        x = startBounds.x + startBounds.width - width;
        break;
    }

    return { x, y, width, height };
  }

  /**
   * Apply aspect ratio constraint to bounds.
   */
  private applyAspectRatio(newBounds: Bounds, startBounds: Bounds, handle: ResizeHandle): Bounds {
    const aspectRatio = startBounds.width / startBounds.height;
    let { x, y, width, height } = newBounds;

    // Determine which dimension to constrain based on handle
    const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);
    const isHorizontal = ['e', 'w'].includes(handle);
    const isVertical = ['n', 's'].includes(handle);

    if (isCorner) {
      // For corners, use the larger scale
      const scaleW = width / startBounds.width;
      const scaleH = height / startBounds.height;
      const scale = Math.max(scaleW, scaleH);

      width = startBounds.width * scale;
      height = startBounds.height * scale;

      // Adjust position based on handle
      if (handle.includes('w')) {
        x = newBounds.x + newBounds.width - width;
      }
      if (handle.includes('n')) {
        y = newBounds.y + newBounds.height - height;
      }
    } else if (isHorizontal) {
      // Constrain height based on width
      height = width / aspectRatio;
      y = startBounds.y + (startBounds.height - height) / 2;
    } else if (isVertical) {
      // Constrain width based on height
      width = height * aspectRatio;
      x = startBounds.x + (startBounds.width - width) / 2;
    }

    return { x, y, width, height };
  }

  /**
   * Snap bounds to grid.
   */
  private snapBounds(bounds: Bounds): Bounds {
    const snappedPos = this.coordService.snapToGrid({ x: bounds.x, y: bounds.y });
    const snappedSize = this.coordService.snapToGrid({ x: bounds.width, y: bounds.height });

    return {
      x: snappedPos.x,
      y: snappedPos.y,
      width: Math.max(5, snappedSize.x), // Ensure minimum size
      height: Math.max(5, snappedSize.y)
    };
  }

  // ============================================================================
  // Group Child Calculations
  // ============================================================================

  /**
   * Calculate scaled positions for group children.
   * Returns a map of child ID to new bounds.
   *
   * @param newGroupBounds New bounds of the group
   * @returns Map of child ID to new bounds
   */
  calculateGroupChildBounds(newGroupBounds: Bounds): Map<string, Bounds> {
    const result = new Map<string, Bounds>();
    const state = this._state();

    if (!state.isResizing || !state.startBounds || !state.groupChildData) {
      return result;
    }

    const startBounds = state.startBounds;
    const scaleX = newGroupBounds.width / startBounds.width;
    const scaleY = newGroupBounds.height / startBounds.height;

    for (const child of state.groupChildData) {
      // Calculate relative position within the group
      const relX = child.startBounds.x - startBounds.x;
      const relY = child.startBounds.y - startBounds.y;

      // New position and size scaled within new group bounds
      const newChildBounds: Bounds = {
        x: newGroupBounds.x + relX * scaleX,
        y: newGroupBounds.y + relY * scaleY,
        width: child.startBounds.width * scaleX,
        height: child.startBounds.height * scaleY
      };

      result.set(child.id, newChildBounds);
    }

    return result;
  }

  /**
   * Get the scale factors for the current resize operation.
   *
   * @param currentBounds Current bounds being resized to
   * @returns Scale factors { x, y } or { x: 1, y: 1 } if not resizing
   */
  getScaleFactors(currentBounds: Bounds): { x: number; y: number } {
    const state = this._state();
    if (!state.isResizing || !state.startBounds) {
      return { x: 1, y: 1 };
    }

    return {
      x: state.startBounds.width > 0 ? currentBounds.width / state.startBounds.width : 1,
      y: state.startBounds.height > 0 ? currentBounds.height / state.startBounds.height : 1
    };
  }

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Check if a specific item is being resized.
   *
   * @param itemId ID to check
   * @returns True if this item is being resized
   */
  isResizingItem(itemId: string): boolean {
    const state = this._state();
    return state.isResizing && state.itemId === itemId;
  }

  /**
   * Get the current resize handle.
   */
  getHandle(): ResizeHandle | null {
    return this._state().handle;
  }

  /**
   * Check if the resize handle affects horizontal size.
   */
  isHorizontalResize(): boolean {
    const handle = this._state().handle;
    return handle !== null && ['e', 'w', 'ne', 'nw', 'se', 'sw'].includes(handle);
  }

  /**
   * Check if the resize handle affects vertical size.
   */
  isVerticalResize(): boolean {
    const handle = this._state().handle;
    return handle !== null && ['n', 's', 'ne', 'nw', 'se', 'sw'].includes(handle);
  }

  /**
   * Get cursor style for a resize handle.
   */
  static getCursorForHandle(handle: ResizeHandle): string {
    const cursors: Record<ResizeHandle, string> = {
      'nw': 'nwse-resize',
      'ne': 'nesw-resize',
      'sw': 'nesw-resize',
      'se': 'nwse-resize',
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize'
    };
    return cursors[handle];
  }
}
