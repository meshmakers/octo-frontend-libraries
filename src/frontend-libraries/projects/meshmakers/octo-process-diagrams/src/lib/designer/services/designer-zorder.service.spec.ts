import { TestBed } from '@angular/core/testing';
import { DesignerZOrderService } from './designer-zorder.service';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { PrimitiveType, PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

describe('DesignerZOrderService', () => {
  let service: DesignerZOrderService;

  // Helper to create minimal element for testing (only ID matters for z-order)
  function createTestElement(id: string): ProcessElement {
    return {
      id,
      type: 'label',
      name: `Element ${id}`,
      position: { x: 0, y: 0 },
      size: { width: 100, height: 30 },
      config: { text: 'Test' }
    } as ProcessElement;
  }

  // Helper to create minimal primitive for testing
  function createTestPrimitive(id: string): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Rectangle,
      position: { x: 0, y: 0 },
      config: { width: 100, height: 80 }
    } as PrimitiveBase;
  }

  // Helper to create minimal symbol for testing
  function createTestSymbol(id: string): SymbolInstance {
    return {
      id,
      type: 'symbol',
      libraryRtId: 'library-1',
      symbolRtId: 'symbol-1',
      position: { x: 0, y: 0 }
    };
  }

  // Helper to create test diagram
  function createTestDiagram(): ProcessDiagramConfig {
    return {
      id: 'test-diagram',
      name: 'Test',
      version: '1.0',
      canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
      elements: [
        createTestElement('elem-1'),
        createTestElement('elem-2'),
        createTestElement('elem-3')
      ],
      primitives: [
        createTestPrimitive('prim-1'),
        createTestPrimitive('prim-2'),
        createTestPrimitive('prim-3')
      ],
      symbolInstances: [
        createTestSymbol('sym-1'),
        createTestSymbol('sym-2')
      ],
      connections: []
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerZOrderService]
    });
    service = TestBed.inject(DesignerZOrderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Bring to Front
  // ============================================================================

  describe('bringToFront', () => {
    it('should move element to end of array', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['elem-1']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-2', 'elem-3', 'elem-1']);
    });

    it('should move primitive to end of array', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['prim-1']));

      expect(result.primitives.map(p => p.id)).toEqual(['prim-2', 'prim-3', 'prim-1']);
    });

    it('should move symbol to end of array', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['sym-1']));

      expect(result.symbolInstances.map(s => s.id)).toEqual(['sym-2', 'sym-1']);
    });

    it('should move multiple items to end', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['elem-1', 'elem-2']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-3', 'elem-1', 'elem-2']);
    });

    it('should preserve relative order of selected items', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['prim-1', 'prim-2']));

      // prim-1 and prim-2 should maintain their relative order at the end
      expect(result.primitives.map(p => p.id)).toEqual(['prim-3', 'prim-1', 'prim-2']);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set());

      expect(result.elements).toBe(diagram.elements);
    });

    it('should not affect items already at front', () => {
      const diagram = createTestDiagram();
      const result = service.bringToFront(diagram, new Set(['elem-3']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-1', 'elem-2', 'elem-3']);
    });
  });

  // ============================================================================
  // Send to Back
  // ============================================================================

  describe('sendToBack', () => {
    it('should move element to start of array', () => {
      const diagram = createTestDiagram();
      const result = service.sendToBack(diagram, new Set(['elem-3']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-3', 'elem-1', 'elem-2']);
    });

    it('should move primitive to start of array', () => {
      const diagram = createTestDiagram();
      const result = service.sendToBack(diagram, new Set(['prim-3']));

      expect(result.primitives.map(p => p.id)).toEqual(['prim-3', 'prim-1', 'prim-2']);
    });

    it('should move multiple items to start', () => {
      const diagram = createTestDiagram();
      const result = service.sendToBack(diagram, new Set(['elem-2', 'elem-3']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-2', 'elem-3', 'elem-1']);
    });

    it('should preserve relative order of selected items', () => {
      const diagram = createTestDiagram();
      const result = service.sendToBack(diagram, new Set(['prim-2', 'prim-3']));

      // prim-2 and prim-3 should maintain their relative order at the start
      expect(result.primitives.map(p => p.id)).toEqual(['prim-2', 'prim-3', 'prim-1']);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.sendToBack(diagram, new Set());

      expect(result.elements).toBe(diagram.elements);
    });
  });

  // ============================================================================
  // Bring Forward
  // ============================================================================

  describe('bringForward', () => {
    it('should swap element with next item', () => {
      const diagram = createTestDiagram();
      const result = service.bringForward(diagram, new Set(['elem-1']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-2', 'elem-1', 'elem-3']);
    });

    it('should swap primitive with next item', () => {
      const diagram = createTestDiagram();
      const result = service.bringForward(diagram, new Set(['prim-2']));

      expect(result.primitives.map(p => p.id)).toEqual(['prim-1', 'prim-3', 'prim-2']);
    });

    it('should not move item already at front', () => {
      const diagram = createTestDiagram();
      const result = service.bringForward(diagram, new Set(['elem-3']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-1', 'elem-2', 'elem-3']);
    });

    it('should move multiple items forward correctly', () => {
      const diagram = createTestDiagram();
      const result = service.bringForward(diagram, new Set(['elem-1', 'elem-2']));

      // Both should move forward, effectively swapping with elem-3
      expect(result.elements.map(e => e.id)).toEqual(['elem-3', 'elem-1', 'elem-2']);
    });

    it('should handle adjacent selected items', () => {
      const diagram = createTestDiagram();
      // When two adjacent items are selected, they should stay together and move forward
      const result = service.bringForward(diagram, new Set(['prim-1', 'prim-2']));

      // prim-1 and prim-2 are adjacent and selected, so they move together past prim-3
      expect(result.primitives.map(p => p.id)).toEqual(['prim-3', 'prim-1', 'prim-2']);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const originalOrder = diagram.elements.map(e => e.id);
      const result = service.bringForward(diagram, new Set());

      expect(result.elements.map(e => e.id)).toEqual(originalOrder);
    });
  });

  // ============================================================================
  // Send Backward
  // ============================================================================

  describe('sendBackward', () => {
    it('should swap element with previous item', () => {
      const diagram = createTestDiagram();
      const result = service.sendBackward(diagram, new Set(['elem-2']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-2', 'elem-1', 'elem-3']);
    });

    it('should swap primitive with previous item', () => {
      const diagram = createTestDiagram();
      const result = service.sendBackward(diagram, new Set(['prim-3']));

      expect(result.primitives.map(p => p.id)).toEqual(['prim-1', 'prim-3', 'prim-2']);
    });

    it('should not move item already at back', () => {
      const diagram = createTestDiagram();
      const result = service.sendBackward(diagram, new Set(['elem-1']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-1', 'elem-2', 'elem-3']);
    });

    it('should move multiple items backward correctly', () => {
      const diagram = createTestDiagram();
      const result = service.sendBackward(diagram, new Set(['elem-2', 'elem-3']));

      // Both should move backward, effectively swapping with elem-1
      expect(result.elements.map(e => e.id)).toEqual(['elem-2', 'elem-3', 'elem-1']);
    });

    it('should handle adjacent selected items', () => {
      const diagram = createTestDiagram();
      const result = service.sendBackward(diagram, new Set(['prim-2', 'prim-3']));

      expect(result.primitives.map(p => p.id)).toEqual(['prim-2', 'prim-3', 'prim-1']);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const originalOrder = diagram.elements.map(e => e.id);
      const result = service.sendBackward(diagram, new Set());

      expect(result.elements.map(e => e.id)).toEqual(originalOrder);
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('getZIndex', () => {
    it('should return correct index for element', () => {
      const diagram = createTestDiagram();
      expect(service.getZIndex(diagram, 'elem-1')).toBe(0);
      expect(service.getZIndex(diagram, 'elem-2')).toBe(1);
      expect(service.getZIndex(diagram, 'elem-3')).toBe(2);
    });

    it('should return correct index for primitive', () => {
      const diagram = createTestDiagram();
      expect(service.getZIndex(diagram, 'prim-1')).toBe(0);
      expect(service.getZIndex(diagram, 'prim-2')).toBe(1);
    });

    it('should return correct index for symbol', () => {
      const diagram = createTestDiagram();
      expect(service.getZIndex(diagram, 'sym-1')).toBe(0);
      expect(service.getZIndex(diagram, 'sym-2')).toBe(1);
    });

    it('should return -1 for non-existent item', () => {
      const diagram = createTestDiagram();
      expect(service.getZIndex(diagram, 'non-existent')).toBe(-1);
    });
  });

  describe('isAtFront', () => {
    it('should return true for last element', () => {
      const diagram = createTestDiagram();
      expect(service.isAtFront(diagram, 'elem-3')).toBeTrue();
    });

    it('should return true for last primitive', () => {
      const diagram = createTestDiagram();
      expect(service.isAtFront(diagram, 'prim-3')).toBeTrue();
    });

    it('should return true for last symbol', () => {
      const diagram = createTestDiagram();
      expect(service.isAtFront(diagram, 'sym-2')).toBeTrue();
    });

    it('should return false for non-last items', () => {
      const diagram = createTestDiagram();
      expect(service.isAtFront(diagram, 'elem-1')).toBeFalse();
      expect(service.isAtFront(diagram, 'elem-2')).toBeFalse();
    });
  });

  describe('isAtBack', () => {
    it('should return true for first element', () => {
      const diagram = createTestDiagram();
      expect(service.isAtBack(diagram, 'elem-1')).toBeTrue();
    });

    it('should return true for first primitive', () => {
      const diagram = createTestDiagram();
      expect(service.isAtBack(diagram, 'prim-1')).toBeTrue();
    });

    it('should return true for first symbol', () => {
      const diagram = createTestDiagram();
      expect(service.isAtBack(diagram, 'sym-1')).toBeTrue();
    });

    it('should return false for non-first items', () => {
      const diagram = createTestDiagram();
      expect(service.isAtBack(diagram, 'elem-2')).toBeFalse();
      expect(service.isAtBack(diagram, 'elem-3')).toBeFalse();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty arrays', () => {
      const diagram: ProcessDiagramConfig = {
        id: 'empty',
        name: 'Empty',
        version: '1.0',
        canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
        elements: [],
        primitives: [],
        symbolInstances: [],
        connections: []
      };

      const result = service.bringToFront(diagram, new Set(['any']));

      expect(result.elements).toEqual([]);
      expect(result.primitives).toEqual([]);
      expect(result.symbolInstances).toEqual([]);
    });

    it('should handle single item arrays', () => {
      const diagram: ProcessDiagramConfig = {
        id: 'single',
        name: 'Single',
        version: '1.0',
        canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
        elements: [createTestElement('only-elem')],
        primitives: [],
        connections: []
      };

      const result = service.bringForward(diagram, new Set(['only-elem']));
      expect(result.elements.map(e => e.id)).toEqual(['only-elem']);
    });

    it('should handle null primitives and symbolInstances', () => {
      const diagram = {
        id: 'minimal',
        name: 'Minimal',
        version: '1.0',
        canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
        elements: [createTestElement('elem-1')],
        connections: []
      } as ProcessDiagramConfig;

      const result = service.bringToFront(diagram, new Set(['elem-1']));

      expect(result.primitives).toEqual([]);
      expect(result.symbolInstances).toEqual([]);
    });
  });
});
