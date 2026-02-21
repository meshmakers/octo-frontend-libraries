/**
 * Image Renderer
 */

import { PrimitiveType } from '../models';
import { ImagePrimitive, toSvgPreserveAspectRatio } from '../models/image.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for image primitives
 */
export class ImageRenderer implements PrimitiveRenderer<ImagePrimitive> {
  readonly type = PrimitiveType.Image;

  render(primitive: ImagePrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform } = primitive;

    // For SVG content, we need to handle it differently
    if (config.sourceType === 'svg') {
      return this.renderSvgContent(primitive, context);
    }

    // Determine the href based on source type
    const href = config.sourceType === 'dataUrl' ? config.src : config.src;

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(style),
      x: position.x,
      y: position.y,
      width: config.width,
      height: config.height,
      href: href,
      preserveAspectRatio: toSvgPreserveAspectRatio(config.fit ?? 'contain', config.alignment)
    };

    if (config.crossOrigin) {
      attributes['crossorigin'] = config.crossOrigin;
    }

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      // Images are wrapped in a group with selection rect
      return {
        tagName: 'g',
        attributes: {},
        transform: buildTransformAttribute(transform),
        children: [
          {
            tagName: 'image',
            attributes
          },
          {
            tagName: 'rect',
            attributes: {
              x: position.x,
              y: position.y,
              width: config.width,
              height: config.height,
              fill: 'none',
              stroke: '#2196F3',
              'stroke-width': 2 / context.zoom,
              'stroke-dasharray': '4 2'
            }
          }
        ]
      };
    }

    return {
      tagName: 'image',
      attributes,
      transform: buildTransformAttribute(transform)
    };
  }

  private renderSvgContent(primitive: ImagePrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform } = primitive;

    // For inline SVG, we create a foreignObject or g element with the SVG content
    // Using a group with nested SVG for better compatibility
    const attributes = {
      ...buildStyleAttributes(style)
    };

    const result: RenderResult = {
      tagName: 'g',
      attributes,
      transform: buildTransformAttribute(transform, position),
      // SVG content would be parsed and rendered as children
      // For now, we use foreignObject as a fallback
      children: [
        {
          tagName: 'foreignObject',
          attributes: {
            x: 0,
            y: 0,
            width: config.width,
            height: config.height
          },
          content: config.src // The SVG string
        }
      ]
    };

    if (context.isEditMode && context.isSelected) {
      result.children!.push({
        tagName: 'rect',
        attributes: {
          x: 0,
          y: 0,
          width: config.width,
          height: config.height,
          fill: 'none',
          stroke: '#2196F3',
          'stroke-width': 2 / context.zoom,
          'stroke-dasharray': '4 2'
        }
      });
    }

    return result;
  }

  getBoundingBox(primitive: ImagePrimitive): { x: number; y: number; width: number; height: number } {
    return {
      x: primitive.position.x,
      y: primitive.position.y,
      width: primitive.config.width,
      height: primitive.config.height
    };
  }

  containsPoint(primitive: ImagePrimitive, x: number, y: number): boolean {
    const { position, config } = primitive;
    return (
      x >= position.x &&
      x <= position.x + config.width &&
      y >= position.y &&
      y <= position.y + config.height
    );
  }
}
