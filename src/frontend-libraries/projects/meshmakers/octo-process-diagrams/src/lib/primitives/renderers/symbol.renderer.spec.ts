import { TestBed } from '@angular/core/testing';
import { SymbolRenderer } from './symbol.renderer';
import { PrimitiveRendererRegistry } from '../primitive-renderer.registry';
import { ExpressionEvaluatorService } from '../../services/expression-evaluator.service';
import { SymbolDefinition, SymbolInstance } from '../models/symbol.model';
import { RectanglePrimitive } from '../models/rectangle.model';
import { PrimitiveType } from '../models/primitive.models';
import { RenderResult } from './primitive-renderer.interface';

describe('SymbolRenderer', () => {
  let renderer: SymbolRenderer;
  let primitiveRegistry: jasmine.SpyObj<PrimitiveRendererRegistry>;

  // Test data
  const createTestPrimitive = (id: string, name = 'Test Rect'): RectanglePrimitive => ({
    id,
    name,
    type: PrimitiveType.Rectangle,
    position: { x: 0, y: 0 },
    config: { width: 100, height: 50 },
    style: {
      fill: { color: '#ffffff' },
      stroke: { color: '#000000', width: 1 }
    }
  });

  const createTestSymbolDefinition = (overrides?: Partial<SymbolDefinition>): SymbolDefinition => ({
    rtId: 'symbol-1',
    name: 'Test Symbol',
    version: '1.0',
    primitives: [createTestPrimitive('rect-1')],
    bounds: { width: 100, height: 50 },
    ...overrides
  });

  const createTestSymbolInstance = (overrides?: Partial<SymbolInstance>): SymbolInstance => ({
    id: 'instance-1',
    type: 'symbol',
    libraryRtId: 'lib-1',
    symbolRtId: 'symbol-1',
    position: { x: 50, y: 50 },
    ...overrides
  });

  beforeEach(() => {
    primitiveRegistry = jasmine.createSpyObj('PrimitiveRendererRegistry', ['render', 'findPrimitiveAtPoint']);

    // Default mock implementation
    primitiveRegistry.render.and.callFake((primitive, _context) => ({
      tagName: 'rect',
      attributes: { id: primitive.id }
    } as RenderResult));

    TestBed.configureTestingModule({
      providers: [
        SymbolRenderer,
        ExpressionEvaluatorService,
        { provide: PrimitiveRendererRegistry, useValue: primitiveRegistry }
      ]
    });

    renderer = TestBed.inject(SymbolRenderer);
  });

  describe('render', () => {
    it('should render a basic symbol instance', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const result = renderer.render(instance, definition);

      expect(result.instanceId).toBe('instance-1');
      expect(result.primitives.length).toBe(1);
      expect(result.transform).toContain('translate(50, 50)');
    });

    it('should apply rotation transform', () => {
      const instance = createTestSymbolInstance({ rotation: 45 });
      const definition = createTestSymbolDefinition();

      const result = renderer.render(instance, definition);

      expect(result.transform).toContain('rotate(45');
    });

    it('should apply scale transform', () => {
      const instance = createTestSymbolInstance({ scale: 2 });
      const definition = createTestSymbolDefinition();

      const result = renderer.render(instance, definition);

      expect(result.transform).toContain('scale(2)');
    });
  });

  describe('buildTransform', () => {
    it('should build translation only', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const transform = renderer.buildTransform(instance, definition);

      expect(transform).toBe('translate(50, 50)');
    });

    it('should include rotation around center', () => {
      const instance = createTestSymbolInstance({ rotation: 90 });
      const definition = createTestSymbolDefinition();

      const transform = renderer.buildTransform(instance, definition);

      expect(transform).toContain('translate(50, 50)');
      expect(transform).toContain('rotate(90, 50, 25)'); // Center of 100x50 bounds
    });

    it('should include scale', () => {
      const instance = createTestSymbolInstance({ scale: 1.5 });
      const definition = createTestSymbolDefinition();

      const transform = renderer.buildTransform(instance, definition);

      expect(transform).toContain('scale(1.5)');
    });

    it('should combine all transforms', () => {
      const instance = createTestSymbolInstance({ rotation: 45, scale: 2 });
      const definition = createTestSymbolDefinition();

      const transform = renderer.buildTransform(instance, definition);

      expect(transform).toContain('translate');
      expect(transform).toContain('rotate');
      expect(transform).toContain('scale');
    });
  });

  describe('calculateBoundingBox', () => {
    it('should calculate bounding box without scale', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const bbox = renderer.calculateBoundingBox(instance, definition);

      expect(bbox.x).toBe(50);
      expect(bbox.y).toBe(50);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(50);
    });

    it('should calculate bounding box with scale', () => {
      const instance = createTestSymbolInstance({ scale: 2 });
      const definition = createTestSymbolDefinition();

      const bbox = renderer.calculateBoundingBox(instance, definition);

      expect(bbox.width).toBe(200);
      expect(bbox.height).toBe(100);
    });
  });

  describe('containsPoint', () => {
    it('should return true for point inside bounding box', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const result = renderer.containsPoint(instance, definition, 100, 75);

      expect(result).toBe(true);
    });

    it('should return false for point outside bounding box', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const result = renderer.containsPoint(instance, definition, 200, 200);

      expect(result).toBe(false);
    });
  });

  describe('getConnectionPoints', () => {
    it('should return empty array when no connection points defined', () => {
      const instance = createTestSymbolInstance();
      const definition = createTestSymbolDefinition();

      const points = renderer.getConnectionPoints(instance, definition);

      expect(points.length).toBe(0);
    });

    it('should return transformed connection points', () => {
      const instance = createTestSymbolInstance({ position: { x: 100, y: 100 }, scale: 2 });
      const definition = createTestSymbolDefinition({
        connectionPoints: [
          { id: 'cp-1', name: 'Input', position: { x: 0, y: 25 } },
          { id: 'cp-2', name: 'Output', position: { x: 100, y: 25 } }
        ]
      });

      const points = renderer.getConnectionPoints(instance, definition);

      expect(points.length).toBe(2);
      expect(points[0].x).toBe(100); // 100 + 0 * 2
      expect(points[0].y).toBe(150); // 100 + 25 * 2
      expect(points[1].x).toBe(300); // 100 + 100 * 2
      expect(points[1].y).toBe(150); // 100 + 25 * 2
    });
  });

  describe('transform property bindings', () => {
    it('should apply rotation binding', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { rotation: 50 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'rotation',
          name: 'Rotation',
          type: 'number',
          defaultValue: 0
        }],
        propertyBindings: [{
          propertyId: 'rotation',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'transform.rotation',
          expression: 'value * 3.6' // 0-100 -> 0-360
        }]
      });

      renderer.render(instance, definition);

      // Verify the primitive was called with modified transform
      expect(primitiveRegistry.render).toHaveBeenCalled();
      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.transform?.rotation).toBe(180); // 50 * 3.6 = 180
    });

    it('should apply fill color binding', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { level: 50 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'level',
          name: 'Level',
          type: 'number',
          defaultValue: 0
        }],
        propertyBindings: [{
          propertyId: 'level',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'style.fill.color',
          expression: 'lerpColor(value, 0, 100, "#ff0000", "#00ff00")'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.style?.fill?.color).toBeDefined();
    });

    it('should apply fillLevel binding', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { level: 75 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'level',
          name: 'Level',
          type: 'number',
          defaultValue: 0
        }],
        propertyBindings: [{
          propertyId: 'level',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'fillLevel',
          expression: 'value / 100'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.fillLevel).toBe(0.75);
    });

    it('should apply visibility binding', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { showElement: 0 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'showElement',
          name: 'Show Element',
          type: 'boolean',
          defaultValue: true
        }],
        propertyBindings: [{
          propertyId: 'showElement',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'visible',
          expression: 'value'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.visible).toBe(false);
    });

    it('should use default value when property value not provided', () => {
      const instance = createTestSymbolInstance({
        propertyValues: {} // No values provided
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'rotation',
          name: 'Rotation',
          type: 'number',
          defaultValue: 45
        }],
        propertyBindings: [{
          propertyId: 'rotation',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'transform.rotation',
          expression: 'value'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.transform?.rotation).toBe(45);
    });

    it('should apply offset bindings', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { offsetX: 25, offsetY: 15 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [
          { id: 'offsetX', name: 'Offset X', type: 'number', defaultValue: 0 },
          { id: 'offsetY', name: 'Offset Y', type: 'number', defaultValue: 0 }
        ],
        propertyBindings: [
          {
            propertyId: 'offsetX',
            targetType: 'primitive',
            targetId: 'rect-1',
            effectType: 'transform.offsetX',
            expression: 'value'
          },
          {
            propertyId: 'offsetY',
            targetType: 'primitive',
            targetId: 'rect-1',
            effectType: 'transform.offsetY',
            expression: 'value'
          }
        ]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.transform?.offsetX).toBe(25);
      expect(callArgs.transform?.offsetY).toBe(15);
    });

    it('should apply scale bindings', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { zoomLevel: 150 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'zoomLevel',
          name: 'Zoom Level',
          type: 'number',
          defaultValue: 100
        }],
        propertyBindings: [{
          propertyId: 'zoomLevel',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'transform.scale',
          expression: 'value / 100'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.transform?.scale).toBe(1.5);
    });

    it('should apply opacity binding', () => {
      const instance = createTestSymbolInstance({
        propertyValues: { opacity: 50 }
      });
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'opacity',
          name: 'Opacity',
          type: 'number',
          defaultValue: 100
        }],
        propertyBindings: [{
          propertyId: 'opacity',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'style.opacity',
          expression: 'value / 100'
        }]
      });

      renderer.render(instance, definition);

      const callArgs = primitiveRegistry.render.calls.mostRecent().args[0];
      expect(callArgs.style?.opacity).toBe(0.5);
    });
  });

  describe('getSymbolInstanceBindings', () => {
    it('should return empty map when no pass-through bindings', () => {
      const definition = createTestSymbolDefinition({
        transformProperties: [{
          id: 'rotation',
          name: 'Rotation',
          type: 'number',
          defaultValue: 0
        }],
        propertyBindings: [{
          propertyId: 'rotation',
          targetType: 'primitive',
          targetId: 'rect-1',
          effectType: 'transform.rotation',
          expression: 'value'
        }]
      });

      const result = renderer.getSymbolInstanceBindings(definition, { rotation: 50 });

      expect(result.size).toBe(0);
    });

    it('should return pass-through bindings for nested symbols', () => {
      const definition = createTestSymbolDefinition({
        symbolInstances: [{
          id: 'nested-gauge',
          type: 'symbol',
          libraryRtId: 'lib-1',
          symbolRtId: 'gauge-def',
          position: { x: 0, y: 0 }
        }],
        transformProperties: [{
          id: 'temperature',
          name: 'Temperature',
          type: 'number',
          defaultValue: 0
        }],
        propertyBindings: [{
          propertyId: 'temperature',
          targetType: 'symbolInstance',
          targetId: 'nested-gauge',
          effectType: 'property',
          expression: 'value',
          targetPropertyId: 'displayValue'
        }]
      });

      const result = renderer.getSymbolInstanceBindings(definition, { temperature: 75 });

      expect(result.size).toBe(1);
      expect(result.has('nested-gauge')).toBe(true);
      const nestedValues = result.get('nested-gauge');
      expect(nestedValues?.['displayValue']).toBe(75);
    });
  });
});
