/**
 * Style Resolution Logic - Unit Tests
 *
 * Tests the style resolution logic that merges style classes with inline styles.
 * Priority order: inline style > style class > defaults
 */

import { StyleClass } from '../../primitives';
import { PrimitiveBase } from '../../primitives/models/primitive.models';

/**
 * Helper function that implements the same logic as ProcessDesignerComponent.resolveStyle
 * Extracted here for testing purposes
 */
function resolveStyle(
  primitive: PrimitiveBase,
  styleClasses: StyleClass[]
): {
  fill?: { color?: string; opacity?: number };
  stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
} {
  const resolved: {
    fill?: { color?: string; opacity?: number };
    stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
  } = {};

  // If primitive has a style class, look it up and use its styles as base
  if (primitive.styleClassId && styleClasses.length > 0) {
    const styleClass = styleClasses.find(s => s.id === primitive.styleClassId);
    if (styleClass?.style) {
      // Deep copy style class properties
      if (styleClass.style.fill) {
        resolved.fill = { ...styleClass.style.fill };
      }
      if (styleClass.style.stroke) {
        resolved.stroke = { ...styleClass.style.stroke };
      }
    }
  }

  // Merge inline styles on top (inline overrides class)
  if (primitive.style) {
    if (primitive.style.fill) {
      resolved.fill = {
        ...resolved.fill,
        ...primitive.style.fill
      };
    }
    if (primitive.style.stroke) {
      resolved.stroke = {
        ...resolved.stroke,
        ...primitive.style.stroke
      };
    }
  }

  return resolved;
}

