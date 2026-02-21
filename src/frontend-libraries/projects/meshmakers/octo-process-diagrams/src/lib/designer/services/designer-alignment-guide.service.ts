import { Injectable, signal, Signal } from '@angular/core';

/**
 * Represents an alignment guide line to be rendered
 */
export interface AlignmentGuide {
  /** Direction of the guide line */
  type: 'horizontal' | 'vertical';
  /** Y coordinate for horizontal, X coordinate for vertical */
  position: number;
  /** Start coordinate of the guide line */
  start: number;
  /** End coordinate of the guide line */
  end: number;
  /** Type of alignment (edge or center) */
  alignmentType: 'edge' | 'center';
}

/**
 * Result of alignment calculation including guides and snap positions
 */
export interface AlignmentGuideState {
  /** Active guide lines to render */
  guides: AlignmentGuide[];
  /** Suggested X position for snapping (null if no X alignment) */
  snapX: number | null;
  /** Suggested Y position for snapping (null if no Y alignment) */
  snapY: number | null;
}

/**
 * Bounds of an item for alignment calculations
 */
export interface ItemBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Internal structure for tracking alignment matches
 */
interface AlignmentMatch {
  type: 'horizontal' | 'vertical';
  position: number;
  snapOffset: number;
  alignmentType: 'edge' | 'center';
  otherBounds: ItemBounds;
  /** Spatial distance to the dragged item (perpendicular to alignment axis) */
  spatialDistance: number;
}

/**
 * Designer Alignment Guide Service
 *
 * Detects alignment opportunities between dragged items and other items,
 * providing visual guides and snap positions.
 *
 * Features:
 * - Edge alignment detection (left, right, top, bottom)
 * - Center alignment detection (horizontal and vertical centers)
 * - Snap position calculation
 * - Visual guide line generation
 *
 * Usage:
 * ```typescript
 * // During drag
 * const guideState = alignmentGuideService.calculateGuides(
 *   draggedBounds,
 *   otherBounds,
 *   canvasBounds
 * );
 *
 * // Apply snap
 * if (guideState.snapX !== null) position.x += guideState.snapX - position.x;
 * if (guideState.snapY !== null) position.y += guideState.snapY - position.y;
 *
 * // On drag end
 * alignmentGuideService.clearGuides();
 * ```
 */
@Injectable()
export class DesignerAlignmentGuideService {
  /** Threshold in canvas pixels for alignment detection */
  private readonly ALIGNMENT_THRESHOLD = 5;

  /** Padding to extend guide lines beyond the items */
  private readonly GUIDE_PADDING = 10;

  // Private state
  private readonly _guides = signal<AlignmentGuide[]>([]);

  // Public readonly signal
  readonly guides: Signal<AlignmentGuide[]> = this._guides.asReadonly();

