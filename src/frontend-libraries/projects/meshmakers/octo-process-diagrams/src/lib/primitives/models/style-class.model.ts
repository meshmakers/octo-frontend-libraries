/**
 * Style Class Model
 *
 * Named style classes for symbol definitions.
 * Allows defining reusable styles that can be applied to multiple primitives.
 * Style classes are scoped per symbol.
 */

import { PrimitiveStyle } from './primitive.models';

// ============================================================================
// Style Class Interface
// ============================================================================

/**
 * A named style class definition within a symbol.
 * Style classes provide reusable style configurations that can be applied
 * to primitives via `styleClassId` reference.
 *
 * @example
 * ```typescript
 * const fillStyle: StyleClass = {
 *   id: 'style_cls-1',
 *   name: 'cls-1',
 *   style: {
 *     fill: { color: '#6fc1a9', opacity: 1 },
 *     stroke: { color: '#333333', width: 1 }
 *   }
 * };
 * ```
 */
export interface StyleClass {
  /** Unique ID within the symbol */
  id: string;
  /** Display name (e.g., "cls-1", "primary-fill", "border-style") */
  name: string;
  /** The style properties */
  style: PrimitiveStyle;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Generate a unique ID for a style class
 */
function generateStyleClassId(): string {
  return `style_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new style class with default values
 *
 * @param name - Display name for the style class
 * @param style - Optional initial style (defaults to a neutral gray)
 * @returns A new StyleClass object
 *
 * @example
 * ```typescript
 * const myStyle = createStyleClass('primary', {
 *   fill: { color: '#007bff' },
 *   stroke: { color: '#0056b3', width: 2 }
 * });
 * ```
 */
export function createStyleClass(
  name: string,
  style?: PrimitiveStyle
): StyleClass {
  return {
    id: generateStyleClassId(),
    name,
    style: style ?? {
      fill: { color: '#cccccc', opacity: 1 },
      stroke: { color: '#333333', width: 1, opacity: 1 }
    }
  };
}

/**
 * Create a style class from CSS class name and declarations.
 * Used during SVG import to convert CSS rules to style classes.
 *
 * @param className - The CSS class name (without the leading dot)
 * @param style - The parsed style properties
 * @returns A new StyleClass object with ID based on class name
 */
export function createStyleClassFromCss(
  className: string,
  style: PrimitiveStyle
): StyleClass {
  return {
    id: `style_${className}`,
    name: className,
    style
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for StyleClass
 */
export function isStyleClass(obj: unknown): obj is StyleClass {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'style' in obj &&
    typeof (obj as StyleClass).id === 'string' &&
    typeof (obj as StyleClass).name === 'string'
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find a style class by ID
 */
export function findStyleClass(
  styleClasses: StyleClass[] | undefined,
  styleClassId: string | undefined
): StyleClass | undefined {
  if (!styleClasses || !styleClassId) return undefined;
  return styleClasses.find(c => c.id === styleClassId);
}

/**
 * Find a style class by name
 */
export function findStyleClassByName(
  styleClasses: StyleClass[] | undefined,
  name: string
): StyleClass | undefined {
  if (!styleClasses) return undefined;
  return styleClasses.find(c => c.name === name);
}

/**
 * Create a lookup map from style class name to ID.
 * Useful during SVG import to map class attributes to styleClassId.
 */
export function createStyleClassNameMap(
  styleClasses: StyleClass[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const sc of styleClasses) {
    map.set(sc.name, sc.id);
  }
  return map;
}
