/**
 * SVG Animation Models
 *
 * Defines interfaces for native SVG animation elements:
 * - <animate> - Attribute animations
 * - <animateTransform> - Transform animations
 * - <animateMotion> - Path-based motion
 *
 * Animations can be linked to Transform Properties for runtime control.
 */

// ============================================================================
// Timing Configuration
// ============================================================================

/**
 * Base animation timing configuration
 * Common to all animation types
 */
export interface AnimationTiming {
  /** Animation duration (e.g., '1s', '500ms', '2000ms') */
  dur: string;

  /** Start time/trigger (e.g., '0s', 'click', 'indefinite') */
  begin?: string;

  /** Repeat count ('indefinite', '1', '3', etc.) */
  repeatCount?: string;

  /** What happens after animation ends */
  fill?: 'freeze' | 'remove';

  /** Easing/interpolation mode */
  calcMode?: 'discrete' | 'linear' | 'paced' | 'spline';

  /** Bezier control points for spline easing (required when calcMode='spline') */
  keySplines?: string;

  /** Key times for keyframe animations (0;0.5;1 format) */
  keyTimes?: string;
}

// ============================================================================
// Animation Types
// ============================================================================

/**
 * Attribute animation (<animate>)
 * Animates a single SVG attribute over time
 */
export interface AttributeAnimation extends AnimationTiming {
  type: 'animate';

  /** SVG attribute to animate (e.g., 'opacity', 'fill', 'stroke-dashoffset') */
  attributeName: string;

  /** Start value */
  from?: string;

  /** End value */
  to?: string;

  /** Keyframe values (alternative to from/to, semicolon-separated) */
  values?: string;
}

/**
 * Transform animation (<animateTransform>)
 * Animates transform attributes (rotate, scale, translate, skew)
 */
export interface TransformAnimation extends AnimationTiming {
  type: 'animateTransform';

  /** Transform type to animate */
  transformType: 'rotate' | 'scale' | 'translate' | 'skewX' | 'skewY';

  /** Start value (format depends on transformType) */
  from?: string;

  /** End value */
  to?: string;

  /** Keyframe values */
  values?: string;

  /** How to combine with existing transforms */
  additive?: 'sum' | 'replace';
}

/**
 * Motion along path (<animateMotion>)
 * Moves an element along an SVG path
 */
export interface MotionAnimation extends AnimationTiming {
  type: 'animateMotion';

  /** SVG path data for motion (e.g., 'M 0 0 L 100 100') */
  path: string;

  /** Auto-rotation along path */
  rotate?: 'auto' | 'auto-reverse' | number;
}

/**
 * Flow particles animation
 * Renders multiple circles/symbols that move along the parent path/line/polyline
 */
export interface FlowParticlesAnimation extends AnimationTiming {
  type: 'flowParticles';

  /** Number of particles (evenly distributed along the path) */
  particleCount: number;

  /** Particle radius in pixels */
  particleRadius: number;

  /** Particle fill color (defaults to stroke color if not set) */
  particleColor?: string;
}

/**
 * Union type for all SVG animation types
 */
export type SVGAnimation = AttributeAnimation | TransformAnimation | MotionAnimation | FlowParticlesAnimation;

// ============================================================================
// Animation Definition
// ============================================================================

/**
 * Anchor point for rotation animations
 * Determines the pivot point for the rotation
 */
export type AnimationAnchor =
  | 'center'
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'
  | 'custom';

/**
 * Custom anchor position (when anchor is 'custom')
 */
export interface CustomAnchorPosition {
  x: number;
  y: number;
}

/**
 * Complete animation definition with metadata and property binding
 */
export interface AnimationDefinition {
  /** Unique ID within the primitive/symbol */
  id: string;

  /** Human-readable name for UI */
  name?: string;

  /** The animation configuration */
  animation: SVGAnimation;

  /**
   * Anchor point for rotation/scale animations.
   * Defaults to 'center' if not specified.
   */
  anchor?: AnimationAnchor;

  /**
   * Custom anchor position (when anchor is 'custom')
   * Values are relative to element bounds (0-1) or absolute pixels
   */
  customAnchor?: CustomAnchorPosition;

  /**
   * Property ID that controls enable/disable of this animation.
   * When set, animation only runs when the condition is met.
   */
  enabledByProperty?: string;

