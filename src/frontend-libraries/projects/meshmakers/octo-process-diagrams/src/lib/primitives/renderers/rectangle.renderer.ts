/**
 * Rectangle Renderer
 *
 * Supports fillLevel for tank/battery visualization using clip-path.
 */

import { PrimitiveType } from '../models';
import { RectanglePrimitive } from '../models/rectangle.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute,
  buildAnimationChildren
} from './primitive-renderer.interface';

/**
 * Renderer for rectangle primitives
 */
export class RectangleRenderer implements PrimitiveRenderer<RectanglePrimitive> {
  readonly type = PrimitiveType.Rectangle;

  render(primitive: RectanglePrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform, fillLevel } = primitive;

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(style),
      x: position.x,
      y: position.y,
      width: config.width,
      height: config.height
    };

    // Corner radius
    if (config.cornerRadius) {
      attributes['rx'] = config.cornerRadius;
      attributes['ry'] = config.cornerRadius;
    } else if (config.cornerRadiusX || config.cornerRadiusY) {
      if (config.cornerRadiusX) attributes['rx'] = config.cornerRadiusX;
      if (config.cornerRadiusY) attributes['ry'] = config.cornerRadiusY;
    }

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = 2 / context.zoom;
    }

    // Handle fillLevel (for tank/battery visualization)
    // fillLevel: 0 = empty, 1 = full
    if (fillLevel !== undefined && fillLevel >= 0 && fillLevel <= 1) {
      return this.renderWithFillLevel(primitive, attributes, fillLevel, context);
    }

    // Build animation children
    const bounds = this.getBoundingBox(primitive);
    const animationChildren = buildAnimationChildren(primitive.animations, bounds, context, primitive.id);

    // If there are animations, wrap in a group
    if (animationChildren.length > 0) {
      return {
        tagName: 'g',
        attributes: {},
        transform: buildTransformAttribute(transform),
        children: [
          {
            tagName: 'rect',
            attributes
          },
          ...animationChildren
        ]
      };
    }

    return {
      tagName: 'rect',
      attributes,
      transform: buildTransformAttribute(transform)
    };
  }

  /**
   * Render rectangle with fill level using clip-path
   * The fill level shows the bottom portion of the rectangle
   */
  private renderWithFillLevel(
    primitive: RectanglePrimitive,
    rectAttributes: SvgAttributes,
    fillLevel: number,
    context: RenderContext
  ): RenderResult {
    const { config, position, transform, id } = primitive;
    const clipId = `fill-clip-${id}`;

    // Calculate clip rect position (fill from bottom)
    // When fillLevel = 0: clipY = position.y + height (nothing visible)
    // When fillLevel = 1: clipY = position.y (fully visible)
    const clipY = position.y + config.height * (1 - fillLevel);
    const clipHeight = config.height * fillLevel;

    // Create the group containing defs and rect
    const groupTransform = buildTransformAttribute(transform);

    // Build animation children
    const bounds = this.getBoundingBox(primitive);
    const animationChildren = buildAnimationChildren(primitive.animations, bounds, context, primitive.id);

    return {
      tagName: 'g',
      attributes: {},
      transform: groupTransform,
      children: [
        // Defs with clip-path
        {
          tagName: 'defs',
          attributes: {},
          children: [
            {
              tagName: 'clipPath',
              attributes: { id: clipId },
              children: [
                {
                  tagName: 'rect',
                  attributes: {
                    x: position.x,
                    y: clipY,
                    width: config.width,
                    height: clipHeight
                  }
                }
              ]
            }
          ]
        },
        // The actual rectangle with clip-path applied
        {
          tagName: 'rect',
          attributes: {
            ...rectAttributes,
            'clip-path': `url(#${clipId})`
          }
        },
        // Animation children
        ...animationChildren
      ]
    };
  }

  getBoundingBox(primitive: RectanglePrimitive): { x: number; y: number; width: number; height: number } {
    return {
      x: primitive.position.x,
      y: primitive.position.y,
      width: primitive.config.width,
      height: primitive.config.height
    };
  }

  containsPoint(primitive: RectanglePrimitive, x: number, y: number): boolean {
    const { position, config } = primitive;
    return (
      x >= position.x &&
      x <= position.x + config.width &&
      y >= position.y &&
      y <= position.y + config.height
    );
  }
}
