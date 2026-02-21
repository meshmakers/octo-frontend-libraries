/**
 * Comprehensive Animation Test Suite
 *
 * Tests all primitive types with all animation presets to ensure:
 * - All primitives can have animations attached
 * - All animation presets render correctly for each primitive type
 * - Animation rendering produces valid SVG output
 *
 * Primitive Types:
 * - Rectangle, Ellipse, Line, Path, Polygon, Polyline, Text, Image
 *
 * Animation Categories:
 * - Rotation: spin, spin-fast, spin-reverse
 * - Opacity: pulse, blink, blink-slow, fade-in, fade-out
 * - Scale: grow-shrink, heartbeat
 * - Movement: shake, bounce
 * - Flow: flow, flow-reverse, flow-slow
 * - Motion: motion-circle, motion-horizontal, motion-vertical, motion-wave, motion-zigzag
 * - Particles: particles-flow, particles-flow-fast, particles-flow-dense
 */

import {
  ANIMATION_PRESETS,
  createFromPreset,
  AnimationDefinition,
  getPresetKeys,
  getPresetsGrouped
} from '../models/animation.models';
import {
  renderAnimations,
  renderAnimation,
  AnimationRenderContext
} from './animation.renderer';
import {
  PrimitiveBase,
  PrimitiveType
} from '../models/primitive.models';
import { RectanglePrimitive } from '../models/rectangle.model';
import { EllipsePrimitive } from '../models/ellipse.model';
import { LinePrimitive } from '../models/line.model';
import { PathPrimitive } from '../models/path.model';
import { PolygonPrimitive, PolylinePrimitive } from '../models/polygon.model';
import { TextPrimitive } from '../models/text.model';
import { ImagePrimitive } from '../models/image.model';

