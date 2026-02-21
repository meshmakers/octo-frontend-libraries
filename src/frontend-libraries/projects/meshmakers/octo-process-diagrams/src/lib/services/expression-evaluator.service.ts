/**
 * Expression Evaluator Service
 *
 * Provides safe expression evaluation using the expr-eval library.
 * Supports math operations, conditionals, and custom helper functions
 * for transform property bindings.
 */

import { Injectable } from '@angular/core';
import { Parser, Expression } from 'expr-eval';

// ============================================================================
// Types
// ============================================================================

/**
 * Context variables for expression evaluation.
 * All values should be primitive types (number, string, boolean) for expr-eval compatibility.
 */
export type ExpressionContext = Record<string, number | string | boolean>;

/**
 * Result of expression evaluation
 */
export interface ExpressionResult {
  /** Whether evaluation succeeded */
  success: boolean;
  /** Computed value (if success) */
  value?: unknown;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Result of expression validation
 */
export interface ValidationResult {
  /** Whether the expression is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Parsed expression (if valid) */
  expression?: Expression;
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Parse a hex color string to RGB components
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    // Try short form (#rgb)
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16),
        g: parseInt(shortResult[2] + shortResult[2], 16),
        b: parseInt(shortResult[3] + shortResult[3], 16)
      };
    }
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * Convert RGB components to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const clamped = Math.round(Math.max(0, Math.min(255, c)));
    const hex = clamped.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Interpolate between two hex colors
 */
function interpolateHexColors(colorA: string, colorB: string, t: number): string {
  const a = parseHexColor(colorA);
  const b = parseHexColor(colorB);

  if (!a || !b) {
    return t < 0.5 ? colorA : colorB;
  }

  const clampedT = Math.max(0, Math.min(1, t));
  const r = a.r + (b.r - a.r) * clampedT;
  const g = a.g + (b.g - a.g) * clampedT;
  const bl = a.b + (b.b - a.b) * clampedT;

  return rgbToHex(r, g, bl);
}

