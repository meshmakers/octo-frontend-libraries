/**
 * Transform Property Models
 *
 * Defines interfaces for dynamic transform properties on symbols.
 * Properties can control transformations (rotation, scale, offset),
 * styles (colors, opacity), and visibility through expressions.
 */

// ============================================================================
// Property Type Definitions
// ============================================================================

/**
 * Available property types for transform properties
 */
export type TransformPropertyType = 'number' | 'color' | 'boolean' | 'string';

/**
 * Target types for property bindings
 */
export type BindingTargetType = 'primitive' | 'symbolInstance';

/**
 * Anchor points for transformations (transform origin)
 * Defines where the transformation is applied from
 */
export type TransformAnchor =
  | 'center'        // Default: center of element
  | 'top-left'
  | 'top'           // top-center
  | 'top-right'
  | 'left'          // center-left
  | 'right'         // center-right
  | 'bottom-left'
  | 'bottom'        // bottom-center
  | 'bottom-right';

/**
 * Effect types that can be applied through property bindings
 */
export type BindingEffectType =
  // Transform effects
  | 'transform.rotation'      // Rotation in degrees
  | 'transform.offsetX'       // X translation offset
  | 'transform.offsetY'       // Y translation offset
  | 'transform.scale'         // Uniform scale factor
  | 'transform.scaleX'        // X-axis scale factor
  | 'transform.scaleY'        // Y-axis scale factor
  // Dimension effects (direct width/height without scaling stroke)
  | 'dimension.width'         // Direct width adjustment (pixels)
  | 'dimension.height'        // Direct height adjustment (pixels)
  // Style effects
  | 'style.fill.color'        // Fill color (hex string)
  | 'style.fill.opacity'      // Fill opacity (0-1)
  | 'style.stroke.color'      // Stroke color (hex string)
  | 'style.stroke.opacity'    // Stroke opacity (0-1)
  | 'style.opacity'           // Overall element opacity (0-1)
  // Visibility
  | 'visible'                 // Element visibility (boolean)
  // Fill level (for tank/battery visualization)
  | 'fillLevel'               // Fill level 0-1 (rendered via clip-path)
  // Animation control
  | 'animation.enabled'       // Enable/disable animation (boolean, requires animationId)
  // Property pass-through to child symbols
  | 'property';               // Pass value to child symbol's property

// ============================================================================
// Transform Property Interface
// ============================================================================

/**
 * A transform property exposed by a symbol.
 *
 * Properties define values that can be set on symbol instances
 * to dynamically control transforms, styles, and visibility.
 *
 * @example
 * ```typescript
 * const rotationProperty: TransformProperty = {
 *   id: 'rotation',
 *   name: 'Rotation',
 *   type: 'number',
 *   defaultValue: 0,
 *   min: 0,
 *   max: 360,
 *   step: 1,
 *   unit: '°',
 *   description: 'Rotates the rotor element'
 * };
 * ```
 */
export interface TransformProperty {
  /** Unique ID within the symbol */
  id: string;

  /** Display name for UI */
  name: string;

  /** Property value type */
  type: TransformPropertyType;

  /** Default value when not overridden */
  defaultValue: number | string | boolean;

  /** Description for UI tooltip */
  description?: string;

  // Number-specific constraints
  /** Minimum value (for number type) */
  min?: number;

  /** Maximum value (for number type) */
  max?: number;

  /** Step value for slider increments (for number type) */
  step?: number;

  /** Display unit suffix (e.g., '°', '%', 'px') */
  unit?: string;

  // UI organization
  /** Group name for categorizing properties in UI */
  group?: string;
}

// ============================================================================
// Property Binding Interface
// ============================================================================

/**
 * A binding from a transform property to a target element.
 *
 * Bindings define how property values are transformed via expressions
 * and applied to specific element properties.
 *
 * @example
 * ```typescript
 * // Rotate a primitive based on windSpeed property
 * const binding: PropertyBinding = {
 *   propertyId: 'windSpeed',
 *   targetType: 'primitive',
 *   targetId: 'rotor-rect',
 *   effectType: 'transform.rotation',
 *   expression: 'value * 3.6'  // 0-100% → 0-360°
 * };
 *
 * // Pass-through to child symbol
 * const passthrough: PropertyBinding = {
 *   propertyId: 'temperature',
 *   targetType: 'symbolInstance',
 *   targetId: 'gauge-instance',
 *   effectType: 'property',
 *   expression: 'value',
 *   targetPropertyId: 'displayValue'
 * };
 * ```
 */
