import { TestBed } from '@angular/core/testing';
import { DesignerAlignmentService } from './designer-alignment.service';
import { DesignerBoundsService } from './designer-bounds.service';
import { DesignerPrimitiveService } from './designer-primitive.service';
import { PrimitiveBase, PrimitiveType } from '../../primitives';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { SymbolInstance, SymbolDefinition } from '../../primitives/models/symbol.model';

describe('DesignerAlignmentService', () => {
  let service: DesignerAlignmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerAlignmentService, DesignerBoundsService, DesignerPrimitiveService]
    });
    service = TestBed.inject(DesignerAlignmentService);
  });

  function createRectangle(id: string, x: number, y: number, width: number, height: number): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Rectangle,
      position: { x, y },
      config: { width, height }
    } as PrimitiveBase;
  }

  function createElement(id: string, x: number, y: number, width: number, height: number): ProcessElement {
    return {
      id,
      name: `Element ${id}`,
      type: 'tank',
      position: { x, y },
      size: { width, height },
      config: {}
    } as ProcessElement;
  }

  function createSymbol(id: string, symbolRtId: string, x: number, y: number, scale = 1): SymbolInstance {
    return {
      id,
      type: 'symbol',
      libraryRtId: 'lib-1',
      symbolRtId,
      position: { x, y },
      scale
    };
  }

  function createSymbolDefinition(bounds: { width: number; height: number }): SymbolDefinition {
    return {
      rtId: 'symbol-def-1',
      name: 'Test Symbol',
      version: '1.0.0',
      primitives: [],
      bounds,
      symbolInstances: []
    };
  }

  function createDiagram(overrides: Partial<ProcessDiagramConfig> = {}): ProcessDiagramConfig {
    return {
      id: 'test-diagram-1',
      name: 'Test Diagram',
      version: '1.0.0',
      canvas: { width: 1000, height: 800, gridSize: 20, showGrid: false },
      primitives: [],
      elements: [],
      connections: [],
      symbolInstances: [],
      ...overrides
    };
  }

  const noSymbolLookup = () => null;

  describe('canAlign', () => {
    it('should return false for less than 2 items', () => {
      expect(service.canAlign(new Set())).toBe(false);
      expect(service.canAlign(new Set(['a']))).toBe(false);
    });

    it('should return true for 2 or more items', () => {
      expect(service.canAlign(new Set(['a', 'b']))).toBe(true);
      expect(service.canAlign(new Set(['a', 'b', 'c']))).toBe(true);
    });
  });

  describe('canDistribute', () => {
    it('should return false for less than 3 items', () => {
      expect(service.canDistribute(new Set())).toBe(false);
      expect(service.canDistribute(new Set(['a']))).toBe(false);
      expect(service.canDistribute(new Set(['a', 'b']))).toBe(false);
    });

    it('should return true for 3 or more items', () => {
      expect(service.canDistribute(new Set(['a', 'b', 'c']))).toBe(true);
    });
  });

  describe('alignLeft', () => {
    it('should return null for less than 2 selected items', () => {
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 100, 100, 50, 50)]
      });
      expect(service.alignLeft(new Set(['r1']), diagram, noSymbolLookup)).toBeNull();
    });

    it('should align primitives to left edge', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),
          createRectangle('r2', 200, 100, 60, 60),
          createRectangle('r3', 50, 150, 40, 40)
        ]
      });

      const result = service.alignLeft(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      expect(result!.primitives![0].position.x).toBe(50); // r1 moved to x=50
      expect(result!.primitives![1].position.x).toBe(50); // r2 moved to x=50
      expect(result!.primitives![2].position.x).toBe(50); // r3 stays at x=50
    });

    it('should preserve Y positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),
          createRectangle('r2', 200, 100, 60, 60)
        ]
      });

      const result = service.alignLeft(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.y).toBe(50);
      expect(result!.primitives![1].position.y).toBe(100);
    });

    it('should work with elements', () => {
      const diagram = createDiagram({
        elements: [
          createElement('e1', 100, 50, 80, 60),
          createElement('e2', 50, 100, 100, 80)
        ]
      });

      const result = service.alignLeft(new Set(['e1', 'e2']), diagram, noSymbolLookup);

      expect(result!.elements![0].position.x).toBe(50);
      expect(result!.elements![1].position.x).toBe(50);
    });

    it('should work with symbols', () => {
      const symbolDef = createSymbolDefinition({ width: 60, height: 40 });
      const diagram = createDiagram({
        symbolInstances: [
          createSymbol('s1', 'def1', 100, 50),
          createSymbol('s2', 'def1', 50, 100)
        ]
      });

      const result = service.alignLeft(new Set(['s1', 's2']), diagram, () => symbolDef);

      expect(result!.symbolInstances![0].position.x).toBe(50);
      expect(result!.symbolInstances![1].position.x).toBe(50);
    });
  });

  describe('alignRight', () => {
    it('should align primitives to right edge', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),  // right at 150
          createRectangle('r2', 200, 100, 60, 60), // right at 260
          createRectangle('r3', 50, 150, 40, 40)   // right at 90
        ]
      });

      const result = service.alignRight(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // All items aligned to rightmost edge (260)
      expect(result!.primitives![0].position.x).toBe(210); // 260 - 50
      expect(result!.primitives![1].position.x).toBe(200); // stays at 200 (rightmost)
      expect(result!.primitives![2].position.x).toBe(220); // 260 - 40
    });
  });

  describe('alignTop', () => {
    it('should align primitives to top edge', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),
          createRectangle('r2', 200, 100, 60, 60),
          createRectangle('r3', 150, 20, 40, 40)
        ]
      });

      const result = service.alignTop(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      expect(result!.primitives![0].position.y).toBe(20);
      expect(result!.primitives![1].position.y).toBe(20);
      expect(result!.primitives![2].position.y).toBe(20);
    });

    it('should preserve X positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),
          createRectangle('r2', 200, 100, 60, 60)
        ]
      });

      const result = service.alignTop(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.x).toBe(100);
      expect(result!.primitives![1].position.x).toBe(200);
    });
  });

  describe('alignBottom', () => {
    it('should align primitives to bottom edge', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 50, 50, 50),  // bottom at 100
          createRectangle('r2', 200, 100, 60, 60), // bottom at 160
          createRectangle('r3', 150, 20, 40, 80)   // bottom at 100
        ]
      });

      const result = service.alignBottom(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // All items aligned to bottommost edge (160)
      expect(result!.primitives![0].position.y).toBe(110); // 160 - 50
      expect(result!.primitives![1].position.y).toBe(100); // stays at 100 (bottommost)
      expect(result!.primitives![2].position.y).toBe(80);  // 160 - 80
    });
  });

  describe('alignHorizontalCenter', () => {
    it('should align primitives to horizontal center', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 50, 100, 50),   // center at 50
          createRectangle('r2', 200, 100, 100, 60) // center at 250
        ]
      });

      const result = service.alignHorizontalCenter(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // Average center X = (50 + 250) / 2 = 150
      expect(result!.primitives![0].position.x).toBe(100); // 150 - 50
      expect(result!.primitives![1].position.x).toBe(100); // 150 - 50
    });

    it('should preserve Y positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 50, 100, 50),
          createRectangle('r2', 200, 100, 100, 60)
        ]
      });

      const result = service.alignHorizontalCenter(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.y).toBe(50);
      expect(result!.primitives![1].position.y).toBe(100);
    });
  });

  describe('alignVerticalCenter', () => {
    it('should align primitives to vertical center', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 0, 50, 100),   // center at 50
          createRectangle('r2', 200, 200, 60, 100)  // center at 250
        ]
      });

      const result = service.alignVerticalCenter(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // Average center Y = (50 + 250) / 2 = 150
      expect(result!.primitives![0].position.y).toBe(100); // 150 - 50
      expect(result!.primitives![1].position.y).toBe(100); // 150 - 50
    });

    it('should preserve X positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 100, 0, 50, 100),
          createRectangle('r2', 200, 200, 60, 100)
        ]
      });

      const result = service.alignVerticalCenter(new Set(['r1', 'r2']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.x).toBe(100);
      expect(result!.primitives![1].position.x).toBe(200);
    });
  });

  describe('distributeHorizontally', () => {
    it('should return null for less than 3 items', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 50, 50),
          createRectangle('r2', 200, 0, 50, 50)
        ]
      });

      expect(service.distributeHorizontally(new Set(['r1', 'r2']), diagram, noSymbolLookup)).toBeNull();
    });

    it('should distribute items evenly horizontally', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 50, 50),     // leftmost
          createRectangle('r2', 300, 0, 50, 50),   // rightmost
          createRectangle('r3', 100, 0, 50, 50)    // middle (will be moved)
        ]
      });

      const result = service.distributeHorizontally(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // First stays at 0, last stays at 300
      // Total span: 350 (0 to 350), total width: 150, gap: 200/2 = 100
      expect(result!.primitives![0].position.x).toBe(0);   // first stays
      expect(result!.primitives![1].position.x).toBe(300); // last stays
      expect(result!.primitives![2].position.x).toBe(150); // 0 + 50 + 100
    });

    it('should preserve Y positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 10, 50, 50),
          createRectangle('r2', 300, 20, 50, 50),
          createRectangle('r3', 100, 30, 50, 50)
        ]
      });

      const result = service.distributeHorizontally(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.y).toBe(10);
      expect(result!.primitives![1].position.y).toBe(20);
      expect(result!.primitives![2].position.y).toBe(30);
    });

    it('should handle items of different widths', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 100, 50),    // width 100
          createRectangle('r2', 400, 0, 100, 50),  // width 100
          createRectangle('r3', 150, 0, 50, 50)    // width 50, middle
        ]
      });

      const result = service.distributeHorizontally(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      // Total span: 500 (0 to 500), total width: 250, gap: 250/2 = 125
      expect(result!.primitives![0].position.x).toBe(0);
      expect(result!.primitives![1].position.x).toBe(400);
      expect(result!.primitives![2].position.x).toBe(225); // 0 + 100 + 125
    });
  });

  describe('distributeVertically', () => {
    it('should return null for less than 3 items', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 50, 50),
          createRectangle('r2', 0, 200, 50, 50)
        ]
      });

      expect(service.distributeVertically(new Set(['r1', 'r2']), diagram, noSymbolLookup)).toBeNull();
    });

    it('should distribute items evenly vertically', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 50, 50),     // topmost
          createRectangle('r2', 0, 300, 50, 50),   // bottommost
          createRectangle('r3', 0, 100, 50, 50)    // middle (will be moved)
        ]
      });

      const result = service.distributeVertically(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      // First stays at 0, last stays at 300
      // Total span: 350 (0 to 350), total height: 150, gap: 200/2 = 100
      expect(result!.primitives![0].position.y).toBe(0);
      expect(result!.primitives![1].position.y).toBe(300);
      expect(result!.primitives![2].position.y).toBe(150); // 0 + 50 + 100
    });

    it('should preserve X positions', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 10, 0, 50, 50),
          createRectangle('r2', 20, 300, 50, 50),
          createRectangle('r3', 30, 100, 50, 50)
        ]
      });

      const result = service.distributeVertically(new Set(['r1', 'r2', 'r3']), diagram, noSymbolLookup);

      expect(result!.primitives![0].position.x).toBe(10);
      expect(result!.primitives![1].position.x).toBe(20);
      expect(result!.primitives![2].position.x).toBe(30);
    });
  });

  describe('mixed content types', () => {
    it('should align mixed primitives and elements', () => {
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 100, 50, 50, 50)],
        elements: [createElement('e1', 50, 100, 80, 60)]
      });

      const result = service.alignLeft(new Set(['r1', 'e1']), diagram, noSymbolLookup);

      expect(result).not.toBeNull();
      expect(result!.primitives![0].position.x).toBe(50);
      expect(result!.elements![0].position.x).toBe(50);
    });

    it('should distribute mixed content types', () => {
      const symbolDef = createSymbolDefinition({ width: 50, height: 50 });
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 0, 0, 50, 50)],
        elements: [createElement('e1', 100, 0, 50, 50)], // x=100, will be moved
        symbolInstances: [createSymbol('s1', 'def1', 300, 0)]
      });

      const result = service.distributeHorizontally(
        new Set(['r1', 'e1', 's1']),
        diagram,
        () => symbolDef
      );

      expect(result).not.toBeNull();
      // Total span: 350 (0 to 350), total width: 150, gap: 200/2 = 100
      // Middle item (e1) should be at: 0 + 50 + 100 = 150 (moved from 100)
      expect(result!.elements![0].position.x).toBe(150);
    });
  });
});
