import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import { AnyWidgetConfig, KpiWidgetConfig, MeshBoardVariable } from '../models/meshboard.models';
import {
  declaredFormulaVariableNames,
  evaluateFormula,
  findVariableCycles,
  formulaKnownNames,
  formulaPreviewText,
  NON_FINITE_FORMULA_REASON,
  NOT_A_NUMBER_FORMULA_ERROR,
  requireNumericFormulaResult,
  rewriteFormula,
  validateFormula,
  validateFormulaField
} from './meshboard-formula';

describe('meshboard-formula', () => {
  const evaluator = new ExpressionEvaluatorService();

  function variable(name: string, value: string): MeshBoardVariable {
    return { name, type: 'string', source: 'static', value };
  }

  function kpi(id: string, overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id,
      type: 'kpi',
      title: id,
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      valueAttribute: '',
      dataSource: { type: 'static' },
      ...overrides
    };
  }

  describe('rewriteFormula', () => {
    it('rewrites ${x} and $x to safe identifiers and lists names once', () => {
      const result = rewriteFormula('(${a} - $b) / $a');
      expect(result.expression).toBe('(__v_a - __v_b) / __v_a');
      expect(result.referencedNames).toEqual(['a', 'b']);
    });

    it('escapes characters outside the identifier alphabet', () => {
      const result = rewriteFormula('${my-var} * 2');
      expect(result.expression).toBe('__v_my_2d_var * 2');
      expect(result.referencedNames).toEqual(['my-var']);
    });

    it('keeps names distinct whose escaped forms would otherwise collide', () => {
      const result = rewriteFormula('${my-var} + ${my_2d_var}');
      expect(result.expression).toBe('__v_my_2d_var + __v_my_5f_2d_5f_var');
    });

    it('evaluates names containing underscores', () => {
      const vars: MeshBoardVariable[] = [variable('mp_rtId_count', '4')];
      expect(evaluateFormula('${mp_rtId_count} * 2', vars, evaluator)).toEqual({ status: 'ok', value: 8 });
    });
  });

  describe('validateFormula', () => {
    it('accepts a valid formula over known variables', () => {
      expect(validateFormula('(${a} - ${b}) / 1000', ['a', 'b'], evaluator))
        .toEqual({ valid: true, unknownVariables: [] });
    });

    it('reports unknown variables', () => {
      const result = validateFormula('${a} + ${missing}', ['a'], evaluator);
      expect(result.valid).toBe(false);
      expect(result.unknownVariables).toEqual(['missing']);
    });

    it('reports bare identifiers as unknown variables', () => {
      const result = validateFormula('a + 1', ['a'], evaluator);
      expect(result.valid).toBe(false);
      expect(result.unknownVariables).toEqual(['a']);
    });

    it('reports syntax errors', () => {
      const result = validateFormula('${a} +', ['a'], evaluator);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('rejects an empty formula', () => {
      expect(validateFormula('  ', [], evaluator).valid).toBe(false);
    });

    it('allows built-in functions', () => {
      expect(validateFormula('max(${a}, 0) + clamp(${a}, 0, 10)', ['a'], evaluator).valid).toBe(true);
    });
  });

  describe('evaluateFormula', () => {
    it('computes arithmetic over numeric string variables', () => {
      const result = evaluateFormula('(${a} - ${b}) / 1000', [variable('a', '5000'), variable('b', '2000')], evaluator);
      expect(result).toEqual({ status: 'ok', value: 3 });
    });

    it('does not clash with built-in names (variable called max)', () => {
      const result = evaluateFormula('max(${max}, 1) * 2', [variable('max', '4')], evaluator);
      expect(result).toEqual({ status: 'ok', value: 8 });
    });

    it('is pending while a referenced variable is missing or empty', () => {
      expect(evaluateFormula('${a} + 1', [], evaluator)).toEqual({ status: 'pending' });
      expect(evaluateFormula('${a} + 1', [variable('a', '')], evaluator)).toEqual({ status: 'pending' });
    });

    it('falls back to the default value', () => {
      const v: MeshBoardVariable = { ...variable('a', ''), defaultValue: '2' };
      expect(evaluateFormula('${a} * 3', [v], evaluator)).toEqual({ status: 'ok', value: 6 });
    });

    it('is pending for an empty formula', () => {
      expect(evaluateFormula('', [], evaluator)).toEqual({ status: 'pending' });
      expect(evaluateFormula(undefined, [], evaluator)).toEqual({ status: 'pending' });
    });

    it('reports division by zero as non-finite with a reason, not as an error (AB#7950)', () => {
      expect(evaluateFormula('${a} / 0', [variable('a', '1')], evaluator))
        .toEqual({ status: 'nonFinite', reason: NON_FINITE_FORMULA_REASON });
    });

    it('reports 0 / 0 (NaN) as non-finite (AB#7950)', () => {
      expect(evaluateFormula('${a} / ${b}', [variable('a', '0'), variable('b', '0')], evaluator).status)
        .toBe('nonFinite');
    });

    it('reports syntax errors', () => {
      expect(evaluateFormula('${a} *', [variable('a', '1')], evaluator).status).toBe('error');
    });

    it('converts booleans', () => {
      expect(evaluateFormula('${on} ? 1 : 0', [variable('on', 'true')], evaluator)).toEqual({ status: 'ok', value: 1 });
    });
  });

  describe('requireNumericFormulaResult (AB#7950)', () => {
    it('turns a string or boolean result into "Result is not a number"', () => {
      expect(requireNumericFormulaResult({ status: 'ok', value: 'on' }))
        .toEqual({ status: 'error', error: NOT_A_NUMBER_FORMULA_ERROR });
      expect(requireNumericFormulaResult({ status: 'ok', value: true }))
        .toEqual({ status: 'error', error: 'Result is not a number' });
    });

    it('passes numbers and every other status through', () => {
      expect(requireNumericFormulaResult({ status: 'ok', value: 4 })).toEqual({ status: 'ok', value: 4 });
      expect(requireNumericFormulaResult({ status: 'pending' })).toEqual({ status: 'pending' });
      expect(requireNumericFormulaResult({ status: 'nonFinite', reason: 'r' })).toEqual({ status: 'nonFinite', reason: 'r' });
      expect(requireNumericFormulaResult({ status: 'error', error: 'e' })).toEqual({ status: 'error', error: 'e' });
    });
  });

  describe('formulaPreviewText (AB#7950)', () => {
    it('renders every status', () => {
      expect(formulaPreviewText({ status: 'ok', value: 3 })).toBe('3');
      expect(formulaPreviewText({ status: 'pending' })).toBe('- (a referenced variable has no value yet)');
      expect(formulaPreviewText({ status: 'nonFinite', reason: NON_FINITE_FORMULA_REASON })).toBe(`- (${NON_FINITE_FORMULA_REASON})`);
      expect(formulaPreviewText({ status: 'error', error: 'Boom' })).toBe('Boom');
    });
  });

  describe('validateFormulaField and declared names (AB#7950)', () => {
    it('accepts names of variables and declared names, rejects others', () => {
      expect(validateFormulaField('${a} + ${later}', [variable('a', '1')], ['later'], evaluator).valid).toBe(true);
      expect(validateFormulaField('${a} + ${x}', [variable('a', '1')], [], evaluator))
        .toEqual({ valid: false, error: 'Unknown variable: x', unknownVariables: ['x'] });
    });

    it('lists known names once', () => {
      expect(formulaKnownNames([variable('a', '1'), variable('b', '2')], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('declares other KPIs\' outputs and selector variables, not the edited widget\'s output', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('self', { outputVariableName: 'mine' }),
        kpi('other', { outputVariableName: ' consumption ' }),
        kpi('plain')
      ];
      const names = declaredFormulaVariableNames(widgets, [{
        id: 'mp', label: 'MP', ckTypeId: 'Test/MeteringPoint', attributeMappings: [{ attributePath: 'power', variableName: 'mp_power' }]
      }], 'self');
      expect(names).toEqual(['consumption', 'mp_power', 'mp_rtId', 'mp_rtCkTypeId']);
    });
  });

  describe('findVariableCycles', () => {
    it('finds a two-widget cycle', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('A', { valueMode: 'formula', formula: '${b} + 1', outputVariableName: 'a' }),
        kpi('B', { valueMode: 'formula', formula: '${a} + 1', outputVariableName: 'b' }),
        kpi('C', { valueMode: 'formula', formula: '${a} * 2' })
      ];
      expect([...findVariableCycles(widgets)].sort()).toEqual(['A', 'B']);
    });

    it('finds a self-reference', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('A', { valueMode: 'formula', formula: '${a} + 1', outputVariableName: 'a' })
      ];
      expect([...findVariableCycles(widgets)]).toEqual(['A']);
    });

    it('accepts a chain without cycle', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('Q', { outputVariableName: 'consumption', dataSource: { type: 'persistentQuery', queryRtId: 'q' } }),
        kpi('A', { valueMode: 'formula', formula: '${consumption} / 1000', outputVariableName: 'mwh' }),
        kpi('B', { valueMode: 'formula', formula: '${mwh} * 2' })
      ];
      expect(findVariableCycles(widgets).size).toBe(0);
    });

    it('does not link a reference shadowed by a configured variable', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('A', { valueMode: 'formula', formula: '${x} + 1', outputVariableName: 'y' }),
        kpi('B', { valueMode: 'formula', formula: '${y} + 1', outputVariableName: 'x' })
      ];
      expect([...findVariableCycles(widgets)].sort()).toEqual(['A', 'B']);
      expect(findVariableCycles(widgets, ['x']).size).toBe(0);
    });

    it('ignores formulas of widgets not in formula mode', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('A', { valueMode: 'value', formula: '${a}', outputVariableName: 'a' })
      ];
      expect(findVariableCycles(widgets).size).toBe(0);
    });
  });
});
