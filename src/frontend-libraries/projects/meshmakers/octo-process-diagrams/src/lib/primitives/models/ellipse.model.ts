/**
 * Ellipse Primitive Model
 */

import { PrimitiveBase, PrimitiveType, Size } from './primitive.models';

/**
 * Ellipse-specific configuration
 */
export interface EllipseConfig {
  /** Horizontal radius */
  radiusX: number;
  /** Vertical radius */
  radiusY: number;
}

/**
 * Ellipse primitive element
 */
export interface EllipsePrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Ellipse;
  config: EllipseConfig;
}

/**
 * Type guard for Ellipse primitive
 */
export function isEllipse(primitive: PrimitiveBase): primitive is EllipsePrimitive {
  return primitive.type === PrimitiveType.Ellipse;
}

/**
 * Create a new ellipse primitive
 */
export function createEllipse(
  id: string,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  options?: Partial<Omit<EllipsePrimitive, 'id' | 'type' | 'position' | 'config'>>
): EllipsePrimitive {
  return {
    id,
    type: PrimitiveType.Ellipse,
    position: { x: cx, y: cy }, // Position is center for ellipse
    config: { radiusX, radiusY },
    ...options
  };
}

/**
 * Create a circle (ellipse with equal radii)
 */
export function createCircle(
  id: string,
  cx: number,
  cy: number,
  radius: number,
  options?: Partial<Omit<EllipsePrimitive, 'id' | 'type' | 'position' | 'config'>>
): EllipsePrimitive {
  return createEllipse(id, cx, cy, radius, radius, options);
}

/**
 * Get the bounding size of an ellipse
 */
export function getEllipseSize(ellipse: EllipsePrimitive): Size {
  return {
    width: ellipse.config.radiusX * 2,
    height: ellipse.config.radiusY * 2
  };
}

/**
 * Check if ellipse is a circle
 */
export function isCircle(ellipse: EllipsePrimitive): boolean {
  return ellipse.config.radiusX === ellipse.config.radiusY;
}
