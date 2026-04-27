/**
 * Factory for creating a mapping expression validator that can be used
 * with the DataMappingListComponent's expressionValidator input.
 *
 * Uses ExpressionEvaluatorService (expr-eval) for instant client-side validation.
 * Compatible with the mXparser expressions used by ApplyDataPointMappingsNode in the backend.
 *
 * Usage in host app:
 * ```typescript
 * import { createMappingExpressionValidator } from '@meshmakers/octo-process-diagrams';
 * import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
 *
 * // In component:
 * private readonly expressionService = inject(ExpressionEvaluatorService);
 * readonly expressionValidator = createMappingExpressionValidator(this.expressionService);
 *
 * // In template:
 * <mm-runtime-browser [expressionValidator]="expressionValidator" ...>
 * ```
 */

import { ExpressionEvaluatorService } from './expression-evaluator.service';

/** Result of validating a mapping expression (matches octo-ui's ExpressionValidationResult). */
export interface MappingExpressionValidationResult {
  valid: boolean;
  error?: string;
  preview?: string;
}

/** Validator function type (matches octo-ui's ExpressionValidatorFn). */
export type MappingExpressionValidatorFn = (expression: string) => MappingExpressionValidationResult;

/**
 * Creates a mapping expression validator function from an ExpressionEvaluatorService instance.
 *
 * The returned function validates expressions and returns a preview of the evaluation
 * using `value = 42` as a test input.
 *
 * @param service The ExpressionEvaluatorService instance (injected via DI)
 * @param testValue The test value for the 'value' variable (default: 42)
 * @returns A validator function compatible with DataMappingListComponent.expressionValidator
 */
export function createMappingExpressionValidator(
  service: ExpressionEvaluatorService,
  testValue = 42,
): MappingExpressionValidatorFn {
  return (expression: string): MappingExpressionValidationResult => {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression must not be empty' };
    }

    // Step 1: Validate syntax
    const validation = service.validate(expression);
    if (!validation.valid) {
      return { valid: false, error: validation.error ?? 'Invalid expression syntax' };
    }

    // Step 2: Evaluate with test value
    const result = service.evaluate(expression, { value: testValue });
    if (!result.success) {
      return { valid: false, error: result.error ?? 'Expression evaluation failed' };
    }

    // Step 3: Format preview
    const preview = typeof result.value === 'number'
      ? Number.isInteger(result.value)
        ? String(result.value)
        : result.value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
      : String(result.value);

    return { valid: true, preview };
  };
}
