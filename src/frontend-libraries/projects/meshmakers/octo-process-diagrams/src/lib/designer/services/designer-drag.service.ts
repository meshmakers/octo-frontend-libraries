import { Injectable, inject, signal, Signal, computed } from '@angular/core';
import { Position } from '../../process-widget.models';
import { DesignerCoordinateService } from './designer-coordinate.service';

/**
 * Type of item being dragged
 */
export type DragItemType = 'element' | 'primitive' | 'symbol' | 'group';

/**
 * Drag state for element/primitive manipulation
 */
export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** ID of the item being dragged */
  itemId: string | null;
  /** Type of item being dragged */
  itemType: DragItemType | null;
  /** Original position of the item when drag started */
  startPosition: Position | null;
  /** Mouse position when drag started (in canvas coordinates) */
  startMousePosition: Position | null;
  /** Current mouse position (in canvas coordinates) */
  currentMousePosition: Position | null;
}

/**
 * Result of drag position calculation
 */
export interface DragPositionResult {
  /** New position for the dragged item */
  newPosition: Position;
  /** Delta from start position */
  delta: Position;
  /** Whether position changed from start */
  hasMoved: boolean;
}

/**
 * Initial/empty drag state
 */
const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  itemId: null,
  itemType: null,
  startPosition: null,
  startMousePosition: null,
  currentMousePosition: null
};

/**
 * Designer Drag Service
 *
 * Manages the drag state for elements, primitives, and groups in the designer.
 * Provides helper methods for calculating new positions during drag operations.
 *
 * Follows Single Responsibility Principle - only handles drag state and position calculations.
 * Does NOT directly update the diagram - returns calculated positions for the component to apply.
 *
 * Usage:
 * ```typescript
 * private readonly dragService = inject(DesignerDragService);
 *
 * // Start drag on mouse down
 * onMouseDown(event: MouseEvent, item: Item) {
 *   const canvasPos = this.coordService.getCanvasCoordinates(event);
 *   this.dragService.startDrag(item.id, 'element', item.position, canvasPos);
 * }
 *
 * // Update during mouse move
 * onMouseMove(event: MouseEvent) {
 *   if (!this.dragService.isDragging()) return;
 *
 *   const canvasPos = this.coordService.getCanvasCoordinates(event);
 *   const result = this.dragService.calculateDragPosition(canvasPos, true);
 *   if (result) {
 *     this.updateItemPosition(this.dragService.state().itemId, result.newPosition);
 *   }
 * }
 *
 * // End drag on mouse up
 * onMouseUp() {
 *   if (this.dragService.isDragging()) {
 *     this.dragService.endDrag();
 *     this.pushToHistory();
 *   }
 * }
 * ```
 */
@Injectable()
export class DesignerDragService {

  private readonly coordService = inject(DesignerCoordinateService);

  // ============================================================================
  // Private State
  // ============================================================================

  private readonly _state = signal<DragState>({ ...INITIAL_DRAG_STATE });

  // ============================================================================
  // Public Readonly Signals
  // ============================================================================

  /** Current drag state */
  readonly state: Signal<DragState> = this._state.asReadonly();

  /** Whether a drag operation is in progress */
  readonly isDragging = computed(() => this._state().isDragging);

  /** ID of the item being dragged (or null) */
  readonly draggedItemId = computed(() => this._state().itemId);

  /** Type of item being dragged */
  readonly draggedItemType = computed(() => this._state().itemType);

  /** Whether dragging a group */
  readonly isDraggingGroup = computed(() => this._state().itemType === 'group');

  /** Whether dragging a primitive */
  readonly isDraggingPrimitive = computed(() =>
    this._state().itemType === 'primitive' || this._state().itemType === 'group'
  );

  // ============================================================================
  // Drag Operations
  // ============================================================================

  /**
   * Start a drag operation.
   *
   * @param itemId ID of the item being dragged
   * @param itemType Type of item (element, primitive, symbol, group)
   * @param startPosition Original position of the item
   * @param startMousePosition Mouse position in canvas coordinates
   */
  startDrag(
    itemId: string,
    itemType: DragItemType,
    startPosition: Position,
    startMousePosition: Position
  ): void {
    this._state.set({
      isDragging: true,
      itemId,
      itemType,
      startPosition: { ...startPosition },
      startMousePosition: { ...startMousePosition },
      currentMousePosition: { ...startMousePosition }
    });
  }

