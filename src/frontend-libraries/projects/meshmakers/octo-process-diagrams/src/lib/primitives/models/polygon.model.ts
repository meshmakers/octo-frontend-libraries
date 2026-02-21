/**
 * Polygon and Polyline Primitive Models
 */

import { Point, PrimitiveBase, PrimitiveType, BoundingBox } from './primitive.models';

/**
 * Polygon-specific configuration
 */
export interface PolygonConfig {
  /** Array of points defining the polygon vertices */
  points: Point[];
}

/**
 * Polygon primitive element (closed shape)
 */
export interface PolygonPrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Polygon;
  config: PolygonConfig;
}

/**
 * Polyline primitive element (open shape)
 */
export interface PolylinePrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Polyline;
  config: PolygonConfig; // Same config as polygon
}

/**
 * Type guard for Polygon primitive
 */
export function isPolygon(primitive: PrimitiveBase): primitive is PolygonPrimitive {
  return primitive.type === PrimitiveType.Polygon;
}

/**
 * Type guard for Polyline primitive
 */
export function isPolyline(primitive: PrimitiveBase): primitive is PolylinePrimitive {
  return primitive.type === PrimitiveType.Polyline;
}

/**
 * Create a new polygon primitive
 */
export function createPolygon(
  id: string,
  points: Point[],
  options?: Partial<Omit<PolygonPrimitive, 'id' | 'type' | 'position' | 'config'>>
): PolygonPrimitive {
  return {
    id,
    type: PrimitiveType.Polygon,
    position: { x: 0, y: 0 }, // Points are absolute
    config: { points: [...points] },
    ...options
  };
}

/**
 * Create a new polyline primitive
 */
export function createPolyline(
  id: string,
  points: Point[],
  options?: Partial<Omit<PolylinePrimitive, 'id' | 'type' | 'position' | 'config'>>
): PolylinePrimitive {
  return {
    id,
    type: PrimitiveType.Polyline,
    position: { x: 0, y: 0 },
    config: { points: [...points] },
    ...options
  };
}

/**
 * Create a regular polygon (equilateral)
 */
export function createRegularPolygon(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  sides: number,
  startAngle = -90, // Start at top
  options?: Partial<Omit<PolygonPrimitive, 'id' | 'type' | 'position' | 'config'>>
): PolygonPrimitive {
  const points: Point[] = [];
  const angleStep = (2 * Math.PI) / sides;
  const startRad = (startAngle * Math.PI) / 180;

  for (let i = 0; i < sides; i++) {
    const angle = startRad + i * angleStep;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }

  return createPolygon(id, points, options);
}

/**
 * Convert points array to SVG points string
 */
export function pointsToSvgString(points: Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

/**
 * Parse SVG points string to points array
 */
export function svgStringToPoints(svgPoints: string): Point[] {
  return svgPoints
    .trim()
    .split(/\s+/)
    .map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return { x: x || 0, y: y || 0 };
    });
}

/**
 * Calculate bounding box of polygon/polyline
 */
export function getPolygonBounds(primitive: PolygonPrimitive | PolylinePrimitive): BoundingBox {
  const points = primitive.config.points;
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x, minY = points[0].y;
  let maxX = points[0].x, maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: primitive.position.x + minX,
    y: primitive.position.y + minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate centroid of polygon
 */
export function getPolygonCentroid(polygon: PolygonPrimitive): Point {
  const points = polygon.config.points;
  if (points.length === 0) {
    return polygon.position;
  }

  let sumX = 0, sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }

  return {
    x: polygon.position.x + sumX / points.length,
    y: polygon.position.y + sumY / points.length
  };
}