  /**
   * Condition for enabling the animation.
   * - boolean: Simple true/false check
   * - string: Expression like '> 50', '!= 0', 'value > 0 && value < 100'
   */
  enableCondition?: string | boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AttributeAnimation
 */
export function isAttributeAnimation(anim: SVGAnimation): anim is AttributeAnimation {
  return anim.type === 'animate';
}

/**
 * Type guard for TransformAnimation
 */
export function isTransformAnimation(anim: SVGAnimation): anim is TransformAnimation {
  return anim.type === 'animateTransform';
}

/**
 * Type guard for MotionAnimation
 */
export function isMotionAnimation(anim: SVGAnimation): anim is MotionAnimation {
  return anim.type === 'animateMotion';
}

/**
 * Type guard for FlowParticlesAnimation
 */
export function isFlowParticlesAnimation(anim: SVGAnimation): anim is FlowParticlesAnimation {
  return anim.type === 'flowParticles';
}

/**
 * Type guard for AnimationDefinition
 */
export function isAnimationDefinition(obj: unknown): obj is AnimationDefinition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'animation' in obj &&
    typeof (obj as AnimationDefinition).animation === 'object' &&
    'type' in (obj as AnimationDefinition).animation
  );
}

// ============================================================================
// Animation Presets
// ============================================================================

/**
 * Preset animation configurations for common use cases
 */
