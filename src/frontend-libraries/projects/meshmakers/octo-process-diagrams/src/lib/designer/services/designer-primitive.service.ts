/**
 * Designer Primitive Service
 *
 * Central service for type-specific primitive operations.
 * Uses the Strategy pattern to delegate operations to type-specific handlers.
 *
 * This service eliminates the need for scattered type checks throughout
 * the component code, making the codebase more maintainable and extensible.
 */

import { Injectable } from '@angular/core';
import { PrimitiveBase, PrimitiveType, Position } from '../../primitives';
import {
  PrimitiveHandler,
  PrimitiveBounds,
  GroupScaleParams,
  RectangleHandler,
  EllipseHandler,
  LineHandler,
  PolylineHandler,
  PathHandler,
  TextHandler,
  DefaultHandler
} from './primitive-handlers';

@Injectable()
export class DesignerPrimitiveService {
  private readonly handlers = new Map<string, PrimitiveHandler>();
  private readonly defaultHandler = new DefaultHandler();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    const rectangleHandler = new RectangleHandler();
    const ellipseHandler = new EllipseHandler();
    const lineHandler = new LineHandler();
    const polylineHandler = new PolylineHandler();
    const pathHandler = new PathHandler();
    const textHandler = new TextHandler();

    // Register handlers for each primitive type
    this.handlers.set(PrimitiveType.Rectangle, rectangleHandler);
    this.handlers.set(PrimitiveType.Image, rectangleHandler); // Same geometry as rectangle
    this.handlers.set(PrimitiveType.Ellipse, ellipseHandler);
    this.handlers.set(PrimitiveType.Line, lineHandler);
    this.handlers.set(PrimitiveType.Polyline, polylineHandler);
    this.handlers.set(PrimitiveType.Polygon, polylineHandler); // Same geometry as polyline
    this.handlers.set(PrimitiveType.Path, pathHandler);
    this.handlers.set(PrimitiveType.Text, textHandler);
    // Group primitives use default handler (position-based)
    this.handlers.set(PrimitiveType.Group, this.defaultHandler);
  }

  /**
   * Get the handler for a primitive type
   */
  getHandler(type: string): PrimitiveHandler {
    return this.handlers.get(type) ?? this.defaultHandler;
  }

  /**
   * Move a primitive by a delta
   */
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase {
    return this.getHandler(primitive.type).move(primitive, delta);
  }

  /**
   * Get the bounding box of a primitive
   */
  getBounds(primitive: PrimitiveBase): PrimitiveBounds {
    return this.getHandler(primitive.type).getBounds(primitive);
  }

  /**
   * Scale a primitive within a group resize operation
   */
  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    return this.getHandler(primitive.type).scaleInGroup(primitive, params);
  }

  /**
   * Resize a primitive to new bounds
   */
  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    return this.getHandler(primitive.type).resize(primitive, newBounds);
  }

  /**
   * Move multiple primitives by a delta
   */
  moveAll(primitives: PrimitiveBase[], delta: Position): PrimitiveBase[] {
    return primitives.map(p => this.move(p, delta));
  }

  /**
   * Get bounds for multiple primitives (combined bounding box)
   */
  getCombinedBounds(primitives: PrimitiveBase[]): PrimitiveBounds | null {
    if (primitives.length === 0) return null;

    const allBounds = primitives.map(p => this.getBounds(p));

    let minX = allBounds[0].x;
    let minY = allBounds[0].y;
    let maxX = allBounds[0].x + allBounds[0].width;
    let maxY = allBounds[0].y + allBounds[0].height;

    for (const bounds of allBounds) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if a primitive type uses points (polyline/polygon)
   */
  usesPoints(type: string): boolean {
    return type === PrimitiveType.Polyline || type === PrimitiveType.Polygon;
  }

  /**
   * Check if a primitive type is a line
   */
  isLine(type: string): boolean {
    return type === PrimitiveType.Line;
  }

  /**
   * Check if a primitive type is a path
   */
  isPath(type: string): boolean {
    return type === PrimitiveType.Path;
  }
}
