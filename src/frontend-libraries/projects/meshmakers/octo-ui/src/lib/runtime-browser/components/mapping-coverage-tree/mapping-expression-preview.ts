/**
 * Pure helpers for the mapping-expression live preview shown in the mapping
 * edit dialogs: "value = <current source value> → <expression result>".
 *
 * The evaluator itself is provided by the HOST (Refinery Studio wires
 * `ExpressionEvaluatorService` from `@meshmakers/octo-process-diagrams`) — the
 * library stays evaluator-agnostic, mirroring the `expressionValidator` input
 * pattern of `DataMappingListComponent`. Note the evaluation is a CLIENT-SIDE
 * APPROXIMATION (expr-eval) of the backend's mXparser semantics; simple
 * arithmetic/comparison/ternary expressions behave identically.
 */

/** Result of evaluating a mapping expression against a concrete value. */
export interface MappingExpressionPreviewResult {
  valid: boolean;
  error?: string;
  preview?: string;
}

/**
 * Host-provided evaluator: applies `expression` with the given `value` bound
 * to the `value` variable and returns the formatted result.
 */
export type MappingExpressionEvaluatorFn = (
  expression: string,
  value: unknown,
) => MappingExpressionPreviewResult;

/**
 * Coerces a raw data-point value (often a string on the wire, e.g. "21.5" or
 * "true") into the type the expression should see — mirroring how the backend
 * feeds numeric state values into mXparser.
 */
export function coerceDataPointValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed === '') return raw;
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) return numeric;
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  return raw;
}

/** The computed preview line for the dialog. */
export interface ExpressionPreview {
  /** The raw source value shown as "value = …". */
  valueLabel: string;
  /** True when no expression is set — the value passes through unchanged. */
  passThrough: boolean;
  /**
   * Evaluation result, or null when an expression is set but the host
   * provided no evaluator (only the source value can be shown then).
   */
  result: MappingExpressionPreviewResult | null;
}

/**
 * Computes the preview line, or null when the source's current value is
 * unknown (nothing sensible to show).
 */
export function computeExpressionPreview(
  evaluator: MappingExpressionEvaluatorFn | null | undefined,
  expression: string | null | undefined,
  rawValue: unknown,
): ExpressionPreview | null {
  if (rawValue === undefined || rawValue === null) return null;

  const valueLabel = String(rawValue);
  const value = coerceDataPointValue(rawValue);
  const trimmed = (expression ?? '').trim();

  if (!trimmed) {
    // No expression = pass-through (matches ApplyDataPointMappings semantics).
    return { valueLabel, passThrough: true, result: { valid: true, preview: String(value) } };
  }
  if (!evaluator) {
    return { valueLabel, passThrough: false, result: null };
  }
  return { valueLabel, passThrough: false, result: evaluator(trimmed, value) };
}
