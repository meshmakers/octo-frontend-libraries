/**
 * Unit tests for polyline and line editing functionality
 * These tests verify the core editing logic independently
 */
import { Position } from '../process-widget.models';

/**
 * Calculate the distance from a point to a line segment
 * (Extracted from ProcessDesignerComponent for isolated testing)
 */
function pointToSegmentDistance(point: Position, p1: Position, p2: Position): number {
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
 * Get the points of a polyline/polygon for rendering handles
 * (Extracted from ProcessDesignerComponent for isolated testing)
 */
function getPolyPoints(
  primitivePosition: Position,
  points: Position[]
): { x: number; y: number; index: number }[] {
  return points.map((pt, index) => ({
    x: pt.x + primitivePosition.x,
    y: pt.y + primitivePosition.y,
    index
  }));
}

/**
 * Add a new point to a polyline/polygon after a given index
 * (Extracted logic for isolated testing)
 */
function addPolyPointToArray(
  points: Position[],
  primitivePosition: Position,
  afterIndex: number,
  absolutePosition: Position
): Position[] {
  const newPoints = [...points];
  const newPoint = {
    x: absolutePosition.x - primitivePosition.x,
    y: absolutePosition.y - primitivePosition.y
  };
  newPoints.splice(afterIndex + 1, 0, newPoint);
  return newPoints;
}

/**
 * Delete a point from a polyline/polygon at a given index
 * (Extracted logic for isolated testing)
 */
function deletePolyPointFromArray(
  points: Position[],
  pointIndex: number,
  minPoints: number
): Position[] | null {
  if (points.length <= minPoints) {
    return null; // Cannot delete
  }
  return points.filter((_, i) => i !== pointIndex);
}

/**
 * Update a polyline point position
 * (Extracted logic for isolated testing)
 */
function updatePolyPointInArray(
  points: Position[],
  primitivePosition: Position,
  pointIndex: number,
  newAbsolutePosition: Position
): Position[] {
  const newPoints = [...points];
  newPoints[pointIndex] = {
    x: newAbsolutePosition.x - primitivePosition.x,
    y: newAbsolutePosition.y - primitivePosition.y
  };
  return newPoints;
}

/**
 * Update a line endpoint position
 * (Extracted logic for isolated testing)
 */
function updateLineEndpoint(
  start: Position,
  end: Position,
  primitivePosition: Position,
  endpoint: 'start' | 'end',
  newAbsolutePosition: Position
): { start: Position; end: Position } {
  const newPosition = {
    x: newAbsolutePosition.x - primitivePosition.x,
    y: newAbsolutePosition.y - primitivePosition.y
  };
  if (endpoint === 'start') {
    return { start: newPosition, end };
  }
  return { start, end: newPosition };
}

/**
 * Find the closest segment index to a point in a polyline
 * (Extracted logic for isolated testing)
 */
function findClosestSegmentIndex(
  relativePoint: Position,
  points: Position[],
  isPolygon: boolean
): number {
  let closestSegmentIndex = 0;
  let minDistance = Infinity;

  const numSegments = isPolygon ? points.length : points.length - 1;

  for (let i = 0; i < numSegments; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const distance = pointToSegmentDistance(relativePoint, p1, p2);
    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
    }
  }

  return closestSegmentIndex;
}