  /**
   * Calculate alignment guides for a dragged item against other items.
   * Returns guide lines to render and snap positions to apply.
   *
   * @param draggedBounds - Bounds of the item being dragged
   * @param otherBounds - Array of bounds for other items to align against
   * @param canvasBounds - Canvas dimensions for guide line extent limiting
   * @returns AlignmentGuideState with guides and snap positions
   */
  calculateGuides(
    draggedBounds: ItemBounds,
    otherBounds: ItemBounds[],
    canvasBounds: { width: number; height: number }
  ): AlignmentGuideState {
    if (otherBounds.length === 0) {
      this._guides.set([]);
      return { guides: [], snapX: null, snapY: null };
    }

    // Extract key positions from dragged item
    const draggedLeft = draggedBounds.x;
    const draggedRight = draggedBounds.x + draggedBounds.width;
    const draggedTop = draggedBounds.y;
    const draggedBottom = draggedBounds.y + draggedBounds.height;
    const draggedCenterX = draggedBounds.x + draggedBounds.width / 2;
    const draggedCenterY = draggedBounds.y + draggedBounds.height / 2;

    const horizontalMatches: AlignmentMatch[] = [];
    const verticalMatches: AlignmentMatch[] = [];

    // Check each other item for alignment opportunities
    for (const other of otherBounds) {
      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterX = other.x + other.width / 2;
      const otherCenterY = other.y + other.height / 2;

      // Vertical alignments (X positions)
      // Left edge alignments
      this.checkAlignment(draggedLeft, otherLeft, 'vertical', 'edge', other, verticalMatches, draggedBounds);
      this.checkAlignment(draggedLeft, otherRight, 'vertical', 'edge', other, verticalMatches, draggedBounds);
      // Right edge alignments
      this.checkAlignment(draggedRight, otherLeft, 'vertical', 'edge', other, verticalMatches, draggedBounds);
      this.checkAlignment(draggedRight, otherRight, 'vertical', 'edge', other, verticalMatches, draggedBounds);
      // Center X alignment
      this.checkAlignment(draggedCenterX, otherCenterX, 'vertical', 'center', other, verticalMatches, draggedBounds);

      // Horizontal alignments (Y positions)
      // Top edge alignments
      this.checkAlignment(draggedTop, otherTop, 'horizontal', 'edge', other, horizontalMatches, draggedBounds);
      this.checkAlignment(draggedTop, otherBottom, 'horizontal', 'edge', other, horizontalMatches, draggedBounds);
      // Bottom edge alignments
      this.checkAlignment(draggedBottom, otherTop, 'horizontal', 'edge', other, horizontalMatches, draggedBounds);
      this.checkAlignment(draggedBottom, otherBottom, 'horizontal', 'edge', other, horizontalMatches, draggedBounds);
      // Center Y alignment
      this.checkAlignment(draggedCenterY, otherCenterY, 'horizontal', 'center', other, horizontalMatches, draggedBounds);
    }

    // Find best alignment for each axis (prefer center, then closest)
    const bestVertical = this.findBestMatch(verticalMatches);
    const bestHorizontal = this.findBestMatch(horizontalMatches);

    // Build guides from best matches
    const guides: AlignmentGuide[] = [];
    let snapX: number | null = null;
    let snapY: number | null = null;

    if (bestVertical) {
      const guide = this.createVerticalGuide(bestVertical, draggedBounds, canvasBounds);
      guides.push(guide);
      // Calculate snap: adjust dragged position so the aligned edge/center matches
      snapX = this.calculateSnapX(bestVertical, draggedBounds);
    }

    if (bestHorizontal) {
      const guide = this.createHorizontalGuide(bestHorizontal, draggedBounds, canvasBounds);
      guides.push(guide);
      // Calculate snap: adjust dragged position so the aligned edge/center matches
      snapY = this.calculateSnapY(bestHorizontal, draggedBounds);
    }

    this._guides.set(guides);
    return { guides, snapX, snapY };
  }

  /**
   * Clear all alignment guides
   */
  clearGuides(): void {
    this._guides.set([]);
  }

  /**
   * Check if two positions are within alignment threshold
   */
  private checkAlignment(
    draggedPos: number,
    otherPos: number,
    type: 'horizontal' | 'vertical',
    alignmentType: 'edge' | 'center',
    otherBounds: ItemBounds,
    matches: AlignmentMatch[],
    draggedBounds: ItemBounds
  ): void {
    const distance = Math.abs(draggedPos - otherPos);
    if (distance <= this.ALIGNMENT_THRESHOLD) {
      // Calculate spatial distance (perpendicular to alignment axis)
      // For vertical alignment (X positions), measure Y distance
      // For horizontal alignment (Y positions), measure X distance
      let spatialDistance: number;
      if (type === 'vertical') {
        // Y distance between items
        const draggedTop = draggedBounds.y;
        const draggedBottom = draggedBounds.y + draggedBounds.height;
        const otherTop = otherBounds.y;
        const otherBottom = otherBounds.y + otherBounds.height;

        // If items overlap in Y, distance is 0
        if (draggedBottom >= otherTop && draggedTop <= otherBottom) {
          spatialDistance = 0;
        } else if (draggedTop > otherBottom) {
          spatialDistance = draggedTop - otherBottom;
        } else {
          spatialDistance = otherTop - draggedBottom;
        }
      } else {
        // X distance between items
        const draggedLeft = draggedBounds.x;
        const draggedRight = draggedBounds.x + draggedBounds.width;
        const otherLeft = otherBounds.x;
        const otherRight = otherBounds.x + otherBounds.width;

        // If items overlap in X, distance is 0
        if (draggedRight >= otherLeft && draggedLeft <= otherRight) {
          spatialDistance = 0;
        } else if (draggedLeft > otherRight) {
          spatialDistance = draggedLeft - otherRight;
        } else {
          spatialDistance = otherLeft - draggedRight;
        }
      }

      matches.push({
        type,
        position: otherPos,
        snapOffset: otherPos - draggedPos,
        alignmentType,
        otherBounds,
        spatialDistance
      });
    }
  }

