/**
 * Ellipse Renderer
 */

import { PrimitiveType } from '../models';
import { EllipsePrimitive } from '../models/ellipse.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for ellipse primitives
 */
export class EllipseRenderer implements PrimitiveRenderer<EllipsePrimitive> {
  readonly type = PrimitiveType.Ellipse;

  render(primitive: EllipsePrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform } = primitive;

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(style),
      cx: position.x,
      cy: position.y,
      rx: config.radiusX,
      ry: config.radiusY
    };

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = 2 / context.zoom;
    }

    return {
      tagName: 'ellipse',
      attributes,
      transform: buildTransformAttribute(transform)
    };
  }

  getBoundingBox(primitive: EllipsePrimitive): { x: number; y: number; width: number; height: number } {
    const { position, config } = primitive;
    return {
      x: position.x - config.radiusX,
      y: position.y - config.radiusY,
      width: config.radiusX * 2,
      height: config.radiusY * 2
    };
  }

  containsPoint(primitive: EllipsePrimitive, x: number, y: number): boolean {
    const { position, config } = primitive;
    // Ellipse equation: (x-cx)²/rx² + (y-cy)²/ry² <= 1
    const dx = (x - position.x) / config.radiusX;
    const dy = (y - position.y) / config.radiusY;
    return dx * dx + dy * dy <= 1;
  }
}