// ============================================================================
// Expression Evaluator Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class ExpressionEvaluatorService {
  private parser: Parser;
  private expressionCache = new Map<string, Expression>();

  constructor() {
    this.parser = new Parser();
    this.registerCustomFunctions();
  }

  /**
   * Register custom helper functions for expressions
   */
  private registerCustomFunctions(): void {
    // Linear interpolation between numbers
    // lerp(value, inMin, inMax, outMin, outMax)
    this.parser.functions['lerp'] = (
      value: number,
      inMin: number,
      inMax: number,
      outMin: number,
      outMax: number
    ): number => {
      if (inMax === inMin) return outMin;
      const t = (value - inMin) / (inMax - inMin);
      return outMin + (outMax - outMin) * t;
    };

    // Color interpolation
    // lerpColor(value, inMin, inMax, colorA, colorB)
    this.parser.functions['lerpColor'] = (
      value: number,
      inMin: number,
      inMax: number,
      colorA: string,
      colorB: string
    ): string => {
      if (inMax === inMin) return colorA;
      const t = (value - inMin) / (inMax - inMin);
      return interpolateHexColors(colorA, colorB, t);
    };

    // Multi-stop color gradient
    // colorStops(value, stop1Value, stop1Color, stop2Value, stop2Color, ...)
    // Note: expr-eval doesn't support array literals, so we use variadic arguments
    this.parser.functions['colorStops'] = (...args: unknown[]): string => {
      if (args.length < 5 || (args.length - 1) % 2 !== 0) {
        return '#000000';
      }

      const value = args[0] as number;
      const stops: { value: number; color: string }[] = [];

      for (let i = 1; i < args.length; i += 2) {
        stops.push({
          value: args[i] as number,
          color: args[i + 1] as string
        });
      }

      // Sort stops by value
      stops.sort((a, b) => a.value - b.value);

      // Find the two stops to interpolate between
      if (value <= stops[0].value) {
        return stops[0].color;
      }
      if (value >= stops[stops.length - 1].value) {
        return stops[stops.length - 1].color;
      }

      for (let i = 0; i < stops.length - 1; i++) {
        if (value >= stops[i].value && value <= stops[i + 1].value) {
          const t = (value - stops[i].value) / (stops[i + 1].value - stops[i].value);
          return interpolateHexColors(stops[i].color, stops[i + 1].color, t);
        }
      }

      return stops[stops.length - 1].color;
    };

    // Clamp value to range
    // clamp(value, min, max)
    this.parser.functions['clamp'] = (value: number, min: number, max: number): number => {
      return Math.min(Math.max(value, min), max);
    };

    // Map value from one range to another (alias for lerp)
    // map(value, inMin, inMax, outMin, outMax)
    this.parser.functions['map'] = this.parser.functions['lerp'];

    // Conditional (ternary alternative for complex conditions)
    // ifelse(condition, trueValue, falseValue)
    this.parser.functions['ifelse'] = (
      condition: boolean | number,
      trueValue: unknown,
      falseValue: unknown
    ): unknown => {
      return condition ? trueValue : falseValue;
    };

    // Degrees to radians
    this.parser.functions['toRadians'] = (degrees: number): number => {
      return degrees * (Math.PI / 180);
    };

    // Radians to degrees
    this.parser.functions['toDegrees'] = (radians: number): number => {
      return radians * (180 / Math.PI);
    };

    // Normalize value to 0-1 range
    this.parser.functions['normalize'] = (value: number, min: number, max: number): number => {
      if (max === min) return 0;
      return (value - min) / (max - min);
    };

    // Step function (returns 1 if value >= threshold, 0 otherwise)
    this.parser.functions['step'] = (value: number, threshold: number): number => {
      return value >= threshold ? 1 : 0;
    };

    // Smoothstep function (smooth transition between 0 and 1)
    this.parser.functions['smoothstep'] = (value: number, edge0: number, edge1: number): number => {
      const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };
  }

  /**
   * Parse and cache an expression
   */
  private getExpression(expressionString: string): Expression {
    let expr = this.expressionCache.get(expressionString);
    if (!expr) {
      expr = this.parser.parse(expressionString);
      this.expressionCache.set(expressionString, expr);
    }
    return expr;
  }

  /**
   * Validate an expression without evaluating it
   */
  validate(expressionString: string): ValidationResult {
    try {
      const expr = this.parser.parse(expressionString);
      return { valid: true, expression: expr };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Invalid expression'
      };
    }
  }

  /**
   * Evaluate an expression with the given context
   *
   * @param expressionString The expression to evaluate
   * @param context Variables available in the expression
   * @returns Evaluation result with success/failure and value/error
   *
   * @example
   * ```typescript
   * // Simple math
   * evaluate('value * 3.6', { value: 50 }) // { success: true, value: 180 }
   *
   * // Conditional
   * evaluate('value > 50 ? 1 : 0', { value: 75 }) // { success: true, value: 1 }
   *
   * // Color interpolation
   * evaluate('lerpColor(value, 0, 100, "#00ff00", "#ff0000")', { value: 50 })
   * // { success: true, value: '#7f7f00' }
   *
   * // Using other properties
   * evaluate('value < threshold ? "#ff0000" : "#00ff00"', { value: 30, threshold: 50 })
   * // { success: true, value: '#ff0000' }
   * ```
   */
  evaluate(expressionString: string, context: ExpressionContext): ExpressionResult {
    try {
      const expr = this.getExpression(expressionString);
      // Type assertion needed due to expr-eval's strict type definition
      const value = expr.evaluate(context as unknown as Parameters<typeof expr.evaluate>[0]);
      return { success: true, value };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Evaluation failed'
      };
    }
  }

  /**
   * Evaluate an expression and return the value directly (throws on error)
   *
   * @throws Error if expression is invalid or evaluation fails
   */
  evaluateOrThrow(expressionString: string, context: ExpressionContext): unknown {
    const result = this.evaluate(expressionString, context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.value;
  }

  /**
   * Evaluate an expression with a fallback value on error
   */
  evaluateWithDefault<T>(expressionString: string, context: ExpressionContext, defaultValue: T): T {
    const result = this.evaluate(expressionString, context);
    if (!result.success) {
      return defaultValue;
    }
    return result.value as T;
  }

  /**
   * Get the variables used in an expression
   */
  getVariables(expressionString: string): string[] {
    try {
      const expr = this.parser.parse(expressionString);
      return expr.variables();
    } catch {
      return [];
    }
  }

  /**
   * Clear the expression cache
   */
  clearCache(): void {
    this.expressionCache.clear();
  }
}
