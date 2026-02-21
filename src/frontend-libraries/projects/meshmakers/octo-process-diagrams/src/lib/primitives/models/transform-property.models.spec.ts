import {
  TransformProperty,
  PropertyBinding,
  isTransformProperty,
  isPropertyBinding,
  createNumberProperty,
  createColorProperty,
  createBooleanProperty,
  createPropertyBinding
} from './transform-property.models';

describe('Transform Property Models', () => {

  describe('isTransformProperty', () => {
    it('should return true for valid TransformProperty', () => {
      const prop: TransformProperty = {
        id: 'test',
        name: 'Test Property',
        type: 'number',
        defaultValue: 0
      };
      expect(isTransformProperty(prop)).toBe(true);
    });

    it('should return true for number type with all optional fields', () => {
      const prop: TransformProperty = {
        id: 'rotation',
        name: 'Rotation',
        type: 'number',
        defaultValue: 0,
        min: 0,
        max: 360,
        step: 1,
        unit: '°',
        description: 'Rotates the element',
        group: 'Transform'
      };
      expect(isTransformProperty(prop)).toBe(true);
    });

    it('should return true for color type', () => {
      const prop: TransformProperty = {
        id: 'fillColor',
        name: 'Fill Color',
        type: 'color',
        defaultValue: '#ff0000'
      };
      expect(isTransformProperty(prop)).toBe(true);
    });

    it('should return true for boolean type', () => {
      const prop: TransformProperty = {
        id: 'visible',
        name: 'Visible',
        type: 'boolean',
        defaultValue: true
      };
      expect(isTransformProperty(prop)).toBe(true);
    });

    it('should return true for string type', () => {
      const prop: TransformProperty = {
        id: 'label',
        name: 'Label',
        type: 'string',
        defaultValue: 'Default'
      };
      expect(isTransformProperty(prop)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isTransformProperty(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTransformProperty(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isTransformProperty('string')).toBe(false);
      expect(isTransformProperty(123)).toBe(false);
    });

    it('should return false for object missing id', () => {
      const prop = {
        name: 'Test',
        type: 'number',
        defaultValue: 0
      };
      expect(isTransformProperty(prop)).toBe(false);
    });

    it('should return false for object missing name', () => {
      const prop = {
        id: 'test',
        type: 'number',
        defaultValue: 0
      };
      expect(isTransformProperty(prop)).toBe(false);
    });

    it('should return false for object missing type', () => {
      const prop = {
        id: 'test',
        name: 'Test',
        defaultValue: 0
      };
      expect(isTransformProperty(prop)).toBe(false);
    });

    it('should return false for object missing defaultValue', () => {
      const prop = {
        id: 'test',
        name: 'Test',
        type: 'number'
      };
      expect(isTransformProperty(prop)).toBe(false);
    });

    it('should return false for invalid type', () => {
      const prop = {
        id: 'test',
        name: 'Test',
        type: 'invalid',
        defaultValue: 0
      };
      expect(isTransformProperty(prop)).toBe(false);
    });
  });

  describe('isPropertyBinding', () => {
    it('should return true for valid PropertyBinding', () => {
      const binding: PropertyBinding = {
        propertyId: 'rotation',
        targetType: 'primitive',
        targetId: 'rect-1',
        effectType: 'transform.rotation',
        expression: 'value'
      };
      expect(isPropertyBinding(binding)).toBe(true);
    });

    it('should return true for binding with targetPropertyId', () => {
      const binding: PropertyBinding = {
        propertyId: 'temperature',
        targetType: 'symbolInstance',
        targetId: 'gauge-1',
        effectType: 'property',
        expression: 'value',
        targetPropertyId: 'displayValue'
      };
      expect(isPropertyBinding(binding)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPropertyBinding(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPropertyBinding(undefined)).toBe(false);
    });

    it('should return false for object missing propertyId', () => {
      const binding = {
        targetType: 'primitive',
        targetId: 'rect-1',
        effectType: 'transform.rotation',
        expression: 'value'
      };
      expect(isPropertyBinding(binding)).toBe(false);
    });

    it('should return false for object missing targetType', () => {
      const binding = {
        propertyId: 'rotation',
        targetId: 'rect-1',
        effectType: 'transform.rotation',
        expression: 'value'
      };
      expect(isPropertyBinding(binding)).toBe(false);
    });

    it('should return false for object missing targetId', () => {
      const binding = {
        propertyId: 'rotation',
        targetType: 'primitive',
        effectType: 'transform.rotation',
        expression: 'value'
      };
      expect(isPropertyBinding(binding)).toBe(false);
    });

    it('should return false for object missing effectType', () => {
      const binding = {
        propertyId: 'rotation',
        targetType: 'primitive',
        targetId: 'rect-1',
        expression: 'value'
      };
      expect(isPropertyBinding(binding)).toBe(false);
    });

    it('should return false for object missing expression', () => {
      const binding = {
        propertyId: 'rotation',
        targetType: 'primitive',
        targetId: 'rect-1',
        effectType: 'transform.rotation'
      };
      expect(isPropertyBinding(binding)).toBe(false);
    });
  });

  describe('createNumberProperty', () => {
    it('should create number property with minimal args', () => {
      const prop = createNumberProperty('speed', 'Speed');
      expect(prop.id).toBe('speed');
      expect(prop.name).toBe('Speed');
      expect(prop.type).toBe('number');
      expect(prop.defaultValue).toBe(0);
      expect(prop.step).toBe(1);
    });

    it('should create number property with all options', () => {
      const prop = createNumberProperty('rotation', 'Rotation', {
        defaultValue: 45,
        min: 0,
        max: 360,
        step: 5,
        unit: '°',
        description: 'Rotation angle',
        group: 'Transform'
      });

      expect(prop.id).toBe('rotation');
      expect(prop.name).toBe('Rotation');
      expect(prop.type).toBe('number');
      expect(prop.defaultValue).toBe(45);
      expect(prop.min).toBe(0);
      expect(prop.max).toBe(360);
      expect(prop.step).toBe(5);
      expect(prop.unit).toBe('°');
      expect(prop.description).toBe('Rotation angle');
      expect(prop.group).toBe('Transform');
    });

    it('should override defaultValue from options', () => {
      const prop = createNumberProperty('value', 'Value', { defaultValue: 100 });
      expect(prop.defaultValue).toBe(100);
    });

    it('should handle undefined options gracefully', () => {
      const prop = createNumberProperty('test', 'Test', {
        min: undefined,
        max: undefined
      });
      expect(prop.min).toBeUndefined();
      expect(prop.max).toBeUndefined();
    });
  });

  describe('createColorProperty', () => {
    it('should create color property with default value', () => {
      const prop = createColorProperty('fill', 'Fill Color');
      expect(prop.id).toBe('fill');
      expect(prop.name).toBe('Fill Color');
      expect(prop.type).toBe('color');
      expect(prop.defaultValue).toBe('#000000');
    });

    it('should create color property with custom default', () => {
      const prop = createColorProperty('stroke', 'Stroke Color', '#ff0000');
      expect(prop.defaultValue).toBe('#ff0000');
    });

    it('should create color property with options', () => {
      const prop = createColorProperty('fill', 'Fill Color', '#00ff00', {
        description: 'Background fill color',
        group: 'Style'
      });
      expect(prop.description).toBe('Background fill color');
      expect(prop.group).toBe('Style');
    });

    it('should not have numeric properties', () => {
      const prop = createColorProperty('color', 'Color');
      expect(prop.min).toBeUndefined();
      expect(prop.max).toBeUndefined();
      expect(prop.step).toBeUndefined();
      expect(prop.unit).toBeUndefined();
    });
  });

  describe('createBooleanProperty', () => {
    it('should create boolean property with default false', () => {
      const prop = createBooleanProperty('visible', 'Visible');
      expect(prop.id).toBe('visible');
      expect(prop.name).toBe('Visible');
      expect(prop.type).toBe('boolean');
      expect(prop.defaultValue).toBe(false);
    });

    it('should create boolean property with custom default', () => {
      const prop = createBooleanProperty('enabled', 'Enabled', true);
      expect(prop.defaultValue).toBe(true);
    });

    it('should create boolean property with options', () => {
      const prop = createBooleanProperty('active', 'Active', false, {
        description: 'Is element active',
        group: 'State'
      });
      expect(prop.description).toBe('Is element active');
      expect(prop.group).toBe('State');
    });
  });

  describe('createPropertyBinding', () => {
    it('should create binding with minimal args', () => {
      const binding = createPropertyBinding(
        'rotation',
        'rect-1',
        'transform.rotation',
        'value'
      );

      expect(binding.propertyId).toBe('rotation');
      expect(binding.targetType).toBe('primitive');
      expect(binding.targetId).toBe('rect-1');
      expect(binding.effectType).toBe('transform.rotation');
      expect(binding.expression).toBe('value');
      expect(binding.targetPropertyId).toBeUndefined();
    });

    it('should create binding with symbolInstance target type', () => {
      const binding = createPropertyBinding(
        'temperature',
        'gauge-1',
        'property',
        'value',
        { targetType: 'symbolInstance', targetPropertyId: 'displayValue' }
      );

      expect(binding.targetType).toBe('symbolInstance');
      expect(binding.targetPropertyId).toBe('displayValue');
    });

    it('should create binding for different effect types', () => {
      const effectTypes = [
        'transform.rotation',
        'transform.offsetX',
        'transform.offsetY',
        'transform.scale',
        'transform.scaleX',
        'transform.scaleY',
        'style.fill.color',
        'style.fill.opacity',
        'style.stroke.color',
        'style.stroke.opacity',
        'style.opacity',
        'visible',
        'fillLevel',
        'property'
      ] as const;

      for (const effectType of effectTypes) {
        const binding = createPropertyBinding('prop', 'target', effectType, 'value');
        expect(binding.effectType).toBe(effectType);
      }
    });

    it('should handle complex expressions', () => {
      const binding = createPropertyBinding(
        'speed',
        'rotor',
        'transform.rotation',
        'value * 3.6 + 45'
      );
      expect(binding.expression).toBe('value * 3.6 + 45');
    });
  });
});