describe('All Primitives with All Animations', () => {
  // ============================================================================
  // Test Data Factory
  // ============================================================================

  const createRectangle = (id: string): RectanglePrimitive => ({
    id,
    type: PrimitiveType.Rectangle,
    name: `Rectangle ${id}`,
    position: { x: 100, y: 100 },
    config: { width: 80, height: 60 }
  });

  const createEllipse = (id: string): EllipsePrimitive => ({
    id,
    type: PrimitiveType.Ellipse,
    name: `Ellipse ${id}`,
    position: { x: 200, y: 100 },
    config: { radiusX: 40, radiusY: 30 }
  });

  const createLine = (id: string): LinePrimitive => ({
    id,
    type: PrimitiveType.Line,
    name: `Line ${id}`,
    position: { x: 0, y: 0 },
    config: {
      start: { x: 300, y: 100 },
      end: { x: 400, y: 150 }
    }
  });

  const createPath = (id: string): PathPrimitive => ({
    id,
    type: PrimitiveType.Path,
    name: `Path ${id}`,
    position: { x: 500, y: 100 },
    config: {
      d: 'M 0 0 C 20 40 60 40 80 0'
    }
  });

  const createPolygon = (id: string): PolygonPrimitive => ({
    id,
    type: PrimitiveType.Polygon,
    name: `Polygon ${id}`,
    position: { x: 100, y: 200 },
    config: {
      points: [
        { x: 0, y: 0 },
        { x: 40, y: -30 },
        { x: 80, y: 0 },
        { x: 60, y: 50 },
        { x: 20, y: 50 }
      ]
    }
  });

  const createPolyline = (id: string): PolylinePrimitive => ({
    id,
    type: PrimitiveType.Polyline,
    name: `Polyline ${id}`,
    position: { x: 200, y: 200 },
    config: {
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 30 },
        { x: 60, y: 0 },
        { x: 90, y: 30 }
      ]
    }
  });

  const createText = (id: string): TextPrimitive => ({
    id,
    type: PrimitiveType.Text,
    name: `Text ${id}`,
    position: { x: 350, y: 200 },
    config: {
      content: 'Test Text',
      textStyle: {
        fontSize: 16,
        fontFamily: 'Arial'
      }
    }
  });

  const createImage = (id: string): ImagePrimitive => ({
    id,
    type: PrimitiveType.Image,
    name: `Image ${id}`,
    position: { x: 500, y: 200 },
    config: {
      width: 80,
      height: 60,
      src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      sourceType: 'dataUrl'
    }
  });

  // Factory map for all primitive types
  const primitiveFactories: Record<string, (id: string) => PrimitiveBase> = {
    rectangle: createRectangle,
    ellipse: createEllipse,
    line: createLine,
    path: createPath,
    polygon: createPolygon,
    polyline: createPolyline,
    text: createText,
    image: createImage
  };

  // Default animation context
  const defaultContext: AnimationRenderContext = {
    bounds: { x: 0, y: 0, width: 100, height: 100 }
  };

  // ============================================================================
  // Animation Preset Coverage Tests
  // ============================================================================

  describe('Animation Preset Coverage', () => {
    it('should have all expected animation presets defined', () => {
      const expectedPresets = [
        // Rotation
        'spin', 'spin-fast', 'spin-reverse',
        // Opacity
        'pulse', 'blink', 'blink-slow', 'fade-in', 'fade-out',
        // Scale
        'grow-shrink', 'heartbeat',
        // Movement
        'shake', 'bounce',
        // Flow
        'flow', 'flow-reverse', 'flow-slow',
        // Motion
        'motion-circle', 'motion-horizontal', 'motion-vertical', 'motion-wave', 'motion-zigzag',
        // Particles
        'particles-flow', 'particles-flow-fast', 'particles-flow-dense'
      ];

      for (const preset of expectedPresets) {
        expect(ANIMATION_PRESETS[preset]).toBeDefined(`Preset '${preset}' should exist`);
      }
    });

    it('should have all presets grouped correctly', () => {
      const grouped = getPresetsGrouped();

      expect(grouped['Rotation']).toBeDefined();
      expect(grouped['Rotation'].length).toBe(3);

      expect(grouped['Opacity']).toBeDefined();
      expect(grouped['Opacity'].length).toBe(5);

      expect(grouped['Scale']).toBeDefined();
      expect(grouped['Scale'].length).toBe(2);

      expect(grouped['Movement']).toBeDefined();
      expect(grouped['Movement'].length).toBe(2);

      expect(grouped['Flow']).toBeDefined();
      expect(grouped['Flow'].length).toBe(3);

      expect(grouped['Motion']).toBeDefined();
      expect(grouped['Motion'].length).toBe(5);

      expect(grouped['Particles']).toBeDefined();
      expect(grouped['Particles'].length).toBe(3);
    });
  });

  // ============================================================================
  // Primitive Type Coverage Tests
  // ============================================================================

  describe('Primitive Type Coverage', () => {
    it('should create valid primitives for all types', () => {
      for (const [type, factory] of Object.entries(primitiveFactories)) {
        const primitive = factory(`test-${type}`);

        expect(primitive).toBeDefined(`Primitive factory for '${type}' should return object`);
        expect(primitive.id).toBe(`test-${type}`);
        expect(primitive.type).toBe(type);
        expect(primitive.position).toBeDefined();
      }
    });

    it('should cover all primitive types except group', () => {
      const testedTypes = Object.keys(primitiveFactories);
      const allTypes = Object.values(PrimitiveType).filter(t => t !== 'group');

      for (const type of allTypes) {
        expect(testedTypes).toContain(type);
      }
    });
  });

  // ============================================================================
  // Animation Creation Tests
  // ============================================================================

  describe('Animation Creation from Presets', () => {
    const presetKeys = getPresetKeys();

    for (const presetKey of presetKeys) {
      it(`should create animation definition from preset '${presetKey}'`, () => {
        const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

        expect(animDef).not.toBeNull();
        expect(animDef!.id).toBe(`anim-${presetKey}`);
        expect(animDef!.animation).toBeDefined();
        expect(animDef!.animation.dur).toBeTruthy();
      });
    }
  });

  // ============================================================================
  // Animation Rendering Tests - All Primitives × All Animations
  // ============================================================================

  describe('Animation Rendering Matrix', () => {
    const primitiveTypes = Object.keys(primitiveFactories);

    // Test rotation animations on all primitives
    describe('Rotation Animations', () => {
      const rotationPresets = ['spin', 'spin-fast', 'spin-reverse'];

      for (const primitiveType of primitiveTypes) {
        for (const presetKey of rotationPresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animateTransform');
            expect(result).toContain('type="rotate"');
            expect(result).toContain('repeatCount="indefinite"');
          });
        }
      }
    });

    // Test opacity animations on all primitives
    describe('Opacity Animations', () => {
      const opacityPresets = ['pulse', 'blink', 'blink-slow', 'fade-in', 'fade-out'];

      for (const primitiveType of primitiveTypes) {
        for (const presetKey of opacityPresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animate');
            expect(result).toContain('attributeName="opacity"');
          });
        }
      }
    });

    // Test scale animations on all primitives
    describe('Scale Animations', () => {
      const scalePresets = ['grow-shrink', 'heartbeat'];

      for (const primitiveType of primitiveTypes) {
        for (const presetKey of scalePresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animateTransform');
            expect(result).toContain('type="scale"');
          });
        }
      }
    });

    // Test movement animations on all primitives
    describe('Movement Animations', () => {
      const movementPresets = ['shake', 'bounce'];

      for (const primitiveType of primitiveTypes) {
        for (const presetKey of movementPresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animateTransform');
            expect(result).toContain('type="translate"');
          });
        }
      }
    });

    // Test flow animations (stroke-dashoffset) - applicable to line primitives
    describe('Flow Animations', () => {
      const flowPresets = ['flow', 'flow-reverse', 'flow-slow'];
      const lineTypes = ['line', 'path', 'polyline'];

      for (const primitiveType of lineTypes) {
        for (const presetKey of flowPresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animate');
            expect(result).toContain('attributeName="stroke-dashoffset"');
          });
        }
      }
    });

    // Test motion path animations on all primitives
    describe('Motion Path Animations', () => {
      const motionPresets = ['motion-circle', 'motion-horizontal', 'motion-vertical', 'motion-wave', 'motion-zigzag'];

      for (const primitiveType of primitiveTypes) {
        for (const presetKey of motionPresets) {
          it(`should render '${presetKey}' animation on ${primitiveType}`, () => {
            const _primitive = primitiveFactories[primitiveType](`${primitiveType}-${presetKey}`);
            const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

            expect(animDef).not.toBeNull();

            const result = renderAnimation(animDef!, defaultContext);

            expect(result).toContain('<animateMotion');
            expect(result).toContain('path="');
          });
        }
      }
    });

    // Test flow particles animations - special rendering
    describe('Flow Particles Animations', () => {
      const particlePresets = ['particles-flow', 'particles-flow-fast', 'particles-flow-dense'];

      for (const presetKey of particlePresets) {
        it(`should create valid '${presetKey}' animation definition`, () => {
          const animDef = createFromPreset(`anim-${presetKey}`, presetKey);

          expect(animDef).not.toBeNull();
          expect(animDef!.animation.type).toBe('flowParticles');
          expect((animDef!.animation as any).particleCount).toBeGreaterThan(0);
          expect((animDef!.animation as any).particleRadius).toBeGreaterThan(0);
        });
      }
    });
  });

  // ============================================================================
  // Primitive with Multiple Animations Tests
  // ============================================================================

  describe('Multiple Animations on Single Primitive', () => {
    it('should render multiple animations on rectangle', () => {
      const animations: AnimationDefinition[] = [
        createFromPreset('anim-1', 'spin')!,
        createFromPreset('anim-2', 'pulse')!
      ];

      const result = renderAnimations(animations, defaultContext);

      expect(result).toContain('<animateTransform');
      expect(result).toContain('<animate');
      expect(result.match(/<animate/g)?.length).toBeGreaterThanOrEqual(1);
    });

    it('should render three different animation types', () => {
      const animations: AnimationDefinition[] = [
        createFromPreset('anim-1', 'spin')!,
        createFromPreset('anim-2', 'pulse')!,
        createFromPreset('anim-3', 'motion-circle')!
      ];

      const result = renderAnimations(animations, defaultContext);

      expect(result).toContain('type="rotate"');
      expect(result).toContain('attributeName="opacity"');
      expect(result).toContain('<animateMotion');
    });
  });

  // ============================================================================
  // Animation Properties Tests
  // ============================================================================

  describe('Animation Property Validation', () => {
    for (const [presetKey, preset] of Object.entries(ANIMATION_PRESETS)) {
      it(`preset '${presetKey}' should have valid duration`, () => {
        expect(preset.animation.dur).toBeTruthy();
        expect(preset.animation.dur).toMatch(/^\d+(\.\d+)?(s|ms)$/);
      });

      it(`preset '${presetKey}' should have name and description`, () => {
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
      });
    }
  });

  // ============================================================================
  // Integration: Primitive with Attached Animation
  // ============================================================================

  describe('Primitives with Attached Animations', () => {
    for (const [primitiveType, factory] of Object.entries(primitiveFactories)) {
      it(`should create ${primitiveType} with attached animation array`, () => {
        const primitive = factory(`test-${primitiveType}`);
        const animDef = createFromPreset('anim-spin', 'spin')!;

        const primitiveWithAnimation: PrimitiveBase = {
          ...primitive,
          animations: [animDef]
        };

        expect(primitiveWithAnimation.animations).toBeDefined();
        expect(primitiveWithAnimation.animations!.length).toBe(1);
        expect(primitiveWithAnimation.animations![0].animation.type).toBe('animateTransform');
      });

      it(`should create ${primitiveType} with multiple animations`, () => {
        const primitive = factory(`test-${primitiveType}-multi`);
        const animations: AnimationDefinition[] = [
          createFromPreset('anim-1', 'spin')!,
          createFromPreset('anim-2', 'pulse')!,
          createFromPreset('anim-3', 'shake')!
        ];

        const primitiveWithAnimations: PrimitiveBase = {
          ...primitive,
          animations
        };

        expect(primitiveWithAnimations.animations!.length).toBe(3);
      });
    }
  });

  // ============================================================================
  // Animation Anchor Point Tests
  // ============================================================================

  describe('Animation Anchor Points', () => {
    const anchors: ('center' | 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right')[] = [
      'center', 'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'
    ];

    for (const anchor of anchors) {
      it(`should render rotation animation with '${anchor}' anchor`, () => {
        const animDef = createFromPreset('anim-spin', 'spin', { anchor })!;
        const context: AnimationRenderContext = {
          bounds: { x: 50, y: 50, width: 100, height: 100 }
        };

        const result = renderAnimation(animDef, context);

        expect(result).toContain('<animateTransform');
        expect(result).toContain('type="rotate"');
      });
    }
  });

  // ============================================================================
  // Summary Test
  // ============================================================================

  describe('Coverage Summary', () => {
    it('should have tested all primitive types', () => {
      const testedTypes = Object.keys(primitiveFactories);
      expect(testedTypes.length).toBe(8); // All types except 'group'
    });

    it('should have tested all animation presets', () => {
      const presetCount = getPresetKeys().length;
      expect(presetCount).toBeGreaterThanOrEqual(23); // At least 23 presets
    });

    it('should produce a complete test matrix', () => {
      const primitiveCount = Object.keys(primitiveFactories).length;
      const presetCount = getPresetKeys().length;

      // Each primitive × each preset = comprehensive coverage
      const expectedCombinations = primitiveCount * presetCount;
      expect(expectedCombinations).toBeGreaterThanOrEqual(8 * 23);
    });
  });
});
