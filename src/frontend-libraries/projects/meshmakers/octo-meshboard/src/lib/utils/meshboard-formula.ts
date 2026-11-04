import type { ExpressionContext, ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import { AnyWidgetConfig, EntitySelectorConfig, KpiWidgetConfig, MeshBoardVariable } from '../models/meshboard.models';

/**
 * Formula support for MeshBoard widgets (AB#5364).
 *
 * A formula is an expr-eval expression whose operands are MeshBoard variables written as
 * `${name}` or `$name`, e.g. `(${a} - ${b}) / 1000`. Before parsing, every reference is
 * rewritten to a safe identifier (`__v_<name>`), so a variable called `max`, `E` or `and`
 * never collides with an expr-eval built-in and names outside the identifier alphabet still work.
 *
 * The functions are pure; the evaluator is passed in so a future board-level
 * `'expression'` variable source can reuse them.
 */

/** The part of the process-diagrams evaluator the formula functions use. */
export type FormulaEvaluator = Pick<ExpressionEvaluatorService, 'validate' | 'evaluate' | 'getVariables'>;

export interface RewrittenFormula {
  /** Expression with every variable reference replaced by its safe identifier */
  expression: string;
  /** Referenced MeshBoard variable names, distinct, in order of first appearance */
  referencedNames: string[];
}

export interface FormulaValidationResult {
  valid: boolean;
  /** Syntax error or other reason the formula is invalid */
  error?: string;
  /** Referenced variables that do not exist (bare identifiers are reported as well) */
  unknownVariables: string[];
}

/**
 * Outcome of evaluating a formula:
 * - `ok`: a value;
 * - `pending`: empty formula or a referenced variable has no value yet → the widget shows `-`, no error;
 * - `nonFinite`: the result is `Infinity`/`NaN` (e.g. division by zero, PV = 0 at night) → the widget
 *   shows `-` and the `reason` as tooltip, no error state (AB#7950);
 * - `error`: syntax or evaluation error → the widget error state with the message.
 */
export type FormulaEvaluationResult =
  | { status: 'pending' }
  | { status: 'ok'; value: number | string | boolean }
  | { status: 'nonFinite'; reason: string }
  | { status: 'error'; error: string };

/** Tooltip reason shown with `-` for a non-finite formula result (AB#7950). */
export const NON_FINITE_FORMULA_REASON = 'The formula result is not a finite number (e.g. division by zero).';

/** Error of a formula whose result must be a number but is not (gauge). */
export const NOT_A_NUMBER_FORMULA_ERROR = 'Result is not a number';

const VARIABLE_REFERENCE = /\$\{([^}]+)\}|\$([a-zA-Z_]\w*)/g;
const IDENTIFIER_PREFIX = '__v_';
const NUMERIC_VALUE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Safe expr-eval identifier for a variable name. Every character outside `[A-Za-z0-9]`,
 * including `_`, is hex-escaped as `_<hex>_`, so underscores only ever delimit escapes and
 * the mapping is injective (`my-var` and `my_2d_var` stay distinct).
 */
function toIdentifier(name: string): string {
  return IDENTIFIER_PREFIX + name.replace(/[^A-Za-z0-9]/g, c => `_${c.charCodeAt(0).toString(16)}_`);
}

/**
 * Replaces `${name}` / `$name` references with safe identifiers.
 */
export function rewriteFormula(formula: string): RewrittenFormula {
  const referencedNames: string[] = [];
  const expression = (formula ?? '').replace(VARIABLE_REFERENCE, (_match, bracketName: string, simpleName: string) => {
    const name = (bracketName ?? simpleName).trim();
    if (!referencedNames.includes(name)) {
      referencedNames.push(name);
    }
    return toIdentifier(name);
  });
  return { expression, referencedNames };
}

/**
 * Validates a formula: syntax, and that every referenced variable exists.
 * A bare identifier (`a` instead of `${a}`) is reported as unknown variable.
 */
export function validateFormula(
  formula: string,
  availableNames: readonly string[],
  evaluator: FormulaEvaluator
): FormulaValidationResult {
  if (!formula?.trim()) {
    return { valid: false, error: 'Formula is empty', unknownVariables: [] };
  }

  const { expression, referencedNames } = rewriteFormula(formula);
  const syntax = evaluator.validate(expression);
  if (!syntax.valid) {
    return { valid: false, error: syntax.error ?? 'Invalid formula', unknownVariables: [] };
  }

  const unknownVariables = referencedNames.filter(name => !availableNames.includes(name));
  const bareIdentifiers = evaluator.getVariables(expression)
    .filter(identifier => !identifier.startsWith(IDENTIFIER_PREFIX));
  for (const identifier of bareIdentifiers) {
    if (!unknownVariables.includes(identifier)) {
      unknownVariables.push(identifier);
    }
  }

  if (unknownVariables.length > 0) {
    return {
      valid: false,
      error: `Unknown variable${unknownVariables.length > 1 ? 's' : ''}: ${unknownVariables.join(', ')}`,
      unknownVariables
    };
  }
  return { valid: true, unknownVariables: [] };
}

/**
 * Variable names that exist by configuration even while they carry no value yet: the outputs
 * declared by other KPIs (e.g. still loading or in error) and the variables an entity selector
 * exposes once an entity is picked. `excludeWidgetId` is the edited widget (its own output is
 * not a valid operand).
 */
