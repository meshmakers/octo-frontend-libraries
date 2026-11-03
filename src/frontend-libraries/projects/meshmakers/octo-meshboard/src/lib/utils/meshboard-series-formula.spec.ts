import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import {
  circularReferenceMessage,
  evaluateSeriesFormulas,
  orderSeriesFormulas,
  seriesFormulaOperands,
  validateSeriesFormulas
} from './meshboard-series-formula';
import { validateFormula } from './meshboard-formula';

/**
 * Formula series (AB#7952): EnergyIQ daily profile fixture with five operand series over six
 * buckets, the consumption / pvDirect formulas of the story, gaps, cycles and dependency order.
 */
describe('meshboard-series-formula (AB#7952)', () => {
  const evaluator = new ExpressionEvaluatorService();

  // Five operand series, six buckets (kW). Bucket 4 has a gap in gridImport.
  const pv = [0, 2, 5, 6, 4, 0];
  const gridImport: (number | null)[] = [3, 1, 0, 0, null, 2.5];
  const gridExport = [0, 0, 1.5, 2, 0.5, 0];
  const batteryCharge = [0, 0.5, 1, 1.5, 0, 0];
  const batteryDischarge = [0.5, 0, 0, 0, 0, 1];
  const OPERANDS = new Map<string, (number | null)[]>([
    ['pv', pv], ['gridImport', gridImport], ['gridExport', gridExport],
    ['batteryCharge', batteryCharge], ['batteryDischarge', batteryDischarge]
  ]);
  const CONSUMPTION = { key: 'consumption', formula: '${pv} + ${gridImport} - ${gridExport} - ${batteryCharge} + ${batteryDischarge}' };
  const PV_DIRECT = { key: 'pvDirect', formula: 'min(${pv} - ${gridExport} - ${batteryCharge}, ${consumption})' };

  describe('evaluateSeriesFormulas', () => {
    it('computes consumption and pvDirect bucket by bucket from the operands of the same bucket', () => {
      // pvDirect is listed first: dependency order, not list order, decides the evaluation.
      const result = evaluateSeriesFormulas([PV_DIRECT, CONSUMPTION], OPERANDS, 6, evaluator);

      for (let i = 0; i < 6; i++) {
        if (gridImport[i] === null) {
          expect(result.get('consumption')?.[i]).toBeNull();
          expect(result.get('pvDirect')?.[i]).toBeNull();
          continue;
        }
        const consumption = pv[i] + (gridImport[i] as number) - gridExport[i] - batteryCharge[i] + batteryDischarge[i];
        expect(result.get('consumption')?.[i]).toBeCloseTo(consumption, 10);
        expect(result.get('pvDirect')?.[i]).toBeCloseTo(Math.min(pv[i] - gridExport[i] - batteryCharge[i], consumption), 10);
      }
      expect(result.get('consumption')).toEqual([3.5, 2.5, 2.5, 2.5, null, 3.5]);
      expect(result.get('pvDirect')).toEqual([0, 1.5, 2.5, 2.5, null, 0]);
    });

    it('a null operand makes the bucket a gap, never 0', () => {
      const result = evaluateSeriesFormulas([{ key: 'x', formula: '${a} + ${b}' }],
        new Map([['a', [1, null, 3]], ['b', [1, 1, null]]]), 3, evaluator);
      expect(result.get('x')).toEqual([2, null, null]);
    });

    it('a non-finite result (division by zero) is a gap', () => {
      const result = evaluateSeriesFormulas([{ key: 'ratio', formula: '${a} / ${b}' }],
        new Map([['a', [1, 0, 4]], ['b', [2, 0, 0]]]), 3, evaluator);
      expect(result.get('ratio')).toEqual([0.5, null, null]);
    });

    it('a boolean or string result is a gap', () => {
      const result = evaluateSeriesFormulas([{ key: 'flag', formula: '${a} > 1' }], new Map([['a', [1, 2]]]), 2, evaluator);
      expect(result.get('flag')).toEqual([null, null]);
    });

    it('an operand without values (source failed or not loaded) makes the whole series gaps', () => {
      const result = evaluateSeriesFormulas([{ key: 'x', formula: '${missing} + 1' }], new Map(), 3, evaluator);
      expect(result.get('x')).toEqual([null, null, null]);
    });

    it('series in a cycle and series behind it are all gaps', () => {
      const result = evaluateSeriesFormulas([
        { key: 'a', formula: '${b} + 1' },
        { key: 'b', formula: '${a} + 1' },
        { key: 'c', formula: '${a} * 2' },
        { key: 'd', formula: '${pv} * 2' }
      ], OPERANDS, 6, evaluator);
      expect(result.get('a')).toEqual([null, null, null, null, null, null]);
      expect(result.get('c')).toEqual([null, null, null, null, null, null]);
      expect(result.get('d')).toEqual([0, 4, 10, 12, 8, 0]);
    });

    it('keys that collide with expr-eval built-ins work as operands', () => {
      const result = evaluateSeriesFormulas([{ key: 'y', formula: '${max} + ${E}' }],
        new Map([['max', [1, 2]], ['E', [10, 20]]]), 2, evaluator);
      expect(result.get('y')).toEqual([11, 22]);
    });
  });

  describe('orderSeriesFormulas', () => {
    it('orders every formula after the formulas it references, stable in input order', () => {
      expect(orderSeriesFormulas([
        { key: 'c', formula: '${b} + ${a}' },
        { key: 'a', formula: '${pv}' },
        { key: 'b', formula: '${a} * 2' },
        { key: 'd', formula: '${pv}' }
      ])).toEqual({ order: ['a', 'b', 'd', 'c'], cyclic: [] });
    });

    it('names the series of a cycle, including a self-reference, but not a series that only depends on it', () => {
      const result = orderSeriesFormulas([
        { key: 'a', formula: '${b}' },
        { key: 'b', formula: '${a}' },
        { key: 'self', formula: '${self} + 1' },
        { key: 'behind', formula: '${a}' },
        { key: 'ok', formula: '${pv}' }
      ]);
      expect(result.order).toEqual(['ok']);
      expect(result.cyclic).toEqual(['a', 'b', 'self']);
    });
  });

  describe('validateSeriesFormulas', () => {
    const KEYS = ['pv', 'gridImport', 'gridExport', 'batteryCharge', 'batteryDischarge', 'consumption', 'pvDirect'];

    it('accepts the story formulas', () => {
      expect(validateSeriesFormulas([CONSUMPTION, PV_DIRECT], KEYS, evaluator).map(r => r.valid)).toEqual([true, true]);
    });

    it('rejects a circular reference with the names involved', () => {
      const results = validateSeriesFormulas([
        { key: 'a', formula: '${b} + 1' },
        { key: 'b', formula: '${a} + 1' },
        { key: 'c', formula: '${pv}' }
      ], ['a', 'b', 'c', 'pv'], evaluator);
      expect(results[0]).toEqual({ valid: false, error: circularReferenceMessage(['a', 'b']), unknownVariables: [] });
      expect(results[1].error).toBe('Circular reference between series: a, b');
      expect(results[2].valid).toBe(true);
    });

    it('reports unknown keys and syntax errors with the messages of the KPI formula field', () => {
      const [unknown, syntax] = validateSeriesFormulas([
        { key: 'x', formula: '${nope} + ${pv}' },
        { key: 'y', formula: '${pv} +' }
      ], ['pv', 'x', 'y'], evaluator);
      expect(unknown.error).toBe(validateFormula('${nope} + ${pv}', ['pv', 'x', 'y'], evaluator).error);
      expect(unknown.error).toBe('Unknown variable: nope');
      expect(syntax.valid).toBe(false);
      expect(syntax.error).toBe(validateFormula('${pv} +', ['pv'], evaluator).error);
    });
  });

  it('seriesFormulaOperands lists referenced keys once, in order', () => {
    expect(seriesFormulaOperands(PV_DIRECT.formula)).toEqual(['pv', 'gridExport', 'batteryCharge', 'consumption']);
  });
});