describe('Polyline Editing', () => {
  describe('pointToSegmentDistance', () => {
    it('should return 0 when point is on segment start', () => {
      const distance = pointToSegmentDistance(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return 0 when point is on segment end', () => {
      const distance = pointToSegmentDistance(
        { x: 100, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return 0 when point is on horizontal segment', () => {
      const distance = pointToSegmentDistance(
        { x: 50, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return 0 when point is on vertical segment', () => {
      const distance = pointToSegmentDistance(
        { x: 0, y: 50 },
        { x: 0, y: 0 },
        { x: 0, y: 100 }
      );
      expect(distance).toBe(0);
    });

    it('should return perpendicular distance for point above horizontal segment', () => {
      const distance = pointToSegmentDistance(
        { x: 50, y: 30 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(30);
    });

    it('should return perpendicular distance for point below horizontal segment', () => {
      const distance = pointToSegmentDistance(
        { x: 50, y: -30 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(30);
    });

    it('should return distance to endpoint when outside segment (left)', () => {
      const distance = pointToSegmentDistance(
        { x: -10, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(10);
    });

    it('should return distance to endpoint when outside segment (right)', () => {
      const distance = pointToSegmentDistance(
        { x: 110, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(10);
    });

    it('should handle diagonal segment', () => {
      // Point at (50, 50) on a segment from (0,0) to (100,100)
      const distance = pointToSegmentDistance(
        { x: 50, y: 50 },
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      );
      expect(distance).toBeCloseTo(0);
    });

    it('should return distance from point to diagonal segment', () => {
      // Point perpendicular to diagonal segment
      const distance = pointToSegmentDistance(
        { x: 0, y: 100 },
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      );
      // Distance from (0,100) to line y=x is |100-0|/sqrt(2)
      expect(distance).toBeCloseTo(Math.sqrt(2) * 50);
    });

    it('should handle zero-length segment (p1 equals p2)', () => {
      const distance = pointToSegmentDistance(
        { x: 30, y: 40 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      );
      // Should return distance from point to p1
      expect(distance).toBeCloseTo(50); // 3-4-5 triangle
    });
  });

  describe('getPolyPoints', () => {
    it('should return empty array for empty points', () => {
      const result = getPolyPoints({ x: 10, y: 20 }, []);
      expect(result).toEqual([]);
    });

    it('should transform points to absolute coordinates', () => {
      const primitivePos = { x: 100, y: 50 };
      const points = [
        { x: 0, y: 0 },
        { x: 20, y: 30 },
        { x: 50, y: 10 }
      ];

      const result = getPolyPoints(primitivePos, points);

      expect(result).toEqual([
        { x: 100, y: 50, index: 0 },
        { x: 120, y: 80, index: 1 },
        { x: 150, y: 60, index: 2 }
      ]);
    });

    it('should include correct indices', () => {
      const result = getPolyPoints({ x: 0, y: 0 }, [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 }
      ]);

      expect(result.map(p => p.index)).toEqual([0, 1, 2, 3]);
    });
  });

  describe('addPolyPointToArray', () => {
    it('should add point at beginning (after index 0)', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ];
      const primitivePos = { x: 50, y: 50 };
      const absolutePos = { x: 75, y: 75 };

      const result = addPolyPointToArray(points, primitivePos, 0, absolutePos);

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[1]).toEqual({ x: 25, y: 25 }); // 75-50=25
      expect(result[2]).toEqual({ x: 100, y: 100 });
    });

    it('should add point at end', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ];
      const primitivePos = { x: 0, y: 0 };
      const absolutePos = { x: 200, y: 200 };

      const result = addPolyPointToArray(points, primitivePos, 1, absolutePos);

      expect(result.length).toBe(3);
      expect(result[2]).toEqual({ x: 200, y: 200 });
    });

    it('should not mutate original array', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      const originalLength = points.length;

      addPolyPointToArray(points, { x: 0, y: 0 }, 0, { x: 50, y: 50 });

      expect(points.length).toBe(originalLength);
    });

    it('should insert in middle of array', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];

      const result = addPolyPointToArray(points, { x: 0, y: 0 }, 1, { x: 75, y: 25 });

      expect(result.length).toBe(4);
      expect(result[2]).toEqual({ x: 75, y: 25 });
    });
  });

  describe('deletePolyPointFromArray', () => {
    it('should delete point from polyline with more than 2 points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];

      const result = deletePolyPointFromArray(points, 1, 2);

      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);
      expect(result![0]).toEqual({ x: 0, y: 0 });
      expect(result![1]).toEqual({ x: 100, y: 0 });
    });

    it('should not delete when at minimum points for polyline (2)', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];

      const result = deletePolyPointFromArray(points, 0, 2);

      expect(result).toBeNull();
    });

    it('should not delete when at minimum points for polygon (3)', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 86.6 }
      ];

      const result = deletePolyPointFromArray(points, 0, 3);

      expect(result).toBeNull();
    });

    it('should delete from polygon with more than 3 points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];

      const result = deletePolyPointFromArray(points, 2, 3);

      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
    });

    it('should delete first point', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];

      const result = deletePolyPointFromArray(points, 0, 2);

      expect(result![0]).toEqual({ x: 50, y: 50 });
    });

    it('should delete last point', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];

      const result = deletePolyPointFromArray(points, 2, 2);

      expect(result![1]).toEqual({ x: 50, y: 50 });
      expect(result!.length).toBe(2);
    });

    it('should not mutate original array', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];

      deletePolyPointFromArray(points, 1, 2);

      expect(points.length).toBe(3);
    });
  });

  describe('updatePolyPointInArray', () => {
    it('should update point position', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ];
      const primitivePos = { x: 10, y: 20 };
      const newAbsPos = { x: 60, y: 80 };

      const result = updatePolyPointInArray(points, primitivePos, 1, newAbsPos);

      expect(result[1]).toEqual({ x: 50, y: 60 }); // 60-10=50, 80-20=60
    });

    it('should not mutate original array', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      const original = points[0];

      updatePolyPointInArray(points, { x: 0, y: 0 }, 0, { x: 999, y: 999 });

      expect(points[0]).toBe(original);
    });

    it('should update first point', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];

      const result = updatePolyPointInArray(points, { x: 0, y: 0 }, 0, { x: 25, y: 25 });

      expect(result[0]).toEqual({ x: 25, y: 25 });
    });

    it('should update last point', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];

      const result = updatePolyPointInArray(points, { x: 0, y: 0 }, 1, { x: 200, y: 200 });

      expect(result[1]).toEqual({ x: 200, y: 200 });
    });
  });

  describe('findClosestSegmentIndex', () => {
    const squarePoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];

    it('should find segment 0 (top edge) for point near top', () => {
      const result = findClosestSegmentIndex(
        { x: 50, y: 5 },
        squarePoints,
        false
      );
      expect(result).toBe(0);
    });

    it('should find segment 1 (right edge) for point near right', () => {
      const result = findClosestSegmentIndex(
        { x: 95, y: 50 },
        squarePoints,
        false
      );
      expect(result).toBe(1);
    });

    it('should find segment 2 (bottom edge) for point near bottom', () => {
      const result = findClosestSegmentIndex(
        { x: 50, y: 95 },
        squarePoints,
        false
      );
      expect(result).toBe(2);
    });

    it('should include closing segment for polygon', () => {
      // For a polygon, segment from last point back to first
      const result = findClosestSegmentIndex(
        { x: 5, y: 50 },
        squarePoints,
        true // polygon
      );
      expect(result).toBe(3); // Closing segment
    });

    it('should not include closing segment for polyline', () => {
      // For a polyline, point on left should be closest to segment 0 or 2
      const result = findClosestSegmentIndex(
        { x: 5, y: 50 },
        squarePoints,
        false // polyline
      );
      // Should find one of the segments, but not segment 3 (no closing segment)
      expect(result).toBeLessThan(3);
    });

    it('should handle simple two-point polyline', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const result = findClosestSegmentIndex(
        { x: 50, y: 10 },
        points,
        false
      );
      expect(result).toBe(0);
    });
  });
});

