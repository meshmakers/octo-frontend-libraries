import {
  coerceDataPointValue,
  computeExpressionPreview,
  MappingExpressionEvaluatorFn,
} from './mapping-expression-preview';

describe('coerceDataPointValue', () => {
  it('coerces numeric strings to numbers', () => {
    expect(coerceDataPointValue('21.5')).toBe(21.5);
    expect(coerceDataPointValue(' 42 ')).toBe(42);
    expect(coerceDataPointValue('-3')).toBe(-3);
  });

  it('coerces boolean strings to booleans', () => {
    expect(coerceDataPointValue('true')).toBe(true);
    expect(coerceDataPointValue('False')).toBe(false);
  });

  it('passes non-coercible values through unchanged', () => {
    expect(coerceDataPointValue('on')).toBe('on');
    expect(coerceDataPointValue('')).toBe('');
    expect(coerceDataPointValue(7)).toBe(7);
    expect(coerceDataPointValue(true)).toBe(true);
  });
});

describe('computeExpressionPreview', () => {
  const doubler: MappingExpressionEvaluatorFn = (expression, value) =>
    expression === 'boom'
      ? { valid: false, error: 'kaputt' }
      : { valid: true, preview: String((value as number) * 2) };

  it('returns null when the source value is unknown', () => {
    expect(computeExpressionPreview(doubler, 'value * 2', undefined)).toBeNull();
    expect(computeExpressionPreview(doubler, 'value * 2', null)).toBeNull();
  });

  it('treats an empty expression as pass-through', () => {
    const preview = computeExpressionPreview(doubler, '', '21.5');
    expect(preview).toEqual({
      valueLabel: '21.5',
      passThrough: true,
      result: { valid: true, preview: '21.5' },
    });
  });

  it('evaluates the expression against the coerced value', () => {
    const preview = computeExpressionPreview(doubler, 'value * 2', '21.5');
    expect(preview?.passThrough).toBeFalse();
    expect(preview?.valueLabel).toBe('21.5');
    expect(preview?.result).toEqual({ valid: true, preview: '43' });
  });

  it('surfaces evaluator errors', () => {
    const preview = computeExpressionPreview(doubler, 'boom', '1');
    expect(preview?.result).toEqual({ valid: false, error: 'kaputt' });
  });

  it('returns a null result when no evaluator is provided but an expression is set', () => {
    const preview = computeExpressionPreview(null, 'value * 2', '1');
    expect(preview?.result).toBeNull();
    expect(preview?.valueLabel).toBe('1');
  });
});