  /**
   * Find the best match from a list of alignment matches.
   * Prefers center alignments, then spatially closest items.
   */
  private findBestMatch(matches: AlignmentMatch[]): AlignmentMatch | null {
    if (matches.length === 0) return null;

    // Prefer center alignments
    const centerMatches = matches.filter(m => m.alignmentType === 'center');
    if (centerMatches.length > 0) {
      // Return the spatially closest center match
      return centerMatches.reduce((best, current) =>
        current.spatialDistance < best.spatialDistance ? current : best
      );
    }

    // For edge matches, prefer the spatially closest item
    // This ensures guide lines connect to the nearest aligned neighbor
    return matches.reduce((best, current) =>
      current.spatialDistance < best.spatialDistance ? current : best
    );
  }

  /**
   * Create a vertical guide line (for X alignment)
   */
  private createVerticalGuide(
    match: AlignmentMatch,
    draggedBounds: ItemBounds,
    canvasBounds: { width: number; height: number }
  ): AlignmentGuide {
    const other = match.otherBounds;

    // Guide line extends from top of higher item to bottom of lower item
    const minY = Math.min(draggedBounds.y, other.y) - this.GUIDE_PADDING;
    const maxY = Math.max(
      draggedBounds.y + draggedBounds.height,
      other.y + other.height
    ) + this.GUIDE_PADDING;

    return {
      type: 'vertical',
      position: match.position,
      start: Math.max(0, minY),
      end: Math.min(canvasBounds.height, maxY),
      alignmentType: match.alignmentType
    };
  }

  /**
   * Create a horizontal guide line (for Y alignment)
   */
  private createHorizontalGuide(
    match: AlignmentMatch,
    draggedBounds: ItemBounds,
    canvasBounds: { width: number; height: number }
  ): AlignmentGuide {
    const other = match.otherBounds;

    // Guide line extends from left of leftmost item to right of rightmost item
    const minX = Math.min(draggedBounds.x, other.x) - this.GUIDE_PADDING;
    const maxX = Math.max(
      draggedBounds.x + draggedBounds.width,
      other.x + other.width
    ) + this.GUIDE_PADDING;

    return {
      type: 'horizontal',
      position: match.position,
      start: Math.max(0, minX),
      end: Math.min(canvasBounds.width, maxX),
      alignmentType: match.alignmentType
    };
  }

  /**
   * Calculate the X position to snap to for vertical alignment
   */
  private calculateSnapX(match: AlignmentMatch, draggedBounds: ItemBounds): number {
    // The snap position is the new X coordinate for the dragged item's top-left corner
    // such that the aligned edge/center matches the target position

    let result: number;
    if (match.alignmentType === 'center') {
      // For center alignment, position.x should place centerX at match.position
      result = match.position - draggedBounds.width / 2;
    } else {
      // For edge alignment, we need to determine which edge was matched
      const draggedLeft = draggedBounds.x;
      const draggedRight = draggedBounds.x + draggedBounds.width;

      // Check if left edge was closer to the match position
      const leftDistance = Math.abs(draggedLeft - match.position);
      const rightDistance = Math.abs(draggedRight - match.position);

      if (leftDistance <= rightDistance) {
        // Left edge aligns - position.x should equal match.position
        result = match.position;
      } else {
        // Right edge aligns - position.x + width should equal match.position
        result = match.position - draggedBounds.width;
      }
    }

    // Round to avoid floating point precision issues
    return Math.round(result);
  }

  /**
   * Calculate the Y position to snap to for horizontal alignment
   */
  private calculateSnapY(match: AlignmentMatch, draggedBounds: ItemBounds): number {
    // The snap position is the new Y coordinate for the dragged item's top-left corner
    // such that the aligned edge/center matches the target position

    let result: number;
    if (match.alignmentType === 'center') {
      // For center alignment, position.y should place centerY at match.position
      result = match.position - draggedBounds.height / 2;
    } else {
      // For edge alignment, we need to determine which edge was matched
      const draggedTop = draggedBounds.y;
      const draggedBottom = draggedBounds.y + draggedBounds.height;

      // Check if top edge was closer to the match position
      const topDistance = Math.abs(draggedTop - match.position);
      const bottomDistance = Math.abs(draggedBottom - match.position);

      if (topDistance <= bottomDistance) {
        // Top edge aligns - position.y should equal match.position
        result = match.position;
      } else {
        // Bottom edge aligns - position.y + height should equal match.position
        result = match.position - draggedBounds.height;
      }
    }

    // Round to avoid floating point precision issues
    return Math.round(result);
  }
}
