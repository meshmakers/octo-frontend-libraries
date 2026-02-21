/**
 * Animation Renderer - Unit Tests
 */

import {
  renderAnimations,
  renderAnimation,
  AnimationRenderContext,
  generateAnimationControlScript,
  getAnimationElementSelector
} from './animation.renderer';
import {
  AnimationDefinition,
  createAnimationDefinition
} from '../models/animation.models';

describe('Animation Renderer', () => {
  // Default bounds for testing
  const defaultBounds = { x: 0, y: 0, width: 100, height: 100 };

  // Default context
  const defaultContext: AnimationRenderContext = {
    bounds: defaultBounds
  };

  // ============================================================================
  // renderAnimations
  // ============================================================================

  describe('renderAnimations', () => {
    it('should return empty string for undefined animations', () => {
      const result = renderAnimations(undefined, defaultContext);
      expect(result).toBe('');
    });

    it('should return empty string for empty animations array', () => {
      const result = renderAnimations([], defaultContext);
      expect(result).toBe('');
    });

    it('should render single animation', () => {
      const animations: AnimationDefinition[] = [
        createAnimationDefinition('anim-1', {
          type: 'animate',
          attributeName: 'opacity',
          from: '0',
          to: '1',
          dur: '1s'
        })
      ];

      const result = renderAnimations(animations, defaultContext);

      expect(result).toContain('<animate');
      expect(result).toContain('attributeName="opacity"');
      expect(result).toContain('from="0"');
      expect(result).toContain('to="1"');
      expect(result).toContain('dur="1s"');
    });

    it('should render multiple animations', () => {
      const animations: AnimationDefinition[] = [
        createAnimationDefinition('anim-1', {
          type: 'animate',
          attributeName: 'opacity',
          from: '0',
          to: '1',
          dur: '1s'
        }),
        createAnimationDefinition('anim-2', {
          type: 'animateTransform',
          transformType: 'rotate',
          from: '0',
          to: '360',
          dur: '2s'
        })
      ];

      const result = renderAnimations(animations, defaultContext);

      expect(result).toContain('<animate');
      expect(result).toContain('<animateTransform');
    });
  });

  // ============================================================================
  // Attribute Animation Rendering
  // ============================================================================

  describe('Attribute Animation Rendering', () => {
    it('should render basic attribute animation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'fill',
        from: '#000000',
        to: '#ffffff',
        dur: '1s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('<animate');
      expect(result).toContain('id="test"');
      expect(result).toContain('attributeName="fill"');
      expect(result).toContain('from="#000000"');
      expect(result).toContain('to="#ffffff"');
    });

    it('should render animation with values instead of from/to', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0.5;1',
        dur: '1.5s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('values="1;0.5;1"');
      expect(result).not.toContain('from=');
      expect(result).not.toContain('to=');
    });

    it('should render animation with repeat count', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        from: '1',
        to: '0',
        dur: '0.5s',
        repeatCount: 'indefinite'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('repeatCount="indefinite"');
    });

    it('should render animation with fill mode', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        from: '1',
        to: '0',
        dur: '1s',
        fill: 'freeze'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('fill="freeze"');
    });

    it('should render animation with easing', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '0;1',
        dur: '1s',
        calcMode: 'spline',
        keySplines: '0.42 0 0.58 1',
        keyTimes: '0;1'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('calcMode="spline"');
      expect(result).toContain('keySplines="0.42 0 0.58 1"');
      expect(result).toContain('keyTimes="0;1"');
    });
  });

  // ============================================================================
  // Transform Animation Rendering
  // ============================================================================

  describe('Transform Animation Rendering', () => {
    it('should render rotation animation with center pivot', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '360',
        dur: '2s'
      }, { anchor: 'center' });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('<animateTransform');
      expect(result).toContain('attributeName="transform"');
      expect(result).toContain('type="rotate"');
      // Center pivot for 100x100 element at 0,0 should be 50,50
      expect(result).toContain('from="0 50 50"');
      expect(result).toContain('to="360 50 50"');
    });

    it('should render rotation animation with top-left pivot', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '180',
        dur: '1s'
      }, { anchor: 'top-left' });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('from="0 0 0"');
      expect(result).toContain('to="180 0 0"');
    });

    it('should render rotation animation with bottom-right pivot', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '90',
        dur: '1s'
      }, { anchor: 'bottom-right' });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('from="0 100 100"');
      expect(result).toContain('to="90 100 100"');
    });

    it('should render rotation animation with custom pivot', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '360',
        dur: '2s'
      }, {
        anchor: 'custom',
        customAnchor: { x: 0.25, y: 0.75 } // 25% from left, 75% from top
      });

      const result = renderAnimation(def, defaultContext);

      // For 100x100 element: 0.25 * 100 = 25, 0.75 * 100 = 75
      expect(result).toContain('from="0 25 75"');
      expect(result).toContain('to="360 25 75"');
    });

    it('should render rotation animation with keyframe values', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        values: '0;180;360',
        dur: '3s'
      }, { anchor: 'center' });

      const result = renderAnimation(def, defaultContext);

      // Each value should have pivot appended
      expect(result).toContain('values="0 50 50;180 50 50;360 50 50"');
    });

    it('should render scale animation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'scale',
        values: '1;1.2;1',
        dur: '1s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('type="scale"');
      expect(result).toContain('values="1;1.2;1"');
    });

    it('should render translate animation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'translate',
        values: '0,0;10,0;-10,0;0,0',
        dur: '0.5s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('type="translate"');
      expect(result).toContain('values="0,0;10,0;-10,0;0,0"');
    });

    it('should render animation with additive mode', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '360',
        dur: '2s',
        additive: 'sum'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('additive="sum"');
    });
  });

  // ============================================================================
  // Motion Animation Rendering
  // ============================================================================

  describe('Motion Animation Rendering', () => {
    it('should render motion animation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateMotion',
        path: 'M 0 0 L 100 100',
        dur: '2s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('<animateMotion');
      expect(result).toContain('path="M 0 0 L 100 100"');
      expect(result).toContain('dur="2s"');
    });

    it('should render motion animation with auto rotation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateMotion',
        path: 'M 0 0 Q 50 50 100 0',
        dur: '1s',
        rotate: 'auto'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('rotate="auto"');
    });

    it('should render motion animation with numeric rotation', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateMotion',
        path: 'M 0 0 L 100 0',
        dur: '1s',
        rotate: 45
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('rotate="45"');
    });
  });

  // ============================================================================
  // Property-based Enable/Disable
  // ============================================================================

  describe('Property-based Enable/Disable', () => {
    it('should enable animation when no property binding', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0.5;1',
        dur: '1s'
      });

      const result = renderAnimation(def, defaultContext);

      // Should start at 0s (default)
      expect(result).toContain('begin="0s"');
    });

    it('should disable animation when property is falsy', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0;1',
        dur: '0.5s'
      }, {
        enabledByProperty: 'isRunning'
      });

      const context: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { isRunning: false }
      };

      const result = renderAnimation(def, context);

      expect(result).toContain('begin="indefinite"');
    });

    it('should enable animation when property is truthy', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0;1',
        dur: '0.5s'
      }, {
        enabledByProperty: 'isRunning'
      });

      const context: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { isRunning: true }
      };

      const result = renderAnimation(def, context);

      expect(result).toContain('begin="0s"');
    });

    it('should check boolean condition correctly', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0;1',
        dur: '0.5s'
      }, {
        enabledByProperty: 'alarmActive',
        enableCondition: true
      });

      // When property is true and condition is true
      const context1: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { alarmActive: true }
      };
      expect(renderAnimation(def, context1)).toContain('begin="0s"');

      // When property is false and condition is true
      const context2: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { alarmActive: false }
      };
      expect(renderAnimation(def, context2)).toContain('begin="indefinite"');
    });

    it('should disable animation when animations globally disabled', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0;1',
        dur: '0.5s'
      }, {
        enabledByProperty: 'isRunning'
      });

      const context: AnimationRenderContext = {
        bounds: defaultBounds,
        animationsEnabled: false,
        propertyValues: { isRunning: true }
      };

      const result = renderAnimation(def, context);

      expect(result).toContain('begin="indefinite"');
    });

    it('should evaluate greater-than condition', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'opacity',
        values: '1;0.5;1',
        dur: '1s'
      }, {
        enabledByProperty: 'speed',
        enableCondition: '> 50'
      });

      // Speed > 50 should enable
      const context1: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { speed: 75 }
      };
      expect(renderAnimation(def, context1)).toContain('begin="0s"');

      // Speed <= 50 should disable
      const context2: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { speed: 50 }
      };
      expect(renderAnimation(def, context2)).toContain('begin="indefinite"');
    });

    it('should evaluate less-than condition', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'fill',
        from: '#00ff00',
        to: '#ff0000',
        dur: '0.5s'
      }, {
        enabledByProperty: 'level',
        enableCondition: '< 20'
      });

      // Level < 20 should enable
      const context1: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { level: 15 }
      };
      expect(renderAnimation(def, context1)).toContain('begin="0s"');

      // Level >= 20 should disable
      const context2: AnimationRenderContext = {
        bounds: defaultBounds,
        propertyValues: { level: 25 }
      };
      expect(renderAnimation(def, context2)).toContain('begin="indefinite"');
    });
  });

  // ============================================================================
  // XML Escaping
  // ============================================================================

  describe('XML Escaping', () => {
    it('should escape special XML characters in values', () => {
      const def = createAnimationDefinition('test', {
        type: 'animate',
        attributeName: 'data-info',
        from: '<start>',
        to: '&end>',
        dur: '1s'
      });

      const result = renderAnimation(def, defaultContext);

      expect(result).toContain('&lt;start&gt;');
      expect(result).toContain('&amp;end&gt;');
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('Utility Functions', () => {
    describe('generateAnimationControlScript', () => {
      it('should generate start script', () => {
        const script = generateAnimationControlScript('my-animation', true);
        expect(script).toBe("document.getElementById('my-animation')?.beginElement()");
      });

      it('should generate stop script', () => {
        const script = generateAnimationControlScript('my-animation', false);
        expect(script).toBe("document.getElementById('my-animation')?.endElement()");
      });
    });

    describe('getAnimationElementSelector', () => {
      it('should return correct CSS selector', () => {
        const selector = getAnimationElementSelector('anim-123');
        expect(selector).toBe('#anim-123');
      });
    });
  });

  // ============================================================================
  // Pivot Point Calculations
  // ============================================================================

  describe('Pivot Point Calculations', () => {
    it('should calculate center pivot correctly', () => {
      const def = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '360',
        dur: '1s'
      }, { anchor: 'center' });

      const context: AnimationRenderContext = {
        bounds: { x: 50, y: 100, width: 200, height: 100 }
      };

      const result = renderAnimation(def, context);

      // Center: x + width/2, y + height/2 = 50 + 100, 100 + 50 = 150, 150
      expect(result).toContain('from="0 150 150"');
    });

    it('should calculate corner pivots correctly', () => {
      const bounds = { x: 20, y: 30, width: 80, height: 60 };

      // Test top-left
      const defTL = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '90',
        dur: '1s'
      }, { anchor: 'top-left' });

      const resultTL = renderAnimation(defTL, { bounds });
      expect(resultTL).toContain('from="0 20 30"');

      // Test bottom-right
      const defBR = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '90',
        dur: '1s'
      }, { anchor: 'bottom-right' });

      const resultBR = renderAnimation(defBR, { bounds });
      expect(resultBR).toContain('from="0 100 90"'); // 20+80, 30+60
    });

    it('should calculate edge pivots correctly', () => {
      const bounds = { x: 0, y: 0, width: 100, height: 50 };

      // Test top
      const defTop = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '180',
        dur: '1s'
      }, { anchor: 'top' });

      const resultTop = renderAnimation(defTop, { bounds });
      expect(resultTop).toContain('from="0 50 0"'); // x + width/2, y

      // Test left
      const defLeft = createAnimationDefinition('test', {
        type: 'animateTransform',
        transformType: 'rotate',
        from: '0',
        to: '180',
        dur: '1s'
      }, { anchor: 'left' });

      const resultLeft = renderAnimation(defLeft, { bounds });
      expect(resultLeft).toContain('from="0 0 25"'); // x, y + height/2
    });
  });
});
