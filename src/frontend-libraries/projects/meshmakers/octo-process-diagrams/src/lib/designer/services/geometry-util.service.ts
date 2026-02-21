import { Injectable } from '@angular/core';
import { Position } from '../../process-widget.models';

/**
 * Service providing geometric utility functions for the designer.
 * Handles calculations like point-to-segment distances, projections, and transformations.
 */
@Injectable({ providedIn: 'root' })
export class GeometryUtilService {

  /**
   * Calculate the perpendicular distance from a point to a line segment.
   * @param point The point to measure from
   * @param p1 Start of the line segment
   * @param p2 End of the line segment
   * @returns The shortest distance from the point to any point on the segment
   */
  pointToSegmentDistance(point: Position, p1: Position, p2: Position): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // p1 and p2 are the same point
      return Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
    }

    // Calculate projection parameter
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment

    // Find closest point on segment
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;

    return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
  }

  /**
   * Find the index of the closest segment to a point in a polyline/polygon.
   * @param point The point to measure from
   * @param points Array of vertices forming the polyline/polygon
   * @param closed If true, includes closing segment from last to first point (polygon)
   * @returns Index of the closest segment (0-based, refers to segment from points[i] to points[i+1])
   */
  findClosestSegmentIndex(point: Position, points: Position[], closed: boolean): number {
    if (points.length < 2) return 0;

    let closestSegmentIndex = 0;
    let minDistance = Infinity;

    const numSegments = closed ? points.length : points.length - 1;

    for (let i = 0; i < numSegments; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const distance = this.pointToSegmentDistance(point, p1, p2);
      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
      }
    }

    return closestSegmentIndex;
  }

  /**
   * Project a point onto a line defined by two points.
   * @param point The point to project
   * @param lineStart Start of the line
   * @param lineEnd End of the line
   * @returns The projected point on the line (may be outside segment bounds)
   */
  projectPointOnLine(point: Position, lineStart: Position, lineEnd: Position): Position {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return { x: lineStart.x, y: lineStart.y };
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;

    return {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy
    };
  }

  /**
   * Calculate the angle (in radians) from one point to another.
   * @param from The starting point
   * @param to The target point
   * @returns Angle in radians (-PI to PI)
   */
  calculateAngle(from: Position, to: Position): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  /**
   * Rotate a point around an origin by a given angle.
   * @param point The point to rotate
   * @param angle Angle in radians
   * @param origin The center of rotation
   * @returns The rotated point
   */
  rotatePoint(point: Position, angle: number, origin: Position): Position {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;

    return {
      x: origin.x + dx * cos - dy * sin,
      y: origin.y + dx * sin + dy * cos
    };
  }

  /**
   * Calculate the distance between two points.
   * @param p1 First point
   * @param p2 Second point
   * @returns The Euclidean distance
   */
  distance(p1: Position, p2: Position): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate the midpoint between two points.
   * @param p1 First point
   * @param p2 Second point
   * @returns The midpoint
   */
  midpoint(p1: Position, p2: Position): Position {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  /**
   * Normalize a vector to unit length.
   * @param vector The vector to normalize
   * @returns Unit vector in the same direction, or {0, 0} if input is zero-length
   */
  normalize(vector: Position): Position {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (length === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  /**
   * Calculate the perpendicular vector (90 degree rotation counter-clockwise).
   * @param vector Input vector
   * @returns Perpendicular vector
   */
  perpendicular(vector: Position): Position {
    return {
      x: -vector.y,
      y: vector.x
    };
  }
}
