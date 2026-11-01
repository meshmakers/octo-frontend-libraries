/**
 * Text value formatter (AB#8022)
 *
 * Turns the value of a `text.value` property binding into the text a process
 * diagram shows: expression first, then the number in the board language with
 * a fixed number of decimals and the unit; "–" when there is no value.
 *
 * Pure functions without Angular or MeshBoard dependencies: the host (process
 * widget, designer, symbol editor) hands in the locale and the evaluator.
 */

import type { PropertyBinding, TextValueFormat, TransformProperty } from '../primitives/models/transform-property.models';
import type { ExpressionContext, ExpressionResult } from './expression-evaluator.service';

/** Locale used when the host has no language (same default as the MeshBoard widgets). */
export const TEXT_VALUE_DEFAULT_LOCALE = 'de-AT';

/** Text shown for a missing value when the binding does not configure one (en dash). */
export const TEXT_VALUE_DEFAULT_NO_VALUE = '–';

/** Highest number of decimals the editor offers. */
export const TEXT_VALUE_MAX_DECIMALS = 6;

/** Minimal evaluator contract, satisfied by `ExpressionEvaluatorService`. */
export interface TextValueExpressionEvaluator {
  evaluate(expression: string, context: ExpressionContext): ExpressionResult;
}

/** Options of {@link evaluateTextValue}. */
export interface TextValueEvaluationOptions {
  /** Evaluates the binding's expression. */
  evaluator: TextValueExpressionEvaluator;
  /** Culture code of the board language; `null`/`undefined`/invalid = de-AT. */
  locale?: string | null;
  /** Property the binding reads (type decides whether a string input is a number; unit is the default unit). */
  property?: Pick<TransformProperty, 'type' | 'unit'>;
  /** Further expression variables (e.g. the other properties of a symbol); `value` is set by this function. */
  context?: ExpressionContext;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}|${decimals}`;
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } catch {
      // Malformed culture code from the host: fall back instead of breaking the diagram
      format = numberFormat(TEXT_VALUE_DEFAULT_LOCALE, decimals);
    }
    numberFormats.set(key, format);
  }
  return format;
}

/** Decimals of a format, clamped to 0–6 (default 0). */
export function textValueDecimals(format: TextValueFormat | undefined): number {
  const decimals = format?.decimals;
  if (typeof decimals !== 'number' || !Number.isFinite(decimals)) {
    return 0;
  }
  return Math.min(TEXT_VALUE_MAX_DECIMALS, Math.max(0, Math.round(decimals)));
}

/** The "no value" text of a format (default "–"). */
export function textValueNoValueText(format: TextValueFormat | undefined): string {
  return format?.noValueText ?? TEXT_VALUE_DEFAULT_NO_VALUE;
}

function withUnit(text: string, unit: string | undefined): string {
  return unit ? `${text} ${unit}` : text;
}

/**
 * Formats an already evaluated value.
 *
 * - finite number → locale number with the format's decimals, plus unit;
 * - non-empty string → the string as it is, plus unit (no number formatting);
 * - boolean → `true`/`false`, plus unit;
 * - everything else (undefined, null, NaN, ±Infinity, empty string, objects) → the "no value" text.
 */
export function formatTextValue(
  value: unknown,
  format: TextValueFormat | undefined,
  locale?: string | null,
  propertyUnit?: string
): string {
  const unit = format?.unit ?? propertyUnit;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return textValueNoValueText(format);
    }
    const culture = locale && locale.trim() ? locale.trim() : TEXT_VALUE_DEFAULT_LOCALE;
    const decimals = textValueDecimals(format);
    // A tiny negative number that rounds to zero would show "-0,0": a sign without a value
    const shown = Number(value.toFixed(decimals)) === 0 ? 0 : value;
    return withUnit(numberFormat(culture, decimals).format(shown), unit);
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? textValueNoValueText(format) : withUnit(value, unit);
  }
  if (typeof value === 'boolean') {
    return withUnit(String(value), unit);
  }
  return textValueNoValueText(format);
}

/**
 * Normalises the input of a binding: `undefined` = no value. A number property
 * takes numbers and numeric strings; a non-numeric string, null or NaN is no value.
 */
function normaliseInput(value: unknown, propertyType: string | undefined): number | string | boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    if (propertyType === 'number') {
      const trimmed = value.trim();
      const parsed = trimmed === '' ? NaN : Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

/**
 * Computes the text of a `text.value` binding: input check, expression, format.
 *
 * `input` is the property value; `undefined` means the property has no value
 * (e.g. its binding has not delivered data or the attribute is empty). The
 * expression only runs on a value; a failed expression shows the "no value" text.
 */
export function evaluateTextValue(
  input: unknown,
  binding: Pick<PropertyBinding, 'expression' | 'textFormat'>,
  options: TextValueEvaluationOptions
): string {
  const format = binding.textFormat;
  const value = normaliseInput(input, options.property?.type);
  if (value === undefined) {
    return textValueNoValueText(format);
  }

  let result: unknown = value;
  const expression = binding.expression?.trim();
  if (expression && expression !== 'value') {
    const evaluated = options.evaluator.evaluate(expression, { ...options.context, value });
    if (!evaluated.success) {
      return textValueNoValueText(format);
    }
    result = evaluated.value;
  }

  return formatTextValue(result, format, options.locale, options.property?.unit);
}

/**
 * Sets the content of a cloned text primitive. Non-text primitives are left as
 * they are (the editor offers `text.value` only for text targets).
 */
export function applyTextValueToPrimitive<T extends { type: string; config?: unknown }>(primitive: T, text: string): T {
  if (primitive.type !== 'text') {
    return primitive;
  }
  const config = (primitive.config ?? {}) as Record<string, unknown>;
  (primitive as { config?: unknown }).config = { ...config, content: text };
  return primitive;
}

/**
 * Input of a `text.value` binding from a property value map with defaults
 * (designer simulation, symbol editor, symbol renderer): a key that is present
 * but `null`/`undefined` (an emptied simulation field, an explicit override
 * without value) is "no value"; an absent key falls back to the default.
 */
export function textValueInput(values: Readonly<Record<string, unknown>> | undefined, property: Pick<TransformProperty, 'id' | 'defaultValue'>): unknown {
  return values && Object.prototype.hasOwnProperty.call(values, property.id) ? values[property.id] : property.defaultValue;
}