describe('Style Resolution', () => {
  // Test style classes
  const styleClasses: StyleClass[] = [
    {
      id: 'style_primary',
      name: 'primary',
      style: {
        fill: { color: '#007bff', opacity: 1 },
        stroke: { color: '#0056b3', width: 2, opacity: 1 }
      }
    },
    {
      id: 'style_danger',
      name: 'danger',
      style: {
        fill: { color: '#dc3545', opacity: 0.9 },
        stroke: { color: '#721c24', width: 1, opacity: 1, dashArray: [4, 2] }
      }
    },
    {
      id: 'style_dashed',
      name: 'dashed-line',
      style: {
        stroke: { color: '#333333', width: 2, dashArray: [8, 4] }
      }
    }
  ];

  // ============================================================================
  // No Style Class (Inline Only)
  // ============================================================================

  describe('No Style Class (Inline Only)', () => {
    it('should return inline styles when no styleClassId is set', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        style: {
          fill: { color: '#ff0000', opacity: 0.5 },
          stroke: { color: '#00ff00', width: 3 }
        }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill?.color).toBe('#ff0000');
      expect(resolved.fill?.opacity).toBe(0.5);
      expect(resolved.stroke?.color).toBe('#00ff00');
      expect(resolved.stroke?.width).toBe(3);
    });

    it('should return empty object when no style and no styleClassId', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill).toBeUndefined();
      expect(resolved.stroke).toBeUndefined();
    });
  });

  // ============================================================================
  // Style Class Only (No Inline)
  // ============================================================================

  describe('Style Class Only (No Inline)', () => {
    it('should return style class values when no inline style', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_primary'
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill?.color).toBe('#007bff');
      expect(resolved.fill?.opacity).toBe(1);
      expect(resolved.stroke?.color).toBe('#0056b3');
      expect(resolved.stroke?.width).toBe(2);
    });

    it('should include dashArray from style class', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_danger'
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.stroke?.dashArray).toEqual([4, 2]);
    });

    it('should handle style class with only stroke', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_dashed'
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill).toBeUndefined();
      expect(resolved.stroke?.color).toBe('#333333');
      expect(resolved.stroke?.width).toBe(2);
      expect(resolved.stroke?.dashArray).toEqual([8, 4]);
    });
  });

  // ============================================================================
  // Inline Overrides Style Class
  // ============================================================================

  describe('Inline Overrides Style Class', () => {
    it('should override fill color from style class', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_primary',
        style: {
          fill: { color: '#ff0000' } // Override color only
        }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill?.color).toBe('#ff0000'); // Overridden
      expect(resolved.fill?.opacity).toBe(1); // From style class
      expect(resolved.stroke?.color).toBe('#0056b3'); // From style class
    });

    it('should override stroke properties from style class', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_primary',
        style: {
          stroke: { width: 5, dashArray: [10, 5] } // Override width and add dashArray
        }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.stroke?.color).toBe('#0056b3'); // From style class
      expect(resolved.stroke?.width).toBe(5); // Overridden
      expect(resolved.stroke?.dashArray).toEqual([10, 5]); // Overridden (not in primary)
    });

    it('should completely override when all properties are specified inline', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_primary',
        style: {
          fill: { color: '#000000', opacity: 0.1 },
          stroke: { color: '#ffffff', width: 10, opacity: 0.2, dashArray: [1, 1] }
        }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      expect(resolved.fill?.color).toBe('#000000');
      expect(resolved.fill?.opacity).toBe(0.1);
      expect(resolved.stroke?.color).toBe('#ffffff');
      expect(resolved.stroke?.width).toBe(10);
      expect(resolved.stroke?.opacity).toBe(0.2);
      expect(resolved.stroke?.dashArray).toEqual([1, 1]);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle non-existent styleClassId', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'non_existent_style',
        style: {
          fill: { color: '#aabbcc' }
        }
      };

      const resolved = resolveStyle(primitive, styleClasses);

      // Should only have inline style, not crash
      expect(resolved.fill?.color).toBe('#aabbcc');
      expect(resolved.stroke).toBeUndefined();
    });

    it('should handle empty styleClasses array', () => {
      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_primary',
        style: {
          fill: { color: '#123456' }
        }
      };

      const resolved = resolveStyle(primitive, []);

      expect(resolved.fill?.color).toBe('#123456');
    });

    it('should handle style class with empty style object', () => {
      const emptyStyleClass: StyleClass = {
        id: 'style_empty',
        name: 'empty',
        style: {}
      };

      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_empty',
        style: {
          fill: { color: '#aabbcc' }
        }
      };

      const resolved = resolveStyle(primitive, [emptyStyleClass]);

      expect(resolved.fill?.color).toBe('#aabbcc');
    });

    it('should handle partial fill in style class', () => {
      const partialStyleClass: StyleClass = {
        id: 'style_partial',
        name: 'partial',
        style: {
          fill: { color: '#ff0000' } // No opacity
        }
      };

      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'rectangle',
        name: 'rect',
        position: { x: 0, y: 0 },
        styleClassId: 'style_partial'
      };

      const resolved = resolveStyle(primitive, [partialStyleClass]);

      expect(resolved.fill?.color).toBe('#ff0000');
      expect(resolved.fill?.opacity).toBeUndefined();
    });

    it('should handle partial stroke in style class', () => {
      const partialStyleClass: StyleClass = {
        id: 'style_partial_stroke',
        name: 'partial-stroke',
        style: {
          stroke: { color: '#00ff00' } // No width, no dashArray
        }
      };

      const primitive: PrimitiveBase = {
        id: 'prim-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_partial_stroke',
        style: {
          stroke: { width: 3 } // Add width inline
        }
      };

      const resolved = resolveStyle(primitive, [partialStyleClass]);

      expect(resolved.stroke?.color).toBe('#00ff00'); // From class
      expect(resolved.stroke?.width).toBe(3); // From inline
      expect(resolved.stroke?.dashArray).toBeUndefined();
    });
  });

  // ============================================================================
  // Line Types with Style Classes
  // ============================================================================

  describe('Line Types with Style Classes', () => {
    const lineTypeStyles: StyleClass[] = [
      {
        id: 'style_solid',
        name: 'solid-line',
        style: { stroke: { color: '#000', width: 2 } }
      },
      {
        id: 'style_dashed',
        name: 'dashed-line',
        style: { stroke: { color: '#000', width: 2, dashArray: [8, 4] } }
      },
      {
        id: 'style_dotted',
        name: 'dotted-line',
        style: { stroke: { color: '#000', width: 2, dashArray: [2, 2] } }
      },
      {
        id: 'style_dash_dot',
        name: 'dash-dot-line',
        style: { stroke: { color: '#000', width: 2, dashArray: [8, 4, 2, 4] } }
      }
    ];

    it('should apply solid line style (no dashArray)', () => {
      const primitive: PrimitiveBase = {
        id: 'line-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_solid'
      };

      const resolved = resolveStyle(primitive, lineTypeStyles);

      expect(resolved.stroke?.dashArray).toBeUndefined();
    });

    it('should apply dashed line style', () => {
      const primitive: PrimitiveBase = {
        id: 'line-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_dashed'
      };

      const resolved = resolveStyle(primitive, lineTypeStyles);

      expect(resolved.stroke?.dashArray).toEqual([8, 4]);
    });

    it('should apply dotted line style', () => {
      const primitive: PrimitiveBase = {
        id: 'line-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_dotted'
      };

      const resolved = resolveStyle(primitive, lineTypeStyles);

      expect(resolved.stroke?.dashArray).toEqual([2, 2]);
    });

    it('should apply dash-dot line style', () => {
      const primitive: PrimitiveBase = {
        id: 'line-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_dash_dot'
      };

      const resolved = resolveStyle(primitive, lineTypeStyles);

      expect(resolved.stroke?.dashArray).toEqual([8, 4, 2, 4]);
    });

    it('should allow inline override of dashArray', () => {
      const primitive: PrimitiveBase = {
        id: 'line-1',
        type: 'line',
        name: 'line',
        position: { x: 0, y: 0 },
        styleClassId: 'style_dashed',
        style: {
          stroke: { dashArray: [12, 6] } // Override to long-dash
        }
      };

      const resolved = resolveStyle(primitive, lineTypeStyles);

      expect(resolved.stroke?.dashArray).toEqual([12, 6]); // Overridden
      expect(resolved.stroke?.color).toBe('#000'); // From class
      expect(resolved.stroke?.width).toBe(2); // From class
    });
  });
});
