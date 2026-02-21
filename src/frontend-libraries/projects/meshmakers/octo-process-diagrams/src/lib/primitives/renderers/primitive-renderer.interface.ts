/**
 * Primitive Renderer Interface
 *
 * Defines the contract for all primitive renderers.
 * Follows the Strategy Pattern - each renderer knows how to render its specific type.
 *
 * SOLID Principles:
 * - Single Responsibility: Each renderer handles one primitive type
 * - Open/Closed: New renderers can be added without modifying existing code
 * - Liskov Substitution: All renderers are interchangeable via interface
 * - Interface Segregation: Focused interface for rendering
 * - Dependency Inversion: Components depend on this abstraction
 */

import { PrimitiveBase, PrimitiveTypeValue, PrimitiveStyle, Transform } from '../models';
import { AnimationDefinition } from '../models/animation.models';
import { renderAnimations, AnimationRenderContext } from './animation.renderer';

/**
 * Render context providing information about the rendering environment
 */
export interface RenderContext {
  /** Whether we're in edit/designer mode */
  isEditMode: boolean;
  /** Whether this element is currently selected */
  isSelected: boolean;
  /** Whether this element is being hovered */
  isHovered?: boolean;
  /** Current zoom level */
  zoom: number;
  /** Grid size for snapping (0 = no grid) */
  gridSize?: number;
  /** Whether animations should be rendered and enabled */
  animationsEnabled?: boolean;
  /** Property values for animation condition evaluation */
  propertyValues?: Record<string, unknown>;
  /**
   * Animation enabled states from property bindings.
   * Key format: "animationId" or "primitiveId:animationId"
   * Value: true = enabled, false = disabled
   */
  animationEnabledStates?: Record<string, boolean>;
}

/**
 * SVG attributes object
 */
export type SvgAttributes = Record<string, string | number | undefined>;

/**
 * Result of rendering a primitive
 */
export interface RenderResult {
  /** The SVG element tag name */
  tagName: string;
  /** SVG attributes for the element */
  attributes: SvgAttributes;
  /** Optional inner content (for text, nested elements, etc.) */
  content?: string;
  /** Optional child elements */
  children?: RenderResult[];
  /** Optional transform string */
  transform?: string;
}

/**
 * Interface for primitive renderers
 *
 * Each implementation handles rendering for a specific primitive type.
 */
export interface PrimitiveRenderer<T extends PrimitiveBase = PrimitiveBase> {
  /**
   * The primitive type this renderer handles
   */
  readonly type: PrimitiveTypeValue;

  /**
   * Render the primitive to an SVG element descriptor
   *
   * @param primitive - The primitive to render
   * @param context - Rendering context
   * @returns SVG element descriptor
   */
  render(primitive: T, context: RenderContext): RenderResult;

  /**
   * Get the bounding box of the primitive
   *
   * @param primitive - The primitive
   * @returns Bounding box { x, y, width, height }
   */
  getBoundingBox(primitive: T): { x: number; y: number; width: number; height: number };

  /**
   * Check if a point is inside the primitive
   *
   * @param primitive - The primitive
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns True if point is inside
   */
  containsPoint(primitive: T, x: number, y: number): boolean;
}

/**
 * Helper to build style attributes from PrimitiveStyle
 */
