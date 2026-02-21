import { TestBed } from '@angular/core/testing';
import { DesignerPrimitiveService } from './designer-primitive.service';
import { PrimitiveBase, PrimitiveType, Position } from '../../primitives';

describe('DesignerPrimitiveService', () => {
  let service: DesignerPrimitiveService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerPrimitiveService]
    });
    service = TestBed.inject(DesignerPrimitiveService);
  });

  function createRectangle(id: string, x: number, y: number, width: number, height: number): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Rectangle,
      position: { x, y },
      config: { width, height }
    } as PrimitiveBase;
  }

  function createEllipse(id: string, cx: number, cy: number, rx: number, ry: number): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Ellipse,
      position: { x: cx, y: cy },
      config: { radiusX: rx, radiusY: ry }
    } as PrimitiveBase;
  }

  function createLine(id: string, start: Position, end: Position): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Line,
      position: { x: 0, y: 0 },
      config: { start, end }
    } as PrimitiveBase;
  }

  function createPolyline(id: string, points: Position[]): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Polyline,
      position: { x: 0, y: 0 },
      config: { points }
    } as PrimitiveBase;
  }

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should have handlers for all standard primitive types', () => {
      expect(service.getHandler(PrimitiveType.Rectangle)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Ellipse)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Line)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Polyline)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Polygon)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Path)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Text)).toBeTruthy();
      expect(service.getHandler(PrimitiveType.Image)).toBeTruthy();
    });

    it('should return default handler for unknown types', () => {
      const handler = service.getHandler('unknown-type');
      expect(handler).toBeTruthy();
    });
  });

  describe('move', () => {
    it('should move rectangle by delta', () => {
      const rect = createRectangle('r1', 100, 100, 50, 50);
      const moved = service.move(rect, { x: 10, y: 20 });

      expect(moved.position.x).toBe(110);
      expect(moved.position.y).toBe(120);
    });

    it('should move ellipse by delta', () => {
      const ellipse = createEllipse('e1', 100, 100, 30, 20);
      const moved = service.move(ellipse, { x: -10, y: 15 });

      expect(moved.position.x).toBe(90);
      expect(moved.position.y).toBe(115);
    });

    it('should move line endpoints by delta', () => {
      const line = createLine('l1', { x: 0, y: 0 }, { x: 100, y: 50 });
      const moved = service.move(line, { x: 20, y: 30 });

      const config = (moved as unknown as { config: { start: Position; end: Position } }).config;
      expect(config.start.x).toBe(20);
      expect(config.start.y).toBe(30);
      expect(config.end.x).toBe(120);
      expect(config.end.y).toBe(80);
    });

    it('should move all polyline points by delta', () => {
      const poly = createPolyline('p1', [
        { x: 0, y: 0 },
        { x: 50, y: 25 },
        { x: 100, y: 0 }
      ]);
      const moved = service.move(poly, { x: 10, y: 10 });

      const config = (moved as unknown as { config: { points: Position[] } }).config;
      expect(config.points[0]).toEqual({ x: 10, y: 10 });
      expect(config.points[1]).toEqual({ x: 60, y: 35 });
      expect(config.points[2]).toEqual({ x: 110, y: 10 });
    });
  });

  describe('getBounds', () => {
    it('should get rectangle bounds', () => {
      const rect = createRectangle('r1', 100, 50, 80, 60);
      const bounds = service.getBounds(rect);

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(50);
      expect(bounds.width).toBe(80);
      expect(bounds.height).toBe(60);
    });

    it('should get ellipse bounds (position is center)', () => {
      const ellipse = createEllipse('e1', 100, 100, 40, 30);
      const bounds = service.getBounds(ellipse);

      expect(bounds.x).toBe(60); // 100 - 40
      expect(bounds.y).toBe(70); // 100 - 30
      expect(bounds.width).toBe(80); // 40 * 2
      expect(bounds.height).toBe(60); // 30 * 2
    });

    it('should get line bounds', () => {
      const line = createLine('l1', { x: 10, y: 20 }, { x: 110, y: 70 });
      const bounds = service.getBounds(line);

      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(50);
    });

    it('should get polyline bounds', () => {
      const poly = createPolyline('p1', [
        { x: 0, y: 50 },
        { x: 50, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 100 }
      ]);
      const bounds = service.getBounds(poly);

      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });
  });

  describe('getCombinedBounds', () => {
    it('should return null for empty array', () => {
      expect(service.getCombinedBounds([])).toBeNull();
    });

    it('should return bounds for single primitive', () => {
      const rect = createRectangle('r1', 10, 20, 100, 50);
      const bounds = service.getCombinedBounds([rect]);

      expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should combine bounds of multiple primitives', () => {
      const rect1 = createRectangle('r1', 0, 0, 50, 50);
      const rect2 = createRectangle('r2', 100, 100, 50, 50);
      const bounds = service.getCombinedBounds([rect1, rect2]);

      expect(bounds).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    });
  });

  describe('scaleInGroup', () => {
    it('should scale rectangle in group', () => {
      const rect = createRectangle('r1', 100, 100, 50, 50);
      const scaled = service.scaleInGroup(rect, {
        childStartBounds: { x: 100, y: 100, width: 50, height: 50 },
        groupStartBounds: { x: 50, y: 50, width: 200, height: 200 },
        groupNewBounds: { x: 50, y: 50, width: 400, height: 400 },
        scaleX: 2,
        scaleY: 2
      });

      // Relative position (50, 50) scaled by 2 = (100, 100), plus new group origin (50, 50) = (150, 150)
      expect(scaled.position.x).toBe(150);
      expect(scaled.position.y).toBe(150);
      const config = (scaled as unknown as { config: { width: number; height: number } }).config;
      expect(config.width).toBe(100); // 50 * 2
      expect(config.height).toBe(100);
    });

    it('should scale line endpoints in group', () => {
      const line = createLine('l1', { x: 100, y: 100 }, { x: 150, y: 100 });
      const scaled = service.scaleInGroup(line, {
        childStartBounds: { x: 100, y: 100, width: 50, height: 0 },
        groupStartBounds: { x: 0, y: 0, width: 200, height: 200 },
        groupNewBounds: { x: 0, y: 0, width: 400, height: 400 },
        scaleX: 2,
        scaleY: 2
      });

      const config = (scaled as unknown as { config: { start: Position; end: Position } }).config;
      expect(config.start.x).toBe(200); // 100 * 2
      expect(config.start.y).toBe(200);
      expect(config.end.x).toBe(300); // 150 * 2
      expect(config.end.y).toBe(200);
    });
  });

  describe('resize', () => {
    it('should resize rectangle to new bounds', () => {
      const rect = createRectangle('r1', 0, 0, 100, 100);
      const resized = service.resize(rect, { x: 50, y: 50, width: 200, height: 150 });

      expect(resized.position.x).toBe(50);
      expect(resized.position.y).toBe(50);
      const config = (resized as unknown as { config: { width: number; height: number } }).config;
      expect(config.width).toBe(200);
      expect(config.height).toBe(150);
    });

    it('should resize ellipse to new bounds (center position)', () => {
      const ellipse = createEllipse('e1', 50, 50, 25, 25);
      const resized = service.resize(ellipse, { x: 0, y: 0, width: 100, height: 80 });

      // New center should be at (50, 40) - center of new bounds
      expect(resized.position.x).toBe(50);
      expect(resized.position.y).toBe(40);
      const config = (resized as unknown as { config: { radiusX: number; radiusY: number } }).config;
      expect(config.radiusX).toBe(50); // width/2
      expect(config.radiusY).toBe(40); // height/2
    });
  });

  describe('type checks', () => {
    it('should identify polyline/polygon types', () => {
      expect(service.usesPoints(PrimitiveType.Polyline)).toBe(true);
      expect(service.usesPoints(PrimitiveType.Polygon)).toBe(true);
      expect(service.usesPoints(PrimitiveType.Rectangle)).toBe(false);
      expect(service.usesPoints(PrimitiveType.Line)).toBe(false);
    });

    it('should identify line type', () => {
      expect(service.isLine(PrimitiveType.Line)).toBe(true);
      expect(service.isLine(PrimitiveType.Polyline)).toBe(false);
    });

    it('should identify path type', () => {
      expect(service.isPath(PrimitiveType.Path)).toBe(true);
      expect(service.isPath(PrimitiveType.Rectangle)).toBe(false);
    });
  });

  describe('moveAll', () => {
    it('should move multiple primitives by delta', () => {
      const rect = createRectangle('r1', 0, 0, 50, 50);
      const ellipse = createEllipse('e1', 100, 100, 25, 25);
      const moved = service.moveAll([rect, ellipse], { x: 10, y: 10 });

      expect(moved[0].position).toEqual({ x: 10, y: 10 });
      expect(moved[1].position).toEqual({ x: 110, y: 110 });
    });
  });
});
