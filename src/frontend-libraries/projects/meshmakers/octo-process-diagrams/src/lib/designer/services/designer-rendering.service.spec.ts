import { TestBed } from '@angular/core/testing';
import {
  DesignerRenderingService,
  PortType
} from './designer-rendering.service';
import { ProcessElement, ProcessDiagramConfig, ProcessConnection, ConnectionPort, Position } from '../../process-widget.models';
import { BoundingBox } from './designer-grouping.service';
import { PrimitiveBase, GroupPrimitive } from '../../primitives';

describe('DesignerRenderingService', () => {
  let service: DesignerRenderingService;

  // Helper to create a test element
  function createElement(id: string, position: Position, size: { width: number; height: number }): ProcessElement {
    return {
      id,
      type: 'tank',
      name: `Element-${id}`,
      position,
      size,
      visible: true
    } as ProcessElement;
  }

  // Helper to create a test diagram
  function createDiagram(elements: ProcessElement[], connections: ProcessConnection[] = []): ProcessDiagramConfig {
    return {
      id: 'test-diagram',
      name: 'Test',
      version: '1.0',
      canvas: { width: 1000, height: 800, backgroundColor: '#fff', gridSize: 10, showGrid: true },
      elements,
      primitives: [],
      symbolInstances: [],
      connections
    };
  }

  // Helper to create a test connection
  function createConnection(
    id: string,
    fromElementId: string,
    fromPort: ConnectionPort,
    toElementId: string,
    toPort: ConnectionPort
  ): ProcessConnection {
    return {
      id,
      from: { elementId: fromElementId, port: fromPort },
      to: { elementId: toElementId, port: toPort },
      style: { strokeColor: '#000', strokeWidth: 2 }
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerRenderingService]
    });
    service = TestBed.inject(DesignerRenderingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Connection Path Generation
  // ============================================================================

  describe('getConnectionPath', () => {
    it('should return empty string if from element not found', () => {
      const diagram = createDiagram([
        createElement('elem2', { x: 200, y: 100 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      expect(service.getConnectionPath(connection, diagram)).toBe('');
    });

    it('should return empty string if to element not found', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 0, y: 100 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      expect(service.getConnectionPath(connection, diagram)).toBe('');
    });

    it('should generate straight path between elements', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 0, y: 100 }, { width: 100, height: 100 }),
        createElement('elem2', { x: 200, y: 100 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      const path = service.getConnectionPath(connection, diagram, 'straight');

      // From element right port (100, 150) to element left port (200, 150)
      expect(path).toBe('M 100,150 L 200,150');
    });

    it('should generate orthogonal path between horizontal elements', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 0, y: 100 }, { width: 100, height: 100 }),
        createElement('elem2', { x: 200, y: 200 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      const path = service.getConnectionPath(connection, diagram, 'orthogonal');

      expect(path).toContain('M 100,150');
      expect(path).toContain('L 200,250');
    });

    it('should generate orthogonal path between vertical elements', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 100, y: 0 }, { width: 100, height: 100 }),
        createElement('elem2', { x: 100, y: 200 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'bottom', 'elem2', 'top');

      const path = service.getConnectionPath(connection, diagram, 'orthogonal');

      expect(path).toContain('M 150,100');
      expect(path).toContain('L 150,200');
    });

    it('should generate curved path', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 0, y: 100 }, { width: 100, height: 100 }),
        createElement('elem2', { x: 200, y: 100 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      const path = service.getConnectionPath(connection, diagram, 'curved');

      expect(path).toContain('M 100,150');
      expect(path).toContain('Q'); // Quadratic bezier
    });

    it('should default to straight path', () => {
      const diagram = createDiagram([
        createElement('elem1', { x: 0, y: 0 }, { width: 100, height: 100 }),
        createElement('elem2', { x: 200, y: 0 }, { width: 100, height: 100 })
      ]);
      const connection = createConnection('conn1', 'elem1', 'right', 'elem2', 'left');

      const path = service.getConnectionPath(connection, diagram);

      expect(path).toMatch(/^M \d+,\d+ L \d+,\d+$/);
    });
  });

  // ============================================================================
  // Port Position Calculation
  // ============================================================================

  describe('getPortPosition', () => {
    const element = createElement('elem1', { x: 100, y: 200 }, { width: 80, height: 60 });

    it('should calculate top port position', () => {
      const pos = service.getPortPosition(element, 'top');

      expect(pos).toEqual({ x: 140, y: 200 }); // center x, top y
    });

    it('should calculate bottom port position', () => {
      const pos = service.getPortPosition(element, 'bottom');

      expect(pos).toEqual({ x: 140, y: 260 }); // center x, bottom y
    });

    it('should calculate left port position', () => {
      const pos = service.getPortPosition(element, 'left');

      expect(pos).toEqual({ x: 100, y: 230 }); // left x, center y
    });

    it('should calculate right port position', () => {
      const pos = service.getPortPosition(element, 'right');

      expect(pos).toEqual({ x: 180, y: 230 }); // right x, center y
    });

    it('should calculate center port position', () => {
      const pos = service.getPortPosition(element, 'center');

      expect(pos).toEqual({ x: 140, y: 230 });
    });

    it('should default to center for unknown port', () => {
      const pos = service.getPortPosition(element, 'unknown' as PortType);

      expect(pos).toEqual({ x: 140, y: 230 });
    });
  });

  describe('getAllPortPositions', () => {
    it('should return all port positions', () => {
      const element = createElement('elem1', { x: 0, y: 0 }, { width: 100, height: 100 });
      const ports = service.getAllPortPositions(element);

      expect(ports.size).toBe(5);
      expect(ports.has('top')).toBeTrue();
      expect(ports.has('bottom')).toBeTrue();
      expect(ports.has('left')).toBeTrue();
      expect(ports.has('right')).toBeTrue();
      expect(ports.has('center')).toBeTrue();
    });

    it('should calculate correct positions for all ports', () => {
      const element = createElement('elem1', { x: 50, y: 50 }, { width: 100, height: 80 });
      const ports = service.getAllPortPositions(element);

      expect(ports.get('top')).toEqual({ x: 100, y: 50 });
      expect(ports.get('bottom')).toEqual({ x: 100, y: 130 });
      expect(ports.get('left')).toEqual({ x: 50, y: 90 });
      expect(ports.get('right')).toEqual({ x: 150, y: 90 });
      expect(ports.get('center')).toEqual({ x: 100, y: 90 });
    });
  });

  describe('findNearestPort', () => {
    const element = createElement('elem1', { x: 100, y: 100 }, { width: 100, height: 100 });

    it('should find top port when position is above', () => {
      const position = { x: 150, y: 50 };
      expect(service.findNearestPort(element, position)).toBe('top');
    });

    it('should find bottom port when position is below', () => {
      const position = { x: 150, y: 250 };
      expect(service.findNearestPort(element, position)).toBe('bottom');
    });

    it('should find left port when position is to the left', () => {
      const position = { x: 50, y: 150 };
      expect(service.findNearestPort(element, position)).toBe('left');
    });

    it('should find right port when position is to the right', () => {
      const position = { x: 250, y: 150 };
      expect(service.findNearestPort(element, position)).toBe('right');
    });

    it('should find center port when position is inside', () => {
      const position = { x: 150, y: 150 };
      expect(service.findNearestPort(element, position)).toBe('center');
    });
  });

  // ============================================================================
  // Bounding Box Calculation
  // ============================================================================

  describe('getElementBounds', () => {
    it('should return correct bounds for element', () => {
      const element = createElement('elem1', { x: 50, y: 100 }, { width: 80, height: 60 });
      const bounds = service.getElementBounds(element);

      expect(bounds).toEqual({ x: 50, y: 100, width: 80, height: 60 });
    });
  });

  describe('getSymbolBounds', () => {
    it('should return default bounds without provider', () => {
      const symbol = {
        id: 'sym1',
        type: 'symbol',
        libraryRtId: 'lib1',
        symbolRtId: 'sym-def-1',
        position: { x: 100, y: 200 },
        scale: 1
      } as any;

      const bounds = service.getSymbolBounds(symbol);

      expect(bounds).toEqual({ x: 100, y: 200, width: 100, height: 100 });
    });

    it('should apply scale to default bounds', () => {
      const symbol = {
        id: 'sym1',
        type: 'symbol',
        libraryRtId: 'lib1',
        symbolRtId: 'sym-def-1',
        position: { x: 100, y: 200 },
        scale: 2
      } as any;

      const bounds = service.getSymbolBounds(symbol);

      expect(bounds).toEqual({ x: 100, y: 200, width: 200, height: 200 });
    });

    it('should use bounds from provider', () => {
      const symbol = {
        id: 'sym1',
        type: 'symbol',
        libraryRtId: 'lib1',
        symbolRtId: 'sym-def-1',
        position: { x: 100, y: 200 },
        scale: 1
      } as any;

      const provider = (symbolRtId: string) => {
        if (symbolRtId === 'sym-def-1') {
          return { x: 0, y: 0, width: 80, height: 60 };
        }
        return null;
      };

      const bounds = service.getSymbolBounds(symbol, provider);

      expect(bounds).toEqual({ x: 100, y: 200, width: 80, height: 60 });
    });

    it('should apply scale to provider bounds', () => {
      const symbol = {
        id: 'sym1',
        type: 'symbol',
        libraryRtId: 'lib1',
        symbolRtId: 'sym-def-1',
        position: { x: 100, y: 200 },
        scale: 1.5
      } as any;

      const provider = () => ({ x: 0, y: 0, width: 100, height: 80 });

      const bounds = service.getSymbolBounds(symbol, provider);

      expect(bounds).toEqual({ x: 100, y: 200, width: 150, height: 120 });
    });

    it('should handle undefined scale', () => {
      const symbol = {
        id: 'sym1',
        type: 'symbol',
        libraryRtId: 'lib1',
        symbolRtId: 'sym-def-1',
        position: { x: 50, y: 50 }
      } as any;

      const bounds = service.getSymbolBounds(symbol);

      expect(bounds).toEqual({ x: 50, y: 50, width: 100, height: 100 });
    });
  });

  describe('getPrimitiveBounds', () => {
    it('should return bounds for group primitive', () => {
      const group: GroupPrimitive = {
        id: 'grp1',
        type: 'group',
        position: { x: 100, y: 100 },
        config: {
          childIds: ['child1'],
          originalBounds: { x: 100, y: 100, width: 200, height: 150 }
        }
      };

      const bounds = service.getPrimitiveBounds(group);

      expect(bounds).toEqual({ x: 100, y: 100, width: 200, height: 150 });
    });

    it('should return default bounds for group without originalBounds values', () => {
      const group = {
        id: 'grp1',
        type: 'group',
        position: { x: 100, y: 100 },
        config: { childIds: [], originalBounds: { x: 0, y: 0, width: 0, height: 0 } }
      } as GroupPrimitive;

      // Override to simulate missing values
      (group.config as any).originalBounds = undefined;

      const bounds = service.getPrimitiveBounds(group);

      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });

    it('should return bounds for rectangle', () => {
      const rect = {
        id: 'rect1',
        type: 'rectangle',
        position: { x: 50, y: 50 },
        width: 120,
        height: 80
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(rect);

      expect(bounds).toEqual({ x: 50, y: 50, width: 120, height: 80 });
    });

    it('should return bounds for ellipse (centered)', () => {
      const ellipse = {
        id: 'ell1',
        type: 'ellipse',
        position: { x: 100, y: 100 }, // center point
        rx: 60,
        ry: 40
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(ellipse);

      expect(bounds).toEqual({ x: 40, y: 60, width: 120, height: 80 });
    });

    it('should return bounds for line', () => {
      const line = {
        id: 'line1',
        type: 'line',
        position: { x: 50, y: 100 },
        x1: 50,
        y1: 100,
        x2: 150,
        y2: 200
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(line);

      expect(bounds).toEqual({ x: 50, y: 100, width: 100, height: 100 });
    });

    it('should return bounds for polygon from points', () => {
      const polygon = {
        id: 'poly1',
        type: 'polygon',
        position: { x: 0, y: 0 },
        points: [
          { x: 10, y: 20 },
          { x: 110, y: 20 },
          { x: 110, y: 80 },
          { x: 10, y: 80 }
        ]
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(polygon);

      expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 60 });
    });

    it('should return bounds for image', () => {
      const image = {
        id: 'img1',
        type: 'image',
        position: { x: 25, y: 35 },
        width: 200,
        height: 150
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(image);

      expect(bounds).toEqual({ x: 25, y: 35, width: 200, height: 150 });
    });

    it('should use bounds provider if available', () => {
      const rect = {
        id: 'rect1',
        type: 'rectangle',
        position: { x: 50, y: 50 }
      } as PrimitiveBase;

      const provider = {
        getBoundingBox: () => ({ x: 50, y: 50, width: 200, height: 100 })
      };

      const bounds = service.getPrimitiveBounds(rect, provider);

      expect(bounds).toEqual({ x: 50, y: 50, width: 200, height: 100 });
    });
  });

  describe('getCombinedBounds', () => {
    it('should return null for empty array', () => {
      expect(service.getCombinedBounds([])).toBeNull();
    });

    it('should return same bounds for single item', () => {
      const boxes: BoundingBox[] = [{ x: 10, y: 20, width: 100, height: 80 }];

      expect(service.getCombinedBounds(boxes)).toEqual({ x: 10, y: 20, width: 100, height: 80 });
    });

    it('should combine multiple non-overlapping boxes', () => {
      const boxes: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 }
      ];

      expect(service.getCombinedBounds(boxes)).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    });

    it('should combine overlapping boxes', () => {
      const boxes: BoundingBox[] = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      ];

      expect(service.getCombinedBounds(boxes)).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    });
  });

  // ============================================================================
  // Transform Generation
  // ============================================================================

  describe('getSymbolTransform', () => {
    it('should generate translate only for default symbol', () => {
      const symbol = {
        id: 'sym1',
        position: { x: 100, y: 200 },
        scale: 1,
        rotation: 0
      } as any;

      const transform = service.getSymbolTransform(symbol);

      expect(transform).toBe('translate(100, 200)');
    });

    it('should include scale when not 1', () => {
      const symbol = {
        id: 'sym1',
        position: { x: 100, y: 200 },
        scale: 2,
        rotation: 0
      } as any;

      const transform = service.getSymbolTransform(symbol);

      expect(transform).toContain('translate(100, 200)');
      expect(transform).toContain('scale(2)');
    });

    it('should include rotation when not 0', () => {
      const symbol = {
        id: 'sym1',
        position: { x: 100, y: 200 },
        scale: 1,
        rotation: 45
      } as any;

      const transform = service.getSymbolTransform(symbol);

      expect(transform).toContain('translate(100, 200)');
      expect(transform).toContain('rotate(45');
    });

    it('should handle undefined scale and rotation', () => {
      const symbol = {
        id: 'sym1',
        position: { x: 50, y: 75 }
      } as any;

      const transform = service.getSymbolTransform(symbol);

      expect(transform).toBe('translate(50, 75)');
    });
  });

  describe('getPrimitiveTransform', () => {
    it('should generate translate for primitive', () => {
      const primitive = {
        id: 'prim1',
        type: 'rectangle',
        position: { x: 150, y: 250 }
      } as PrimitiveBase;

      const transform = service.getPrimitiveTransform(primitive);

      expect(transform).toBe('translate(150, 250)');
    });

    it('should include rotation when provided', () => {
      const primitive = {
        id: 'prim1',
        type: 'rectangle',
        position: { x: 150, y: 250 },
        width: 100,
        height: 80
      } as PrimitiveBase;

      const transform = service.getPrimitiveTransform(primitive, 90);

      expect(transform).toContain('translate(150, 250)');
      expect(transform).toContain('rotate(90');
    });

    it('should not include rotation when 0', () => {
      const primitive = {
        id: 'prim1',
        type: 'rectangle',
        position: { x: 100, y: 100 }
      } as PrimitiveBase;

      const transform = service.getPrimitiveTransform(primitive, 0);

      expect(transform).not.toContain('rotate');
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const distance = service.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for same point', () => {
      const distance = service.calculateDistance({ x: 100, y: 200 }, { x: 100, y: 200 });

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = service.calculateDistance({ x: -10, y: -10 }, { x: 10, y: 10 });

      expect(distance).toBeCloseTo(Math.sqrt(800), 5);
    });
  });

  describe('isPointInBounds', () => {
    const bounds: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };

    it('should return true for point inside bounds', () => {
      expect(service.isPointInBounds({ x: 125, y: 125 }, bounds)).toBeTrue();
    });

    it('should return true for point on edge', () => {
      expect(service.isPointInBounds({ x: 100, y: 100 }, bounds)).toBeTrue();
      expect(service.isPointInBounds({ x: 150, y: 150 }, bounds)).toBeTrue();
    });

    it('should return false for point outside bounds', () => {
      expect(service.isPointInBounds({ x: 50, y: 125 }, bounds)).toBeFalse();
      expect(service.isPointInBounds({ x: 200, y: 125 }, bounds)).toBeFalse();
    });

    it('should account for padding', () => {
      expect(service.isPointInBounds({ x: 95, y: 125 }, bounds, 10)).toBeTrue();
      expect(service.isPointInBounds({ x: 85, y: 125 }, bounds, 10)).toBeFalse();
    });
  });

  describe('doBoundsIntersect', () => {
    it('should return true for overlapping bounds', () => {
      const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const b: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };

      expect(service.doBoundsIntersect(a, b)).toBeTrue();
    });

    it('should return true for touching bounds', () => {
      const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const b: BoundingBox = { x: 100, y: 0, width: 100, height: 100 };

      expect(service.doBoundsIntersect(a, b)).toBeTrue();
    });

    it('should return false for separated bounds', () => {
      const a: BoundingBox = { x: 0, y: 0, width: 50, height: 50 };
      const b: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };

      expect(service.doBoundsIntersect(a, b)).toBeFalse();
    });

    it('should return true for contained bounds', () => {
      const a: BoundingBox = { x: 0, y: 0, width: 200, height: 200 };
      const b: BoundingBox = { x: 50, y: 50, width: 50, height: 50 };

      expect(service.doBoundsIntersect(a, b)).toBeTrue();
    });
  });

  describe('doesBoundsContain', () => {
    it('should return true when container fully contains other', () => {
      const container: BoundingBox = { x: 0, y: 0, width: 200, height: 200 };
      const contained: BoundingBox = { x: 50, y: 50, width: 50, height: 50 };

      expect(service.doesBoundsContain(container, contained)).toBeTrue();
    });

    it('should return true for same bounds', () => {
      const bounds: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };

      expect(service.doesBoundsContain(bounds, bounds)).toBeTrue();
    });

    it('should return false when partially overlapping', () => {
      const container: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const contained: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };

      expect(service.doesBoundsContain(container, contained)).toBeFalse();
    });

    it('should return false when separated', () => {
      const container: BoundingBox = { x: 0, y: 0, width: 50, height: 50 };
      const contained: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };

      expect(service.doesBoundsContain(container, contained)).toBeFalse();
    });
  });

  describe('getBoundsCenter', () => {
    it('should return center of bounds', () => {
      const bounds: BoundingBox = { x: 100, y: 100, width: 200, height: 100 };

      expect(service.getBoundsCenter(bounds)).toEqual({ x: 200, y: 150 });
    });

    it('should handle origin bounds', () => {
      const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };

      expect(service.getBoundsCenter(bounds)).toEqual({ x: 50, y: 50 });
    });
  });

  describe('expandBounds', () => {
    it('should expand bounds by padding', () => {
      const bounds: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };
      const expanded = service.expandBounds(bounds, 10);

      expect(expanded).toEqual({ x: 90, y: 90, width: 70, height: 70 });
    });

    it('should handle zero padding', () => {
      const bounds: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };
      const expanded = service.expandBounds(bounds, 0);

      expect(expanded).toEqual(bounds);
    });

    it('should handle negative padding (shrink)', () => {
      const bounds: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };
      const expanded = service.expandBounds(bounds, -5);

      expect(expanded).toEqual({ x: 105, y: 105, width: 40, height: 40 });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle zero-size elements', () => {
      const element = createElement('elem1', { x: 100, y: 100 }, { width: 0, height: 0 });
      const bounds = service.getElementBounds(element);

      expect(bounds).toEqual({ x: 100, y: 100, width: 0, height: 0 });
    });

    it('should handle horizontal line bounds', () => {
      const line = {
        id: 'line1',
        type: 'line',
        position: { x: 0, y: 50 },
        x1: 0,
        y1: 50,
        x2: 100,
        y2: 50
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(line);

      expect(bounds.height).toBe(1); // Minimum height for horizontal line
    });

    it('should handle empty polygon points', () => {
      const polygon = {
        id: 'poly1',
        type: 'polygon',
        position: { x: 0, y: 0 },
        points: []
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(polygon);

      expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 }); // Fallback
    });

    it('should handle text with empty content', () => {
      const text = {
        id: 'text1',
        type: 'text',
        position: { x: 100, y: 100 },
        text: ''
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(text);

      expect(bounds.x).toBe(100);
      expect(bounds.width).toBe(0);
    });
  });
});