describe('Line Endpoint Editing', () => {
  describe('updateLineEndpoint', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };
    const primitivePos = { x: 50, y: 50 };

    it('should update start endpoint', () => {
      const result = updateLineEndpoint(start, end, primitivePos, 'start', { x: 75, y: 75 });

      expect(result.start).toEqual({ x: 25, y: 25 }); // 75-50=25
      expect(result.end).toEqual(end);
    });

    it('should update end endpoint', () => {
      const result = updateLineEndpoint(start, end, primitivePos, 'end', { x: 200, y: 200 });

      expect(result.start).toEqual(start);
      expect(result.end).toEqual({ x: 150, y: 150 }); // 200-50=150
    });

    it('should handle negative coordinates', () => {
      const result = updateLineEndpoint(start, end, primitivePos, 'start', { x: 0, y: 0 });

      expect(result.start).toEqual({ x: -50, y: -50 });
    });

    it('should not mutate original endpoints', () => {
      const originalStart = { x: 0, y: 0 };
      const originalEnd = { x: 100, y: 100 };

      updateLineEndpoint(originalStart, originalEnd, primitivePos, 'start', { x: 999, y: 999 });

      expect(originalStart).toEqual({ x: 0, y: 0 });
      expect(originalEnd).toEqual({ x: 100, y: 100 });
    });

    it('should allow horizontal line', () => {
      const result = updateLineEndpoint(
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        { x: 0, y: 0 },
        'end',
        { x: 200, y: 50 }
      );

      expect(result.end.y).toBe(50);
    });

    it('should allow vertical line', () => {
      const result = updateLineEndpoint(
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 0, y: 0 },
        'end',
        { x: 50, y: 200 }
      );

      expect(result.end.x).toBe(50);
    });
  });
});
