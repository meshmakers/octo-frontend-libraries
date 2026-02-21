/**
 * Animation Renderer
 *
 * Renders SVG animation elements (<animate>, <animateTransform>, <animateMotion>)
 * based on AnimationDefinition configurations.
 */

import {
  AnimationDefinition,
  SVGAnimation,
  AttributeAnimation,
  TransformAnimation,
  MotionAnimation,
  FlowParticlesAnimation,
  AnimationAnchor,
  isAttributeAnimation,
  isTransformAnimation,
  isMotionAnimation,
  isFlowParticlesAnimation,
  parseDuration
} from '../models/animation.models';
import { BoundingBox } from '../models/primitive.models';

/**
 * Context for rendering animations
 */
export interface AnimationRenderContext {
  /** Bounding box of the element (for calculating pivot points) */
  bounds: BoundingBox;
  /** Whether animations should be enabled (from simulation) */
  animationsEnabled?: boolean;
  /** Property values for condition evaluation */
  propertyValues?: Record<string, unknown>;
  /**
   * Preview mode - when true, all animations are enabled regardless of property bindings.
   * Used in the symbol editor for design-time preview.
   */
  previewMode?: boolean;
  /**
   * ID of the primitive being rendered.
   * Used for looking up animation enabled states from property bindings.
   */
  primitiveId?: string;
  /**
   * Animation enabled states from property bindings.
   * Key format: "primitiveId:animationId" or just "animationId"
   * Value: true = enabled, false = disabled
   */
  animationEnabledStates?: Record<string, boolean>;
  /**
   * Target element ID for animations.
   * When specified, animations will use href="#targetElementId" to target
   * a specific element instead of animating their parent.
   * This is needed when animations are siblings of the shape element.
   */
  targetElementId?: string;
}

/**
 * Render all animations for a primitive
 *
 * @param animations - Array of animation definitions
 * @param context - Rendering context with element bounds
 * @returns SVG animation elements as a string
 */
export function renderAnimations(
  animations: AnimationDefinition[] | undefined,
  context: AnimationRenderContext
): string {
  if (!animations || animations.length === 0) {
    return '';
  }

  return animations
    .map(def => renderAnimation(def, context))
    .filter(Boolean)
    .join('\n');
}

/**
 * Render a single animation definition
 */
export function renderAnimation(
  definition: AnimationDefinition,
  context: AnimationRenderContext
): string {
  const { animation } = definition;

  // Check if animation is enabled based on property condition
  const isEnabled = checkAnimationEnabled(definition, context);

  if (isAttributeAnimation(animation)) {
    return renderAttributeAnimation(animation, definition, context, isEnabled);
  }

  if (isTransformAnimation(animation)) {
    return renderTransformAnimation(animation, definition, context, isEnabled);
  }

  if (isMotionAnimation(animation)) {
    return renderMotionAnimation(animation, definition, context, isEnabled);
  }

  return '';
}

/**
 * Check if animation should be enabled based on property condition
 */
