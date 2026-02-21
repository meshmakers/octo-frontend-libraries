/**
 * Line Renderer
 */

import { PrimitiveType } from '../models';
import { LinePrimitive } from '../models/line.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for line primitives
 */
export class LineRenderer implements PrimitiveRenderer<LinePrimitive> {
  readonly type = PrimitiveType.Line;

  render(primitive: LinePrimitive, context: RenderContext): RenderResult {
    const { config, position, style, transform } = primitive;

    // Lines don't have fill, ensure stroke is visible
    const lineStyle = {
      ...style,
      fill: undefined, // Lines have no fill
      stroke: style?.stroke ?? { color: '#333333', width: 2 }
    };

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(lineStyle),
      x1: config.start.x + position.x,
      y1: config.start.y + position.y,
      x2: config.end.x + position.x,
      y2: config.end.y + position.y
    };

    // Remove fill attributes for line
    attributes['fill'] = 'none';
    delete attributes['fill-opacity'];

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = Math.max(2, (style?.stroke?.width ?? 2)) + 2 / context.zoom;
    }

    const result: RenderResult = {
      tagName: 'line',
      attributes,
      transform: buildTransformAttribute(transform)
    };

    // Add markers if configured
    if (config.markerStart || config.markerEnd) {
      result.children = this.createMarkers(primitive, config.markerStart, config.markerEnd);
    }

    return result;
  }

  getBoundingBox(primitive: LinePrimitive): { x: number; y: number; width: number; height: number } {
    const { config, position } = primitive;
    const x1 = config.start.x + position.x;
    const y1 = config.start.y + position.y;
    const x2 = config.end.x + position.x;
    const y2 = config.end.y + position.y;

    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    return {
      x: minX,
      y: minY,
      width: maxX - minX || 1, // Ensure at least 1px for vertical/horizontal lines
      height: maxY - minY || 1
    };
  }

  containsPoint(primitive: LinePrimitive, x: number, y: number): boolean {
    const { config, position, style } = primitive;
    const x1 = config.start.x + position.x;
    const y1 = config.start.y + position.y;
    const x2 = config.end.x + position.x;
    const y2 = config.end.y + position.y;

    // Calculate distance from point to line segment
    const tolerance = Math.max(5, (style?.stroke?.width ?? 2) / 2 + 2);
    return this.pointToLineDistance(x, y, x1, y1, x2, y2) <= tolerance;
  }

  private pointToLineDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // Line is a point
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    // Project point onto line segment
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  private createMarkers(
    _primitive: LinePrimitive,
    _markerStart?: { type: string; size?: number; color?: string },
    _markerEnd?: { type: string; size?: number; color?: string }
  ): RenderResult[] {
    // Markers would be implemented as defs + use references
    // For simplicity, returning empty array - full implementation would add SVG markers
    return [];
  }
}
