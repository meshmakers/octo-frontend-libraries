/**
 * Text Renderer
 */

import { PrimitiveType } from '../models';
import { TextPrimitive, getEffectiveTextStyle, applyTextTransform, wrapText } from '../models/text.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for text primitives
 */
export class TextRenderer implements PrimitiveRenderer<TextPrimitive> {
  readonly type = PrimitiveType.Text;

  render(primitive: TextPrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform } = primitive;
    const textStyle = getEffectiveTextStyle(primitive);

    const content = applyTextTransform(config.content, config.textTransform);

    const baseAttributes: SvgAttributes = {
      x: position.x,
      y: position.y,
      'font-family': textStyle.fontFamily,
      'font-size': textStyle.fontSize,
      'font-weight': textStyle.fontWeight,
      fill: textStyle.color,
      'text-anchor': textStyle.textAnchor,
      'dominant-baseline': textStyle.dominantBaseline
    };

    // Apply style opacity if set
    if (style?.opacity !== undefined && style.opacity !== 1) {
      baseAttributes['opacity'] = style.opacity;
    }

    // Font style
    if (textStyle.fontStyle && textStyle.fontStyle !== 'normal') {
      baseAttributes['font-style'] = textStyle.fontStyle;
    }

    // Letter spacing
    if (config.letterSpacing) {
      baseAttributes['letter-spacing'] = config.letterSpacing;
    }

    // Text decoration
    if (config.decoration && config.decoration !== 'none') {
      baseAttributes['text-decoration'] = config.decoration;
    }

    // Handle text wrapping
    if (config.wrap && config.maxWidth) {
      return this.renderWrappedText(primitive, content, baseAttributes, context);
    }

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      // Wrap text in a group with background rect for selection
      const fontSize = textStyle.fontSize;
      const estimatedWidth = content.length * fontSize * 0.6;

      return {
        tagName: 'g',
        attributes: {},
        transform: buildTransformAttribute(transform),
        children: [
          {
            tagName: 'rect',
            attributes: {
              x: position.x - 2,
              y: position.y - fontSize,
              width: estimatedWidth + 4,
              height: fontSize * 1.2 + 4,
              fill: 'rgba(33, 150, 243, 0.1)',
              stroke: '#2196F3',
              'stroke-width': 1 / context.zoom
            }
          },
          {
            tagName: 'text',
            attributes: baseAttributes,
            content
          }
        ]
      };
    }

    return {
      tagName: 'text',
      attributes: baseAttributes,
      content,
      transform: buildTransformAttribute(transform)
    };
  }

  private renderWrappedText(
    primitive: TextPrimitive,
    content: string,
    baseAttributes: SvgAttributes,
    _context: RenderContext
  ): RenderResult {
    const { config, position } = primitive;
    const textStyle = getEffectiveTextStyle(primitive);
    const lineHeight = config.lineHeight ?? 1.2;
    const lines = wrapText(content, config.maxWidth!, textStyle.fontSize, textStyle.fontFamily);

    const tspans: RenderResult[] = lines.map((line, index) => ({
      tagName: 'tspan',
      attributes: {
        x: position.x,
        dy: index === 0 ? 0 : textStyle.fontSize * lineHeight
      },
      content: line
    }));

    return {
      tagName: 'text',
      attributes: baseAttributes,
      children: tspans,
      transform: buildTransformAttribute(primitive.transform)
    };
  }

  getBoundingBox(primitive: TextPrimitive): { x: number; y: number; width: number; height: number } {
    const textStyle = getEffectiveTextStyle(primitive);
    const content = applyTextTransform(primitive.config.content, primitive.config.textTransform);

    // Rough estimation - accurate measurement would require DOM
    const estimatedWidth = content.length * textStyle.fontSize * 0.6;
    const estimatedHeight = textStyle.fontSize * 1.2;

    // Adjust position based on text anchor
    let x = primitive.position.x;
    if (textStyle.textAnchor === 'middle') {
      x -= estimatedWidth / 2;
    } else if (textStyle.textAnchor === 'end') {
      x -= estimatedWidth;
    }

    // Adjust for baseline
    let y = primitive.position.y - textStyle.fontSize;
    if (textStyle.dominantBaseline === 'middle') {
      y = primitive.position.y - estimatedHeight / 2;
    } else if (textStyle.dominantBaseline === 'hanging' || textStyle.dominantBaseline === 'text-top') {
      y = primitive.position.y;
    }

    return {
      x,
      y,
      width: estimatedWidth,
      height: estimatedHeight
    };
  }

  containsPoint(primitive: TextPrimitive, x: number, y: number): boolean {
    const bounds = this.getBoundingBox(primitive);
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }
}
