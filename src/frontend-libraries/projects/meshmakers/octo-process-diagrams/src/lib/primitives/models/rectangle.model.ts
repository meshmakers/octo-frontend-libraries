/**
 * Rectangle Primitive Model
 */

import { PrimitiveBase, PrimitiveType, Size } from './primitive.models';

/**
 * Rectangle-specific configuration
 */
export interface RectangleConfig {
  /** Width of the rectangle */
  width: number;
  /** Height of the rectangle */
  height: number;
  /** Corner radius for rounded rectangles */
  cornerRadius?: number;
  /** Separate corner radii (rx, ry) */
  cornerRadiusX?: number;
  cornerRadiusY?: number;
}

/**
 * Rectangle primitive element
 */
export interface RectanglePrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Rectangle;
  config: RectangleConfig;
}

/**
 * Type guard for Rectangle primitive
 */
export function isRectangle(primitive: PrimitiveBase): primitive is RectanglePrimitive {
  return primitive.type === PrimitiveType.Rectangle;
}

/**
 * Create a new rectangle primitive
 */
export function createRectangle(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: Partial<Omit<RectanglePrimitive, 'id' | 'type' | 'position' | 'config'> & { config?: Partial<RectangleConfig> }>
): RectanglePrimitive {
  const { config: configOptions, ...rest } = options ?? {};
  return {
    ...rest,
    id,
    type: PrimitiveType.Rectangle,
    position: { x, y },
    config: {
      width,
      height,
      cornerRadius: configOptions?.cornerRadius,
      cornerRadiusX: configOptions?.cornerRadiusX,
      cornerRadiusY: configOptions?.cornerRadiusY
    }
  };
}

/**
 * Get the size of a rectangle
 */
export function getRectangleSize(rect: RectanglePrimitive): Size {
  return {
    width: rect.config.width,
    height: rect.config.height
  };
}
