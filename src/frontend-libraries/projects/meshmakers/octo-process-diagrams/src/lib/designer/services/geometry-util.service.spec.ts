import { TestBed } from '@angular/core/testing';
import { GeometryUtilService } from './geometry-util.service';
import { Position } from '../../process-widget.models';

describe('GeometryUtilService', () => {
  let service: GeometryUtilService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeometryUtilService]
    });
    service = TestBed.inject(GeometryUtilService);
  });

  describe('pointToSegmentDistance', () => {
    it('should return 0 when point is on segment start', () => {
      const distance = service.pointToSegmentDistance(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return 0 when point is on segment end', () => {
      const distance = service.pointToSegmentDistance(
        { x: 100, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return 0 when point is on horizontal segment', () => {
      const distance = service.pointToSegmentDistance(
        { x: 50, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBe(0);
    });

    it('should return perpendicular distance for point above horizontal segment', () => {
      const distance = service.pointToSegmentDistance(
        { x: 50, y: 30 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(30);
    });

    it('should return distance to endpoint when point is outside segment (left)', () => {
      const distance = service.pointToSegmentDistance(
        { x: -10, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(10);
    });

    it('should return distance to endpoint when point is outside segment (right)', () => {
      const distance = service.pointToSegmentDistance(
        { x: 110, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(distance).toBeCloseTo(10);
    });

    it('should handle zero-length segment (p1 equals p2)', () => {
      const distance = service.pointToSegmentDistance(
        { x: 30, y: 40 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      );
      expect(distance).toBeCloseTo(50); // 3-4-5 triangle
    });

    it('should handle diagonal segment', () => {
      const distance = service.pointToSegmentDistance(
        { x: 50, y: 50 },
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      );
      expect(distance).toBeCloseTo(0);
    });
  });

  describe('findClosestSegmentIndex', () => {
    const squarePoints: Position[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];

    it('should return 0 for single point', () => {
      const result = service.findClosestSegmentIndex(
        { x: 50, y: 50 },
        [{ x: 0, y: 0 }],
        false
      );
      expect(result).toBe(0);
    });

    it('should find segment 0 (top edge) for point near top', () => {
      const result = service.findClosestSegmentIndex(
        { x: 50, y: 5 },
        squarePoints,
        false
      );
      expect(result).toBe(0);
    });

    it('should find segment 1 (right edge) for point near right', () => {
      const result = service.findClosestSegmentIndex(
        { x: 95, y: 50 },
        squarePoints,
        false
      );
      expect(result).toBe(1);
    });

    it('should find segment 2 (bottom edge) for point near bottom', () => {
      const result = service.findClosestSegmentIndex(
        { x: 50, y: 95 },
        squarePoints,
        false
      );
      expect(result).toBe(2);
    });

    it('should include closing segment for polygon (closed=true)', () => {
      const result = service.findClosestSegmentIndex(
        { x: 5, y: 50 },
        squarePoints,
        true
      );
      expect(result).toBe(3); // Closing segment from [0,100] back to [0,0]
    });

    it('should not include closing segment for polyline (closed=false)', () => {
      const result = service.findClosestSegmentIndex(
        { x: 5, y: 50 },
        squarePoints,
        false
      );
      expect(result).toBeLessThan(3);
    });
  });

  describe('projectPointOnLine', () => {
    it('should project point onto horizontal line', () => {
      const result = service.projectPointOnLine(
        { x: 50, y: 30 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(result.x).toBeCloseTo(50);
      expect(result.y).toBeCloseTo(0);
    });

    it('should project point onto vertical line', () => {
      const result = service.projectPointOnLine(
        { x: 30, y: 50 },
        { x: 0, y: 0 },
        { x: 0, y: 100 }
      );
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(50);
    });

    it('should handle zero-length line', () => {
      const result = service.projectPointOnLine(
        { x: 50, y: 50 },
        { x: 10, y: 10 },
        { x: 10, y: 10 }
      );
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });

    it('should project beyond segment bounds', () => {
      const result = service.projectPointOnLine(
        { x: 150, y: 30 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(result.x).toBeCloseTo(150);
      expect(result.y).toBeCloseTo(0);
    });
  });

  describe('calculateAngle', () => {
    it('should return 0 for point to the right', () => {
      const angle = service.calculateAngle(
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );
      expect(angle).toBeCloseTo(0);
    });

    it('should return PI/2 for point above', () => {
      const angle = service.calculateAngle(
        { x: 0, y: 0 },
        { x: 0, y: 100 }
      );
      expect(angle).toBeCloseTo(Math.PI / 2);
    });

    it('should return PI for point to the left', () => {
      const angle = service.calculateAngle(
        { x: 0, y: 0 },
        { x: -100, y: 0 }
      );
      expect(Math.abs(angle)).toBeCloseTo(Math.PI);
    });

    it('should return -PI/2 for point below', () => {
      const angle = service.calculateAngle(
        { x: 0, y: 0 },
        { x: 0, y: -100 }
      );
      expect(angle).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('rotatePoint', () => {
    it('should rotate point 90 degrees counter-clockwise', () => {
      const result = service.rotatePoint(
        { x: 100, y: 0 },
        Math.PI / 2,
        { x: 0, y: 0 }
      );
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(100);
    });

    it('should rotate point 180 degrees', () => {
      const result = service.rotatePoint(
        { x: 100, y: 0 },
        Math.PI,
        { x: 0, y: 0 }
      );
      expect(result.x).toBeCloseTo(-100);
      expect(result.y).toBeCloseTo(0);
    });

    it('should rotate around non-origin point', () => {
      const result = service.rotatePoint(
        { x: 110, y: 50 },
        Math.PI / 2,
        { x: 100, y: 50 }
      );
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(60);
    });

    it('should return same point for 0 rotation', () => {
      const result = service.rotatePoint(
        { x: 100, y: 50 },
        0,
        { x: 0, y: 0 }
      );
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(50);
    });
  });

  describe('distance', () => {
    it('should return 0 for same point', () => {
      expect(service.distance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });

    it('should calculate horizontal distance', () => {
      expect(service.distance({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(100);
    });

    it('should calculate vertical distance', () => {
      expect(service.distance({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(100);
    });

    it('should calculate diagonal distance (3-4-5 triangle)', () => {
      expect(service.distance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBeCloseTo(50);
    });
  });

  describe('midpoint', () => {
    it('should find midpoint of horizontal segment', () => {
      const result = service.midpoint({ x: 0, y: 0 }, { x: 100, y: 0 });
      expect(result.x).toBe(50);
      expect(result.y).toBe(0);
    });

    it('should find midpoint of vertical segment', () => {
      const result = service.midpoint({ x: 0, y: 0 }, { x: 0, y: 100 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(50);
    });

    it('should find midpoint of diagonal segment', () => {
      const result = service.midpoint({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });
  });

  describe('normalize', () => {
    it('should normalize horizontal vector', () => {
      const result = service.normalize({ x: 100, y: 0 });
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
    });

    it('should normalize vertical vector', () => {
      const result = service.normalize({ x: 0, y: 100 });
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
    });

    it('should normalize diagonal vector', () => {
      const result = service.normalize({ x: 100, y: 100 });
      const expected = 1 / Math.sqrt(2);
      expect(result.x).toBeCloseTo(expected);
      expect(result.y).toBeCloseTo(expected);
    });

    it('should return zero vector for zero input', () => {
      const result = service.normalize({ x: 0, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('perpendicular', () => {
    it('should rotate horizontal vector 90 degrees', () => {
      const result = service.perpendicular({ x: 100, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(100);
    });

    it('should rotate vertical vector 90 degrees', () => {
      const result = service.perpendicular({ x: 0, y: 100 });
      expect(result.x).toBe(-100);
      expect(result.y).toBe(0);
    });

    it('should return zero vector for zero input', () => {
      const result = service.perpendicular({ x: 0, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });
});
