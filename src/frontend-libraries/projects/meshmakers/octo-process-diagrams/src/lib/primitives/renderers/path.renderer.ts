/**
 * Path Renderer
 */

import { PrimitiveType } from '../models';
import { PathPrimitive, estimatePathBounds } from '../models/path.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for path primitives
 */
export class PathRenderer implements PrimitiveRenderer<PathPrimitive> {
  readonly type = PrimitiveType.Path;

  render(primitive: PathPrimitive, context: RenderContext): RenderResult {
    const { config, style, transform, position } = primitive;

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(style),
      d: config.d
    };

    if (config.fillRule) {
      attributes['fill-rule'] = config.fillRule;
    }

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = 2 / context.zoom;
    }

    return {
      tagName: 'path',
      attributes,
      transform: buildTransformAttribute(transform, position)
    };
  }

  getBoundingBox(primitive: PathPrimitive): { x: number; y: number; width: number; height: number } {
    // Use estimated bounds - for accurate bounds, SVG DOM would be needed
    return estimatePathBounds(primitive);
  }

  containsPoint(primitive: PathPrimitive, x: number, y: number): boolean {
    // Simple bounding box check - accurate hit testing would require path parsing
    const bounds = this.getBoundingBox(primitive);
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }
}