export interface PropertyBinding {
  /** Reference to the source property ID */
  propertyId: string;

  /** Type of target element */
  targetType: BindingTargetType;

  /** ID of the target element (primitive or symbol instance) */
  targetId: string;

  /** What effect to apply to the target */
  effectType: BindingEffectType;

  /**
   * Expression to evaluate.
   *
   * Uses 'value' as the input variable for the property value.
   * Can also reference other properties by name.
   *
   * @example
   * - Simple: "value"
   * - Math: "value * 3.6 + 45"
   * - Conditional: "value > 50 ? '#ff0000' : '#00ff00'"
   * - Functions: "lerp(value, 0, 100, 0, 360)"
   * - Color interpolation: "lerpColor(value, 0, 100, '#00ff00', '#ff0000')"
   */
  expression: string;

  /**
   * Target property ID in child symbol (when effectType is 'property').
   * Required for property pass-through bindings.
   */
  targetPropertyId?: string;

  /**
   * Animation ID to control (when effectType is 'animation.enabled').
   * The expression result determines if the animation runs (truthy) or stops (falsy).
   */
  animationId?: string;

  /**
   * Anchor point for the transformation (transform origin).
   * Defines where the transformation is applied from.
   * Defaults to 'center' if not specified.
   *
   * For rotation: The pivot point around which the element rotates.
   * For dimension changes: The point that stays fixed while the element grows/shrinks.
   *
   * @example
   * - 'center': Rotate/scale from center (default)
   * - 'bottom': For a fill-level effect, element grows upward from bottom
   * - 'top-left': Element grows toward bottom-right
   */
  anchor?: TransformAnchor;
}

// ============================================================================
// Evaluated Binding Result
// ============================================================================

/**
 * Result of evaluating a property binding expression
 */
export interface EvaluatedBinding {
  /** ID of the target element */
  targetId: string;

  /** Type of target element */
  targetType: BindingTargetType;

  /** Effect type to apply */
  effectType: BindingEffectType;

  /** Computed value after expression evaluation */
  computedValue: unknown;

  /** Target property ID for pass-through bindings */
  targetPropertyId?: string;

  /** Animation ID for animation.enabled bindings */
  animationId?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a TransformProperty
 */
export function isTransformProperty(obj: unknown): obj is TransformProperty {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'type' in obj &&
    'defaultValue' in obj &&
    ['number', 'color', 'boolean', 'string'].includes((obj as TransformProperty).type)
  );
}

/**
 * Type guard to check if an object is a PropertyBinding
 */
export function isPropertyBinding(obj: unknown): obj is PropertyBinding {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'propertyId' in obj &&
    'targetType' in obj &&
    'targetId' in obj &&
    'effectType' in obj &&
    'expression' in obj
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a number transform property with sensible defaults
 */
export function createNumberProperty(
  id: string,
  name: string,
  options?: Partial<Omit<TransformProperty, 'id' | 'name' | 'type'>>
): TransformProperty {
  return {
    id,
    name,
    type: 'number',
    defaultValue: options?.defaultValue ?? 0,
    min: options?.min,
    max: options?.max,
    step: options?.step ?? 1,
    unit: options?.unit,
    description: options?.description,
    group: options?.group
  };
}

/**
 * Create a color transform property
 */
export function createColorProperty(
  id: string,
  name: string,
  defaultValue = '#000000',
  options?: Partial<Omit<TransformProperty, 'id' | 'name' | 'type' | 'defaultValue'>>
): TransformProperty {
  return {
    id,
    name,
    type: 'color',
    defaultValue,
    description: options?.description,
    group: options?.group
  };
}

/**
 * Create a boolean transform property
 */
export function createBooleanProperty(
  id: string,
  name: string,
  defaultValue = false,
  options?: Partial<Omit<TransformProperty, 'id' | 'name' | 'type' | 'defaultValue'>>
): TransformProperty {
  return {
    id,
    name,
    type: 'boolean',
    defaultValue,
    description: options?.description,
    group: options?.group
  };
}

/**
 * Create a property binding
 */
export function createPropertyBinding(
  propertyId: string,
  targetId: string,
  effectType: BindingEffectType,
  expression: string,
  options?: {
    targetType?: BindingTargetType;
    targetPropertyId?: string;
    anchor?: TransformAnchor;
  }
): PropertyBinding {
  return {
    propertyId,
    targetType: options?.targetType ?? 'primitive',
    targetId,
    effectType,
    expression,
    targetPropertyId: options?.targetPropertyId,
    anchor: options?.anchor
  };
}
