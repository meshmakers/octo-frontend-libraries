/**
 * Symbol Renderer
 *
 * Renders symbol instances by composing their constituent primitives.
 * Applies the symbol instance's position, scale, and rotation as group transforms.
 */

import { Injectable, inject } from '@angular/core';
import { SymbolInstance, SymbolDefinition } from '../models/symbol.model';
import { PrimitiveBase } from '../models/primitive.models';
import {
  BindingEffectType,
  EvaluatedBinding
} from '../models/transform-property.models';
import { PrimitiveRendererRegistry } from '../primitive-renderer.registry';
import { RenderContext, RenderResult, DEFAULT_RENDER_CONTEXT } from './primitive-renderer.interface';
import { ExpressionEvaluatorService } from '../../services/expression-evaluator.service';

/**
 * Context for rendering a symbol, extends RenderContext with symbol-specific info
 */
export interface SymbolRenderContext extends RenderContext {
  /** Parameter value overrides from the symbol instance (legacy) */
  parameterValues?: Record<string, unknown>;
  /** Transform property value overrides from the symbol instance */
  propertyValues?: Record<string, unknown>;
}

/**
 * Result of rendering a symbol instance
 */
export interface SymbolRenderResult {
  /** The symbol instance ID */
  instanceId: string;
  /** Transform string for the symbol group */
  transform: string;
  /** Rendered primitives within the symbol */
  primitives: RenderResult[];
  /** Bounding box of the symbol */
  boundingBox: { x: number; y: number; width: number; height: number };
}

/**
 * Service for rendering symbol instances
 */
@Injectable({
  providedIn: 'root'
})
export class SymbolRenderer {
  private readonly primitiveRegistry = inject(PrimitiveRendererRegistry);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  /**
   * Render a symbol instance
   *
   * @param instance - The symbol instance to render
   * @param definition - The symbol definition containing the primitives
   * @param context - Optional render context
   * @returns The render result with all primitives
   */
  render(
    instance: SymbolInstance,
    definition: SymbolDefinition,
    context?: Partial<SymbolRenderContext>
  ): SymbolRenderResult {
    const fullContext: SymbolRenderContext = {
      ...DEFAULT_RENDER_CONTEXT,
      ...context,
      parameterValues: instance.parameterValues,
      propertyValues: instance.propertyValues
    };

    // Build transform string for the symbol group
    const transform = this.buildTransform(instance, definition);

    // Evaluate all property bindings once
    const evaluatedBindings = this.evaluatePropertyBindings(definition, instance.propertyValues);

    // Extract animation enabled states from bindings
    const animationEnabledStates = this.extractAnimationEnabledStates(evaluatedBindings);
    if (Object.keys(animationEnabledStates).length > 0) {
      fullContext.animationEnabledStates = animationEnabledStates;
    }

    // Render all primitives in the symbol
    const primitives: RenderResult[] = [];
    for (const primitive of definition.primitives) {
      // Apply legacy parameter value overrides if configured
      let modifiedPrimitive = this.applyParameterOverrides(
        primitive,
        definition,
        instance.parameterValues
      );

      // Apply transform property bindings
      modifiedPrimitive = this.applyEvaluatedBindings(modifiedPrimitive, evaluatedBindings);

      const result = this.primitiveRegistry.render(modifiedPrimitive, fullContext);
      if (result) {
        primitives.push(result);
      }
    }

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(instance, definition);

    return {
      instanceId: instance.id,
      transform,
      primitives,
      boundingBox
    };
  }

  /**
   * Build the transform string for a symbol instance
   */
  buildTransform(instance: SymbolInstance, definition: SymbolDefinition): string {
    const transforms: string[] = [];

    // Translate to position
    transforms.push(`translate(${instance.position.x}, ${instance.position.y})`);

    // Apply rotation around center if specified
    if (instance.rotation && instance.rotation !== 0) {
      const centerX = definition.bounds.width / 2;
      const centerY = definition.bounds.height / 2;
      transforms.push(`rotate(${instance.rotation}, ${centerX}, ${centerY})`);
    }

    // Apply scale if specified
    const scale = instance.scale ?? 1;
    if (scale !== 1) {
      transforms.push(`scale(${scale})`);
    }

    return transforms.join(' ');
  }

  /**
   * Calculate the bounding box of a symbol instance
   */
  calculateBoundingBox(
    instance: SymbolInstance,
    definition: SymbolDefinition
  ): { x: number; y: number; width: number; height: number } {
    const scale = instance.scale ?? 1;
    const width = definition.bounds.width * scale;
    const height = definition.bounds.height * scale;

    // Note: This is a simplified bounding box that doesn't account for rotation
    // A more accurate implementation would calculate the rotated bounding box
    return {
      x: instance.position.x,
      y: instance.position.y,
      width,
      height
    };
  }