function checkAnimationEnabled(
  definition: AnimationDefinition,
  context: AnimationRenderContext
): boolean {
  // In preview mode, all animations are enabled for design-time preview
  if (context.previewMode) {
    return true;
  }

  // Check animationEnabledStates from property bindings (expression-evaluated)
  if (context.animationEnabledStates && definition.id) {
    // Try with primitiveId:animationId key format first
    if (context.primitiveId) {
      const fullKey = `${context.primitiveId}:${definition.id}`;
      if (fullKey in context.animationEnabledStates) {
        return context.animationEnabledStates[fullKey];
      }
    }
    // Also check with just the animationId
    if (definition.id in context.animationEnabledStates) {
      return context.animationEnabledStates[definition.id];
    }
  }

  // If no property binding, animation is always enabled
  if (!definition.enabledByProperty) {
    return true;
  }

  // If animations are globally disabled in context
  if (context.animationsEnabled === false) {
    return false;
  }

  // Get property value
  const propertyValue = context.propertyValues?.[definition.enabledByProperty];

  // If no condition specified, check for truthy value
  if (definition.enableCondition === undefined) {
    return Boolean(propertyValue);
  }

  // Boolean condition
  if (typeof definition.enableCondition === 'boolean') {
    return propertyValue === definition.enableCondition;
  }

  // String expression condition
  return evaluateCondition(propertyValue, definition.enableCondition);
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(value: unknown, condition: string): boolean {
  const numValue = Number(value);

  // Simple comparison expressions
  if (condition.startsWith('> ')) {
    return numValue > Number(condition.substring(2));
  }
  if (condition.startsWith('>= ')) {
    return numValue >= Number(condition.substring(3));
  }
  if (condition.startsWith('< ')) {
    return numValue < Number(condition.substring(2));
  }
  if (condition.startsWith('<= ')) {
    return numValue <= Number(condition.substring(3));
  }
  if (condition.startsWith('== ')) {
    return String(value) === condition.substring(3);
  }
  if (condition.startsWith('!= ')) {
    return String(value) !== condition.substring(3);
  }

  // Boolean string comparison
  if (condition === 'true') {
    return value === true || value === 'true';
  }
  if (condition === 'false') {
    return value === false || value === 'false';
  }

  // For more complex expressions, use the expression evaluator service instead
  // For now, return true for unrecognized conditions (will be evaluated at runtime)
  return true;
}

/**
 * Render an attribute animation (<animate>)
 */
function renderAttributeAnimation(
  animation: AttributeAnimation,
  definition: AnimationDefinition,
  context: AnimationRenderContext,
  isEnabled: boolean
): string {
  const attrs: Record<string, string> = {
    attributeName: animation.attributeName
  };

  // Add href to target specific element (needed when animation is sibling of shape)
  if (context.targetElementId) {
    attrs['href'] = `#${context.targetElementId}`;
  }

  // Add timing attributes
  addTimingAttributes(attrs, animation, isEnabled);

  // Add value attributes
  if (animation.values) {
    attrs['values'] = animation.values;
  } else {
    if (animation.from) attrs['from'] = animation.from;
    if (animation.to) attrs['to'] = animation.to;
  }

  return buildSvgElement('animate', attrs, definition.id);
}

/**
 * Render a transform animation (<animateTransform>)
 */
function renderTransformAnimation(
  animation: TransformAnimation,
  definition: AnimationDefinition,
  context: AnimationRenderContext,
  isEnabled: boolean
): string {
  const attrs: Record<string, string> = {
    attributeName: 'transform',
    type: animation.transformType
  };

  // Add href to target specific element (needed when animation is sibling of shape)
  if (context.targetElementId) {
    attrs['href'] = `#${context.targetElementId}`;
  }

  // Add timing attributes
  addTimingAttributes(attrs, animation, isEnabled);

  // Handle rotation with pivot point
  if (animation.transformType === 'rotate') {
    const pivot = calculatePivot(definition.anchor ?? 'center', context.bounds, definition.customAnchor);

    if (animation.values) {
      // For keyframe values, append pivot to each value
      const valuesWithPivot = animation.values
        .split(';')
        .map(v => `${v.trim()} ${pivot.x} ${pivot.y}`)
        .join(';');
      attrs['values'] = valuesWithPivot;
    } else {
      if (animation.from) attrs['from'] = `${animation.from} ${pivot.x} ${pivot.y}`;
      if (animation.to) attrs['to'] = `${animation.to} ${pivot.x} ${pivot.y}`;
    }
  } else if (animation.transformType === 'scale') {
    // Scale animations - values are passed through
    // Center-based scaling is handled at the shape rendering level
    if (animation.values) {
      attrs['values'] = animation.values;
    } else {
      if (animation.from) attrs['from'] = animation.from;
      if (animation.to) attrs['to'] = animation.to;
    }
  } else {
    // translate, skewX, skewY
    if (animation.values) {
      attrs['values'] = animation.values;
    } else {
      if (animation.from) attrs['from'] = animation.from;
      if (animation.to) attrs['to'] = animation.to;
    }
  }

  // Additive mode - default to 'sum' for transform animations to preserve existing transforms
  // This is essential for groups that have translate transforms that must be preserved
  if (animation.additive) {
    attrs['additive'] = animation.additive;
  } else {
    // Default to additive="sum" so animations ADD to existing transforms (e.g., translate)
    attrs['additive'] = 'sum';
  }

  return buildSvgElement('animateTransform', attrs, definition.id);
}

/**
 * Render a motion animation (<animateMotion>)
 */
function renderMotionAnimation(
  animation: MotionAnimation,
  definition: AnimationDefinition,
  context: AnimationRenderContext,
  isEnabled: boolean
): string {
  const attrs: Record<string, string> = {
    path: animation.path
  };

  // Add href to target specific element (needed when animation is sibling of shape)
  if (context.targetElementId) {
    attrs['href'] = `#${context.targetElementId}`;
  }

  // Add timing attributes
  addTimingAttributes(attrs, animation, isEnabled);

  // Rotation along path
  if (animation.rotate !== undefined) {
    attrs['rotate'] = String(animation.rotate);
  }

  return buildSvgElement('animateMotion', attrs, definition.id);
}

/**
 * Add common timing attributes to an animation
 */
function addTimingAttributes(
  attrs: Record<string, string>,
  animation: SVGAnimation,
  isEnabled: boolean
): void {
  // Duration is required
  attrs['dur'] = animation.dur;

  // Begin - use 'indefinite' if animation is disabled
  if (!isEnabled) {
    attrs['begin'] = 'indefinite';
  } else if (animation.begin) {
    attrs['begin'] = animation.begin;
  } else {
    attrs['begin'] = '0s';
  }

  // Repeat count
  if (animation.repeatCount) {
    attrs['repeatCount'] = animation.repeatCount;
  }

  // Fill mode
  if (animation.fill) {
    attrs['fill'] = animation.fill;
  }

  // Easing
  if (animation.calcMode) {
    attrs['calcMode'] = animation.calcMode;
  }

  if (animation.keySplines) {
    attrs['keySplines'] = animation.keySplines;
  }

  if (animation.keyTimes) {
    attrs['keyTimes'] = animation.keyTimes;
  }
}

/**
 * Calculate pivot point for rotation based on anchor
 */
function calculatePivot(
  anchor: AnimationAnchor,
  bounds: BoundingBox,
  customAnchor?: { x: number; y: number }
): { x: number; y: number } {
  const { x, y, width, height } = bounds;

  switch (anchor) {
    case 'top-left':
      return { x, y };
    case 'top':
      return { x: x + width / 2, y };
    case 'top-right':
      return { x: x + width, y };
    case 'left':
      return { x, y: y + height / 2 };
    case 'center':
      return { x: x + width / 2, y: y + height / 2 };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'bottom-left':
      return { x, y: y + height };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    case 'bottom-right':
      return { x: x + width, y: y + height };
    case 'custom':
      if (customAnchor) {
        // Custom anchor can be absolute or relative (0-1)
        const px = customAnchor.x <= 1 ? x + width * customAnchor.x : customAnchor.x;
        const py = customAnchor.y <= 1 ? y + height * customAnchor.y : customAnchor.y;
        return { x: px, y: py };
      }
      return { x: x + width / 2, y: y + height / 2 };
    default:
      return { x: x + width / 2, y: y + height / 2 };
  }
}

/**
 * Build an SVG element string from tag name and attributes
 */
function buildSvgElement(
  tagName: string,
  attrs: Record<string, string>,
  id?: string
): string {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeXml(value)}"`)
    .join(' ');

  const idAttr = id ? ` id="${escapeXml(id)}"` : '';

  return `<${tagName}${idAttr} ${attrString}/>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate JavaScript code for starting/stopping an animation by ID
 */
export function generateAnimationControlScript(animationId: string, start: boolean): string {
  const method = start ? 'beginElement' : 'endElement';
  return `document.getElementById('${animationId}')?.${method}()`;
}

/**
 * Get animation element reference for runtime control
 */
export function getAnimationElementSelector(animationId: string): string {
  return `#${animationId}`;
}