export function buildStyleAttributes(style?: PrimitiveStyle): SvgAttributes {
  if (!style) {
    return {};
  }

  const attrs: SvgAttributes = {};

  // Fill
  if (style.fill) {
    if (style.fill.color) {
      attrs['fill'] = style.fill.color;
    }
    if (style.fill.opacity !== undefined && style.fill.opacity !== 1) {
      attrs['fill-opacity'] = style.fill.opacity;
    }
  } else {
    attrs['fill'] = 'none';
  }

  // Stroke
  if (style.stroke) {
    if (style.stroke.color) {
      attrs['stroke'] = style.stroke.color;
    }
    if (style.stroke.width !== undefined) {
      attrs['stroke-width'] = style.stroke.width;
    }
    if (style.stroke.opacity !== undefined && style.stroke.opacity !== 1) {
      attrs['stroke-opacity'] = style.stroke.opacity;
    }
    if (style.stroke.dashArray && style.stroke.dashArray.length > 0) {
      attrs['stroke-dasharray'] = style.stroke.dashArray.join(' ');
    }
    if (style.stroke.dashOffset !== undefined) {
      attrs['stroke-dashoffset'] = style.stroke.dashOffset;
    }
    if (style.stroke.lineCap) {
      attrs['stroke-linecap'] = style.stroke.lineCap;
    }
    if (style.stroke.lineJoin) {
      attrs['stroke-linejoin'] = style.stroke.lineJoin;
    }
  }

  // Overall opacity
  if (style.opacity !== undefined && style.opacity !== 1) {
    attrs['opacity'] = style.opacity;
  }

  // Cursor
  if (style.cursor) {
    attrs['cursor'] = style.cursor;
  }

  return attrs;
}

/**
 * Helper to build transform attribute from Transform
 */
export function buildTransformAttribute(transform?: Transform, position?: { x: number; y: number }): string | undefined {
  if (!transform && !position) {
    return undefined;
  }

  const transforms: string[] = [];

  // Position translation (including offset)
  const offsetX = transform?.offsetX ?? 0;
  const offsetY = transform?.offsetY ?? 0;
  const posX = (position?.x ?? 0) + offsetX;
  const posY = (position?.y ?? 0) + offsetY;

  if (posX !== 0 || posY !== 0) {
    transforms.push(`translate(${posX}, ${posY})`);
  }

  if (transform) {
    // Rotation
    if (transform.rotation) {
      const pivotX = transform.rotationPivot?.x ?? 0;
      const pivotY = transform.rotationPivot?.y ?? 0;
      transforms.push(`rotate(${transform.rotation}, ${pivotX}, ${pivotY})`);
    }

    // Scale
    if (transform.scale !== undefined && transform.scale !== 1) {
      transforms.push(`scale(${transform.scale})`);
    } else if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
      const sx = transform.scaleX ?? 1;
      const sy = transform.scaleY ?? 1;
      transforms.push(`scale(${sx}, ${sy})`);
    }

    // Skew
    if (transform.skewX) {
      transforms.push(`skewX(${transform.skewX})`);
    }
    if (transform.skewY) {
      transforms.push(`skewY(${transform.skewY})`);
    }
  }

  return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Default render context
 */
export const DEFAULT_RENDER_CONTEXT: RenderContext = {
  isEditMode: false,
  isSelected: false,
  isHovered: false,
  zoom: 1,
  gridSize: 0,
  animationsEnabled: false
};

/**
 * Helper to build animation children for a primitive
 *
 * @param animations - Array of animation definitions from the primitive
 * @param bounds - Bounding box of the primitive (for pivot calculations)
 * @param context - Render context with animation settings
 * @param primitiveId - Optional ID of the primitive (for animation state lookup)
 * @returns Array of RenderResult children for animations
 */
export function buildAnimationChildren(
  animations: AnimationDefinition[] | undefined,
  bounds: { x: number; y: number; width: number; height: number },
  context: RenderContext,
  primitiveId?: string
): RenderResult[] {
  if (!animations || animations.length === 0) {
    return [];
  }

  // In edit mode without simulation, don't render animations
  if (context.isEditMode && !context.animationsEnabled) {
    return [];
  }

  const animContext: AnimationRenderContext = {
    bounds,
    animationsEnabled: context.animationsEnabled,
    propertyValues: context.propertyValues,
    primitiveId,
    animationEnabledStates: context.animationEnabledStates
  };

  // Get animation SVG strings and convert to RenderResult
  const animationSvg = renderAnimations(animations, animContext);
  if (!animationSvg) {
    return [];
  }

  // Return as raw content children (the animation renderer outputs SVG strings)
  // We wrap them in a special RenderResult that signals raw SVG content
  return [{
    tagName: '__raw__',
    attributes: {},
    content: animationSvg
  }];
}
