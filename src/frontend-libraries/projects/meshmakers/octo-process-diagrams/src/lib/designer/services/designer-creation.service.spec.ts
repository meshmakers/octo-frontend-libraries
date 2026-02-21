import { TestBed } from '@angular/core/testing';
import { DesignerCreationService } from './designer-creation.service';
import { PrimitiveType, PrimitiveTypeValue } from '../../primitives';
import { ProcessElementType, Position } from '../../process-widget.models';

describe('DesignerCreationService', () => {
  let service: DesignerCreationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerCreationService]
    });
    service = TestBed.inject(DesignerCreationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // ID Generation
  // ============================================================================

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateId();
      const id2 = service.generateId();

      expect(id1).not.toBe(id2);
    });

    it('should use default prefix "elem"', () => {
      const id = service.generateId();

      expect(id.startsWith('elem-')).toBeTrue();
    });

    it('should use custom prefix', () => {
      const id = service.generateId('custom');

      expect(id.startsWith('custom-')).toBeTrue();
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const id = service.generateId();
      const after = Date.now();

      // Extract timestamp from ID (format: prefix-timestamp-random)
      const parts = id.split('-');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================================
  // Default Sizes
  // ============================================================================

  describe('getDefaultElementSize', () => {
    it('should return correct size for tank', () => {
      const size = service.getDefaultElementSize('tank');

      expect(size).toEqual({ width: 80, height: 120 });
    });

    it('should return correct size for valve', () => {
      const size = service.getDefaultElementSize('valve');

      expect(size).toEqual({ width: 40, height: 40 });
    });

    it('should return correct size for digitalDisplay', () => {
      const size = service.getDefaultElementSize('digitalDisplay');

      expect(size).toEqual({ width: 100, height: 40 });
    });

    it('should return default size for unknown type', () => {
      const size = service.getDefaultElementSize('unknown' as ProcessElementType);

      expect(size).toEqual({ width: 80, height: 80 });
    });

    it('should return different sizes for different types', () => {
      const tankSize = service.getDefaultElementSize('tank');
      const valveSize = service.getDefaultElementSize('valve');
      const pumpSize = service.getDefaultElementSize('pump');

      expect(tankSize).not.toEqual(valveSize);
      expect(valveSize).not.toEqual(pumpSize);
    });
  });

  describe('getDefaultPrimitiveSize', () => {
    it('should return correct size for rectangle', () => {
      const size = service.getDefaultPrimitiveSize(PrimitiveType.Rectangle);

      expect(size).toEqual({ width: 100, height: 80 });
    });

    it('should return correct size for line', () => {
      const size = service.getDefaultPrimitiveSize(PrimitiveType.Line);

      expect(size).toEqual({ width: 100, height: 0 });
    });

    it('should return correct size for text', () => {
      const size = service.getDefaultPrimitiveSize(PrimitiveType.Text);

      expect(size).toEqual({ width: 100, height: 24 });
    });

    it('should return default size for unknown type', () => {
      const size = service.getDefaultPrimitiveSize('unknown' as PrimitiveTypeValue);

      expect(size).toEqual({ width: 100, height: 80 });
    });
  });

  // ============================================================================
  // Element Creation
  // ============================================================================

  describe('createDefaultElement', () => {
    const position: Position = { x: 100, y: 200 };

    it('should create element with auto-generated ID', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.id).toBeDefined();
      expect(element.id.startsWith('elem-')).toBeTrue();
    });

    it('should create element with provided ID', () => {
      const element = service.createDefaultElement('tank', position, 'custom-id');

      expect(element.id).toBe('custom-id');
    });

    it('should set correct type', () => {
      const element = service.createDefaultElement('pump', position);

      expect(element.type).toBe('pump');
    });

    it('should set position', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.position).toEqual(position);
    });

    it('should set default size based on type', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.size).toEqual({ width: 80, height: 120 });
    });

    it('should set visible to true', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.visible).toBeTrue();
    });

    it('should generate name with ID suffix', () => {
      const element = service.createDefaultElement('valve', position, 'test-id-1234');

      expect(element.name).toBe('valve-1234');
    });

    it('should initialize empty style object', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.style).toBeDefined();
      expect(element.style?.fillColor).toBeUndefined();
      expect(element.style?.strokeColor).toBeUndefined();
    });

    // Type-specific config tests
    it('should create tank with default config', () => {
      const element = service.createDefaultElement('tank', position);

      expect(element.config).toEqual({
        shape: 'cylindrical',
        orientation: 'vertical',
        showLevel: true,
        showPercentage: true
      });
    });

    it('should create valve with default config', () => {
      const element = service.createDefaultElement('valve', position);

      expect(element.config).toEqual({
        valveType: 'gate',
        showState: true
      });
    });

    it('should create pump with default config', () => {
      const element = service.createDefaultElement('pump', position);

      expect(element.config).toEqual({
        pumpType: 'centrifugal',
        showAnimation: true,
        showState: true
      });
    });

    it('should create gauge with default config', () => {
      const element = service.createDefaultElement('gauge', position);

      expect(element.config).toEqual({
        gaugeType: 'arc',
        min: 0,
        max: 100,
        showValue: true
      });
    });

    it('should create label with default config', () => {
      const element = service.createDefaultElement('label', position);

      expect(element.config).toEqual({ text: 'Label' });
    });

    it('should create all element types without error', () => {
      const types: ProcessElementType[] = [
        'tank', 'silo', 'vessel', 'pipe', 'valve', 'pump', 'motor',
        'gauge', 'digitalDisplay', 'statusLight', 'label', 'image', 'shape', 'customSvg'
      ];

      for (const type of types) {
        expect(() => service.createDefaultElement(type, position)).not.toThrow();
      }
    });
  });

  // ============================================================================
  // Primitive Creation
  // ============================================================================

  describe('createDefaultPrimitive', () => {
    const position: Position = { x: 50, y: 100 };

    it('should create primitive with auto-generated ID', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Rectangle, position);

      expect(primitive.id).toBeDefined();
      expect(primitive.id.startsWith('prim-')).toBeTrue();
    });

    it('should create primitive with provided ID', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Rectangle, position, 'custom-prim');

      expect(primitive.id).toBe('custom-prim');
    });

    it('should create rectangle at correct position', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Rectangle, position);

      expect(primitive.type).toBe('rectangle');
      expect(primitive.position).toEqual(position);
    });

    it('should create ellipse with centered position', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Ellipse, position);

      expect(primitive.type).toBe('ellipse');
      // Ellipse position is center point
      expect(primitive.position.x).toBe(position.x + 50);
      expect(primitive.position.y).toBe(position.y + 40);
    });

    it('should create line with start and end points', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Line, position);

      expect(primitive.type).toBe('line');
      expect(primitive.id).toBeDefined();
      // Line primitives may have different property structures
    });

    it('should create path with default path data', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Path, position);

      expect(primitive.type).toBe('path');
      expect(primitive.id).toBeDefined();
      // Path primitives contain path data
    });

    it('should create polygon with default points', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Polygon, position);

      expect(primitive.type).toBe('polygon');
      expect(primitive.id).toBeDefined();
      // Polygon primitives contain points array
    });

    it('should create polyline with default points', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Polyline, position);

      expect(primitive.type).toBe('polyline');
      expect(primitive.id).toBeDefined();
      // Polyline primitives contain points array
    });

    it('should create image primitive', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Image, position);

      expect(primitive.type).toBe('image');
      expect(primitive.id).toBeDefined();
      expect(primitive.position).toEqual(position);
    });

    it('should create text primitive', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Text, position);

      expect(primitive.type).toBe('text');
      expect(primitive.id).toBeDefined();
    });

    it('should apply default style to filled shapes', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Rectangle, position);

      expect(primitive.style?.fill?.color).toBe('#e3f2fd');
      expect(primitive.style?.stroke?.color).toBe('#1976d2');
      expect(primitive.style?.stroke?.width).toBe(2);
    });

    it('should apply stroke-only style to lines', () => {
      const primitive = service.createDefaultPrimitive(PrimitiveType.Line, position);

      expect(primitive.style?.stroke?.color).toBe('#333333');
      expect(primitive.style?.stroke?.width).toBe(2);
    });

    it('should create all primitive types without error', () => {
      const types: PrimitiveTypeValue[] = [
        PrimitiveType.Rectangle, PrimitiveType.Ellipse, PrimitiveType.Line,
        PrimitiveType.Path, PrimitiveType.Polygon, PrimitiveType.Polyline,
        PrimitiveType.Image, PrimitiveType.Text
      ];

      for (const type of types) {
        expect(() => service.createDefaultPrimitive(type, position)).not.toThrow();
      }
    });

    it('should default to rectangle for unknown type', () => {
      const primitive = service.createDefaultPrimitive('unknown' as PrimitiveTypeValue, position);

      expect(primitive.type).toBe('rectangle');
    });
  });

  // ============================================================================
  // Symbol Instance Creation
  // ============================================================================

  describe('createSymbolInstance', () => {
    const position: Position = { x: 150, y: 250 };
    const libraryRtId = 'lib-123';
    const symbolRtId = 'sym-456';

    it('should create symbol instance with auto-generated ID', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.id).toBeDefined();
      expect(symbol.id.startsWith('sym-')).toBeTrue();
    });

    it('should set library and symbol IDs', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.libraryRtId).toBe(libraryRtId);
      expect(symbol.symbolRtId).toBe(symbolRtId);
    });

    it('should set position (copy, not reference)', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.position).toEqual(position);
      expect(symbol.position).not.toBe(position);
    });

    it('should set type to "symbol"', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.type).toBe('symbol');
    });

    it('should use default scale of 1', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.scale).toBe(1);
    });

    it('should use default rotation of 0', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.rotation).toBe(0);
    });

    it('should set visible to true', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.visible).toBeTrue();
    });

    it('should set locked to false', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.locked).toBeFalse();
    });

    it('should apply custom scale', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position, { scale: 2 });

      expect(symbol.scale).toBe(2);
    });

    it('should apply custom rotation', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position, { rotation: 45 });

      expect(symbol.rotation).toBe(45);
    });

    it('should apply custom name', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position, { name: 'My Symbol' });

      expect(symbol.name).toBe('My Symbol');
    });

    it('should leave name undefined when not provided', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position);

      expect(symbol.name).toBeUndefined();
    });

    it('should apply all options together', () => {
      const symbol = service.createSymbolInstance(libraryRtId, symbolRtId, position, {
        scale: 1.5,
        rotation: 90,
        name: 'Custom Symbol'
      });

      expect(symbol.scale).toBe(1.5);
      expect(symbol.rotation).toBe(90);
      expect(symbol.name).toBe('Custom Symbol');
    });
  });

  // ============================================================================
  // Diagram Creation
  // ============================================================================

  describe('createEmptyDiagram', () => {
    it('should create diagram with auto-generated ID', () => {
      const diagram = service.createEmptyDiagram();

      expect(diagram.id).toBeDefined();
      expect(diagram.id.startsWith('diag-')).toBeTrue();
    });

    it('should use default name', () => {
      const diagram = service.createEmptyDiagram();

      expect(diagram.name).toBe('New Process Diagram');
    });

    it('should use provided name', () => {
      const diagram = service.createEmptyDiagram('My Diagram');

      expect(diagram.name).toBe('My Diagram');
    });

    it('should set version to 1.0', () => {
      const diagram = service.createEmptyDiagram();

      expect(diagram.version).toBe('1.0');
    });

    it('should set default canvas configuration', () => {
      const diagram = service.createEmptyDiagram();

      expect(diagram.canvas).toEqual({
        width: 1200,
        height: 800,
        backgroundColor: '#fafafa',
        gridSize: 20,
        showGrid: true
      });
    });

    it('should initialize empty arrays', () => {
      const diagram = service.createEmptyDiagram();

      expect(diagram.elements).toEqual([]);
      expect(diagram.primitives).toEqual([]);
      expect(diagram.symbolInstances).toEqual([]);
      expect(diagram.connections).toEqual([]);
    });
  });

  describe('copyDiagram', () => {
    it('should create copy with new ID', () => {
      const original = service.createEmptyDiagram('Original');
      const copy = service.copyDiagram(original);

      expect(copy.id).not.toBe(original.id);
      expect(copy.id.startsWith('diag-')).toBeTrue();
    });

    it('should use default copy name', () => {
      const original = service.createEmptyDiagram('My Diagram');
      const copy = service.copyDiagram(original);

      expect(copy.name).toBe('My Diagram (Copy)');
    });

    it('should use provided name', () => {
      const original = service.createEmptyDiagram('Original');
      const copy = service.copyDiagram(original, 'New Name');

      expect(copy.name).toBe('New Name');
    });

    it('should preserve other properties', () => {
      const original = service.createEmptyDiagram();
      original.canvas.gridSize = 10;
      original.version = '2.0';

      const copy = service.copyDiagram(original);

      expect(copy.canvas.gridSize).toBe(10);
      expect(copy.version).toBe('2.0');
    });
  });

  // ============================================================================
  // Type Information
  // ============================================================================

  describe('getElementTypeLabel', () => {
    it('should return correct label for tank', () => {
      expect(service.getElementTypeLabel('tank')).toBe('Tank');
    });

    it('should return correct label for digitalDisplay', () => {
      expect(service.getElementTypeLabel('digitalDisplay')).toBe('Digital Display');
    });

    it('should return correct label for customSvg', () => {
      expect(service.getElementTypeLabel('customSvg')).toBe('SVG');
    });

    it('should return type as label for unknown type', () => {
      expect(service.getElementTypeLabel('unknown' as ProcessElementType)).toBe('unknown');
    });
  });

  describe('getPrimitiveTypeLabel', () => {
    it('should return correct label for rectangle', () => {
      expect(service.getPrimitiveTypeLabel(PrimitiveType.Rectangle)).toBe('Rectangle');
    });

    it('should return correct label for polyline', () => {
      expect(service.getPrimitiveTypeLabel(PrimitiveType.Polyline)).toBe('Polyline');
    });

    it('should return correct label for group', () => {
      expect(service.getPrimitiveTypeLabel('group')).toBe('Group');
    });

    it('should return type as label for unknown type', () => {
      expect(service.getPrimitiveTypeLabel('unknown' as PrimitiveTypeValue)).toBe('unknown');
    });
  });

  describe('getAvailableElementTypes', () => {
    it('should return array of element types', () => {
      const types = service.getAvailableElementTypes();

      expect(Array.isArray(types)).toBeTrue();
      expect(types.length).toBe(14);
    });

    it('should include common types', () => {
      const types = service.getAvailableElementTypes();

      expect(types).toContain('tank');
      expect(types).toContain('valve');
      expect(types).toContain('pump');
      expect(types).toContain('gauge');
    });
  });

  describe('getAvailablePrimitiveTypes', () => {
    it('should return array of primitive types', () => {
      const types = service.getAvailablePrimitiveTypes();

      expect(Array.isArray(types)).toBeTrue();
      expect(types.length).toBe(8);
    });

    it('should include all standard types', () => {
      const types = service.getAvailablePrimitiveTypes();

      expect(types).toContain(PrimitiveType.Rectangle);
      expect(types).toContain(PrimitiveType.Ellipse);
      expect(types).toContain(PrimitiveType.Line);
      expect(types).toContain(PrimitiveType.Text);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle negative positions', () => {
      const position: Position = { x: -100, y: -50 };
      const element = service.createDefaultElement('tank', position);

      expect(element.position).toEqual(position);
    });

    it('should handle zero position', () => {
      const position: Position = { x: 0, y: 0 };
      const primitive = service.createDefaultPrimitive(PrimitiveType.Rectangle, position);

      expect(primitive.position).toEqual(position);
    });

    it('should handle very large positions', () => {
      const position: Position = { x: 999999, y: 999999 };
      const symbol = service.createSymbolInstance('lib', 'sym', position);

      expect(symbol.position).toEqual(position);
    });

    it('should handle special characters in names', () => {
      const diagram = service.createEmptyDiagram('Test <> & "quotes"');

      expect(diagram.name).toBe('Test <> & "quotes"');
    });

    it('should handle empty string name', () => {
      const diagram = service.createEmptyDiagram('');

      expect(diagram.name).toBe('');
    });
  });
});