export const ANIMATION_PRESETS: Record<string, { name: string; animation: SVGAnimation; description: string }> = {
  // Rotation presets
  'spin': {
    name: 'Spin (Clockwise)',
    description: 'Continuous 360° rotation clockwise',
    animation: {
      type: 'animateTransform',
      transformType: 'rotate',
      from: '0',
      to: '360',
      dur: '2s',
      repeatCount: 'indefinite'
    }
  },
  'spin-fast': {
    name: 'Spin Fast',
    description: 'Fast 360° rotation (1s)',
    animation: {
      type: 'animateTransform',
      transformType: 'rotate',
      from: '0',
      to: '360',
      dur: '1s',
      repeatCount: 'indefinite'
    }
  },
  'spin-reverse': {
    name: 'Spin (Counter-clockwise)',
    description: 'Continuous 360° rotation counter-clockwise',
    animation: {
      type: 'animateTransform',
      transformType: 'rotate',
      from: '360',
      to: '0',
      dur: '2s',
      repeatCount: 'indefinite'
    }
  },

  // Opacity presets
  'pulse': {
    name: 'Pulse',
    description: 'Smooth opacity pulsing (fade in/out)',
    animation: {
      type: 'animate',
      attributeName: 'opacity',
      values: '1;0.3;1',
      dur: '1.5s',
      repeatCount: 'indefinite'
    }
  },
  'blink': {
    name: 'Blink',
    description: 'Fast on/off blinking',
    animation: {
      type: 'animate',
      attributeName: 'opacity',
      values: '1;0;1',
      dur: '0.5s',
      repeatCount: 'indefinite',
      calcMode: 'discrete'
    }
  },
  'blink-slow': {
    name: 'Blink Slow',
    description: 'Slow on/off blinking',
    animation: {
      type: 'animate',
      attributeName: 'opacity',
      values: '1;0;1',
      dur: '1s',
      repeatCount: 'indefinite',
      calcMode: 'discrete'
    }
  },
  'fade-in': {
    name: 'Fade In',
    description: 'Fade from transparent to visible (once)',
    animation: {
      type: 'animate',
      attributeName: 'opacity',
      from: '0',
      to: '1',
      dur: '0.5s',
      fill: 'freeze'
    }
  },
  'fade-out': {
    name: 'Fade Out',
    description: 'Fade from visible to transparent (once)',
    animation: {
      type: 'animate',
      attributeName: 'opacity',
      from: '1',
      to: '0',
      dur: '0.5s',
      fill: 'freeze'
    }
  },

  // Scale presets
  'grow-shrink': {
    name: 'Grow & Shrink',
    description: 'Scale up and down continuously',
    animation: {
      type: 'animateTransform',
      transformType: 'scale',
      values: '1;1.2;1',
      dur: '1s',
      repeatCount: 'indefinite'
    }
  },
  'heartbeat': {
    name: 'Heartbeat',
    description: 'Double-pulse like a heartbeat',
    animation: {
      type: 'animateTransform',
      transformType: 'scale',
      values: '1;1.1;1;1.15;1',
      keyTimes: '0;0.2;0.4;0.6;1',
      dur: '1s',
      repeatCount: 'indefinite'
    }
  },

  // Movement presets
  'shake': {
    name: 'Shake',
    description: 'Horizontal shaking motion',
    animation: {
      type: 'animateTransform',
      transformType: 'translate',
      values: '0,0;-5,0;5,0;-5,0;5,0;0,0',
      dur: '0.5s',
      repeatCount: 'indefinite'
    }
  },
  'bounce': {
    name: 'Bounce',
    description: 'Vertical bouncing motion',
    animation: {
      type: 'animateTransform',
      transformType: 'translate',
      values: '0,0;0,-10;0,0',
      dur: '0.6s',
      repeatCount: 'indefinite',
      calcMode: 'spline',
      keySplines: '0.5 0 0.5 1; 0.5 0 0.5 1'
    }
  },

  // Flow presets (for pipes/lines)
  'flow': {
    name: 'Flow',
    description: 'Animated dash pattern (flowing effect)',
    animation: {
      type: 'animate',
      attributeName: 'stroke-dashoffset',
      from: '15',
      to: '0',
      dur: '0.5s',
      repeatCount: 'indefinite'
    }
  },
  'flow-reverse': {
    name: 'Flow Reverse',
    description: 'Animated dash pattern (reverse direction)',
    animation: {
      type: 'animate',
      attributeName: 'stroke-dashoffset',
      from: '0',
      to: '15',
      dur: '0.5s',
      repeatCount: 'indefinite'
    }
  },
  'flow-slow': {
    name: 'Flow Slow',
    description: 'Slow flowing effect',
    animation: {
      type: 'animate',
      attributeName: 'stroke-dashoffset',
      from: '15',
      to: '0',
      dur: '1s',
      repeatCount: 'indefinite'
    }
  },

  // Motion path presets (animateMotion)
  'motion-circle': {
    name: 'Circular Motion',
    description: 'Move in a circle',
    animation: {
      type: 'animateMotion',
      path: 'M 0,0 A 25,25 0 1,1 0,0.1 A 25,25 0 1,1 0,0',
      dur: '3s',
      repeatCount: 'indefinite',
      rotate: 'auto'
    } as MotionAnimation
  },
  'motion-horizontal': {
    name: 'Horizontal Slide',
    description: 'Move left to right',
    animation: {
      type: 'animateMotion',
      path: 'M 0,0 L 100,0',
      dur: '2s',
      repeatCount: 'indefinite'
    } as MotionAnimation
  },
  'motion-vertical': {
    name: 'Vertical Slide',
    description: 'Move top to bottom',
    animation: {
      type: 'animateMotion',
      path: 'M 0,0 L 0,100',
      dur: '2s',
      repeatCount: 'indefinite'
    } as MotionAnimation
  },
  'motion-wave': {
    name: 'Wave Motion',
    description: 'Sinusoidal wave movement',
    animation: {
      type: 'animateMotion',
      path: 'M 0,0 Q 25,-20 50,0 T 100,0',
      dur: '2s',
      repeatCount: 'indefinite'
    } as MotionAnimation
  },
  'motion-zigzag': {
    name: 'Zig-Zag',
    description: 'Back and forth diagonal motion',
    animation: {
      type: 'animateMotion',
      path: 'M 0,0 L 30,20 L 60,0 L 90,20 L 120,0',
      dur: '2s',
      repeatCount: 'indefinite'
    } as MotionAnimation
  },

  // Flow particles presets (for paths/lines/polylines)
  'particles-flow': {
    name: 'Particle Flow',
    description: 'Circles flowing along the path',
    animation: {
      type: 'flowParticles',
      particleCount: 5,
      particleRadius: 4,
      dur: '3s',
      repeatCount: 'indefinite'
    } as FlowParticlesAnimation
  },
  'particles-flow-fast': {
    name: 'Particle Flow (Fast)',
    description: 'Fast flowing circles',
    animation: {
      type: 'flowParticles',
      particleCount: 5,
      particleRadius: 4,
      dur: '1.5s',
      repeatCount: 'indefinite'
    } as FlowParticlesAnimation
  },
  'particles-flow-dense': {
    name: 'Particle Flow (Dense)',
    description: 'More particles, smaller size',
    animation: {
      type: 'flowParticles',
      particleCount: 10,
      particleRadius: 3,
      dur: '3s',
      repeatCount: 'indefinite'
    } as FlowParticlesAnimation
  }
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an animation definition with default values
 */
export function createAnimationDefinition(
  id: string,
  animation: SVGAnimation,
  options?: Partial<Omit<AnimationDefinition, 'id' | 'animation'>>
): AnimationDefinition {
  return {
    id,
    animation,
    name: options?.name,
    anchor: options?.anchor ?? 'center',
    customAnchor: options?.customAnchor,
    enabledByProperty: options?.enabledByProperty,
    enableCondition: options?.enableCondition
  };
}

/**
 * Create an animation definition from a preset
 */
export function createFromPreset(
  id: string,
  presetKey: string,
  options?: Partial<Omit<AnimationDefinition, 'id' | 'animation'>>
): AnimationDefinition | null {
  const preset = ANIMATION_PRESETS[presetKey];
  if (!preset) {
    return null;
  }

  return createAnimationDefinition(id, { ...preset.animation }, {
    name: options?.name ?? preset.name,
    ...options
  });
}

/**
 * Create a rotation animation
 */
export function createRotationAnimation(
  fromDegrees: number,
  toDegrees: number,
  durationSeconds: number,
  options?: Partial<AnimationTiming>
): TransformAnimation {
  return {
    type: 'animateTransform',
    transformType: 'rotate',
    from: String(fromDegrees),
    to: String(toDegrees),
    dur: `${durationSeconds}s`,
    repeatCount: options?.repeatCount ?? 'indefinite',
    ...options
  };
}

/**
 * Create an opacity animation
 */
export function createOpacityAnimation(
  fromOpacity: number,
  toOpacity: number,
  durationSeconds: number,
  options?: Partial<AnimationTiming>
): AttributeAnimation {
  return {
    type: 'animate',
    attributeName: 'opacity',
    from: String(fromOpacity),
    to: String(toOpacity),
    dur: `${durationSeconds}s`,
    ...options
  };
}

/**
 * Create a motion path animation
 */
export function createMotionAnimation(
  path: string,
  durationSeconds: number,
  options?: Partial<Omit<MotionAnimation, 'type' | 'path' | 'dur'>>
): MotionAnimation {
  return {
    type: 'animateMotion',
    path,
    dur: `${durationSeconds}s`,
    repeatCount: options?.repeatCount ?? 'indefinite',
    rotate: options?.rotate ?? 'auto',
    ...options
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the list of available preset keys
 */
export function getPresetKeys(): string[] {
  return Object.keys(ANIMATION_PRESETS);
}

/**
 * Get presets grouped by category
 */
export function getPresetsGrouped(): Record<string, { key: string; name: string; description: string }[]> {
  return {
    'Rotation': [
      { key: 'spin', ...ANIMATION_PRESETS['spin'] },
      { key: 'spin-fast', ...ANIMATION_PRESETS['spin-fast'] },
      { key: 'spin-reverse', ...ANIMATION_PRESETS['spin-reverse'] }
    ],
    'Opacity': [
      { key: 'pulse', ...ANIMATION_PRESETS['pulse'] },
      { key: 'blink', ...ANIMATION_PRESETS['blink'] },
      { key: 'blink-slow', ...ANIMATION_PRESETS['blink-slow'] },
      { key: 'fade-in', ...ANIMATION_PRESETS['fade-in'] },
      { key: 'fade-out', ...ANIMATION_PRESETS['fade-out'] }
    ],
    'Scale': [
      { key: 'grow-shrink', ...ANIMATION_PRESETS['grow-shrink'] },
      { key: 'heartbeat', ...ANIMATION_PRESETS['heartbeat'] }
    ],
    'Movement': [
      { key: 'shake', ...ANIMATION_PRESETS['shake'] },
      { key: 'bounce', ...ANIMATION_PRESETS['bounce'] }
    ],
    'Flow': [
      { key: 'flow', ...ANIMATION_PRESETS['flow'] },
      { key: 'flow-reverse', ...ANIMATION_PRESETS['flow-reverse'] },
      { key: 'flow-slow', ...ANIMATION_PRESETS['flow-slow'] }
    ],
    'Motion': [
      { key: 'motion-circle', ...ANIMATION_PRESETS['motion-circle'] },
      { key: 'motion-horizontal', ...ANIMATION_PRESETS['motion-horizontal'] },
      { key: 'motion-vertical', ...ANIMATION_PRESETS['motion-vertical'] },
      { key: 'motion-wave', ...ANIMATION_PRESETS['motion-wave'] },
      { key: 'motion-zigzag', ...ANIMATION_PRESETS['motion-zigzag'] }
    ],
    'Particles': [
      { key: 'particles-flow', ...ANIMATION_PRESETS['particles-flow'] },
      { key: 'particles-flow-fast', ...ANIMATION_PRESETS['particles-flow-fast'] },
      { key: 'particles-flow-dense', ...ANIMATION_PRESETS['particles-flow-dense'] }
    ]
  };
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(dur: string): number {
  const match = dur.match(/^([\d.]+)(ms|s)?$/);
  if (!match) return 1000;

  const value = parseFloat(match[1]);
  const unit = match[2] || 's';

  return unit === 'ms' ? value : value * 1000;
}

/**
 * Format milliseconds to duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${ms / 1000}s`;
}
