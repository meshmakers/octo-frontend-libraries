import { TestBed } from '@angular/core/testing';
import { DesignerDeletionService } from './designer-deletion.service';
import { ProcessDiagramConfig, ProcessElement, ProcessConnection } from '../../process-widget.models';
import { PrimitiveType, GroupPrimitive, PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

describe('DesignerDeletionService', () => {
  let service: DesignerDeletionService;

  // Helper to create minimal element for testing
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

  // Helper to create connection for testing
  function createTestConnection(id: string, sourceId: string, targetId: string): ProcessConnection {
    return {
      id,
      from: { elementId: sourceId, port: 'right' },
      to: { elementId: targetId, port: 'left' },
      style: { strokeWidth: 2, strokeColor: '#000' }
    };
  }

  // Helper to create test diagram with groups
  function createTestDiagram(): ProcessDiagramConfig {
    return {
      id: 'test-diagram',
      name: 'Test',
      version: '1.0',
      canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
      elements: [
        createTestElement('elem-1'),
        createTestElement('elem-2')
      ],
      primitives: [
        createTestPrimitive('prim-1'),
        createTestPrimitive('prim-2'),
        createTestPrimitive('prim-3'),
        {
          id: 'group-1',
          type: 'group',
          position: { x: 0, y: 200 },
          config: { childIds: ['prim-1', 'prim-2'], originalBounds: { x: 0, y: 100, width: 200, height: 80 } }
        } as GroupPrimitive
      ],
      symbolInstances: [
        createTestSymbol('sym-1'),
        createTestSymbol('sym-2')
      ],
      connections: [
        createTestConnection('conn-1', 'elem-1', 'elem-2'),
        createTestConnection('conn-2', 'elem-2', 'elem-1')
      ]
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerDeletionService]
    });
    service = TestBed.inject(DesignerDeletionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Delete Items
  // ============================================================================

  describe('deleteItems', () => {
    it('should delete element', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['elem-1']), new Set());

      expect(result.elements.map(e => e.id)).toEqual(['elem-2']);
      expect(result.deletedIds.has('elem-1')).toBeTrue();
    });

    it('should delete primitive', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['prim-3']), new Set());

      expect(result.primitives.find(p => p.id === 'prim-3')).toBeUndefined();
    });

    it('should delete symbol', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['sym-1']), new Set());

      expect(result.symbolInstances.map(s => s.id)).toEqual(['sym-2']);
    });

    it('should delete connection', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(), new Set(['conn-1']));

      expect(result.connections.map(c => c.id)).toEqual(['conn-2']);
    });

    it('should delete group and its children', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['group-1']), new Set());

      // Group and its children (prim-1, prim-2) should be deleted
      expect(result.deletedIds.has('group-1')).toBeTrue();
      expect(result.deletedIds.has('prim-1')).toBeTrue();
      expect(result.deletedIds.has('prim-2')).toBeTrue();

      expect(result.primitives.find(p => p.id === 'group-1')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'prim-1')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'prim-2')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'prim-3')).toBeDefined();
    });

    it('should also delete orphaned connections', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['elem-1']), new Set());

      // Both connections reference elem-1, so both should be deleted
      expect(result.connections.length).toBe(0);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(), new Set());

      expect(result.elements).toBe(diagram.elements);
      expect(result.deletedIds.size).toBe(0);
    });

    it('should delete multiple items at once', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['elem-1', 'prim-3', 'sym-1']), new Set());

      expect(result.elements.map(e => e.id)).toEqual(['elem-2']);
      expect(result.primitives.find(p => p.id === 'prim-3')).toBeUndefined();
      expect(result.symbolInstances.map(s => s.id)).toEqual(['sym-2']);
    });
  });

  // ============================================================================
  // Delete Elements
  // ============================================================================

  describe('deleteElements', () => {
    it('should only delete elements', () => {
      const diagram = createTestDiagram();
      const result = service.deleteElements(diagram, new Set(['elem-1']));

      expect(result.elements.map(e => e.id)).toEqual(['elem-2']);
      // Primitives should be unchanged
      expect(result.primitives.length).toBe(4);
    });

    it('should delete orphaned connections', () => {
      const diagram = createTestDiagram();
      const result = service.deleteElements(diagram, new Set(['elem-1']));

      expect(result.connections.length).toBe(0);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.deleteElements(diagram, new Set());

      expect(result.elements).toBe(diagram.elements);
    });
  });

  // ============================================================================
  // Delete Primitives
  // ============================================================================

  describe('deletePrimitives', () => {
    it('should only delete primitives', () => {
      const diagram = createTestDiagram();
      const result = service.deletePrimitives(diagram, new Set(['prim-3']));

      expect(result.primitives.find(p => p.id === 'prim-3')).toBeUndefined();
      // Elements should be unchanged
      expect(result.elements.length).toBe(2);
    });

    it('should expand group children', () => {
      const diagram = createTestDiagram();
      const result = service.deletePrimitives(diagram, new Set(['group-1']));

      expect(result.primitives.find(p => p.id === 'prim-1')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'prim-2')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'group-1')).toBeUndefined();
      expect(result.primitives.find(p => p.id === 'prim-3')).toBeDefined();
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.deletePrimitives(diagram, new Set());

      expect(result.primitives).toEqual(diagram.primitives ?? []);
    });
  });

  // ============================================================================
  // Delete Symbols
  // ============================================================================

  describe('deleteSymbols', () => {
    it('should only delete symbols', () => {
      const diagram = createTestDiagram();
      const result = service.deleteSymbols(diagram, new Set(['sym-1']));

      expect(result.symbolInstances.map(s => s.id)).toEqual(['sym-2']);
      // Other arrays should be unchanged
      expect(result.elements.length).toBe(2);
      expect(result.primitives.length).toBe(4);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.deleteSymbols(diagram, new Set());

      expect(result.symbolInstances).toEqual(diagram.symbolInstances ?? []);
    });
  });

  // ============================================================================
  // Delete Connections
  // ============================================================================

  describe('deleteConnections', () => {
    it('should only delete connections', () => {
      const diagram = createTestDiagram();
      const result = service.deleteConnections(diagram, new Set(['conn-1']));

      expect(result.connections.map(c => c.id)).toEqual(['conn-2']);
      // Other arrays should be unchanged
      expect(result.elements.length).toBe(2);
    });

    it('should handle empty selection', () => {
      const diagram = createTestDiagram();
      const result = service.deleteConnections(diagram, new Set());

      expect(result.connections).toBe(diagram.connections);
    });
  });

  // ============================================================================
  // Helper Methods
  // ============================================================================

  describe('expandWithGroupChildren', () => {
    it('should expand group to include children', () => {
      const diagram = createTestDiagram();
      const result = service.expandWithGroupChildren(diagram, new Set(['group-1']));

      expect(result.has('group-1')).toBeTrue();
      expect(result.has('prim-1')).toBeTrue();
      expect(result.has('prim-2')).toBeTrue();
      expect(result.size).toBe(3);
    });

    it('should not expand non-groups', () => {
      const diagram = createTestDiagram();
      const result = service.expandWithGroupChildren(diagram, new Set(['prim-3']));

      expect(result.size).toBe(1);
      expect(result.has('prim-3')).toBeTrue();
    });

    it('should handle mixed selection', () => {
      const diagram = createTestDiagram();
      const result = service.expandWithGroupChildren(diagram, new Set(['group-1', 'prim-3']));

      expect(result.size).toBe(4); // group-1, prim-1, prim-2, prim-3
    });
  });

  describe('getOrphanedConnections', () => {
    it('should return connections referencing deleted items', () => {
      const diagram = createTestDiagram();
      const result = service.getOrphanedConnections(diagram, new Set(['elem-1']));

      // Both connections reference elem-1
      expect(result.has('conn-1')).toBeTrue();
      expect(result.has('conn-2')).toBeTrue();
    });

    it('should return empty set if no connections are orphaned', () => {
      const diagram = createTestDiagram();
      const result = service.getOrphanedConnections(diagram, new Set(['prim-3']));

      expect(result.size).toBe(0);
    });
  });

  describe('wouldOrphanConnections', () => {
    it('should return true for element with connections', () => {
      const diagram = createTestDiagram();
      expect(service.wouldOrphanConnections(diagram, 'elem-1')).toBeTrue();
    });

    it('should return false for item without connections', () => {
      const diagram = createTestDiagram();
      expect(service.wouldOrphanConnections(diagram, 'prim-3')).toBeFalse();
    });
  });

  describe('getDeletionCount', () => {
    it('should count single item', () => {
      const diagram = createTestDiagram();
      expect(service.getDeletionCount(diagram, new Set(['prim-3']))).toBe(1);
    });

    it('should count group with children', () => {
      const diagram = createTestDiagram();
      // group-1 has 2 children, so total is 3
      expect(service.getDeletionCount(diagram, new Set(['group-1']))).toBe(3);
    });

    it('should count multiple items', () => {
      const diagram = createTestDiagram();
      expect(service.getDeletionCount(diagram, new Set(['prim-3', 'sym-1']))).toBe(2);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle null primitives array', () => {
      const diagram: ProcessDiagramConfig = {
        id: 'minimal',
        name: 'Minimal',
        version: '1.0',
        canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
        elements: [createTestElement('elem-1')],
        connections: []
      } as ProcessDiagramConfig;

      const result = service.deleteItems(diagram, new Set(['elem-1']), new Set());

      expect(result.elements.length).toBe(0);
      expect(result.primitives).toEqual([]);
      expect(result.symbolInstances).toEqual([]);
    });

    it('should handle non-existent IDs', () => {
      const diagram = createTestDiagram();
      const result = service.deleteItems(diagram, new Set(['non-existent']), new Set());

      // Nothing should be deleted
      expect(result.elements.length).toBe(2);
      expect(result.deletedIds.has('non-existent')).toBeTrue();
    });

    it('should handle empty diagram', () => {
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

      const result = service.deleteItems(diagram, new Set(['any']), new Set());

      expect(result.elements).toEqual([]);
      expect(result.primitives).toEqual([]);
      expect(result.symbolInstances).toEqual([]);
      expect(result.connections).toEqual([]);
    });
  });
});