  /**
   * Check if a point is inside a symbol instance
   */
  containsPoint(
    instance: SymbolInstance,
    definition: SymbolDefinition,
    x: number,
    y: number
  ): boolean {
    const bbox = this.calculateBoundingBox(instance, definition);

    // Simple bounding box check (doesn't account for rotation)
    return (
      x >= bbox.x &&
      x <= bbox.x + bbox.width &&
      y >= bbox.y &&
      y <= bbox.y + bbox.height
    );
  }

  /**
   * Find the primitive at a point within a symbol instance
   * Returns the primitive in symbol-local coordinates
   */
  findPrimitiveAtPoint(
    instance: SymbolInstance,
    definition: SymbolDefinition,
    x: number,
    y: number
  ): PrimitiveBase | null {
    // Transform point to symbol-local coordinates
    const scale = instance.scale ?? 1;
    const localX = (x - instance.position.x) / scale;
    const localY = (y - instance.position.y) / scale;

    // Note: This doesn't account for rotation
    // A more accurate implementation would apply inverse rotation

    return this.primitiveRegistry.findPrimitiveAtPoint(definition.primitives, localX, localY);
  }

  /**
   * Apply parameter value overrides to a primitive
   */
  private applyParameterOverrides(
    primitive: PrimitiveBase,
    definition: SymbolDefinition,
    parameterValues?: Record<string, unknown>
  ): PrimitiveBase {
    if (!parameterValues || !definition.parameters) {
      return primitive;
    }

    // Clone the primitive to avoid modifying the original
    let modified = { ...primitive };

    for (const param of definition.parameters) {
      const value = parameterValues[param.id];
      if (value === undefined) continue;

      // Find bindings that affect this primitive
      for (const binding of param.bindings) {
        if (binding.primitiveId !== primitive.id) continue;

        // Apply the value to the property path
        modified = this.setPropertyByPath(modified, binding.property, value);
      }
    }

    return modified;
  }

  /**
   * Set a nested property by path (e.g., "style.fill.color")
   */
  private setPropertyByPath(obj: PrimitiveBase, path: string, value: unknown): PrimitiveBase {
    const parts = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone

    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return result;
  }

  /**
   * Get connection point positions for a symbol instance
   * Returns positions transformed to canvas coordinates
   */
  getConnectionPoints(
    instance: SymbolInstance,
    definition: SymbolDefinition
  ): { id: string; name: string; x: number; y: number; direction?: string }[] {
    if (!definition.connectionPoints) {
      return [];
    }

    const scale = instance.scale ?? 1;

    return definition.connectionPoints.map(cp => ({
      id: cp.id,
      name: cp.name,
      x: instance.position.x + cp.position.x * scale,
      y: instance.position.y + cp.position.y * scale,
      direction: cp.direction
    }));
  }

  // ============================================================================
  // Transform Property Binding Methods
  // ============================================================================

  /**
   * Evaluate all property bindings for a symbol definition
   */
  private evaluatePropertyBindings(
    definition: SymbolDefinition,
    propertyValues?: Record<string, unknown>
  ): EvaluatedBinding[] {
    if (!definition.transformProperties || !definition.propertyBindings) {
      return [];
    }

    const evaluatedBindings: EvaluatedBinding[] = [];

    // Evaluate each binding
    for (const binding of definition.propertyBindings) {
      // Get the input value for this binding
      const property = definition.transformProperties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      const inputValue = propertyValues?.[binding.propertyId] ?? property.defaultValue;

      // Build context with all property values (defaults + overrides)
      const context = this.buildExpressionContext(definition, propertyValues, inputValue);

      // Evaluate the expression
      const result = this.expressionEvaluator.evaluate(binding.expression, context);

      if (result.success) {
        evaluatedBindings.push({
          targetId: binding.targetId,
          targetType: binding.targetType,
          effectType: binding.effectType,
          computedValue: result.value,
          targetPropertyId: binding.targetPropertyId,
          animationId: binding.animationId
        });
      }
    }

    return evaluatedBindings;
  }

  /**
   * Build an expression context from property values
   */
  private buildExpressionContext(
    definition: SymbolDefinition,
    propertyValues: Record<string, unknown> | undefined,
    inputValue: unknown
  ): Record<string, number | string | boolean> {
    const context: Record<string, number | string | boolean> = {
      value: this.toPrimitiveValue(inputValue)
    };

    // Add all property values to context
    for (const prop of definition.transformProperties ?? []) {
      const val = propertyValues?.[prop.id] ?? prop.defaultValue;
      context[prop.id] = this.toPrimitiveValue(val);
    }

    return context;
  }

  /**
   * Convert unknown value to primitive type for expression evaluation
   */
  private toPrimitiveValue(value: unknown): number | string | boolean {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return 0;
    return String(value);
  }

