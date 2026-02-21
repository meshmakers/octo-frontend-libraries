import { TestBed } from '@angular/core/testing';
import { ExpressionEvaluatorService } from './expression-evaluator.service';

describe('ExpressionEvaluatorService', () => {
  let service: ExpressionEvaluatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExpressionEvaluatorService]
    });
    service = TestBed.inject(ExpressionEvaluatorService);
  });

  describe('evaluate', () => {
    describe('basic math operations', () => {
      it('should evaluate simple addition', () => {
        const result = service.evaluate('value + 10', { value: 5 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(15);
      });

      it('should evaluate subtraction', () => {
        const result = service.evaluate('value - 10', { value: 25 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(15);
      });

      it('should evaluate multiplication', () => {
        const result = service.evaluate('value * 3.6', { value: 100 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(360);
      });

      it('should evaluate division', () => {
        const result = service.evaluate('value / 2', { value: 100 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(50);
      });

      it('should evaluate modulo', () => {
        const result = service.evaluate('value % 3', { value: 10 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
      });

      it('should evaluate power', () => {
        const result = service.evaluate('value ^ 2', { value: 5 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(25);
      });
    });

    describe('comparison operations', () => {
      it('should evaluate greater than', () => {
        const result = service.evaluate('value > 50', { value: 75 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate less than', () => {
        const result = service.evaluate('value < 50', { value: 25 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate equality', () => {
        const result = service.evaluate('value == 50', { value: 50 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate inequality', () => {
        const result = service.evaluate('value != 50', { value: 25 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('ternary operator', () => {
      it('should return true value when condition is true', () => {
        const result = service.evaluate('value > 50 ? 1 : 0', { value: 75 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
      });

      it('should return false value when condition is false', () => {
        const result = service.evaluate('value > 50 ? 1 : 0', { value: 25 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should return string values in ternary', () => {
        const result = service.evaluate('value > 50 ? "#ff0000" : "#00ff00"', { value: 75 });
        expect(result.success).toBe(true);
        expect(result.value).toBe('#ff0000');
      });
    });

    describe('built-in math functions', () => {
      it('should evaluate sin', () => {
        const result = service.evaluate('sin(value)', { value: 0 });
        expect(result.success).toBe(true);
        expect(result.value).toBeCloseTo(0);
      });

      it('should evaluate cos', () => {
        const result = service.evaluate('cos(value)', { value: 0 });
        expect(result.success).toBe(true);
        expect(result.value).toBeCloseTo(1);
      });

      it('should evaluate abs', () => {
        const result = service.evaluate('abs(value)', { value: -50 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(50);
      });

      it('should evaluate min', () => {
        const result = service.evaluate('min(value, 100)', { value: 150 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(100);
      });

      it('should evaluate max', () => {
        const result = service.evaluate('max(value, 0)', { value: -50 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should evaluate round', () => {
        const result = service.evaluate('round(value)', { value: 3.7 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(4);
      });

      it('should evaluate floor', () => {
        const result = service.evaluate('floor(value)', { value: 3.7 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(3);
      });

      it('should evaluate ceil', () => {
        const result = service.evaluate('ceil(value)', { value: 3.2 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(4);
      });

      it('should evaluate sqrt', () => {
        const result = service.evaluate('sqrt(value)', { value: 16 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(4);
      });
    });

    describe('custom functions', () => {
      describe('lerp', () => {
        it('should interpolate at start', () => {
          const result = service.evaluate('lerp(value, 0, 100, 0, 360)', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should interpolate at end', () => {
          const result = service.evaluate('lerp(value, 0, 100, 0, 360)', { value: 100 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(360);
        });

        it('should interpolate at midpoint', () => {
          const result = service.evaluate('lerp(value, 0, 100, 0, 360)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(180);
        });

        it('should extrapolate beyond range', () => {
          const result = service.evaluate('lerp(value, 0, 100, 0, 360)', { value: 150 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(540);
        });

        it('should handle equal input range', () => {
          const result = service.evaluate('lerp(value, 50, 50, 0, 100)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });
      });

      describe('clamp', () => {
        it('should clamp value below min', () => {
          const result = service.evaluate('clamp(value, 0, 100)', { value: -50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should clamp value above max', () => {
          const result = service.evaluate('clamp(value, 0, 100)', { value: 150 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(100);
        });

        it('should not clamp value within range', () => {
          const result = service.evaluate('clamp(value, 0, 100)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(50);
        });
      });

      describe('ifelse', () => {
        it('should return true value when condition is truthy', () => {
          const result = service.evaluate('ifelse(value > 50, 100, 0)', { value: 75 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(100);
        });

        it('should return false value when condition is falsy', () => {
          const result = service.evaluate('ifelse(value > 50, 100, 0)', { value: 25 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });
      });

      describe('toRadians', () => {
        it('should convert 0 degrees to 0 radians', () => {
          const result = service.evaluate('toRadians(value)', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should convert 180 degrees to PI radians', () => {
          const result = service.evaluate('toRadians(value)', { value: 180 });
          expect(result.success).toBe(true);
          expect(result.value).toBeCloseTo(Math.PI);
        });

        it('should convert 360 degrees to 2*PI radians', () => {
          const result = service.evaluate('toRadians(value)', { value: 360 });
          expect(result.success).toBe(true);
          expect(result.value).toBeCloseTo(2 * Math.PI);
        });
      });

      describe('toDegrees', () => {
        it('should convert 0 radians to 0 degrees', () => {
          const result = service.evaluate('toDegrees(value)', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should convert PI radians to 180 degrees', () => {
          const result = service.evaluate('toDegrees(value)', { value: Math.PI });
          expect(result.success).toBe(true);
          expect(result.value).toBeCloseTo(180);
        });
      });

      describe('normalize', () => {
        it('should normalize to 0 at min', () => {
          const result = service.evaluate('normalize(value, 0, 100)', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should normalize to 1 at max', () => {
          const result = service.evaluate('normalize(value, 0, 100)', { value: 100 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(1);
        });

        it('should normalize to 0.5 at midpoint', () => {
          const result = service.evaluate('normalize(value, 0, 100)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0.5);
        });

        it('should handle equal min/max', () => {
          const result = service.evaluate('normalize(value, 50, 50)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });
      });

      describe('step', () => {
        it('should return 0 when value is below threshold', () => {
          const result = service.evaluate('step(value, 50)', { value: 25 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should return 1 when value equals threshold', () => {
          const result = service.evaluate('step(value, 50)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(1);
        });

        it('should return 1 when value is above threshold', () => {
          const result = service.evaluate('step(value, 50)', { value: 75 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(1);
        });
      });

      describe('smoothstep', () => {
        it('should return 0 at edge0', () => {
          const result = service.evaluate('smoothstep(value, 0, 100)', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should return 1 at edge1', () => {
          const result = service.evaluate('smoothstep(value, 0, 100)', { value: 100 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(1);
        });

        it('should return 0.5 at midpoint', () => {
          const result = service.evaluate('smoothstep(value, 0, 100)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0.5);
        });

        it('should clamp below edge0', () => {
          const result = service.evaluate('smoothstep(value, 0, 100)', { value: -50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(0);
        });

        it('should clamp above edge1', () => {
          const result = service.evaluate('smoothstep(value, 0, 100)', { value: 150 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(1);
        });
      });

      describe('lerpColor', () => {
        it('should return colorA at start', () => {
          const result = service.evaluate('lerpColor(value, 0, 100, "#ff0000", "#00ff00")', { value: 0 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#ff0000');
        });

        it('should return colorB at end', () => {
          const result = service.evaluate('lerpColor(value, 0, 100, "#ff0000", "#00ff00")', { value: 100 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#00ff00');
        });

        it('should interpolate colors at midpoint', () => {
          const result = service.evaluate('lerpColor(value, 0, 100, "#ff0000", "#00ff00")', { value: 50 });
          expect(result.success).toBe(true);
          // Midpoint between #ff0000 and #00ff00 should be around #808000 (yellow-ish)
          // Math.round(127.5) = 128 = 0x80
          expect(result.value).toBe('#808000');
        });

        it('should handle equal input range', () => {
          const result = service.evaluate('lerpColor(value, 50, 50, "#ff0000", "#00ff00")', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#ff0000');
        });
      });

      describe('colorStops', () => {
        it('should return first color below first stop', () => {
          const result = service.evaluate('colorStops(value, 0, "#ff0000", 50, "#ffff00", 100, "#00ff00")', { value: -10 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#ff0000');
        });

        it('should return last color above last stop', () => {
          const result = service.evaluate('colorStops(value, 0, "#ff0000", 50, "#ffff00", 100, "#00ff00")', { value: 150 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#00ff00');
        });

        it('should return exact color at stop', () => {
          const result = service.evaluate('colorStops(value, 0, "#ff0000", 50, "#ffff00", 100, "#00ff00")', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe('#ffff00');
        });

        it('should interpolate between stops', () => {
          const result = service.evaluate('colorStops(value, 0, "#000000", 100, "#ffffff")', { value: 50 });
          expect(result.success).toBe(true);
          // Math.round(127.5) = 128 = 0x80
          expect(result.value).toBe('#808080');
        });
      });

      describe('map (alias for lerp)', () => {
        it('should work like lerp', () => {
          const result = service.evaluate('map(value, 0, 100, 0, 360)', { value: 50 });
          expect(result.success).toBe(true);
          expect(result.value).toBe(180);
        });
      });
    });

    describe('multiple context variables', () => {
      it('should access multiple variables', () => {
        const result = service.evaluate('value + threshold', { value: 50, threshold: 25 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(75);
      });

      it('should use variables in conditions', () => {
        const result = service.evaluate('value > threshold ? 1 : 0', { value: 75, threshold: 50 });
        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
      });
    });

    describe('error handling', () => {
      it('should return error for invalid expression', () => {
        const result = service.evaluate('invalid syntax +++', { value: 50 });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error for undefined variable', () => {
        const result = service.evaluate('undefinedVar + 10', { value: 50 });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validate', () => {
    it('should validate correct expression', () => {
      const result = service.validate('value * 2 + 10');
      expect(result.valid).toBe(true);
      expect(result.expression).toBeDefined();
    });

    it('should invalidate incorrect expression', () => {
      const result = service.validate('value ** invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('evaluateOrThrow', () => {
    it('should return value for valid expression', () => {
      const result = service.evaluateOrThrow('value * 2', { value: 25 });
      expect(result).toBe(50);
    });

    it('should throw for invalid expression', () => {
      expect(() => {
        service.evaluateOrThrow('invalid +++', { value: 50 });
      }).toThrow();
    });
  });

  describe('evaluateWithDefault', () => {
    it('should return evaluated value for valid expression', () => {
      const result = service.evaluateWithDefault('value * 2', { value: 25 }, 0);
      expect(result).toBe(50);
    });

    it('should return default value for invalid expression', () => {
      const result = service.evaluateWithDefault('invalid +++', { value: 50 }, 42);
      expect(result).toBe(42);
    });
  });

  describe('getVariables', () => {
    it('should return variables in expression', () => {
      const vars = service.getVariables('value * threshold + offset');
      expect(vars).toContain('value');
      expect(vars).toContain('threshold');
      expect(vars).toContain('offset');
    });

    it('should return empty array for constant expression', () => {
      const vars = service.getVariables('10 + 20');
      expect(vars.length).toBe(0);
    });

    it('should return empty array for invalid expression', () => {
      const vars = service.getVariables('invalid +++');
      expect(vars.length).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear expression cache', () => {
      // First evaluation caches the expression
      service.evaluate('value * 2', { value: 25 });

      // Clear cache
      service.clearCache();

      // This should work without issues after cache clear
      const result = service.evaluate('value * 2', { value: 25 });
      expect(result.success).toBe(true);
      expect(result.value).toBe(50);
    });
  });
});
