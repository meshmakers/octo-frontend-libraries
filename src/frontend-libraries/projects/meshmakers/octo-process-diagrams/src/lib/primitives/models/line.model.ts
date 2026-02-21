/**
 * Line Primitive Model
 */

import { Point, PrimitiveBase, PrimitiveType } from './primitive.models';

/**
 * Line-specific configuration
 */
export interface LineConfig {
  /** Start point (relative to position) */
  start: Point;
  /** End point (relative to position) */
  end: Point;
  /** Marker at start (arrowhead, circle, etc.) */
  markerStart?: LineMarker;
  /** Marker at end */
  markerEnd?: LineMarker;
}

/**
 * Line marker types
 */
export type LineMarkerType = 'none' | 'arrow' | 'circle' | 'square' | 'diamond';

/**
 * Line marker configuration
 */
export interface LineMarker {
  type: LineMarkerType;
  size?: number;
  color?: string;
}

/**
 * Line primitive element
 */
export interface LinePrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Line;
  config: LineConfig;
}

/**
 * Type guard for Line primitive
 */
export function isLine(primitive: PrimitiveBase): primitive is LinePrimitive {
  return primitive.type === PrimitiveType.Line;
}

/**
 * Create a new line primitive
 */
export function createLine(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: Partial<Omit<LinePrimitive, 'id' | 'type' | 'position' | 'config'> & { config?: Partial<Omit<LineConfig, 'start' | 'end'>> }>
): LinePrimitive {
  const { config: configOptions, ...rest } = options ?? {};
  return {
    ...rest,
    id,
    type: PrimitiveType.Line,
    position: { x: 0, y: 0 }, // Lines use absolute coordinates in config
    config: {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      markerStart: configOptions?.markerStart,
      markerEnd: configOptions?.markerEnd
    }
  };
}

/**
 * Get the length of a line
 */
export function getLineLength(line: LinePrimitive): number {
  const dx = line.config.end.x - line.config.start.x;
  const dy = line.config.end.y - line.config.start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get the angle of a line in degrees
 */
export function getLineAngle(line: LinePrimitive): number {
  const dx = line.config.end.x - line.config.start.x;
  const dy = line.config.end.y - line.config.start.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Get the midpoint of a line
 */
export function getLineMidpoint(line: LinePrimitive): Point {
  return {
    x: (line.config.start.x + line.config.end.x) / 2,
    y: (line.config.start.y + line.config.end.y) / 2
  };
}
