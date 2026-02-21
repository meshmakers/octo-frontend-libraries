/**
 * Tests for Polyline Primitive Handler
 */
import { PolylineHandler } from './polyline.handler';
import { PrimitiveBase, Position } from '../../../primitives';

describe('PolylineHandler', () => {
  let handler: PolylineHandler;

  beforeEach(() => {
    handler = new PolylineHandler();
  });

  // Helper to create a polyline primitive
  function createPolyline(
    id: string,
    position: Position,
    points: Position[]
  ): PrimitiveBase {
    return {
      id,
      type: 'polyline',
      position,
      config: { points }
    } as PrimitiveBase;
  }

  // Helper to create a polygon primitive
  function createPolygon(
    id: string,
    position: Position,
    points: Position[]
  ): PrimitiveBase {
    return {
      id,
      type: 'polygon',
      position,
      config: { points }
    } as PrimitiveBase;
  }

  describe('getBounds', () => {
    it('should return position when points array is empty', () => {
      const polyline = createPolyline('p1', { x: 100, y: 50 }, []);
      const bounds = handler.getBounds(polyline);

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(50);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should calculate bounds including position offset for polyline', () => {
      // Points are relative to position
      const polyline = createPolyline('p1', { x: 100, y: 50 }, [
        { x: 0, y: 0 },    // Absolute: (100, 50)
        { x: 50, y: 30 },  // Absolute: (150, 80)
        { x: 80, y: 60 }   // Absolute: (180, 110)
      ]);

      const bounds = handler.getBounds(polyline);

      // Bounds should include position offset
      expect(bounds.x).toBe(100);      // position.x + minX(0)
      expect(bounds.y).toBe(50);       // position.y + minY(0)
      expect(bounds.width).toBe(80);   // maxX(80) - minX(0)
      expect(bounds.height).toBe(60);  // maxY(60) - minY(0)
    });

    it('should handle negative point coordinates', () => {
      const polyline = createPolyline('p1', { x: 200, y: 100 }, [
        { x: -20, y: -10 },  // Absolute: (180, 90)
        { x: 30, y: 40 }     // Absolute: (230, 140)
      ]);

      const bounds = handler.getBounds(polyline);

      expect(bounds.x).toBe(180);     // position.x + minX(-20)
      expect(bounds.y).toBe(90);      // position.y + minY(-10)
      expect(bounds.width).toBe(50);  // maxX(30) - minX(-20)
      expect(bounds.height).toBe(50); // maxY(40) - minY(-10)
    });

    it('should calculate bounds correctly for polygon', () => {
      const polygon = createPolygon('p1', { x: 50, y: 25 }, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 75 },
        { x: 0, y: 75 }
      ]);

      const bounds = handler.getBounds(polygon);

      expect(bounds.x).toBe(50);       // position.x + minX(0)
      expect(bounds.y).toBe(25);       // position.y + minY(0)
      expect(bounds.width).toBe(100);  // maxX(100) - minX(0)
      expect(bounds.height).toBe(75);  // maxY(75) - minY(0)
    });

    it('should ensure minimum width and height of 1', () => {
      // Single point - would have 0 width and height
      const polyline = createPolyline('p1', { x: 100, y: 100 }, [
        { x: 0, y: 0 }
      ]);

      const bounds = handler.getBounds(polyline);

      expect(bounds.width).toBeGreaterThanOrEqual(1);
      expect(bounds.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('move', () => {
    it('should move all points by the delta', () => {
      const polyline = createPolyline('p1', { x: 0, y: 0 }, [
        { x: 10, y: 20 },
        { x: 50, y: 60 }
      ]);

      const moved = handler.move(polyline, { x: 100, y: 50 });
      const config = (moved as unknown as { config: { points: Position[] } }).config;

      expect(config.points[0].x).toBe(110);
      expect(config.points[0].y).toBe(70);
      expect(config.points[1].x).toBe(150);
      expect(config.points[1].y).toBe(110);
    });

    it('should handle negative delta', () => {
      const polyline = createPolyline('p1', { x: 0, y: 0 }, [
        { x: 100, y: 100 }
      ]);

      const moved = handler.move(polyline, { x: -30, y: -20 });
      const config = (moved as unknown as { config: { points: Position[] } }).config;

      expect(config.points[0].x).toBe(70);
      expect(config.points[0].y).toBe(80);
    });
  });

  describe('resize', () => {
    it('should scale points proportionally when resizing', () => {
      const polyline = createPolyline('p1', { x: 0, y: 0 }, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]);

      // Resize to double width and height
      const resized = handler.resize(polyline, {
        x: 0, y: 0, width: 200, height: 200
      });
      const config = (resized as unknown as { config: { points: Position[] } }).config;

      // Points should be scaled 2x
      expect(config.points[0]).toEqual({ x: 0, y: 0 });
      expect(config.points[1]).toEqual({ x: 200, y: 0 });
      expect(config.points[2]).toEqual({ x: 200, y: 200 });
      expect(config.points[3]).toEqual({ x: 0, y: 200 });
    });

    it('should handle resize with position offset', () => {
      const polyline = createPolyline('p1', { x: 50, y: 50 }, [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ]);

      // Current bounds: x=50, y=50, width=100, height=100
      // Resize to new position and half size
      const resized = handler.resize(polyline, {
        x: 100, y: 100, width: 50, height: 50
      });
      const config = (resized as unknown as { config: { points: Position[] } }).config;

      // Points should be scaled to fit new bounds
      // Scale factors: 0.5 for both x and y
      expect(config.points[0].x).toBe(0);
      expect(config.points[0].y).toBe(0);
      expect(config.points[1].x).toBe(50);
      expect(config.points[1].y).toBe(50);
    });
  });

  describe('scaleInGroup', () => {
    it('should scale points relative to group origin', () => {
      const polyline = createPolyline('p1', { x: 100, y: 100 }, [
        { x: 0, y: 0 },
        { x: 50, y: 50 }
      ]);

      // Get initial bounds for childStartBounds
      const childStartBounds = handler.getBounds(polyline);

      // Group starts at (100, 100) with size 100x100
      // Scale to double size, group now at (100, 100) with size 200x200
      const scaled = handler.scaleInGroup(polyline, {
        childStartBounds,
        groupStartBounds: { x: 100, y: 100, width: 100, height: 100 },
        groupNewBounds: { x: 100, y: 100, width: 200, height: 200 },
        scaleX: 2,
        scaleY: 2
      });

      const config = (scaled as unknown as { config: { points: Position[] } }).config;

      // Points should be scaled relative to group origin (100, 100)
      // Point (100, 100) relative to group is (0, 0), scaled is still (0, 0), absolute (100, 100)
      // Point (150, 150) relative to group is (50, 50), scaled is (100, 100), absolute (200, 200)
      // But we need to convert back to relative to position (100, 100)
      expect(config.points[0]).toEqual({ x: 0, y: 0 });
      expect(config.points[1]).toEqual({ x: 100, y: 100 });
    });
  });
});
