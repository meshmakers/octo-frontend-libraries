import { TestBed } from '@angular/core/testing';
import { PathEditorService, PathSegment, MoveToSegment, LineToSegment, CubicBezierSegment, QuadraticBezierSegment, ArcSegment, HorizontalLineSegment, VerticalLineSegment, ClosePathSegment } from './path-editor.service';

describe('PathEditorService', () => {
  let service: PathEditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PathEditorService]
    });
    service = TestBed.inject(PathEditorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Parsing - Basic Commands
  // ============================================================================

  describe('parse', () => {
    describe('MoveTo (M/m)', () => {
      it('should parse absolute MoveTo command', () => {
        const result = service.parse('M10,20');

        expect(result.segments.length).toBe(1);
        const segment = result.segments[0] as MoveToSegment;
        expect(segment.command).toBe('M');
        expect(segment.isRelative).toBeFalse();
        expect(segment.point).toEqual({ x: 10, y: 20 });
      });

      it('should parse relative MoveTo command', () => {
        const result = service.parse('m10,20');

        expect(result.segments.length).toBe(1);
        const segment = result.segments[0] as MoveToSegment;
        expect(segment.command).toBe('m');
        expect(segment.isRelative).toBeTrue();
        expect(segment.point).toEqual({ x: 10, y: 20 });
      });

      it('should parse multiple MoveTo coordinates as separate segments', () => {
        const result = service.parse('M10,20 30,40');

        expect(result.segments.length).toBe(2);
        expect((result.segments[0] as MoveToSegment).point).toEqual({ x: 10, y: 20 });
        expect((result.segments[1] as MoveToSegment).point).toEqual({ x: 30, y: 40 });
      });

      it('should create nodes for MoveTo', () => {
        const result = service.parse('M10,20');

        expect(result.nodes.length).toBe(1);
        expect(result.nodes[0].type).toBe('point');
        expect(result.nodes[0].position).toEqual({ x: 10, y: 20 });
      });
    });

    describe('LineTo (L/l)', () => {
      it('should parse absolute LineTo command', () => {
        const result = service.parse('M0,0 L50,50');

        expect(result.segments.length).toBe(2);
        const segment = result.segments[1] as LineToSegment;
        expect(segment.command).toBe('L');
        expect(segment.isRelative).toBeFalse();
        expect(segment.point).toEqual({ x: 50, y: 50 });
      });

      it('should parse relative LineTo command', () => {
        const result = service.parse('M0,0 l50,50');

        const segment = result.segments[1] as LineToSegment;
        expect(segment.command).toBe('l');
        expect(segment.isRelative).toBeTrue();
      });

      it('should parse multiple LineTo points', () => {
        const result = service.parse('M0,0 L10,10 20,20 30,30');

        expect(result.segments.length).toBe(4);
        expect((result.segments[1] as LineToSegment).point).toEqual({ x: 10, y: 10 });
        expect((result.segments[2] as LineToSegment).point).toEqual({ x: 20, y: 20 });
        expect((result.segments[3] as LineToSegment).point).toEqual({ x: 30, y: 30 });
      });
    });

    describe('Horizontal/Vertical LineTo (H/h/V/v)', () => {
      it('should parse absolute HorizontalLineTo', () => {
        const result = service.parse('M0,0 H50');

        const segment = result.segments[1] as HorizontalLineSegment;
        expect(segment.command).toBe('H');
        expect(segment.x).toBe(50);
      });

      it('should parse absolute VerticalLineTo', () => {
        const result = service.parse('M0,0 V50');

        const segment = result.segments[1] as VerticalLineSegment;
        expect(segment.command).toBe('V');
        expect(segment.y).toBe(50);
      });

      it('should create nodes at correct positions for H command', () => {
        const result = service.parse('M10,20 H50');

        // M creates node at (10,20), H creates node at (50,20) - same Y
        expect(result.nodes.length).toBe(2);
        expect(result.nodes[1].position).toEqual({ x: 50, y: 20 });
      });

      it('should create nodes at correct positions for V command', () => {
        const result = service.parse('M10,20 V50');

        // M creates node at (10,20), V creates node at (10,50) - same X
        expect(result.nodes.length).toBe(2);
        expect(result.nodes[1].position).toEqual({ x: 10, y: 50 });
      });
    });

    describe('Cubic Bezier (C/c)', () => {
      it('should parse absolute Cubic Bezier', () => {
        const result = service.parse('M0,0 C10,20 30,40 50,60');

        const segment = result.segments[1] as CubicBezierSegment;
        expect(segment.command).toBe('C');
        expect(segment.controlPoint1).toEqual({ x: 10, y: 20 });
        expect(segment.controlPoint2).toEqual({ x: 30, y: 40 });
        expect(segment.point).toEqual({ x: 50, y: 60 });
      });

      it('should create 3 nodes for Cubic Bezier (2 control + 1 point)', () => {
        const result = service.parse('M0,0 C10,20 30,40 50,60');

        // M creates 1 node, C creates 3 nodes
        expect(result.nodes.length).toBe(4);
        expect(result.nodes[1].type).toBe('controlPoint1');
        expect(result.nodes[2].type).toBe('controlPoint2');
        expect(result.nodes[3].type).toBe('point');
      });
    });

    describe('Quadratic Bezier (Q/q)', () => {
      it('should parse absolute Quadratic Bezier', () => {
        const result = service.parse('M0,0 Q25,50 50,0');

        const segment = result.segments[1] as QuadraticBezierSegment;
        expect(segment.command).toBe('Q');
        expect(segment.controlPoint).toEqual({ x: 25, y: 50 });
        expect(segment.point).toEqual({ x: 50, y: 0 });
      });

      it('should create 2 nodes for Quadratic Bezier (1 control + 1 point)', () => {
        const result = service.parse('M0,0 Q25,50 50,0');

        // M creates 1 node, Q creates 2 nodes
        expect(result.nodes.length).toBe(3);
        expect(result.nodes[1].type).toBe('controlPoint');
        expect(result.nodes[2].type).toBe('point');
      });
    });

    describe('Arc (A/a)', () => {
      it('should parse absolute Arc', () => {
        const result = service.parse('M0,0 A10,20 30 1 0 50,60');

        const segment = result.segments[1] as ArcSegment;
        expect(segment.command).toBe('A');
        expect(segment.rx).toBe(10);
        expect(segment.ry).toBe(20);
        expect(segment.xAxisRotation).toBe(30);
        expect(segment.largeArcFlag).toBeTrue();
        expect(segment.sweepFlag).toBeFalse();
        expect(segment.point).toEqual({ x: 50, y: 60 });
      });
    });

    describe('ClosePath (Z/z)', () => {
      it('should parse ClosePath', () => {
        const result = service.parse('M0,0 L50,50 Z');

        const segment = result.segments[2] as ClosePathSegment;
        expect(segment.command).toBe('Z');
      });

      it('should parse lowercase closepath', () => {
        const result = service.parse('M0,0 L50,50 z');

        const segment = result.segments[2] as ClosePathSegment;
        expect(segment.command).toBe('z');
      });
    });

    describe('Complex paths', () => {
      it('should parse path with multiple command types', () => {
        const result = service.parse('M10,10 L50,50 C60,70 80,90 100,100 Z');

        expect(result.segments.length).toBe(4);
        expect(result.segments[0].command).toBe('M');
        expect(result.segments[1].command).toBe('L');
        expect(result.segments[2].command).toBe('C');
        expect(result.segments[3].command).toBe('Z');
      });

      it('should handle empty path string', () => {
        const result = service.parse('');

        expect(result.segments).toEqual([]);
        expect(result.nodes).toEqual([]);
      });

      it('should handle whitespace variations', () => {
        const result1 = service.parse('M10,20L30,40');
        const result2 = service.parse('M10,20 L30,40');
        const result3 = service.parse('M 10 20 L 30 40');

        expect(result1.segments.length).toBe(2);
        expect(result2.segments.length).toBe(2);
        expect(result3.segments.length).toBe(2);
      });

      it('should preserve original path string', () => {
        const original = 'M10,20 L30,40';
        const result = service.parse(original);

        expect(result.original).toBe(original);
      });
    });

    describe('Relative command position calculation', () => {
      it('should calculate absolute positions for relative commands', () => {
        const result = service.parse('M10,20 l30,40');

        // M creates node at (10,20)
        // l30,40 is relative, so node should be at (10+30, 20+40) = (40, 60)
        expect(result.nodes[1].position).toEqual({ x: 40, y: 60 });
      });

      it('should chain relative positions correctly', () => {
        const result = service.parse('M10,10 l10,0 l0,10 l-10,0 z');

        // Start at (10,10)
        // l10,0 -> (20,10)
        // l0,10 -> (20,20)
        // l-10,0 -> (10,20)
        expect(result.nodes[0].position).toEqual({ x: 10, y: 10 });
        expect(result.nodes[1].position).toEqual({ x: 20, y: 10 });
        expect(result.nodes[2].position).toEqual({ x: 20, y: 20 });
        expect(result.nodes[3].position).toEqual({ x: 10, y: 20 });
      });
    });
  });

  // ============================================================================
  // Serialization
  // ============================================================================

  describe('serialize', () => {
    it('should serialize MoveTo', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'M',
        isRelative: false,
        point: { x: 10, y: 20 }
      } as MoveToSegment];

      expect(service.serialize(segments)).toBe('M10,20');
    });

    it('should serialize LineTo', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'L',
        isRelative: false,
        point: { x: 50, y: 60 }
      } as LineToSegment];

      expect(service.serialize(segments)).toBe('L50,60');
    });

    it('should serialize HorizontalLineTo', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'H',
        isRelative: false,
        x: 100
      } as HorizontalLineSegment];

      expect(service.serialize(segments)).toBe('H100');
    });

    it('should serialize VerticalLineTo', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'V',
        isRelative: false,
        y: 100
      } as VerticalLineSegment];

      expect(service.serialize(segments)).toBe('V100');
    });

    it('should serialize Cubic Bezier', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'C',
        isRelative: false,
        controlPoint1: { x: 10, y: 20 },
        controlPoint2: { x: 30, y: 40 },
        point: { x: 50, y: 60 }
      } as CubicBezierSegment];

      expect(service.serialize(segments)).toBe('C10,20 30,40 50,60');
    });

    it('should serialize Quadratic Bezier', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'Q',
        isRelative: false,
        controlPoint: { x: 25, y: 50 },
        point: { x: 50, y: 0 }
      } as QuadraticBezierSegment];

      expect(service.serialize(segments)).toBe('Q25,50 50,0');
    });

    it('should serialize Arc', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'A',
        isRelative: false,
        rx: 10,
        ry: 20,
        xAxisRotation: 30,
        largeArcFlag: true,
        sweepFlag: false,
        point: { x: 50, y: 60 }
      } as ArcSegment];

      expect(service.serialize(segments)).toBe('A10,20 30 1 0 50,60');
    });

    it('should serialize ClosePath', () => {
      const segments: PathSegment[] = [{
        id: '1',
        command: 'Z',
        isRelative: false
      } as ClosePathSegment];

      expect(service.serialize(segments)).toBe('Z');
    });

    it('should serialize multiple segments', () => {
      const segments: PathSegment[] = [
        { id: '1', command: 'M', isRelative: false, point: { x: 0, y: 0 } } as MoveToSegment,
        { id: '2', command: 'L', isRelative: false, point: { x: 50, y: 50 } } as LineToSegment,
        { id: '3', command: 'Z', isRelative: false } as ClosePathSegment
      ];

      expect(service.serialize(segments)).toBe('M0,0 L50,50 Z');
    });

    it('should round-trip parse and serialize', () => {
      const original = 'M10,20 L30,40 C50,60 70,80 90,100 Z';
      const parsed = service.parse(original);
      const serialized = service.serialize(parsed.segments);

      // Re-parse to compare structures
      const reparsed = service.parse(serialized);

      expect(reparsed.segments.length).toBe(parsed.segments.length);
      for (let i = 0; i < parsed.segments.length; i++) {
        expect(reparsed.segments[i].command).toBe(parsed.segments[i].command);
      }
    });
  });

  // ============================================================================
  // State Management
  // ============================================================================

  describe('loadPath', () => {
    it('should load path and update state', () => {
      service.loadPath('M10,20 L30,40');

      expect(service.currentPath()).not.toBeNull();
      expect(service.segments().length).toBe(2);
      expect(service.nodes().length).toBe(2);
    });

    it('should clear selection when loading', () => {
      service.loadPath('M10,20');
      service.selectNode(service.nodes()[0].id);

      service.loadPath('M50,60');

      expect(service.selectedNodeId()).toBeNull();
    });

    it('should reset dirty flag when loading', () => {
      service.loadPath('M10,20');
      service.moveNode(service.nodes()[0].id, { x: 100, y: 100 });

      expect(service.isDirty()).toBeTrue();

      service.loadPath('M50,60');

      expect(service.isDirty()).toBeFalse();
    });
  });

  describe('clearPath', () => {
    it('should clear all state', () => {
      service.loadPath('M10,20 L30,40');
      service.selectNode(service.nodes()[0].id);

      service.clearPath();

      expect(service.currentPath()).toBeNull();
      expect(service.segments()).toEqual([]);
      expect(service.nodes()).toEqual([]);
      expect(service.selectedNodeId()).toBeNull();
      expect(service.isDirty()).toBeFalse();
    });
  });

  describe('selectNode', () => {
    it('should select a node', () => {
      service.loadPath('M10,20 L30,40');
      const nodeId = service.nodes()[0].id;

      service.selectNode(nodeId);

      expect(service.selectedNodeId()).toBe(nodeId);
      expect(service.selectedNode()).not.toBeNull();
      expect(service.selectedNode()?.id).toBe(nodeId);
    });

    it('should clear selection with null', () => {
      service.loadPath('M10,20');
      service.selectNode(service.nodes()[0].id);

      service.selectNode(null);

      expect(service.selectedNodeId()).toBeNull();
      expect(service.selectedNode()).toBeNull();
    });
  });

  // ============================================================================
  // Node Manipulation
  // ============================================================================

  describe('moveNode', () => {
    it('should move a point node', () => {
      service.loadPath('M10,20');
      const nodeId = service.nodes()[0].id;

      service.moveNode(nodeId, { x: 100, y: 200 });

      const node = service.nodes().find(n => n.id === nodeId);
      expect(node?.position).toEqual({ x: 100, y: 200 });
    });

    it('should update segment when moving node', () => {
      service.loadPath('M10,20');
      const nodeId = service.nodes()[0].id;

      service.moveNode(nodeId, { x: 100, y: 200 });

      const segment = service.segments()[0] as MoveToSegment;
      expect(segment.point).toEqual({ x: 100, y: 200 });
    });

    it('should set dirty flag when moving', () => {
      service.loadPath('M10,20');

      service.moveNode(service.nodes()[0].id, { x: 100, y: 200 });

      expect(service.isDirty()).toBeTrue();
    });

    it('should move control points in cubic bezier', () => {
      service.loadPath('M0,0 C10,20 30,40 50,60');
      const controlPoint1Node = service.nodes().find(n => n.type === 'controlPoint1');

      service.moveNode(controlPoint1Node!.id, { x: 15, y: 25 });

      const segment = service.segments()[1] as CubicBezierSegment;
      expect(segment.controlPoint1).toEqual({ x: 15, y: 25 });
    });

    it('should preserve node ID after move', () => {
      service.loadPath('M10,20');
      const originalId = service.nodes()[0].id;

      service.moveNode(originalId, { x: 100, y: 200 });

      expect(service.nodes()[0].id).toBe(originalId);
    });

    it('should do nothing for invalid node ID', () => {
      service.loadPath('M10,20');
      const originalNode = service.nodes()[0];

      service.moveNode('invalid-id', { x: 100, y: 200 });

      expect(service.nodes()[0].position).toEqual(originalNode.position);
    });
  });

  // ============================================================================
  // Segment Operations
  // ============================================================================

  describe('deleteSegment', () => {
    it('should delete a segment', () => {
      service.loadPath('M0,0 L10,10 L20,20');
      const segmentToDelete = service.segments()[1];

      service.deleteSegment(segmentToDelete.id);

      expect(service.segments().length).toBe(2);
      expect(service.segments().find(s => s.id === segmentToDelete.id)).toBeUndefined();
    });

    it('should clear selection after delete', () => {
      service.loadPath('M0,0 L10,10');
      service.selectNode(service.nodes()[0].id);

      service.deleteSegment(service.segments()[1].id);

      expect(service.selectedNodeId()).toBeNull();
    });

    it('should set dirty flag', () => {
      service.loadPath('M0,0 L10,10');

      service.deleteSegment(service.segments()[1].id);

      expect(service.isDirty()).toBeTrue();
    });
  });

  describe('convertSegmentType', () => {
    it('should convert LineTo to Cubic Bezier', () => {
      service.loadPath('M0,0 L100,100');
      const lineSegment = service.segments()[1];

      service.convertSegmentType(lineSegment.id, 'C');

      const newSegment = service.segments()[1] as CubicBezierSegment;
      expect(newSegment.command).toBe('C');
      expect(newSegment.point).toEqual({ x: 100, y: 100 });
      expect(newSegment.controlPoint1).toBeDefined();
      expect(newSegment.controlPoint2).toBeDefined();
    });

    it('should convert LineTo to Quadratic Bezier', () => {
      service.loadPath('M0,0 L100,100');
      const lineSegment = service.segments()[1];

      service.convertSegmentType(lineSegment.id, 'Q');

      const newSegment = service.segments()[1] as QuadraticBezierSegment;
      expect(newSegment.command).toBe('Q');
      expect(newSegment.point).toEqual({ x: 100, y: 100 });
      expect(newSegment.controlPoint).toBeDefined();
    });

    it('should set dirty flag after conversion', () => {
      service.loadPath('M0,0 L100,100');

      service.convertSegmentType(service.segments()[1].id, 'C');

      expect(service.isDirty()).toBeTrue();
    });
  });

  describe('updateFromText', () => {
    it('should update path from text', () => {
      service.loadPath('M0,0');

      service.updateFromText('M10,20 L30,40');

      expect(service.segments().length).toBe(2);
      expect((service.segments()[0] as MoveToSegment).point).toEqual({ x: 10, y: 20 });
    });

    it('should set dirty flag', () => {
      service.loadPath('M0,0');

      service.updateFromText('M10,20');

      expect(service.isDirty()).toBeTrue();
    });
  });

  describe('getCurrentPathString', () => {
    it('should return serialized path', () => {
      service.loadPath('M10,20 L30,40');

      const result = service.getCurrentPathString();

      expect(result).toBe('M10,20 L30,40');
    });

    it('should return empty string when no path loaded', () => {
      expect(service.getCurrentPathString()).toBe('');
    });

    it('should reflect changes after move', () => {
      service.loadPath('M10,20');
      service.moveNode(service.nodes()[0].id, { x: 100, y: 200 });

      const result = service.getCurrentPathString();

      expect(result).toBe('M100,200');
    });
  });

  // ============================================================================
  // Path Normalization
  // ============================================================================

  describe('normalizePath', () => {
    it('should not change path with positive coordinates', () => {
      const result = service.normalizePath('M10,20 L30,40');

      expect(result.normalizedPath).toBe('M10,20 L30,40');
      expect(result.offset).toEqual({ x: 0, y: 0 });
    });

    it('should shift path with negative X coordinates', () => {
      const result = service.normalizePath('M-10,20 L30,40');

      // Should shift X by +10 to make min X = 0
      expect(result.offset).toEqual({ x: -10, y: 0 });
      // Normalized path should have shifted coordinates
      const parsed = service.parse(result.normalizedPath);
      expect(parsed.nodes[0].position.x).toBe(0); // -10 + 10 = 0
    });

    it('should shift path with negative Y coordinates', () => {
      const result = service.normalizePath('M10,-20 L30,40');

      expect(result.offset).toEqual({ x: 0, y: -20 });
    });

    it('should shift path with both negative coordinates', () => {
      const result = service.normalizePath('M-10,-20 L30,40');

      expect(result.offset).toEqual({ x: -10, y: -20 });
    });

    it('should handle empty path', () => {
      const result = service.normalizePath('');

      expect(result.normalizedPath).toBe('');
      expect(result.offset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('shiftSegment', () => {
    it('should shift MoveTo segment', () => {
      const segment: MoveToSegment = {
        id: '1',
        command: 'M',
        isRelative: false,
        point: { x: 10, y: 20 }
      };

      const shifted = service.shiftSegment(segment, 5, 10) as MoveToSegment;

      expect(shifted.point).toEqual({ x: 15, y: 30 });
    });

    it('should shift LineTo segment', () => {
      const segment: LineToSegment = {
        id: '1',
        command: 'L',
        isRelative: false,
        point: { x: 50, y: 60 }
      };

      const shifted = service.shiftSegment(segment, -10, -20) as LineToSegment;

      expect(shifted.point).toEqual({ x: 40, y: 40 });
    });

    it('should shift Cubic Bezier with all points', () => {
      const segment: CubicBezierSegment = {
        id: '1',
        command: 'C',
        isRelative: false,
        controlPoint1: { x: 10, y: 20 },
        controlPoint2: { x: 30, y: 40 },
        point: { x: 50, y: 60 }
      };

      const shifted = service.shiftSegment(segment, 5, 5) as CubicBezierSegment;

      expect(shifted.controlPoint1).toEqual({ x: 15, y: 25 });
      expect(shifted.controlPoint2).toEqual({ x: 35, y: 45 });
      expect(shifted.point).toEqual({ x: 55, y: 65 });
    });

    it('should not shift relative segments', () => {
      const segment: LineToSegment = {
        id: '1',
        command: 'l',
        isRelative: true,
        point: { x: 50, y: 60 }
      };

      const shifted = service.shiftSegment(segment, 100, 100);

      // Should be unchanged
      expect(shifted).toEqual(segment);
    });

    it('should shift H segment X only', () => {
      const segment: HorizontalLineSegment = {
        id: '1',
        command: 'H',
        isRelative: false,
        x: 100
      };

      const shifted = service.shiftSegment(segment, 10, 20) as HorizontalLineSegment;

      expect(shifted.x).toBe(110);
    });

    it('should shift V segment Y only', () => {
      const segment: VerticalLineSegment = {
        id: '1',
        command: 'V',
        isRelative: false,
        y: 100
      };

      const shifted = service.shiftSegment(segment, 10, 20) as VerticalLineSegment;

      expect(shifted.y).toBe(120);
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('isCurveSegment', () => {
    it('should return true for C command', () => {
      const segment = { command: 'C' } as PathSegment;
      expect(service.isCurveSegment(segment)).toBeTrue();
    });

    it('should return true for Q command', () => {
      const segment = { command: 'Q' } as PathSegment;
      expect(service.isCurveSegment(segment)).toBeTrue();
    });

    it('should return true for lowercase c command', () => {
      const segment = { command: 'c' } as PathSegment;
      expect(service.isCurveSegment(segment)).toBeTrue();
    });

    it('should return false for L command', () => {
      const segment = { command: 'L' } as PathSegment;
      expect(service.isCurveSegment(segment)).toBeFalse();
    });

    it('should return false for M command', () => {
      const segment = { command: 'M' } as PathSegment;
      expect(service.isCurveSegment(segment)).toBeFalse();
    });
  });

  describe('getAbsolutePosition', () => {
    it('should return node position directly', () => {
      service.loadPath('M10,20');
      const node = service.nodes()[0];

      const pos = service.getAbsolutePosition(node);

      expect(pos).toEqual({ x: 10, y: 20 });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle negative coordinates', () => {
      const result = service.parse('M-10,-20 L-30,-40');

      expect(result.nodes[0].position).toEqual({ x: -10, y: -20 });
      expect(result.nodes[1].position).toEqual({ x: -30, y: -40 });
    });

    it('should handle decimal coordinates', () => {
      const result = service.parse('M10.5,20.75 L30.25,40.125');

      expect(result.nodes[0].position).toEqual({ x: 10.5, y: 20.75 });
      expect(result.nodes[1].position).toEqual({ x: 30.25, y: 40.125 });
    });

    it('should handle scientific notation', () => {
      const result = service.parse('M1e2,2e3');

      expect(result.nodes[0].position).toEqual({ x: 100, y: 2000 });
    });

    it('should handle very large coordinates', () => {
      const result = service.parse('M999999,888888');

      expect(result.nodes[0].position).toEqual({ x: 999999, y: 888888 });
    });

    it('should handle zero coordinates', () => {
      const result = service.parse('M0,0 L0,0');

      expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(result.nodes[1].position).toEqual({ x: 0, y: 0 });
    });
  });
});