export function declaredFormulaVariableNames(
  widgets: readonly AnyWidgetConfig[],
  entitySelectors: readonly EntitySelectorConfig[],
  excludeWidgetId?: string
): string[] {
  const outputs = widgets
    .filter(w => w.id !== excludeWidgetId && w.type === 'kpi')
    .map(w => (w as KpiWidgetConfig).outputVariableName?.trim())
    .filter((name): name is string => !!name);
  const selectorVariables = entitySelectors.flatMap(selector => [
    ...(selector.attributeMappings ?? []).map(m => m.variableName),
    `${selector.id}_rtId`,
    `${selector.id}_rtCkTypeId`
  ]);
  return [...outputs, ...selectorVariables];
}

/**
 * Validation of a formula field (AB#7950): `validateFormula` against the names of `variables`
 * plus `declaredNames`. The shared formula field shows this result and the config dialogs use
 * it to enable Save, so both always agree.
 */
export function validateFormulaField(
  formula: string,
  variables: readonly MeshBoardVariable[],
  declaredNames: readonly string[],
  evaluator: FormulaEvaluator
): FormulaValidationResult {
  return validateFormula(formula, formulaKnownNames(variables, declaredNames), evaluator);
}

/** Converts a variable's string value to the type expr-eval should see. */
function toContextValue(value: string): number | string | boolean {
  const trimmed = value.trim();
  if (NUMERIC_VALUE.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  return value;
}

/**
 * Evaluates a formula against the given variables.
 *
 * Returns `pending` while the formula is empty or a referenced variable is missing or empty
 * (e.g. an upstream widget has not published yet), so the widget shows `-` instead of an error,
 * and `nonFinite` for an `Infinity`/`NaN` result (shown as `-` with the reason as tooltip).
 */
export function evaluateFormula(
  formula: string | undefined,
  variables: readonly MeshBoardVariable[],
  evaluator: FormulaEvaluator
): FormulaEvaluationResult {
  if (!formula?.trim()) {
    return { status: 'pending' };
  }

  const { expression, referencedNames } = rewriteFormula(formula);
  const context: ExpressionContext = {};
  for (const name of referencedNames) {
    const variable = variables.find(v => v.name === name);
    const value = variable?.value || variable?.defaultValue;
    if (value === undefined || value === '') {
      return { status: 'pending' };
    }
    context[toIdentifier(name)] = toContextValue(value);
  }

  const result = evaluator.evaluate(expression, context);
  if (!result.success) {
    return { status: 'error', error: result.error ?? 'Evaluation failed' };
  }

  const value = result.value;
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { status: 'ok', value }
      : { status: 'nonFinite', reason: NON_FINITE_FORMULA_REASON };
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return { status: 'ok', value };
  }
  return { status: 'error', error: NOT_A_NUMBER_FORMULA_ERROR };
}

/**
 * Restricts a formula result to numbers, for widgets that can only show a number (gauge).
 * A string or boolean result becomes the error *Result is not a number*; every other
 * status passes through unchanged.
 */
export function requireNumericFormulaResult(result: FormulaEvaluationResult): FormulaEvaluationResult {
  if (result.status === 'ok' && typeof result.value !== 'number') {
    return { status: 'error', error: NOT_A_NUMBER_FORMULA_ERROR };
  }
  return result;
}

/**
 * Preview text of the shared formula field for an evaluation result.
 */
export function formulaPreviewText(result: FormulaEvaluationResult): string {
  switch (result.status) {
    case 'ok': return String(result.value);
    case 'pending': return '- (a referenced variable has no value yet)';
    case 'nonFinite': return `- (${result.reason})`;
    default: return result.error;
  }
}

/**
 * Names a formula may reference: the names of the given variables plus names that exist by
 * configuration but carry no value yet (declared outputs, entity-selector variables),
 * distinct, in order.
 */
export function formulaKnownNames(
  variables: readonly MeshBoardVariable[],
  declaredNames: readonly string[] = []
): string[] {
  return [...new Set([...variables.map(v => v.name), ...declaredNames])];
}

/** True when the widget is a KPI in formula mode. */
export function isFormulaKpi(widget: AnyWidgetConfig): widget is KpiWidgetConfig {
  return widget.type === 'kpi' && (widget as KpiWidgetConfig).valueMode === 'formula';
}

/**
 * Finds widgets that depend on their own output, directly or through other widgets.
 *
 * Graph: a formula KPI depends on every widget whose `outputVariableName` its formula
 * references. A name that is also a configured MeshBoard variable resolves to that variable
 * at runtime (config variables win), so it creates no dependency on the widget.
 * Returns the IDs of all widgets that are part of a cycle (including self-references).
 */
export function findVariableCycles(
  widgets: readonly AnyWidgetConfig[],
  configuredVariableNames: readonly string[] = []
): Set<string> {
  const configuredNames = new Set(configuredVariableNames);
  const producerByName = new Map<string, string>();
  for (const widget of widgets) {
    const name = widget.type === 'kpi' ? (widget as KpiWidgetConfig).outputVariableName?.trim() : undefined;
    if (name) {
      producerByName.set(name, widget.id);
    }
  }

  const dependencies = new Map<string, string[]>();
  for (const widget of widgets) {
    if (!isFormulaKpi(widget)) continue;
    const producers = rewriteFormula(widget.formula ?? '').referencedNames
      .map(name => configuredNames.has(name) ? undefined : producerByName.get(name))
      .filter((id): id is string => id !== undefined);
    dependencies.set(widget.id, producers);
  }

  const inCycle = new Set<string>();
  for (const start of dependencies.keys()) {
    const visited = new Set<string>();
    const stack = [...(dependencies.get(start) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === start) {
        inCycle.add(start);
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);
      stack.push(...(dependencies.get(current) ?? []));
    }
  }
  return inCycle;
}
