/**
 * Style Class Model - Unit Tests
 */

import {
  StyleClass,
  createStyleClass,
  createStyleClassFromCss,
  isStyleClass,
  findStyleClass,
  findStyleClassByName,
  createStyleClassNameMap
} from './style-class.model';

describe('Style Class Model', () => {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  describe('Factory Functions', () => {
    describe('createStyleClass', () => {
      it('should create a style class with default values', () => {
        const styleClass = createStyleClass('test-style');

        expect(styleClass.id).toBeDefined();
        expect(styleClass.id).toMatch(/^style_\d+_[a-z0-9]+$/);
        expect(styleClass.name).toBe('test-style');
        expect(styleClass.style).toBeDefined();
        expect(styleClass.style.fill?.color).toBe('#cccccc');
        expect(styleClass.style.fill?.opacity).toBe(1);
        expect(styleClass.style.stroke?.color).toBe('#333333');
        expect(styleClass.style.stroke?.width).toBe(1);
        expect(styleClass.style.stroke?.opacity).toBe(1);
      });

      it('should create a style class with custom style', () => {
        const customStyle = {
          fill: { color: '#ff0000', opacity: 0.5 },
          stroke: { color: '#00ff00', width: 2, opacity: 0.8 }
        };

        const styleClass = createStyleClass('custom-style', customStyle);

        expect(styleClass.name).toBe('custom-style');
        expect(styleClass.style.fill?.color).toBe('#ff0000');
        expect(styleClass.style.fill?.opacity).toBe(0.5);
        expect(styleClass.style.stroke?.color).toBe('#00ff00');
        expect(styleClass.style.stroke?.width).toBe(2);
        expect(styleClass.style.stroke?.opacity).toBe(0.8);
      });

      it('should create unique IDs for different style classes', () => {
        const styleClass1 = createStyleClass('style-1');
        const styleClass2 = createStyleClass('style-2');

        expect(styleClass1.id).not.toBe(styleClass2.id);
      });

      it('should create style with dashArray for line types', () => {
        const styleWithDash = createStyleClass('dashed-style', {
          fill: { color: '#ffffff' },
          stroke: { color: '#000000', width: 2, dashArray: [8, 4] }
        });

        expect(styleWithDash.style.stroke?.dashArray).toEqual([8, 4]);
      });
    });

    describe('createStyleClassFromCss', () => {
      it('should create a style class from CSS class name', () => {
        const styleClass = createStyleClassFromCss('cls-1', {
          fill: { color: '#6fc1a9', opacity: 1 },
          stroke: { color: '#333333', width: 1 }
        });

        expect(styleClass.id).toBe('style_cls-1');
        expect(styleClass.name).toBe('cls-1');
        expect(styleClass.style.fill?.color).toBe('#6fc1a9');
      });

      it('should preserve all style properties from CSS', () => {
        const styleClass = createStyleClassFromCss('border-style', {
          stroke: { color: '#ff0000', width: 3, dashArray: [5, 3], opacity: 0.9 }
        });

        expect(styleClass.style.stroke?.color).toBe('#ff0000');
        expect(styleClass.style.stroke?.width).toBe(3);
        expect(styleClass.style.stroke?.dashArray).toEqual([5, 3]);
        expect(styleClass.style.stroke?.opacity).toBe(0.9);
      });
    });
  });

  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('Type Guards', () => {
    describe('isStyleClass', () => {
      it('should return true for valid style class objects', () => {
        const styleClass: StyleClass = {
          id: 'style_123',
          name: 'test-style',
          style: { fill: { color: '#000' } }
        };

        expect(isStyleClass(styleClass)).toBe(true);
      });

      it('should return true for created style class', () => {
        const styleClass = createStyleClass('created-style');
        expect(isStyleClass(styleClass)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isStyleClass(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isStyleClass(undefined)).toBe(false);
      });

      it('should return false for objects without id', () => {
        expect(isStyleClass({ name: 'test', style: {} })).toBe(false);
      });

      it('should return false for objects without name', () => {
        expect(isStyleClass({ id: 'test', style: {} })).toBe(false);
      });

      it('should return false for objects without style', () => {
        expect(isStyleClass({ id: 'test', name: 'test' })).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isStyleClass('string')).toBe(false);
        expect(isStyleClass(123)).toBe(false);
        expect(isStyleClass(true)).toBe(false);
        expect(isStyleClass([])).toBe(false);
      });

      it('should return false for objects with non-string id', () => {
        expect(isStyleClass({ id: 123, name: 'test', style: {} })).toBe(false);
      });

      it('should return false for objects with non-string name', () => {
        expect(isStyleClass({ id: 'test', name: 123, style: {} })).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('Utility Functions', () => {
    const testStyleClasses: StyleClass[] = [
      {
        id: 'style_1',
        name: 'primary',
        style: { fill: { color: '#007bff' } }
      },
      {
        id: 'style_2',
        name: 'secondary',
        style: { fill: { color: '#6c757d' } }
      },
      {
        id: 'style_3',
        name: 'danger',
        style: { fill: { color: '#dc3545' }, stroke: { color: '#721c24', dashArray: [4, 2] } }
      }
    ];

    describe('findStyleClass', () => {
      it('should find style class by id', () => {
        const found = findStyleClass(testStyleClasses, 'style_2');

        expect(found).toBeDefined();
        expect(found?.name).toBe('secondary');
      });

      it('should return undefined for non-existent id', () => {
        const found = findStyleClass(testStyleClasses, 'non-existent');
        expect(found).toBeUndefined();
      });

      it('should return undefined for undefined styleClasses', () => {
        const found = findStyleClass(undefined, 'style_1');
        expect(found).toBeUndefined();
      });

      it('should return undefined for undefined styleClassId', () => {
        const found = findStyleClass(testStyleClasses, undefined);
        expect(found).toBeUndefined();
      });

      it('should return undefined for empty array', () => {
        const found = findStyleClass([], 'style_1');
        expect(found).toBeUndefined();
      });
    });

    describe('findStyleClassByName', () => {
      it('should find style class by name', () => {
        const found = findStyleClassByName(testStyleClasses, 'danger');

        expect(found).toBeDefined();
        expect(found?.id).toBe('style_3');
        expect(found?.style.stroke?.dashArray).toEqual([4, 2]);
      });

      it('should return undefined for non-existent name', () => {
        const found = findStyleClassByName(testStyleClasses, 'non-existent');
        expect(found).toBeUndefined();
      });

      it('should return undefined for undefined styleClasses', () => {
        const found = findStyleClassByName(undefined, 'primary');
        expect(found).toBeUndefined();
      });

      it('should be case-sensitive', () => {
        const found = findStyleClassByName(testStyleClasses, 'Primary');
        expect(found).toBeUndefined();
      });
    });

    describe('createStyleClassNameMap', () => {
      it('should create a map from name to id', () => {
        const map = createStyleClassNameMap(testStyleClasses);

        expect(map.size).toBe(3);
        expect(map.get('primary')).toBe('style_1');
        expect(map.get('secondary')).toBe('style_2');
        expect(map.get('danger')).toBe('style_3');
      });

      it('should handle empty array', () => {
        const map = createStyleClassNameMap([]);
        expect(map.size).toBe(0);
      });

      it('should handle duplicate names (last wins)', () => {
        const stylesWithDuplicates: StyleClass[] = [
          { id: 'id_1', name: 'same-name', style: {} },
          { id: 'id_2', name: 'same-name', style: {} }
        ];

        const map = createStyleClassNameMap(stylesWithDuplicates);

        expect(map.size).toBe(1);
        expect(map.get('same-name')).toBe('id_2');
      });
    });
  });

  // ============================================================================
  // Style Resolution
  // ============================================================================

  describe('Style Resolution', () => {
    it('should support all PrimitiveStyle properties in StyleClass', () => {
      const fullStyle = createStyleClass('full-style', {
        fill: { color: '#ff0000', opacity: 0.8 },
        stroke: {
          color: '#00ff00',
          width: 2,
          opacity: 0.9,
          dashArray: [8, 4, 2, 4],
          dashOffset: 2,
          lineCap: 'round',
          lineJoin: 'bevel'
        },
        opacity: 0.95
      });

      expect(fullStyle.style.fill?.color).toBe('#ff0000');
      expect(fullStyle.style.fill?.opacity).toBe(0.8);
      expect(fullStyle.style.stroke?.color).toBe('#00ff00');
      expect(fullStyle.style.stroke?.width).toBe(2);
      expect(fullStyle.style.stroke?.opacity).toBe(0.9);
      expect(fullStyle.style.stroke?.dashArray).toEqual([8, 4, 2, 4]);
      expect(fullStyle.style.stroke?.dashOffset).toBe(2);
      expect(fullStyle.style.stroke?.lineCap).toBe('round');
      expect(fullStyle.style.stroke?.lineJoin).toBe('bevel');
      expect(fullStyle.style.opacity).toBe(0.95);
    });

    it('should support line type patterns', () => {
      const lineTypes: Record<string, number[]> = {
        'dashed': [8, 4],
        'dotted': [2, 2],
        'dash-dot': [8, 4, 2, 4],
        'long-dash': [12, 6]
      };

      for (const [name, dashArray] of Object.entries(lineTypes)) {
        const styleClass = createStyleClass(name, {
          stroke: { color: '#000', dashArray }
        });

        expect(styleClass.style.stroke?.dashArray).toEqual(dashArray);
      }
    });
  });
});
