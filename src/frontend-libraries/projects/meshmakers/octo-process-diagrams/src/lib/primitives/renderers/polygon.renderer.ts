/**
 * Polygon and Polyline Renderer
 */

import { PrimitiveType } from '../models';
import { PolygonPrimitive, PolylinePrimitive, pointsToSvgString, getPolygonBounds } from '../models/polygon.model';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  SvgAttributes,
  buildStyleAttributes,
  buildTransformAttribute
} from './primitive-renderer.interface';

/**
 * Renderer for polygon primitives (closed shapes)
 */
export class PolygonRenderer implements PrimitiveRenderer<PolygonPrimitive> {
  readonly type = PrimitiveType.Polygon;

  render(primitive: PolygonPrimitive, context: RenderContext): RenderResult {
    const { config, style, transform, position } = primitive;

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(style),
      points: pointsToSvgString(config.points)
    };

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = 2 / context.zoom;
    }

    return {
      tagName: 'polygon',
      attributes,
      transform: buildTransformAttribute(transform, position)
    };
  }

  getBoundingBox(primitive: PolygonPrimitive): { x: number; y: number; width: number; height: number } {
    return getPolygonBounds(primitive);
  }

  containsPoint(primitive: PolygonPrimitive, x: number, y: number): boolean {
    // Ray casting algorithm for point-in-polygon
    const points = primitive.config.points;
    const px = x - primitive.position.x;
    const py = y - primitive.position.y;

    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;

      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }
}

/**
 * Renderer for polyline primitives (open shapes)
 */
export class PolylineRenderer implements PrimitiveRenderer<PolylinePrimitive> {
  readonly type = PrimitiveType.Polyline;

  render(primitive: PolylinePrimitive, context: RenderContext): RenderResult {
    const { config, style, transform, position } = primitive;

    // Polylines typically don't have fill
    const lineStyle = {
      ...style,
      fill: { color: 'none' },
      stroke: style?.stroke ?? { color: '#333333', width: 2 }
    };

    const attributes: SvgAttributes = {
      ...buildStyleAttributes(lineStyle),
      points: pointsToSvgString(config.points)
    };

    // Add selection styling in edit mode
    if (context.isEditMode && context.isSelected) {
      attributes['stroke'] = '#2196F3';
      attributes['stroke-width'] = Math.max(2, (style?.stroke?.width ?? 2)) + 2 / context.zoom;
    }

    return {
      tagName: 'polyline',
      attributes,
      transform: buildTransformAttribute(transform, position)
    };
  }

  getBoundingBox(primitive: PolylinePrimitive): { x: number; y: number; width: number; height: number } {
    return getPolygonBounds(primitive);
  }

  containsPoint(primitive: PolylinePrimitive, x: number, y: number): boolean {
    // Check proximity to any line segment
    const points = primitive.config.points;
    const px = x - primitive.position.x;
    const py = y - primitive.position.y;
    const tolerance = 5;

    for (let i = 0; i < points.length - 1; i++) {
      const dist = this.pointToSegmentDistance(
        px, py,
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y
      );
      if (dist <= tolerance) {
        return true;
      }
    }

    return false;
  }

  private pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }
}
