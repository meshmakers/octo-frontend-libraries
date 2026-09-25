import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import { AnyWidgetConfig, KpiWidgetConfig, MeshBoardVariable } from '../models/meshboard.models';
import {
  evaluateFormula,
  findVariableCycles,
  rewriteFormula,
  validateFormula
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

    it('reports division by zero as an error', () => {
      const result = evaluateFormula('${a} / 0', [variable('a', '1')], evaluator);
      expect(result.status).toBe('error');
    });

    it('reports syntax errors', () => {
      expect(evaluateFormula('${a} *', [variable('a', '1')], evaluator).status).toBe('error');
    });

    it('converts booleans', () => {
      expect(evaluateFormula('${on} ? 1 : 0', [variable('on', 'true')], evaluator)).toEqual({ status: 'ok', value: 1 });
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

    it('ignores formulas of widgets not in formula mode', () => {
      const widgets: AnyWidgetConfig[] = [
        kpi('A', { valueMode: 'value', formula: '${a}', outputVariableName: 'a' })
      ];
      expect(findVariableCycles(widgets).size).toBe(0);
    });
  });
});
