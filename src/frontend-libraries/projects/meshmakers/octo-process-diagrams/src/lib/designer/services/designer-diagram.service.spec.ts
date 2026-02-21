import { TestBed } from '@angular/core/testing';
import { DesignerDiagramService } from './designer-diagram.service';
import { ProcessDiagramConfig, ProcessConnection, LabelElementConfig } from '../../process-widget.models';
import { PrimitiveBase, PrimitiveType, PrimitiveTypeValue } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

describe('DesignerDiagramService', () => {
  let service: DesignerDiagramService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerDiagramService]
    });
    service = TestBed.inject(DesignerDiagramService);
  });

  function createTestPrimitive(id: string, type: PrimitiveTypeValue = PrimitiveType.Rectangle): PrimitiveBase {
    return {
      id,
      type,
      position: { x: 0, y: 0 },
      config: { width: 100, height: 50 }
    } as PrimitiveBase;
  }

  function createTestSymbol(id: string): SymbolInstance {
    return {
      id,
      type: 'symbol',
      libraryRtId: 'lib-1',
      symbolRtId: 'sym-1',
      position: { x: 0, y: 0 },
      scale: 1
    };
  }

  function createTestElement(id: string): LabelElementConfig {
    return {
      id,
      type: 'label',
      name: `Element ${id}`,
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      config: { text: `Label ${id}` }
    };
  }

  function createTestConnection(id: string, fromElementId: string, toElementId: string): ProcessConnection {
    return {
      id,
      from: { elementId: fromElementId, port: 'right' },
      to: { elementId: toElementId, port: 'left' },
      style: { strokeWidth: 2, strokeColor: '#000000' }
    };
  }

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty diagram', () => {
      const diagram = service.getDiagram();
      expect(diagram.primitives).toEqual([]);
      expect(diagram.symbolInstances).toEqual([]);
      expect(diagram.elements).toEqual([]);
      expect(diagram.connections).toEqual([]);
    });

    it('should have default canvas settings', () => {
      const canvas = service.canvas();
      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(800);
      expect(canvas.gridSize).toBe(10);
      expect(canvas.showGrid).toBe(true);
    });
  });

  describe('diagram-level operations', () => {
    it('should set diagram', () => {
      const newDiagram: ProcessDiagramConfig = {
        id: 'test-id',
        name: 'Test Diagram',
        version: '1.0.0',
        canvas: { width: 800, height: 600, gridSize: 20, showGrid: false, backgroundColor: '#fff' },
        elements: [],
        connections: [],
        primitives: [createTestPrimitive('p1')],
        symbolInstances: []
      };

      service.setDiagram(newDiagram);

      expect(service.getDiagram().name).toBe('Test Diagram');
      expect(service.primitives().length).toBe(1);
    });

    it('should update diagram with updater function', () => {
      service.updateDiagram(d => ({ ...d, name: 'Updated Name' }));
      expect(service.getDiagram().name).toBe('Updated Name');
    });

    it('should update canvas configuration', () => {
      service.updateCanvas(c => ({ ...c, gridSize: 25 }));
      expect(service.canvas().gridSize).toBe(25);
    });

    it('should reset to empty diagram', () => {
      service.addPrimitive(createTestPrimitive('p1'));
      expect(service.primitives().length).toBe(1);

      service.reset();

      expect(service.primitives().length).toBe(0);
      expect(service.getDiagram().name).toBe('New Diagram');
    });
  });

  describe('primitive operations', () => {
    beforeEach(() => {
      service.addPrimitive(createTestPrimitive('p1'));
      service.addPrimitive(createTestPrimitive('p2'));
    });

    it('should add a primitive', () => {
      expect(service.primitives().length).toBe(2);
    });

    it('should add multiple primitives', () => {
      service.addPrimitives([createTestPrimitive('p3'), createTestPrimitive('p4')]);
      expect(service.primitives().length).toBe(4);
    });

    it('should update a primitive by ID', () => {
      service.updatePrimitive('p1', p => ({ ...p, position: { x: 100, y: 200 } }));

      const updated = service.getPrimitive('p1');
      expect(updated?.position).toEqual({ x: 100, y: 200 });
    });

    it('should not affect other primitives when updating one', () => {
      service.updatePrimitive('p1', p => ({ ...p, position: { x: 999, y: 999 } }));

      const p2 = service.getPrimitive('p2');
      expect(p2?.position).toEqual({ x: 0, y: 0 });
    });

    it('should update primitives matching predicate', () => {
      service.updatePrimitives(
        p => p.id.startsWith('p'),
        p => ({ ...p, position: { x: 50, y: 50 } })
      );

      expect(service.getPrimitive('p1')?.position).toEqual({ x: 50, y: 50 });
      expect(service.getPrimitive('p2')?.position).toEqual({ x: 50, y: 50 });
    });

    it('should remove a primitive by ID', () => {
      service.removePrimitive('p1');
      expect(service.primitives().length).toBe(1);
      expect(service.getPrimitive('p1')).toBeUndefined();
    });

    it('should remove multiple primitives by IDs (array)', () => {
      service.removePrimitives(['p1', 'p2']);
      expect(service.primitives().length).toBe(0);
    });

    it('should remove multiple primitives by IDs (Set)', () => {
      service.removePrimitives(new Set(['p1']));
      expect(service.primitives().length).toBe(1);
    });

    it('should set all primitives', () => {
      service.setPrimitives([createTestPrimitive('p99')]);
      expect(service.primitives().length).toBe(1);
      expect(service.getPrimitive('p99')).toBeTruthy();
    });

    it('should get primitive by ID', () => {
      const p = service.getPrimitive('p1');
      expect(p?.id).toBe('p1');
    });

    it('should return undefined for non-existent primitive', () => {
      expect(service.getPrimitive('nonexistent')).toBeUndefined();
    });
  });

  describe('symbol operations', () => {
    beforeEach(() => {
      service.addSymbol(createTestSymbol('s1'));
      service.addSymbol(createTestSymbol('s2'));
    });

    it('should add a symbol', () => {
      expect(service.symbols().length).toBe(2);
    });

    it('should add multiple symbols', () => {
      service.addSymbols([createTestSymbol('s3'), createTestSymbol('s4')]);
      expect(service.symbols().length).toBe(4);
    });

    it('should update a symbol by ID', () => {
      service.updateSymbol('s1', s => ({ ...s, position: { x: 100, y: 200 } }));

      const updated = service.getSymbol('s1');
      expect(updated?.position).toEqual({ x: 100, y: 200 });
    });

    it('should remove a symbol by ID', () => {
      service.removeSymbol('s1');
      expect(service.symbols().length).toBe(1);
    });

    it('should remove multiple symbols by IDs', () => {
      service.removeSymbols(['s1', 's2']);
      expect(service.symbols().length).toBe(0);
    });

    it('should get symbol by ID', () => {
      const s = service.getSymbol('s1');
      expect(s?.id).toBe('s1');
    });
  });

  describe('element operations', () => {
    beforeEach(() => {
      service.addElement(createTestElement('e1'));
      service.addElement(createTestElement('e2'));
    });

    it('should add an element', () => {
      expect(service.elements().length).toBe(2);
    });

    it('should update an element by ID', () => {
      service.updateElement('e1', e => ({ ...e, name: 'Updated Name' }));

      const updated = service.getElement('e1');
      expect(updated?.name).toBe('Updated Name');
    });

    it('should remove an element by ID', () => {
      service.removeElement('e1');
      expect(service.elements().length).toBe(1);
    });

    it('should remove multiple elements by IDs', () => {
      service.removeElements(['e1', 'e2']);
      expect(service.elements().length).toBe(0);
    });

    it('should get element by ID', () => {
      const e = service.getElement('e1');
      expect(e?.id).toBe('e1');
    });
  });

  describe('connection operations', () => {
    beforeEach(() => {
      service.addElement(createTestElement('e1'));
      service.addElement(createTestElement('e2'));
      service.addElement(createTestElement('e3'));
      service.addConnection(createTestConnection('c1', 'e1', 'e2'));
      service.addConnection(createTestConnection('c2', 'e2', 'e3'));
    });

    it('should add a connection', () => {
      expect(service.connections().length).toBe(2);
    });

    it('should update a connection by ID', () => {
      service.updateConnection('c1', c => ({ ...c, from: { ...c.from, port: 'bottom' } }));

      const updated = service.connections().find(c => c.id === 'c1');
      expect(updated?.from.port).toBe('bottom');
    });

    it('should remove a connection by ID', () => {
      service.removeConnection('c1');
      expect(service.connections().length).toBe(1);
    });

    it('should remove multiple connections by IDs', () => {
      service.removeConnections(['c1', 'c2']);
      expect(service.connections().length).toBe(0);
    });

    it('should remove connections to elements', () => {
      service.removeConnectionsToElements(new Set(['e2']));
      // Both c1 (e1->e2) and c2 (e2->e3) reference e2
      expect(service.connections().length).toBe(0);
    });

    it('should only remove connections to specified elements', () => {
      service.removeConnectionsToElements(new Set(['e3']));
      // Only c2 references e3
      expect(service.connections().length).toBe(1);
      expect(service.connections()[0].id).toBe('c1');
    });
  });

  describe('batch operations', () => {
    it('should batch update multiple collections', () => {
      const primitives = [createTestPrimitive('p1')];
      const symbolInstances = [createTestSymbol('s1')];

      service.batchUpdate({ primitives, symbolInstances });

      expect(service.primitives().length).toBe(1);
      expect(service.symbols().length).toBe(1);
    });

    it('should only update specified collections in batch', () => {
      service.addElement(createTestElement('e1'));

      service.batchUpdate({ primitives: [createTestPrimitive('p1')] });

      expect(service.primitives().length).toBe(1);
      expect(service.elements().length).toBe(1); // Unchanged
    });

    it('should merge partial diagram changes', () => {
      service.merge({ name: 'Merged Name' });
      expect(service.getDiagram().name).toBe('Merged Name');
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      service.addPrimitive(createTestPrimitive('p1'));
      service.addSymbol(createTestSymbol('s1'));
      service.addElement(createTestElement('e1'));
    });

    it('should find primitive by ID', () => {
      const item = service.findItemById('p1');
      expect(item).toBeTruthy();
      expect(item?.id).toBe('p1');
    });

    it('should find symbol by ID', () => {
      const item = service.findItemById('s1');
      expect(item).toBeTruthy();
      expect(item?.id).toBe('s1');
    });

    it('should find element by ID', () => {
      const item = service.findItemById('e1');
      expect(item).toBeTruthy();
      expect(item?.id).toBe('e1');
    });

    it('should return undefined for non-existent ID', () => {
      expect(service.findItemById('nonexistent')).toBeUndefined();
    });

    it('should check if ID exists', () => {
      expect(service.hasId('p1')).toBe(true);
      expect(service.hasId('s1')).toBe(true);
      expect(service.hasId('e1')).toBe(true);
      expect(service.hasId('nonexistent')).toBe(false);
    });
  });

  describe('computed signals', () => {
    it('should update primitives signal when primitives change', () => {
      expect(service.primitives().length).toBe(0);

      service.addPrimitive(createTestPrimitive('p1'));

      expect(service.primitives().length).toBe(1);
    });

    it('should update symbols signal when symbols change', () => {
      expect(service.symbols().length).toBe(0);

      service.addSymbol(createTestSymbol('s1'));

      expect(service.symbols().length).toBe(1);
    });

    it('should update diagram signal when any change occurs', () => {
      const initial = service.diagram();

      service.addPrimitive(createTestPrimitive('p1'));

      const after = service.diagram();
      expect(after).not.toBe(initial);
    });
  });
});