  /**
   * Update the current mouse position during drag.
   * Does not calculate new item position - use calculateDragPosition for that.
   *
   * @param currentMousePosition Current mouse position in canvas coordinates
   */
  updateMousePosition(currentMousePosition: Position): void {
    if (!this._state().isDragging) return;

    this._state.update(state => ({
      ...state,
      currentMousePosition: { ...currentMousePosition }
    }));
  }

  /**
   * End the current drag operation.
   * Returns the final drag state before resetting.
   *
   * @returns The drag state at the time of ending, or null if not dragging
   */
  endDrag(): DragState | null {
    const state = this._state();
    if (!state.isDragging) return null;

    const finalState = { ...state };
    this._state.set({ ...INITIAL_DRAG_STATE });
    return finalState;
  }

  /**
   * Cancel the current drag operation without returning the state.
   */
  cancelDrag(): void {
    this._state.set({ ...INITIAL_DRAG_STATE });
  }

  // ============================================================================
  // Position Calculations
  // ============================================================================

  /**
   * Calculate the new position for the dragged item.
   * Uses the start position + mouse delta approach for accurate positioning.
   *
   * @param currentMousePosition Current mouse position in canvas coordinates
   * @param snap Whether to snap to grid
   * @returns DragPositionResult or null if not dragging
   */
  calculateDragPosition(currentMousePosition: Position, snap = true): DragPositionResult | null {
    const state = this._state();
    if (!state.isDragging || !state.startPosition || !state.startMousePosition) {
      return null;
    }

    // Calculate delta from drag start
    const delta: Position = {
      x: currentMousePosition.x - state.startMousePosition.x,
      y: currentMousePosition.y - state.startMousePosition.y
    };

    // Calculate new position: original position + delta
    let newPosition: Position = {
      x: state.startPosition.x + delta.x,
      y: state.startPosition.y + delta.y
    };

    // Optionally snap to grid
    if (snap) {
      newPosition = this.coordService.snapToGrid(newPosition);
    }

    // Check if actually moved from start (after snapping)
    const hasMoved =
      newPosition.x !== state.startPosition.x ||
      newPosition.y !== state.startPosition.y;

    return { newPosition, delta, hasMoved };
  }

  /**
   * Calculate the current delta from drag start.
   * Useful for moving multiple items by the same offset.
   *
   * @param currentMousePosition Current mouse position in canvas coordinates
   * @returns Delta position or null if not dragging
   */
  calculateDragDelta(currentMousePosition: Position): Position | null {
    const state = this._state();
    if (!state.isDragging || !state.startMousePosition) {
      return null;
    }

    return {
      x: currentMousePosition.x - state.startMousePosition.x,
      y: currentMousePosition.y - state.startMousePosition.y
    };
  }

  /**
   * Calculate positions for multiple items moving together (e.g., group children).
   * Returns a map of item IDs to their new positions.
   *
   * @param items Array of items with id and position
   * @param currentMousePosition Current mouse position
   * @param snap Whether to snap positions to grid
   * @returns Map of item ID to new position
   */
  calculateMultiItemPositions<T extends { id: string; position: Position }>(
    items: T[],
    currentMousePosition: Position,
    snap = true
  ): Map<string, Position> {
    const result = new Map<string, Position>();
    const delta = this.calculateDragDelta(currentMousePosition);

    if (!delta) return result;

    for (const item of items) {
      let newPos: Position = {
        x: item.position.x + delta.x,
        y: item.position.y + delta.y
      };

      if (snap) {
        newPos = this.coordService.snapToGrid(newPos);
      }

      result.set(item.id, newPos);
    }

    return result;
  }

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Check if a specific item is being dragged.
   *
   * @param itemId ID to check
   * @returns True if this item is being dragged
   */
  isDraggingItem(itemId: string): boolean {
    const state = this._state();
    return state.isDragging && state.itemId === itemId;
  }

  /**
   * Get the current drag delta from start position.
   * Returns { x: 0, y: 0 } if not dragging.
   */
  getCurrentDelta(): Position {
    const state = this._state();
    if (!state.isDragging || !state.startMousePosition || !state.currentMousePosition) {
      return { x: 0, y: 0 };
    }

    return {
      x: state.currentMousePosition.x - state.startMousePosition.x,
      y: state.currentMousePosition.y - state.startMousePosition.y
    };
  }

  /**
   * Get the distance dragged from start position.
   */
  getDragDistance(): number {
    const delta = this.getCurrentDelta();
    return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
  }

  /**
   * Check if the drag has moved beyond a minimum threshold.
   * Useful for distinguishing clicks from drags.
   *
   * @param threshold Minimum distance in pixels (default: 3)
   */
  hasMovedBeyondThreshold(threshold = 3): boolean {
    return this.getDragDistance() > threshold;
  }
}
