/**
 * Animation Models - Unit Tests
 */

import {
  AnimationDefinition,
  SVGAnimation,
  AttributeAnimation,
  TransformAnimation,
  MotionAnimation,
  isAttributeAnimation,
  isTransformAnimation,
  isMotionAnimation,
  isAnimationDefinition,
  ANIMATION_PRESETS,
  createAnimationDefinition,
  createFromPreset,
  createRotationAnimation,
  createOpacityAnimation,
  createMotionAnimation,
  getPresetKeys,
  getPresetsGrouped,
  parseDuration,
  formatDuration
} from './animation.models';

describe('Animation Models', () => {
  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('Type Guards', () => {
    describe('isAttributeAnimation', () => {
      it('should return true for attribute animations', () => {
        const anim: AttributeAnimation = {
          type: 'animate',
          attributeName: 'opacity',
          from: '0',
          to: '1',
          dur: '1s'
        };
        expect(isAttributeAnimation(anim)).toBe(true);
      });

      it('should return false for transform animations', () => {
        const anim: TransformAnimation = {
          type: 'animateTransform',
          transformType: 'rotate',
          from: '0',
          to: '360',
          dur: '2s'
        };
        expect(isAttributeAnimation(anim)).toBe(false);
      });

      it('should return false for motion animations', () => {
        const anim: MotionAnimation = {
          type: 'animateMotion',
          path: 'M 0 0 L 100 100',
          dur: '1s'
        };
        expect(isAttributeAnimation(anim)).toBe(false);
      });
    });

    describe('isTransformAnimation', () => {
      it('should return true for transform animations', () => {
        const anim: TransformAnimation = {
          type: 'animateTransform',
          transformType: 'scale',
          values: '1;1.2;1',
          dur: '1s'
        };
        expect(isTransformAnimation(anim)).toBe(true);
      });

      it('should return false for attribute animations', () => {
        const anim: AttributeAnimation = {
          type: 'animate',
          attributeName: 'fill',
          from: '#000',
          to: '#fff',
          dur: '1s'
        };
        expect(isTransformAnimation(anim)).toBe(false);
      });
    });

    describe('isMotionAnimation', () => {
      it('should return true for motion animations', () => {
        const anim: MotionAnimation = {
          type: 'animateMotion',
          path: 'M 0 0 C 50 50 100 0 100 100',
          dur: '3s',
          rotate: 'auto'
        };
        expect(isMotionAnimation(anim)).toBe(true);
      });

      it('should return false for non-motion animations', () => {
        const anim: TransformAnimation = {
          type: 'animateTransform',
          transformType: 'translate',
          values: '0,0;10,10;0,0',
          dur: '1s'
        };
        expect(isMotionAnimation(anim)).toBe(false);
      });
    });

    describe('isAnimationDefinition', () => {
      it('should return true for valid animation definitions', () => {
        const def: AnimationDefinition = {
          id: 'test-1',
          animation: {
            type: 'animate',
            attributeName: 'opacity',
            from: '0',
            to: '1',
            dur: '1s'
          }
        };
        expect(isAnimationDefinition(def)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isAnimationDefinition(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isAnimationDefinition(undefined)).toBe(false);
      });

      it('should return false for objects without id', () => {
        expect(isAnimationDefinition({ animation: { type: 'animate' } })).toBe(false);
      });

      it('should return false for objects without animation', () => {
        expect(isAnimationDefinition({ id: 'test' })).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isAnimationDefinition('string')).toBe(false);
        expect(isAnimationDefinition(123)).toBe(false);
        expect(isAnimationDefinition(true)).toBe(false);
      });
    });
  });

  // ============================================================================
  // Animation Presets
  // ============================================================================

  describe('Animation Presets', () => {
    it('should have all expected presets', () => {
      const expectedPresets = [
        'spin', 'spin-fast', 'spin-reverse',
        'pulse', 'blink', 'blink-slow', 'fade-in', 'fade-out',
        'grow-shrink', 'heartbeat',
        'shake', 'bounce',
        'flow', 'flow-reverse', 'flow-slow'
      ];

      for (const key of expectedPresets) {
        expect(ANIMATION_PRESETS[key]).toBeDefined();
        expect(ANIMATION_PRESETS[key].name).toBeTruthy();
        expect(ANIMATION_PRESETS[key].description).toBeTruthy();
        expect(ANIMATION_PRESETS[key].animation).toBeDefined();
      }
    });

    it('should have valid animation types in presets', () => {
      for (const [, preset] of Object.entries(ANIMATION_PRESETS)) {
        const validTypes = ['animate', 'animateTransform', 'animateMotion', 'flowParticles'];
        expect(validTypes).toContain(preset.animation.type);
      }
    });

    it('should have duration in all presets', () => {
      for (const [, preset] of Object.entries(ANIMATION_PRESETS)) {
        expect(preset.animation.dur).toBeTruthy();
      }
    });
  });

  // ============================================================================
  // Factory Functions
  // ============================================================================

  describe('Factory Functions', () => {
    describe('createAnimationDefinition', () => {
      it('should create animation definition with required properties', () => {
        const animation: SVGAnimation = {
          type: 'animate',
          attributeName: 'opacity',
          from: '0',
          to: '1',
          dur: '1s'
        };

        const def = createAnimationDefinition('test-id', animation);

        expect(def.id).toBe('test-id');
        expect(def.animation).toEqual(animation);
        expect(def.anchor).toBe('center'); // Default anchor
      });

      it('should apply optional properties', () => {
        const animation: SVGAnimation = {
          type: 'animateTransform',
          transformType: 'rotate',
          from: '0',
          to: '360',
          dur: '2s'
        };

        const def = createAnimationDefinition('test-id', animation, {
          name: 'Test Animation',
          anchor: 'top-left',
          enabledByProperty: 'isRunning',
          enableCondition: true
        });

        expect(def.name).toBe('Test Animation');
        expect(def.anchor).toBe('top-left');
        expect(def.enabledByProperty).toBe('isRunning');
        expect(def.enableCondition).toBe(true);
      });

      it('should support custom anchor position', () => {
        const animation: SVGAnimation = {
          type: 'animateTransform',
          transformType: 'rotate',
          from: '0',
          to: '180',
          dur: '1s'
        };

        const def = createAnimationDefinition('test-id', animation, {
          anchor: 'custom',
          customAnchor: { x: 0.25, y: 0.75 }
        });

        expect(def.anchor).toBe('custom');
        expect(def.customAnchor).toEqual({ x: 0.25, y: 0.75 });
      });
    });

    describe('createFromPreset', () => {
      it('should create animation definition from valid preset', () => {
        const def = createFromPreset('preset-spin', 'spin');

        expect(def).not.toBeNull();
        expect(def!.id).toBe('preset-spin');
        expect(def!.name).toBe('Spin (Clockwise)');
        expect(def!.animation.type).toBe('animateTransform');
      });

      it('should return null for invalid preset', () => {
        const def = createFromPreset('test-id', 'non-existent-preset');
        expect(def).toBeNull();
      });

      it('should allow overriding preset name', () => {
        const def = createFromPreset('test-id', 'pulse', { name: 'Custom Pulse' });

        expect(def).not.toBeNull();
        expect(def!.name).toBe('Custom Pulse');
      });

      it('should allow adding property binding to preset', () => {
        const def = createFromPreset('test-id', 'blink', {
          enabledByProperty: 'alarmActive',
          enableCondition: true
        });

        expect(def).not.toBeNull();
        expect(def!.enabledByProperty).toBe('alarmActive');
        expect(def!.enableCondition).toBe(true);
      });
    });

    describe('createRotationAnimation', () => {
      it('should create rotation animation with specified parameters', () => {
        const anim = createRotationAnimation(0, 360, 2);

        expect(anim.type).toBe('animateTransform');
        expect(anim.transformType).toBe('rotate');
        expect(anim.from).toBe('0');
        expect(anim.to).toBe('360');
        expect(anim.dur).toBe('2s');
        expect(anim.repeatCount).toBe('indefinite');
      });

      it('should allow custom timing options', () => {
        const anim = createRotationAnimation(45, 135, 1.5, {
          repeatCount: '3',
          fill: 'freeze'
        });

        expect(anim.from).toBe('45');
        expect(anim.to).toBe('135');
        expect(anim.dur).toBe('1.5s');
        expect(anim.repeatCount).toBe('3');
        expect(anim.fill).toBe('freeze');
      });
    });

    describe('createOpacityAnimation', () => {
      it('should create opacity animation with specified parameters', () => {
        const anim = createOpacityAnimation(0, 1, 0.5);

        expect(anim.type).toBe('animate');
        expect(anim.attributeName).toBe('opacity');
        expect(anim.from).toBe('0');
        expect(anim.to).toBe('1');
        expect(anim.dur).toBe('0.5s');
      });

      it('should allow custom timing options', () => {
        const anim = createOpacityAnimation(1, 0.3, 2, {
          fill: 'freeze',
          calcMode: 'spline',
          keySplines: '0.42 0 0.58 1'
        });

        expect(anim.calcMode).toBe('spline');
        expect(anim.keySplines).toBe('0.42 0 0.58 1');
        expect(anim.fill).toBe('freeze');
      });
    });

    describe('createMotionAnimation', () => {
      it('should create motion animation with specified parameters', () => {
        const anim = createMotionAnimation('M 0 0 L 100 0', 3);

        expect(anim.type).toBe('animateMotion');
        expect(anim.path).toBe('M 0 0 L 100 0');
        expect(anim.dur).toBe('3s');
        expect(anim.repeatCount).toBe('indefinite');
        expect(anim.rotate).toBe('auto');
      });

      it('should allow custom rotate option', () => {
        const anim = createMotionAnimation('M 0 0 Q 50 50 100 0', 2, {
          rotate: 90
        });

        expect(anim.rotate).toBe(90);
      });

      it('should allow auto-reverse rotation', () => {
        const anim = createMotionAnimation('M 0 0 L 100 100', 1, {
          rotate: 'auto-reverse'
        });

        expect(anim.rotate).toBe('auto-reverse');
      });
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('Utility Functions', () => {
    describe('getPresetKeys', () => {
      it('should return all preset keys', () => {
        const keys = getPresetKeys();

        expect(keys.length).toBeGreaterThan(0);
        expect(keys).toContain('spin');
        expect(keys).toContain('pulse');
        expect(keys).toContain('flow');
      });
    });

    describe('getPresetsGrouped', () => {
      it('should return presets grouped by category', () => {
        const grouped = getPresetsGrouped();

        expect(grouped['Rotation']).toBeDefined();
        expect(grouped['Opacity']).toBeDefined();
        expect(grouped['Scale']).toBeDefined();
        expect(grouped['Movement']).toBeDefined();
        expect(grouped['Flow']).toBeDefined();
      });

      it('should have correct structure in grouped presets', () => {
        const grouped = getPresetsGrouped();

        for (const [, presets] of Object.entries(grouped)) {
          expect(Array.isArray(presets)).toBe(true);
          for (const preset of presets) {
            expect(preset.key).toBeTruthy();
            expect(preset.name).toBeTruthy();
            expect(preset.description).toBeTruthy();
          }
        }
      });

      it('should include spin presets in Rotation category', () => {
        const grouped = getPresetsGrouped();
        const rotationKeys = grouped['Rotation'].map(p => p.key);

        expect(rotationKeys).toContain('spin');
        expect(rotationKeys).toContain('spin-fast');
        expect(rotationKeys).toContain('spin-reverse');
      });
    });

    describe('parseDuration', () => {
      it('should parse seconds correctly', () => {
        expect(parseDuration('1s')).toBe(1000);
        expect(parseDuration('2.5s')).toBe(2500);
        expect(parseDuration('0.5s')).toBe(500);
      });

      it('should parse milliseconds correctly', () => {
        expect(parseDuration('500ms')).toBe(500);
        expect(parseDuration('100ms')).toBe(100);
        expect(parseDuration('1500ms')).toBe(1500);
      });

      it('should default to seconds when no unit', () => {
        expect(parseDuration('2')).toBe(2000);
        expect(parseDuration('0.5')).toBe(500);
      });

      it('should return default for invalid format', () => {
        expect(parseDuration('invalid')).toBe(1000);
        expect(parseDuration('')).toBe(1000);
      });
    });

    describe('formatDuration', () => {
      it('should format milliseconds < 1000 as ms', () => {
        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(100)).toBe('100ms');
        expect(formatDuration(999)).toBe('999ms');
      });

      it('should format milliseconds >= 1000 as seconds', () => {
        expect(formatDuration(1000)).toBe('1s');
        expect(formatDuration(2500)).toBe('2.5s');
        expect(formatDuration(3000)).toBe('3s');
      });
    });
  });
});