/**
 * Render flow particles animation
 *
 * Generates multiple circles with animateMotion that move along a path.
 * This is rendered as separate SVG elements (not inside a primitive).
 *
 * @param animation - The flow particles animation config
 * @param pathData - SVG path data string (from line/polyline/path)
 * @param particleColor - Fill color for particles (fallback if not in animation)
 * @param isEnabled - Whether the animation should be active
 * @returns SVG string with circles and their animations
 */
export function renderFlowParticles(
  animation: FlowParticlesAnimation,
  pathData: string,
  particleColor: string,
  isEnabled = true
): string {
  if (!pathData || animation.particleCount <= 0) {
    return '';
  }

  const color = animation.particleColor || particleColor;
  const radius = animation.particleRadius || 4;
  const count = animation.particleCount;
  const dur = animation.dur;
  const repeatCount = animation.repeatCount || 'indefinite';

  // Calculate staggered start times for each particle
  const durationMs = parseDuration(dur);
  const staggerMs = durationMs / count;

  const particles: string[] = [];

  for (let i = 0; i < count; i++) {
    const staggerSec = (staggerMs * i) / 1000;
    const beginTime = isEnabled ? `${staggerSec}s` : 'indefinite';

    particles.push(`
      <circle r="${radius}" fill="${escapeXml(color)}">
        <animateMotion
          path="${escapeXml(pathData)}"
          dur="${escapeXml(dur)}"
          begin="${beginTime}"
          repeatCount="${escapeXml(repeatCount)}"
          fill="freeze"/>
      </circle>
    `);
  }

  return particles.join('');
}

/**
 * Check if an animation definition is a flow particles animation
 */
export function hasFlowParticlesAnimation(animations: AnimationDefinition[] | undefined): boolean {
  return animations?.some(def => isFlowParticlesAnimation(def.animation)) ?? false;
}

/**
 * Get the flow particles animation from a list of animations
 */
export function getFlowParticlesAnimation(animations: AnimationDefinition[] | undefined): { definition: AnimationDefinition; animation: FlowParticlesAnimation } | null {
  if (!animations) return null;
  for (const def of animations) {
    if (isFlowParticlesAnimation(def.animation)) {
      return { definition: def, animation: def.animation };
    }
  }
  return null;
}