  /**
   * Apply evaluated bindings to a primitive
   */
  private applyEvaluatedBindings(
    primitive: PrimitiveBase,
    evaluatedBindings: EvaluatedBinding[]
  ): PrimitiveBase {
    // Filter bindings for this primitive
    const relevantBindings = evaluatedBindings.filter(
      b => b.targetType === 'primitive' && b.targetId === primitive.id
    );

    if (relevantBindings.length === 0) {
      return primitive;
    }

    // Clone the primitive to avoid modifying the original
    let modified = JSON.parse(JSON.stringify(primitive)) as PrimitiveBase;

    for (const binding of relevantBindings) {
      modified = this.applyBindingEffect(modified, binding.effectType, binding.computedValue);
    }

    return modified;
  }

  /**
   * Apply a single binding effect to a primitive
   */
  private applyBindingEffect(
    primitive: PrimitiveBase,
    effectType: BindingEffectType,
    value: unknown
  ): PrimitiveBase {
    // Ensure nested objects exist
    if (!primitive.transform) {
      primitive.transform = {};
    }
    if (!primitive.style) {
      primitive.style = {};
    }
    if (!primitive.style.fill) {
      primitive.style.fill = {};
    }
    if (!primitive.style.stroke) {
      primitive.style.stroke = {};
    }

    switch (effectType) {
      // Transform effects
      case 'transform.rotation':
        primitive.transform.rotation = Number(value);
        break;
      case 'transform.offsetX':
        primitive.transform.offsetX = Number(value);
        break;
      case 'transform.offsetY':
        primitive.transform.offsetY = Number(value);
        break;
      case 'transform.scale':
        primitive.transform.scale = Number(value);
        break;
      case 'transform.scaleX':
        primitive.transform.scaleX = Number(value);
        break;
      case 'transform.scaleY':
        primitive.transform.scaleY = Number(value);
        break;

      // Style effects
      case 'style.fill.color':
        primitive.style.fill.color = String(value);
        break;
      case 'style.fill.opacity':
        primitive.style.fill.opacity = Number(value);
        break;
      case 'style.stroke.color':
        primitive.style.stroke.color = String(value);
        break;
      case 'style.stroke.opacity':
        primitive.style.stroke.opacity = Number(value);
        break;
      case 'style.opacity':
        primitive.style.opacity = Number(value);
        break;

      // Visibility
      case 'visible':
        primitive.visible = Boolean(value);
        break;

      // Fill level
      case 'fillLevel':
        primitive.fillLevel = Math.max(0, Math.min(1, Number(value)));
        break;

      // Property pass-through (handled at symbol instance level, not primitive)
      case 'property':
        // This is handled separately in renderNestedSymbolInstances
        break;

      // Animation control (handled via animationEnabledStates in context)
      case 'animation.enabled':
        // This is handled separately in extractAnimationEnabledStates
        break;
    }

    return primitive;
  }

  /**
   * Extract animation enabled states from evaluated bindings.
   * Returns a map of "primitiveId:animationId" -> boolean
   */
  private extractAnimationEnabledStates(
    evaluatedBindings: EvaluatedBinding[]
  ): Record<string, boolean> {
    const states: Record<string, boolean> = {};

    for (const binding of evaluatedBindings) {
      if (binding.effectType === 'animation.enabled' && binding.animationId) {
        // Key format: "primitiveId:animationId"
        const key = `${binding.targetId}:${binding.animationId}`;
        states[key] = Boolean(binding.computedValue);
      }
    }

    return states;
  }

  /**
   * Get property bindings that pass values to nested symbol instances
   */
  getSymbolInstanceBindings(
    definition: SymbolDefinition,
    propertyValues?: Record<string, unknown>
  ): Map<string, Record<string, unknown>> {
    const result = new Map<string, Record<string, unknown>>();

    if (!definition.transformProperties || !definition.propertyBindings) {
      return result;
    }

    // Find pass-through bindings to symbol instances
    for (const binding of definition.propertyBindings) {
      if (binding.targetType !== 'symbolInstance' || binding.effectType !== 'property') {
        continue;
      }
      if (!binding.targetPropertyId) continue;

      const property = definition.transformProperties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      const inputValue = propertyValues?.[binding.propertyId] ?? property.defaultValue;
      const context = this.buildExpressionContext(definition, propertyValues, inputValue);

      const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
      if (!evalResult.success) continue;

      // Get or create the property values map for this symbol instance
      if (!result.has(binding.targetId)) {
        result.set(binding.targetId, {});
      }
      const instanceValues = result.get(binding.targetId)!;
      instanceValues[binding.targetPropertyId] = evalResult.value;
    }

    return result;
  }
}

/**
 * Helper to create a default symbol render context
 */
export function createSymbolRenderContext(overrides?: Partial<SymbolRenderContext>): SymbolRenderContext {
  return {
    ...DEFAULT_RENDER_CONTEXT,
    ...overrides
  };
}
