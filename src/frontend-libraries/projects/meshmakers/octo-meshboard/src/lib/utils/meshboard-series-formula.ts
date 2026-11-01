import type { ExpressionContext } from '@meshmakers/octo-process-diagrams';
import { FormulaEvaluator, FormulaValidationResult, rewriteFormula, validateFormula } from './meshboard-formula';

/**
 * Formula series of charts (AB#7952): a series whose value in each bucket is a formula over the
 * values of other series in the same bucket, e.g.
 * `pvDirect = min(${pv} - ${gridExport} - ${batteryCharge}, ${consumption})`.
 *
 * Reuses the board formula syntax and evaluator of `meshboard-formula.ts` (`${key}` operands,
 * expr-eval) — no second expression engine. The functions are pure and work on plain value arrays
 * (`data[i]` = bucket `i`), so the line chart (time buckets) and the bar chart (categories, AB#7953)
 * both use them.
 *
 * Gap rule: a bucket in which any operand is `null`, or whose result is not a finite number
 * (division by zero, a string or boolean result, an evaluation error), is `null` — a gap, never 0.
 */

/** A formula series as these functions see it. */
export interface SeriesFormula {
  key: string;
  formula: string;
}

/** Dependency order of formula series, or the cycle that prevents one. */
export interface SeriesFormulaOrder {
  /** Keys of the formula series, every one after the formula series it references. */
  order: string[];
  /** Keys of every formula series that is part of a circular reference (self-references included), in input order. */
  cyclic: string[];
}

/** Referenced series keys of a formula, distinct, in order of first appearance. */
export function seriesFormulaOperands(formula: string): string[] {
  return rewriteFormula(formula ?? '').referencedNames;
}

/**
 * Orders formula series so every series comes after the formula series it references (Kahn's
 * algorithm, stable in input order). References to non-formula keys (query series) are leaves.
 * Series in or behind a cycle are left out of `order`; `cyclic` names the ones in the cycle.
 */
export function orderSeriesFormulas(formulas: readonly SeriesFormula[]): SeriesFormulaOrder {
  const keys = new Set(formulas.map(f => f.key));
  const deps = new Map<string, string[]>();
  for (const f of formulas) {
    deps.set(f.key, seriesFormulaOperands(f.formula).filter(k => keys.has(k)));
  }

  const order: string[] = [];
  const done = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const f of formulas) {
      if (done.has(f.key)) continue;
      if ((deps.get(f.key) ?? []).every(d => done.has(d))) {
        done.add(f.key);
        order.push(f.key);
        progress = true;
      }
    }
  }

  const cyclic = formulas
    .filter(f => !done.has(f.key) && reaches(f.key, f.key, deps))
    .map(f => f.key);
  return { order, cyclic };
}

/** True when `target` is reachable from the dependencies of `start`. */
function reaches(start: string, target: string, deps: ReadonlyMap<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = [...(deps.get(start) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(deps.get(current) ?? []));
  }
  return false;
}

/** Message of a circular reference, naming the series involved. */
export function circularReferenceMessage(cyclic: readonly string[]): string {
  return `Circular reference between series: ${cyclic.join(', ')}`;
}

/**
 * Validates every formula series of a chart: syntax and unknown keys exactly like the KPI formula
 * field (`validateFormula`, series keys as available names), then circular references.
 * Returns one result per formula, in input order.
 */
export function validateSeriesFormulas(
  formulas: readonly SeriesFormula[],
  availableKeys: readonly string[],
  evaluator: FormulaEvaluator
): FormulaValidationResult[] {
  const results = formulas.map(f => validateFormula(f.formula, availableKeys, evaluator));
  const { cyclic } = orderSeriesFormulas(formulas);
  if (cyclic.length > 0) {
    const message = circularReferenceMessage(cyclic);
    formulas.forEach((f, i) => {
      if (results[i].valid && cyclic.includes(f.key)) {
        results[i] = { valid: false, error: message, unknownVariables: [] };
      }
    });
  }
  return results;
}

/**
 * Evaluates the formula series bucket by bucket over `operands` (key → values, all of `length`).
 * Formula series are evaluated in dependency order and their results become operands of later
 * ones. A formula in a cycle, or with an operand key that has no values, is all gaps.
 * Returns key → values for every formula series.
 */
export function evaluateSeriesFormulas(
  formulas: readonly SeriesFormula[],
  operands: ReadonlyMap<string, readonly (number | null)[]>,
  length: number,
  evaluator: FormulaEvaluator
): Map<string, (number | null)[]> {
  const values = new Map<string, readonly (number | null)[]>(operands);
  const result = new Map<string, (number | null)[]>();
  const byKey = new Map(formulas.map(f => [f.key, f]));
  const { order } = orderSeriesFormulas(formulas);

  for (const key of order) {
    const formula = byKey.get(key) as SeriesFormula;
    const data = evaluateOneSeries(formula.formula, values, length, evaluator);
    result.set(key, data);
    values.set(key, data);
  }
  for (const f of formulas) {
    if (!result.has(f.key)) result.set(f.key, new Array<number | null>(length).fill(null));
  }
  return result;
}

function evaluateOneSeries(
  formula: string,
  values: ReadonlyMap<string, readonly (number | null)[]>,
  length: number,
  evaluator: FormulaEvaluator
): (number | null)[] {
  const out = new Array<number | null>(length).fill(null);
  if (!formula?.trim()) return out;
  const { expression, referencedNames } = rewriteFormula(formula);
  const columns = referencedNames.map(name => values.get(name));
  if (columns.some(c => c === undefined)) return out;
  // Identifiers of the operands, as rewriteFormula produced them (`${a}` alone rewrites to the identifier of `a`).
  const identifiers = referencedNames.map(name => rewriteFormula(`\${${name}}`).expression);

  for (let i = 0; i < length; i++) {
    const context: ExpressionContext = {};
    let gap = false;
    for (let j = 0; j < columns.length; j++) {
      const v = (columns[j] as readonly (number | null)[])[i];
      if (v === null || v === undefined || !Number.isFinite(v)) {
        gap = true;
        break;
      }
      context[identifiers[j]] = v;
    }
    if (gap) continue;
    const r = evaluator.evaluate(expression, context);
    if (r.success && typeof r.value === 'number' && Number.isFinite(r.value)) {
      out[i] = r.value;
    }
  }
  return out;
}
