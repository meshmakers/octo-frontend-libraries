/**
 * Primitive Models - Base Interfaces
 *
 * Defines the core abstractions for all primitive elements.
 * Following SOLID principles:
 * - Single Responsibility: Each interface has one purpose
 * - Open/Closed: Extendable without modification
 * - Liskov Substitution: All primitives are interchangeable via base interface
 * - Interface Segregation: Separate interfaces for different concerns
 * - Dependency Inversion: Depend on abstractions
 */

import { AnimationDefinition } from './animation.models';

// ============================================================================
// Geometry Types
// ============================================================================

/**
 * 2D position in canvas coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 2D size dimensions
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 2D point (alias for Position, semantically different use)
 */
export type Point = Position;

/**
 * Bounding box of an element
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Style Interfaces
// ============================================================================

/**
 * Fill style configuration
 */
export interface FillStyle {
  /** Fill color (CSS color string) */
  color?: string;
  /** Fill opacity (0-1) */
  opacity?: number;
}

/**
 * Stroke style configuration
 */
export interface StrokeStyle {
  /** Stroke color */
  color?: string;
  /** Stroke width in pixels */
  width?: number;
  /** Stroke opacity (0-1) */
  opacity?: number;
  /** Dash array pattern */
  dashArray?: number[];
  /** Dash offset */
  dashOffset?: number;
  /** Line cap style */
  lineCap?: 'butt' | 'round' | 'square';
  /** Line join style */
  lineJoin?: 'miter' | 'round' | 'bevel';
}

/**
 * Text style configuration
 */
export interface TextStyle {
  /** Font family */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Font weight */
  fontWeight?: 'normal' | 'bold' | number;
  /** Font style */
  fontStyle?: 'normal' | 'italic' | 'oblique';
  /** Text color */
  color?: string;
  /** Text anchor */
  textAnchor?: 'start' | 'middle' | 'end';
  /** Dominant baseline */
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'text-top' | 'text-bottom';
}

/**
 * Combined style for primitive elements
 */
export interface PrimitiveStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  /** Overall opacity (multiplied with fill/stroke opacity) */
  opacity?: number;
  /** CSS cursor style */
  cursor?: string;
}

// ============================================================================
// Transform Interface
// ============================================================================

/**
 * Transform configuration for elements
 */
export interface Transform {
  /** Rotation in degrees */
  rotation?: number;
  /** Rotation pivot point (relative to element, 0.5 = center) */
  rotationPivot?: Position;
  /** Scale factor (1 = 100%) */
  scale?: number;
  /** Scale X factor */
  scaleX?: number;
  /** Scale Y factor */
  scaleY?: number;
  /** Skew X in degrees */
  skewX?: number;
  /** Skew Y in degrees */
  skewY?: number;
  /** X translation offset (added to position) */
  offsetX?: number;
  /** Y translation offset (added to position) */
  offsetY?: number;
  /**
   * Transform anchor point (alternative to rotationPivot)
   * Uses named positions: 'center', 'top', 'bottom', 'left', 'right', 'top-left', etc.
   */
  anchor?: 'center' | 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
}

// ============================================================================
// Primitive Type Enum
// ============================================================================

/**
 * All supported primitive types
 */
export const PrimitiveType = {
  Rectangle: 'rectangle',
  Ellipse: 'ellipse',
  Line: 'line',
  Path: 'path',
  Polygon: 'polygon',
  Polyline: 'polyline',
  Image: 'image',
  Text: 'text',
  Group: 'group'
} as const;

export type PrimitiveTypeValue = typeof PrimitiveType[keyof typeof PrimitiveType];

// ============================================================================
// Base Primitive Interface
// ============================================================================

/**
 * Base interface for all primitive elements.
 * All specific primitives extend this interface.
 */
export interface PrimitiveBase {
  /** Unique element ID */
  id: string;
  /** Primitive type discriminator */
  type: PrimitiveTypeValue;
  /** Position on canvas */
  position: Position;
  /** Visual style (inline) */
  style?: PrimitiveStyle;
  /** Reference to a style class ID (if using class-based styling) */
  styleClassId?: string;
  /** Transform configuration */
  transform?: Transform;
  /** Z-index for layering */
  zIndex?: number;
  /** Whether element is visible */
  visible?: boolean;
  /** Whether element is locked (non-editable) */
  locked?: boolean;
  /** Element name for identification */
  name?: string;
  /**
   * Fill level for visualization (0-1).
   * Used by renderers to clip/mask the element based on fill percentage.
   * Typically used for tank/battery/progress visualizations.
   * 0 = empty, 1 = full
   */
  fillLevel?: number;
  /**
   * SVG animations attached to this primitive.
   * Animations can be linked to transform properties for runtime control.
   */
  animations?: AnimationDefinition[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if an object is a primitive
 */
export function isPrimitive(obj: unknown): obj is PrimitiveBase {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'position' in obj &&
    Object.values(PrimitiveType).includes((obj as PrimitiveBase).type)
  );
}

/**
 * Default style values
 */
export const DEFAULT_STYLE: PrimitiveStyle = {
  fill: { color: '#e0e0e0', opacity: 1 },
  stroke: { color: '#333333', width: 1, opacity: 1 },
  opacity: 1
};

/**
 * Default text style values
 */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  fontWeight: 'normal',
  color: '#333333',
  textAnchor: 'start',
  dominantBaseline: 'auto'
};
