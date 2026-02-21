import { TestBed } from '@angular/core/testing';
import { DesignerGroupingService, SymbolBoundsProvider } from './designer-grouping.service';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { PrimitiveType, PrimitiveBase, GroupPrimitive } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

describe('DesignerGroupingService', () => {
  let service: DesignerGroupingService;
  let idCounter: number;

  // Helper to create minimal element for testing
  function createTestElement(id: string, x = 0, y = 0, width = 100, height = 100): ProcessElement {
    return {
      id,
      type: 'label',
      name: `Element ${id}`,
      position: { x, y },
      size: { width, height },
      config: { text: 'Test' }
    } as ProcessElement;
  }

  // Helper to create minimal primitive for testing
  function createTestPrimitive(id: string, x = 0, y = 0, width = 100, height = 80): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Rectangle,
      position: { x, y },
      config: { width, height }
    } as PrimitiveBase;
  }

  // Helper to create an ellipse primitive
  function createTestEllipse(id: string, cx = 50, cy = 50, rx = 50, ry = 30): PrimitiveBase {
    return {
      id,
      type: PrimitiveType.Ellipse,
      position: { x: cx, y: cy },
      config: { radiusX: rx, radiusY: ry }
    } as PrimitiveBase;
  }

  // Helper to create minimal symbol for testing
  function createTestSymbol(id: string, x = 0, y = 0): SymbolInstance {
    return {
      id,
      type: 'symbol',
      libraryRtId: 'library-1',
      symbolRtId: 'symbol-1',
      position: { x, y }
    };
  }

  // Helper to create group primitive
  function createTestGroup(id: string, childIds: string[], x = 0, y = 0, width = 200, height = 150): GroupPrimitive {
    return {
      id,
      type: 'group',
      position: { x, y },
      config: {
        childIds,
        originalBounds: { x, y, width, height }
      }
    } as GroupPrimitive;
  }

  // Helper to create test diagram
  function createTestDiagram(): ProcessDiagramConfig {
    return {
      id: 'test-diagram',
      name: 'Test',
      version: '1.0',
      canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
      elements: [
        createTestElement('elem-1', 0, 0),
        createTestElement('elem-2', 150, 0)
      ],
      primitives: [
        createTestPrimitive('prim-1', 0, 200),
        createTestPrimitive('prim-2', 150, 200),
        createTestPrimitive('prim-3', 300, 200)
      ],
      symbolInstances: [
        createTestSymbol('sym-1', 0, 400),
        createTestSymbol('sym-2', 150, 400)
      ],
      connections: []
    };
  }

  // ID generator for tests
  function generateId(): string {
    return `test-id-${++idCounter}`;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerGroupingService]
    });
    service = TestBed.inject(DesignerGroupingService);
    idCounter = 0;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Validation Methods
  // ============================================================================

  describe('canGroup', () => {
    it('should return true for 2 or more items', () => {
      expect(service.canGroup(new Set(['a', 'b']))).toBeTrue();
      expect(service.canGroup(new Set(['a', 'b', 'c']))).toBeTrue();
    });

    it('should return false for less than 2 items', () => {
      expect(service.canGroup(new Set())).toBeFalse();
      expect(service.canGroup(new Set(['a']))).toBeFalse();
    });
  });

  describe('canUngroup', () => {
    it('should return true if selection contains groups', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestGroup('group-1', ['prim-1'])
        ]
      };

      expect(service.canUngroup(diagram, new Set(['group-1']))).toBeTrue();
    });

    it('should return false if selection contains no groups', () => {
      const diagram = createTestDiagram();
      expect(service.canUngroup(diagram, new Set(['prim-1', 'prim-2']))).toBeFalse();
    });

    it('should return false for empty selection', () => {
      const diagram = createTestDiagram();
      expect(service.canUngroup(diagram, new Set())).toBeFalse();
    });
  });

  describe('getSelectedGroups', () => {
    it('should return selected groups', () => {
      const group = createTestGroup('group-1', ['prim-1', 'prim-2']);
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestPrimitive('prim-2'),
          group
        ]
      };

      const result = service.getSelectedGroups(diagram, new Set(['group-1', 'prim-3']));
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('group-1');
    });

    it('should return empty array if no groups selected', () => {
      const diagram = createTestDiagram();
      const result = service.getSelectedGroups(diagram, new Set(['prim-1']));
      expect(result.length).toBe(0);
    });
  });

  // ============================================================================
  // Grouping Operations
  // ============================================================================

  describe('groupItems', () => {
    it('should create group from selected primitives', () => {
      const diagram = createTestDiagram();
      const result = service.groupItems(
        diagram,
        new Set(['prim-1', 'prim-2']),
        generateId
      );

      expect(result).not.toBeNull();
      expect(result!.groupId).toBe('test-id-1');
      expect(result!.childIds).toContain('prim-1');
      expect(result!.childIds).toContain('prim-2');

      // New group should be added
      const newGroup = result!.primitives.find(p => p.id === 'test-id-1');
      expect(newGroup).toBeDefined();
      expect(newGroup!.type).toBe('group');
    });

    it('should flatten nested groups', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1', 0, 0),
          createTestPrimitive('prim-2', 100, 0),
          createTestPrimitive('prim-3', 200, 0),
          createTestGroup('group-1', ['prim-1', 'prim-2'], 0, 0, 200, 80)
        ]
      };

      const result = service.groupItems(
        diagram,
        new Set(['group-1', 'prim-3']),
        generateId
      );

      expect(result).not.toBeNull();
      // Children should include prim-1, prim-2 (from flattened group), and prim-3
      expect(result!.childIds).toContain('prim-1');
      expect(result!.childIds).toContain('prim-2');
      expect(result!.childIds).toContain('prim-3');
      // Old group should be removed
      expect(result!.primitives.find(p => p.id === 'group-1')).toBeUndefined();
    });

    it('should return null for less than 2 items', () => {
      const diagram = createTestDiagram();
      const result = service.groupItems(diagram, new Set(['prim-1']), generateId);
      expect(result).toBeNull();
    });

    it('should calculate correct bounds for group', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1', 10, 20, 50, 30),
          createTestPrimitive('prim-2', 100, 80, 60, 40)
        ]
      };

      const result = service.groupItems(
        diagram,
        new Set(['prim-1', 'prim-2']),
        generateId
      );

      expect(result).not.toBeNull();
      const group = result!.primitives.find(p => p.id === result!.groupId) as GroupPrimitive;
      expect(group.position.x).toBe(10);
      expect(group.position.y).toBe(20);
      expect(group.config.originalBounds.width).toBe(150); // (100 + 60) - 10
      expect(group.config.originalBounds.height).toBe(100); // (80 + 40) - 20
    });
  });

  describe('ungroupItems', () => {
    it('should remove group and free children', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestPrimitive('prim-2'),
          createTestGroup('group-1', ['prim-1', 'prim-2'])
        ]
      };

      const result = service.ungroupItems(diagram, new Set(['group-1']));

      expect(result).not.toBeNull();
      expect(result!.removedGroupIds).toContain('group-1');
      expect(result!.freedChildIds).toContain('prim-1');
      expect(result!.freedChildIds).toContain('prim-2');
      expect(result!.primitives.find(p => p.id === 'group-1')).toBeUndefined();
    });

    it('should handle multiple groups', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestPrimitive('prim-2'),
          createTestPrimitive('prim-3'),
          createTestGroup('group-1', ['prim-1']),
          createTestGroup('group-2', ['prim-2', 'prim-3'])
        ]
      };

      const result = service.ungroupItems(diagram, new Set(['group-1', 'group-2']));

      expect(result).not.toBeNull();
      expect(result!.removedGroupIds.length).toBe(2);
      expect(result!.freedChildIds.length).toBe(3);
      expect(result!.primitives.filter(p => p.type === 'group').length).toBe(0);
    });

    it('should return null if no groups in selection', () => {
      const diagram = createTestDiagram();
      const result = service.ungroupItems(diagram, new Set(['prim-1']));
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Bounds Calculation
  // ============================================================================

  describe('calculateCombinedBounds', () => {
    it('should calculate bounds for primitives', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1', 0, 0, 100, 50),
          createTestPrimitive('prim-2', 200, 100, 80, 60)
        ]
      };

      const bounds = service.calculateCombinedBounds(diagram, ['prim-1', 'prim-2']);

      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(0);
      expect(bounds!.y).toBe(0);
      expect(bounds!.width).toBe(280); // 200 + 80
      expect(bounds!.height).toBe(160); // 100 + 60
    });

    it('should calculate bounds for elements', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        elements: [
          createTestElement('elem-1', 50, 50, 100, 100),
          createTestElement('elem-2', 200, 200, 50, 50)
        ]
      };

      const bounds = service.calculateCombinedBounds(diagram, ['elem-1', 'elem-2']);

      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(50);
      expect(bounds!.y).toBe(50);
      expect(bounds!.width).toBe(200); // (200 + 50) - 50
      expect(bounds!.height).toBe(200); // (200 + 50) - 50
    });

    it('should calculate bounds for symbols', () => {
      const diagram = createTestDiagram();
      const symbolBoundsProvider: SymbolBoundsProvider = {
        getSymbolBounds: (symbol) => ({
          x: symbol.position.x,
          y: symbol.position.y,
          width: 80,
          height: 80
        })
      };

      const bounds = service.calculateCombinedBounds(
        diagram,
        ['sym-1', 'sym-2'],
        symbolBoundsProvider
      );

      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(0);
      expect(bounds!.y).toBe(400);
      expect(bounds!.width).toBe(230); // 150 + 80
      expect(bounds!.height).toBe(80);
    });

    it('should return null for empty array', () => {
      const diagram = createTestDiagram();
      expect(service.calculateCombinedBounds(diagram, [])).toBeNull();
    });

    it('should return null if no items found', () => {
      const diagram = createTestDiagram();
      expect(service.calculateCombinedBounds(diagram, ['nonexistent'])).toBeNull();
    });
  });

  describe('getPrimitiveBounds', () => {
    it('should get bounds for rectangle', () => {
      const rect = createTestPrimitive('rect', 10, 20, 100, 50);
      const bounds = service.getPrimitiveBounds(rect);

      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(50);
    });

    it('should get bounds for ellipse (centered)', () => {
      const ellipse = createTestEllipse('ellipse', 100, 100, 50, 30);
      const bounds = service.getPrimitiveBounds(ellipse);

      expect(bounds.x).toBe(50); // 100 - 50
      expect(bounds.y).toBe(70); // 100 - 30
      expect(bounds.width).toBe(100); // 50 * 2
      expect(bounds.height).toBe(60); // 30 * 2
    });

    it('should get bounds for group', () => {
      const group = createTestGroup('group', ['a', 'b'], 50, 100, 200, 150);
      const bounds = service.getPrimitiveBounds(group);

      expect(bounds.x).toBe(50);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(150);
    });

    it('should use defaults for unknown type', () => {
      const unknown: PrimitiveBase = {
        id: 'unknown',
        type: 'custom' as any,
        position: { x: 10, y: 20 },
        config: {}
      } as PrimitiveBase;

      const bounds = service.getPrimitiveBounds(unknown);

      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });
  });

  describe('getElementBounds', () => {
    it('should get element bounds', () => {
      const element = createTestElement('elem', 50, 100, 200, 150);
      const bounds = service.getElementBounds(element);

      expect(bounds.x).toBe(50);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(150);
    });

    it('should use defaults for missing size', () => {
      const element: ProcessElement = {
        id: 'elem',
        type: 'label',
        name: 'Test',
        position: { x: 10, y: 20 },
        config: { text: 'test' }
      } as ProcessElement;

      const bounds = service.getElementBounds(element);

      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('getAllGroupDescendants', () => {
    it('should get direct children', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestPrimitive('prim-2'),
          createTestGroup('group-1', ['prim-1', 'prim-2'])
        ]
      };

      const descendants = service.getAllGroupDescendants(diagram, 'group-1');

      expect(descendants.size).toBe(2);
      expect(descendants.has('prim-1')).toBeTrue();
      expect(descendants.has('prim-2')).toBeTrue();
    });

    it('should get nested children recursively', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestPrimitive('prim-2'),
          createTestGroup('inner-group', ['prim-1']),
          createTestGroup('outer-group', ['inner-group', 'prim-2'])
        ]
      };

      const descendants = service.getAllGroupDescendants(diagram, 'outer-group');

      expect(descendants.size).toBe(3);
      expect(descendants.has('inner-group')).toBeTrue();
      expect(descendants.has('prim-1')).toBeTrue();
      expect(descendants.has('prim-2')).toBeTrue();
    });

    it('should return empty set for non-group', () => {
      const diagram = createTestDiagram();
      const descendants = service.getAllGroupDescendants(diagram, 'prim-1');
      expect(descendants.size).toBe(0);
    });
  });

  describe('findParentGroup', () => {
    it('should find parent group', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestGroup('group-1', ['prim-1'])
        ]
      };

      const parent = service.findParentGroup(diagram, 'prim-1');

      expect(parent).not.toBeNull();
      expect(parent!.id).toBe('group-1');
    });

    it('should return null for ungrouped item', () => {
      const diagram = createTestDiagram();
      const parent = service.findParentGroup(diagram, 'prim-1');
      expect(parent).toBeNull();
    });
  });

  describe('isItemInGroup', () => {
    it('should return true for grouped item', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestGroup('group-1', ['prim-1'])
        ]
      };

      expect(service.isItemInGroup(diagram, 'prim-1')).toBeTrue();
    });

    it('should return false for ungrouped item', () => {
      const diagram = createTestDiagram();
      expect(service.isItemInGroup(diagram, 'prim-1')).toBeFalse();
    });
  });

  describe('getTopLevelItem', () => {
    it('should return self for ungrouped item', () => {
      const diagram = createTestDiagram();
      expect(service.getTopLevelItem(diagram, 'prim-1')).toBe('prim-1');
    });

    it('should return group for grouped item', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestGroup('group-1', ['prim-1'])
        ]
      };

      expect(service.getTopLevelItem(diagram, 'prim-1')).toBe('group-1');
    });

    it('should return outermost group for nested items', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        primitives: [
          createTestPrimitive('prim-1'),
          createTestGroup('inner-group', ['prim-1']),
          createTestGroup('outer-group', ['inner-group'])
        ]
      };

      expect(service.getTopLevelItem(diagram, 'prim-1')).toBe('outer-group');
      expect(service.getTopLevelItem(diagram, 'inner-group')).toBe('outer-group');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle diagram with null primitives', () => {
      const diagram: ProcessDiagramConfig = {
        id: 'minimal',
        name: 'Minimal',
        version: '1.0',
        canvas: { width: 800, height: 600, backgroundColor: '#fff', gridSize: 20, showGrid: true },
        elements: [createTestElement('elem-1')],
        connections: []
      } as ProcessDiagramConfig;

      expect(service.canUngroup(diagram, new Set(['any']))).toBeFalse();
      expect(service.getSelectedGroups(diagram, new Set(['any'])).length).toBe(0);
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

      const result = service.groupItems(diagram, new Set(['a', 'b']), generateId);
      expect(result).toBeNull(); // No items found to calculate bounds
    });

    it('should handle grouping elements', () => {
      const diagram: ProcessDiagramConfig = {
        ...createTestDiagram(),
        elements: [
          createTestElement('elem-1', 0, 0, 100, 100),
          createTestElement('elem-2', 200, 200, 100, 100)
        ]
      };

      const result = service.groupItems(
        diagram,
        new Set(['elem-1', 'elem-2']),
        generateId
      );

      expect(result).not.toBeNull();
      expect(result!.childIds).toContain('elem-1');
      expect(result!.childIds).toContain('elem-2');
    });

    it('should handle mixed selection (primitives, symbols, elements)', () => {
      const diagram = createTestDiagram();
      const symbolBoundsProvider: SymbolBoundsProvider = {
        getSymbolBounds: (symbol) => ({
          x: symbol.position.x,
          y: symbol.position.y,
          width: 100,
          height: 100
        })
      };

      const result = service.groupItems(
        diagram,
        new Set(['prim-1', 'sym-1', 'elem-1']),
        generateId,
        symbolBoundsProvider
      );

      expect(result).not.toBeNull();
      expect(result!.childIds.length).toBe(3);
    });
  });
});
