/**
 * Primitive Handler Interface
 *
 * Defines the contract for type-specific primitive operations.
 * Each primitive type (Line, Polyline, Rectangle, etc.) has its own handler
 * that implements these operations according to its specific geometry.
 */

import { PrimitiveBase, Position } from '../../../primitives';

/**
 * Bounds representation for primitives
 */
export interface PrimitiveBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Scale parameters for resize operations
 */
export interface ScaleParams {
  scaleX: number;
  scaleY: number;
  /** Origin point for scaling (typically the opposite corner from resize handle) */
  origin: Position;
}

/**
 * Group scale parameters for scaling primitives within a group
 */
export interface GroupScaleParams {
  /** The original bounds of this primitive before scaling */
  childStartBounds: PrimitiveBounds;
  /** The original bounds of the group before scaling */
  groupStartBounds: PrimitiveBounds;
  /** The new bounds of the group after scaling */
  groupNewBounds: PrimitiveBounds;
  scaleX: number;
  scaleY: number;
}

/**
 * Handler interface for type-specific primitive operations
 */
export interface PrimitiveHandler {
  /**
   * Move a primitive by a delta
   * @param primitive The primitive to move
   * @param delta The amount to move by
   * @returns A new primitive with updated position
   */
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase;

  /**
   * Get the bounding box of a primitive
   * @param primitive The primitive to get bounds for
   * @returns The bounding box
   */
  getBounds(primitive: PrimitiveBase): PrimitiveBounds;

  /**
   * Scale a primitive within a group resize operation
   * @param primitive The primitive to scale
   * @param params The scaling parameters
   * @returns A new primitive with scaled dimensions
   */
  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase;

  /**
   * Resize a primitive to new bounds
   * @param primitive The primitive to resize
   * @param newBounds The new bounds
   * @returns A new primitive with updated size/dimensions
   */
  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase;
}
