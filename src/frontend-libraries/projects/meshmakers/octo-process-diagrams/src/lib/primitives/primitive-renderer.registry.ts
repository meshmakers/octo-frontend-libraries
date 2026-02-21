/**
 * Primitive Renderer Registry
 *
 * Central registry for all primitive renderers.
 * Uses the Registry Pattern to allow dynamic registration and lookup.
 *
 * SOLID Principles:
 * - Open/Closed: New renderers can be registered without modifying this class
 * - Dependency Inversion: Depends on PrimitiveRenderer interface
 */

import { Injectable } from '@angular/core';
import { PrimitiveBase, PrimitiveTypeValue } from './models';
import {
  PrimitiveRenderer,
  RenderContext,
  RenderResult,
  DEFAULT_RENDER_CONTEXT
} from './renderers';
import { RectangleRenderer } from './renderers/rectangle.renderer';
import { EllipseRenderer } from './renderers/ellipse.renderer';
import { LineRenderer } from './renderers/line.renderer';
import { PathRenderer } from './renderers/path.renderer';
import { PolygonRenderer, PolylineRenderer } from './renderers/polygon.renderer';
import { ImageRenderer } from './renderers/image.renderer';
import { TextRenderer } from './renderers/text.renderer';

/**
 * Registry for primitive renderers
 *
 * Provides centralized access to all registered renderers.
 * Pre-registers all built-in renderers on instantiation.
 */
@Injectable({
  providedIn: 'root'
})
export class PrimitiveRendererRegistry {
  private readonly renderers = new Map<PrimitiveTypeValue, PrimitiveRenderer>();

  constructor() {
    this.registerBuiltInRenderers();
  }

  /**
   * Register built-in renderers
   */
  private registerBuiltInRenderers(): void {
    this.register(new RectangleRenderer());
    this.register(new EllipseRenderer());
    this.register(new LineRenderer());
    this.register(new PathRenderer());
    this.register(new PolygonRenderer());
    this.register(new PolylineRenderer());
    this.register(new ImageRenderer());
    this.register(new TextRenderer());
  }

  /**
   * Register a renderer for a primitive type
   *
   * @param renderer - The renderer to register
   */
  register<T extends PrimitiveBase>(renderer: PrimitiveRenderer<T>): void {
    this.renderers.set(renderer.type, renderer as PrimitiveRenderer);
  }

  /**
   * Get a renderer for a primitive type
   *
   * @param type - The primitive type
   * @returns The renderer, or undefined if not found
   */
  get(type: PrimitiveTypeValue): PrimitiveRenderer | undefined {
    return this.renderers.get(type);
  }

  /**
   * Get a renderer for a primitive, throwing if not found
   *
   * @param type - The primitive type
   * @returns The renderer
   * @throws Error if no renderer is registered for the type
   */
  getOrThrow(type: PrimitiveTypeValue): PrimitiveRenderer {
    const renderer = this.get(type);
    if (!renderer) {
      throw new Error(`No renderer registered for primitive type: ${type}`);
    }
    return renderer;
  }

  /**
   * Check if a renderer is registered for a type
   *
   * @param type - The primitive type
   * @returns True if a renderer is registered
   */
  has(type: PrimitiveTypeValue): boolean {
    return this.renderers.has(type);
  }

  /**
   * Get all registered primitive types
   *
   * @returns Array of registered types
   */
  getRegisteredTypes(): PrimitiveTypeValue[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Render a primitive using the appropriate renderer
   *
   * @param primitive - The primitive to render
   * @param context - Render context (optional, uses defaults)
   * @returns Render result, or null if no renderer found
   */
  render(primitive: PrimitiveBase, context?: Partial<RenderContext>): RenderResult | null {
    const renderer = this.get(primitive.type);
    if (!renderer) {
      console.warn(`No renderer for primitive type: ${primitive.type}`);
      return null;
    }

    const fullContext: RenderContext = {
      ...DEFAULT_RENDER_CONTEXT,
      ...context
    };

    return renderer.render(primitive, fullContext);
  }

  /**
   * Get bounding box of a primitive
   *
   * @param primitive - The primitive
   * @returns Bounding box, or null if no renderer found
   */
  getBoundingBox(primitive: PrimitiveBase): { x: number; y: number; width: number; height: number } | null {
    const renderer = this.get(primitive.type);
    if (!renderer) {
      return null;
    }
    return renderer.getBoundingBox(primitive);
  }

  /**
   * Check if a point is inside a primitive
   *
   * @param primitive - The primitive
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns True if point is inside, false if outside or no renderer
   */
  containsPoint(primitive: PrimitiveBase, x: number, y: number): boolean {
    const renderer = this.get(primitive.type);
    if (!renderer) {
      return false;
    }
    return renderer.containsPoint(primitive, x, y);
  }

  /**
   * Find primitive at a given point
   *
   * @param primitives - Array of primitives to check
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns The topmost primitive containing the point, or null
   */
  findPrimitiveAtPoint(primitives: PrimitiveBase[], x: number, y: number): PrimitiveBase | null {
    // Check in reverse order (topmost first based on array order/zIndex)
    const sorted = [...primitives].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

    for (const primitive of sorted) {
      if (primitive.visible !== false && this.containsPoint(primitive, x, y)) {
        return primitive;
      }
    }

    return null;
  }
}

/**
 * Helper function to create a render context
 */
export function createRenderContext(overrides?: Partial<RenderContext>): RenderContext {
  return {
    ...DEFAULT_RENDER_CONTEXT,
    ...overrides
  };
}
