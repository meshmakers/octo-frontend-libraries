import { TestBed } from '@angular/core/testing';
import { DesignerBoundsService } from './designer-bounds.service';
import { DesignerPrimitiveService } from './designer-primitive.service';
import { PrimitiveBase, PrimitiveType } from '../../primitives';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { SymbolInstance, SymbolDefinition } from '../../primitives/models/symbol.model';

describe('DesignerBoundsService', () => {
  let service: DesignerBoundsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerBoundsService, DesignerPrimitiveService]
    });
    service = TestBed.inject(DesignerBoundsService);
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

  describe('getPrimitiveBounds', () => {
    it('should return bounds for a rectangle', () => {
      const rect = createRectangle('r1', 100, 50, 80, 60);
      const bounds = service.getPrimitiveBounds(rect);

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(50);
      expect(bounds.width).toBe(80);
      expect(bounds.height).toBe(60);
    });

    it('should return bounds for a group primitive', () => {
      const group = {
        id: 'g1',
        type: 'group',
        position: { x: 10, y: 20 },
        config: { originalBounds: { width: 200, height: 150 }, childIds: [] }
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(group);

      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(150);
    });

    it('should use default bounds for group without originalBounds', () => {
      const group = {
        id: 'g1',
        type: 'group',
        position: { x: 10, y: 20 },
        config: { childIds: [] }
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(group);

      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });
  });

  describe('getElementBounds', () => {
    it('should return bounds for an element', () => {
      const element = createElement('e1', 50, 100, 120, 80);
      const bounds = service.getElementBounds(element);

      expect(bounds.x).toBe(50);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(120);
      expect(bounds.height).toBe(80);
    });
  });

  describe('getSymbolBounds', () => {
    it('should return bounds for a symbol instance', () => {
      const symbol = createSymbol('s1', 'def1', 200, 150, 1);
      const definition = createSymbolDefinition({ width: 50, height: 30 });

      const bounds = service.getSymbolBounds(symbol, definition);

      expect(bounds.x).toBe(200);
      expect(bounds.y).toBe(150);
      expect(bounds.width).toBe(50);
      expect(bounds.height).toBe(30);
    });

    it('should scale symbol bounds by instance scale', () => {
      const symbol = createSymbol('s1', 'def1', 100, 100, 2);
      const definition = createSymbolDefinition({ width: 50, height: 30 });

      const bounds = service.getSymbolBounds(symbol, definition);

      expect(bounds.width).toBe(100); // 50 * 2
      expect(bounds.height).toBe(60); // 30 * 2
    });
  });

  describe('getContentBounds', () => {
    it('should return null for empty diagram', () => {
      const diagram = createDiagram();
      const bounds = service.getContentBounds(diagram, () => null);

      expect(bounds).toBeNull();
    });

    it('should return bounds for diagram with primitives', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 100, 50),
          createRectangle('r2', 200, 100, 50, 80)
        ]
      });

      const bounds = service.getContentBounds(diagram, () => null);

      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(0);
      expect(bounds!.minY).toBe(0);
      expect(bounds!.maxX).toBe(250); // 200 + 50
      expect(bounds!.maxY).toBe(180); // 100 + 80
    });

    it('should include elements in bounds', () => {
      const diagram = createDiagram({
        elements: [
          createElement('e1', 50, 50, 100, 100)
        ]
      });

      const bounds = service.getContentBounds(diagram, () => null);

      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(50);
      expect(bounds!.minY).toBe(50);
      expect(bounds!.maxX).toBe(150);
      expect(bounds!.maxY).toBe(150);
    });

    it('should include symbols when definition is available', () => {
      const symbolDef = createSymbolDefinition({ width: 60, height: 40 });
      const diagram = createDiagram({
        symbolInstances: [
          createSymbol('s1', 'def1', 300, 200, 1)
        ]
      });

      const bounds = service.getContentBounds(diagram, () => symbolDef);

      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(300);
      expect(bounds!.minY).toBe(200);
      expect(bounds!.maxX).toBe(360);
      expect(bounds!.maxY).toBe(240);
    });

    it('should combine bounds from all content types', () => {
      const symbolDef = createSymbolDefinition({ width: 50, height: 50 });
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 0, 0, 100, 100)],
        elements: [createElement('e1', 200, 200, 50, 50)],
        symbolInstances: [createSymbol('s1', 'def1', 400, 100, 1)]
      });

      const bounds = service.getContentBounds(diagram, () => symbolDef);

      expect(bounds!.minX).toBe(0);
      expect(bounds!.minY).toBe(0);
      expect(bounds!.maxX).toBe(450); // 400 + 50
      expect(bounds!.maxY).toBe(250); // 200 + 50
    });
  });

  describe('getSelectionBounds', () => {
    it('should return null for empty selection', () => {
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 0, 0, 100, 100)]
      });

      const bounds = service.getSelectionBounds(new Set(), diagram, () => null);

      expect(bounds).toBeNull();
    });

    it('should return bounds for selected primitives', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 100, 50),
          createRectangle('r2', 200, 100, 50, 80)
        ]
      });

      const bounds = service.getSelectionBounds(new Set(['r1', 'r2']), diagram, () => null);

      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(0);
      expect(bounds!.y).toBe(0);
      expect(bounds!.width).toBe(250);
      expect(bounds!.height).toBe(180);
    });

    it('should only include selected items', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 100, 100),
          createRectangle('r2', 500, 500, 50, 50) // Not selected
        ]
      });

      const bounds = service.getSelectionBounds(new Set(['r1']), diagram, () => null);

      expect(bounds!.x).toBe(0);
      expect(bounds!.y).toBe(0);
      expect(bounds!.width).toBe(100);
      expect(bounds!.height).toBe(100);
    });

    it('should include selected elements', () => {
      const diagram = createDiagram({
        elements: [createElement('e1', 100, 100, 200, 150)]
      });

      const bounds = service.getSelectionBounds(new Set(['e1']), diagram, () => null);

      expect(bounds!.x).toBe(100);
      expect(bounds!.y).toBe(100);
      expect(bounds!.width).toBe(200);
      expect(bounds!.height).toBe(150);
    });

    it('should include selected symbols', () => {
      const symbolDef = createSymbolDefinition({ width: 80, height: 60 });
      const diagram = createDiagram({
        symbolInstances: [createSymbol('s1', 'def1', 50, 50, 1)]
      });

      const bounds = service.getSelectionBounds(new Set(['s1']), diagram, () => symbolDef);

      expect(bounds!.x).toBe(50);
      expect(bounds!.y).toBe(50);
      expect(bounds!.width).toBe(80);
      expect(bounds!.height).toBe(60);
    });
  });

  describe('getSelectionCenter', () => {
    it('should return origin for empty selection', () => {
      const diagram = createDiagram();
      const center = service.getSelectionCenter(new Set(), diagram, () => null);

      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
    });

    it('should return center of single primitive', () => {
      const diagram = createDiagram({
        primitives: [createRectangle('r1', 100, 100, 100, 100)]
      });

      const center = service.getSelectionCenter(new Set(['r1']), diagram, () => null);

      expect(center.x).toBe(150); // 100 + 50
      expect(center.y).toBe(150); // 100 + 50
    });

    it('should return average center of multiple items', () => {
      const diagram = createDiagram({
        primitives: [
          createRectangle('r1', 0, 0, 100, 100), // center: (50, 50)
          createRectangle('r2', 200, 200, 100, 100) // center: (250, 250)
        ]
      });

      const center = service.getSelectionCenter(new Set(['r1', 'r2']), diagram, () => null);

      expect(center.x).toBe(150); // (50 + 250) / 2
      expect(center.y).toBe(150); // (50 + 250) / 2
    });

    it('should include elements in center calculation', () => {
      const diagram = createDiagram({
        elements: [
          createElement('e1', 0, 0, 100, 100) // center: (50, 50)
        ]
      });

      const center = service.getSelectionCenter(new Set(['e1']), diagram, () => null);

      expect(center.x).toBe(50);
      expect(center.y).toBe(50);
    });
  });

  describe('diagramBoundsToSelectionBounds', () => {
    it('should convert diagram bounds to selection bounds format', () => {
      const diagramBounds = { minX: 10, minY: 20, maxX: 110, maxY: 120 };
      const selectionBounds = service.diagramBoundsToSelectionBounds(diagramBounds);

      expect(selectionBounds.x).toBe(10);
      expect(selectionBounds.y).toBe(20);
      expect(selectionBounds.width).toBe(100);
      expect(selectionBounds.height).toBe(100);
    });
  });
});
