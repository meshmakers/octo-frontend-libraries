import { Injectable, inject } from '@angular/core';
import { Position } from '../../process-widget.models';
import { DesignerStateService } from './designer-state.service';

/**
 * Designer Coordinate Service
 *
 * Handles coordinate transformations between screen/client coordinates
 * and canvas/SVG coordinates. Accounts for:
 * - SVG viewBox transformations
 * - Zoom level
 * - Pan offset
 * - Grid snapping
 *
 * Follows Single Responsibility Principle - only handles coordinate math.
 *
 * Usage:
 * ```typescript
 * private readonly coordService = inject(DesignerCoordinateService);
 *
 * // Set SVG reference once (in component's ngAfterViewInit)
 * this.coordService.setSvgElement(svgElement);
 *
 * // Convert event coordinates to canvas
 * const canvasPos = this.coordService.getCanvasCoordinates(mouseEvent);
 *
 * // Snap position to grid
 * const snapped = this.coordService.snapToGrid(position);
 * ```
 */
@Injectable()
export class DesignerCoordinateService {

  private readonly stateService = inject(DesignerStateService);

  // Reference to the SVG element for coordinate transformations
  private _svgElement: SVGSVGElement | null = null;

  // Cached CTM for performance (invalidated when SVG changes)
  private _cachedCtmInverse: DOMMatrix | null = null;

  // ============================================================================
  // SVG Element Management
  // ============================================================================

  /**
   * Set the SVG element reference for coordinate transformations.
   * Must be called after the SVG is rendered (e.g., in ngAfterViewInit).
   */
  setSvgElement(svg: SVGSVGElement | null): void {
    this._svgElement = svg;
    this._cachedCtmInverse = null; // Invalidate cache
  }

  /**
   * Get the current SVG element reference
   */
  getSvgElement(): SVGSVGElement | null {
    return this._svgElement;
  }

  /**
   * Check if SVG element is available
   */
  hasSvgElement(): boolean {
    return this._svgElement !== null;
  }

  /**
   * Invalidate the cached CTM (call when canvas transforms change)
   */
  invalidateCache(): void {
    this._cachedCtmInverse = null;
  }

  // ============================================================================
  // Coordinate Transformations
  // ============================================================================

  /**
   * Convert client/screen coordinates to SVG canvas coordinates.
   * Uses SVG's built-in coordinate transformation to handle viewBox scaling.
   *
   * @param event Object with clientX and clientY properties (MouseEvent, DragEvent, etc.)
   * @returns Canvas position or null if SVG element is not available
   */
  getCanvasCoordinates(event: { clientX: number; clientY: number }): Position | null {
    if (!this._svgElement) return null;

    // Use SVG's coordinate transformation (handles viewBox scaling correctly)
    const point = this._svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const ctm = this._svgElement.getScreenCTM();
    if (!ctm) return null;

    const svgPoint = point.matrixTransform(ctm.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  }

  /**
   * Convert screen coordinates to canvas coordinates.
   * Alternative method that takes separate x, y values.
   *
   * @param screenX Screen X coordinate
   * @param screenY Screen Y coordinate
   * @returns Canvas position or null if SVG element is not available
   */
  screenToCanvas(screenX: number, screenY: number): Position | null {
    return this.getCanvasCoordinates({ clientX: screenX, clientY: screenY });
  }

  /**
   * Convert canvas coordinates to screen coordinates.
   *
   * @param canvasPos Canvas position
   * @returns Screen position or null if SVG element is not available
   */
  canvasToScreen(canvasPos: Position): Position | null {
    if (!this._svgElement) return null;

    const point = this._svgElement.createSVGPoint();
    point.x = canvasPos.x;
    point.y = canvasPos.y;

    const ctm = this._svgElement.getScreenCTM();
    if (!ctm) return null;

    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  }

  // ============================================================================
  // Grid Snapping
  // ============================================================================

  /**
   * Snap a position to the grid if snap is enabled in state service.
   * Delegates to DesignerStateService for the actual snapping logic.
   *
   * @param position The position to snap
   * @returns Snapped position (or original if snap is disabled)
   */
  snapToGrid(position: Position): Position {
    return this.stateService.snapPosition(position);
  }

  /**
   * Snap a position to a specific grid size, regardless of state settings.
   *
   * @param position The position to snap
   * @param gridSize The grid size to snap to
   * @returns Snapped position
   */
  snapToGridSize(position: Position, gridSize: number): Position {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get canvas coordinates and snap to grid in one call.
   * Convenience method for drag operations.
   *
   * @param event Object with clientX and clientY
   * @returns Snapped canvas position or null if SVG is not available
   */
  getSnappedCanvasCoordinates(event: { clientX: number; clientY: number }): Position | null {
    const pos = this.getCanvasCoordinates(event);
    if (!pos) return null;
    return this.snapToGrid(pos);
  }

  /**
   * Calculate the distance between two positions.
   *
   * @param pos1 First position
   * @param pos2 Second position
   * @returns Distance in pixels
   */
  distance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate the delta (difference) between two positions.
   *
   * @param from Starting position
   * @param to Ending position
   * @returns Delta position { x: to.x - from.x, y: to.y - from.y }
   */
  delta(from: Position, to: Position): Position {
    return {
      x: to.x - from.x,
      y: to.y - from.y
    };
  }

  /**
   * Add two positions together.
   *
   * @param pos1 First position
   * @param pos2 Second position (or delta)
   * @returns Sum position
   */
  add(pos1: Position, pos2: Position): Position {
    return {
      x: pos1.x + pos2.x,
      y: pos1.y + pos2.y
    };
  }

  /**
   * Subtract pos2 from pos1.
   *
   * @param pos1 Position to subtract from
   * @param pos2 Position to subtract
   * @returns Difference position
   */
  subtract(pos1: Position, pos2: Position): Position {
    return {
      x: pos1.x - pos2.x,
      y: pos1.y - pos2.y
    };
  }

  /**
   * Scale a position by a factor.
   *
   * @param pos Position to scale
   * @param factor Scale factor
   * @returns Scaled position
   */
  scale(pos: Position, factor: number): Position {
    return {
      x: pos.x * factor,
      y: pos.y * factor
    };
  }

  /**
   * Check if a position is within a bounding box.
   *
   * @param pos Position to check
   * @param bounds Bounding box { x, y, width, height }
   * @returns True if position is inside bounds
   */
  isInsideBounds(pos: Position, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return (
      pos.x >= bounds.x &&
      pos.x <= bounds.x + bounds.width &&
      pos.y >= bounds.y &&
      pos.y <= bounds.y + bounds.height
    );
  }

  /**
   * Clamp a position to stay within bounds.
   *
   * @param pos Position to clamp
   * @param bounds Bounding box
   * @returns Clamped position
   */
  clampToBounds(pos: Position, bounds: { x: number; y: number; width: number; height: number }): Position {
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, pos.x)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, pos.y))
    };
  }

  /**
   * Get the center point of a bounding box.
   *
   * @param bounds Bounding box
   * @returns Center position
   */
  getBoundsCenter(bounds: { x: number; y: number; width: number; height: number }): Position {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }
}
