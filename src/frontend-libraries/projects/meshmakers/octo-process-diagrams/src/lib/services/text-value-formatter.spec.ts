import { ExpressionEvaluatorService } from './expression-evaluator.service';
import {
  applyTextValueToPrimitive,
  evaluateTextValue,
  formatTextValue,
  textValueDecimals,
  TEXT_VALUE_DEFAULT_NO_VALUE
} from './text-value-formatter';

/** Grouping separators differ per ICU build (space, NBSP, narrow NBSP); compare with plain spaces. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

describe('text value formatter (AB#8022)', () => {
  const evaluator = new ExpressionEvaluatorService();
  const kw1 = { unit: 'kW', decimals: 1 };

  describe('formatTextValue', () => {
    it('formats with the decimals and unit in de-AT', () => {
      expect(formatTextValue(14.425, kw1, 'de-AT')).toBe('14,4 kW');
    });

    it('uses de-AT when the host has no language', () => {
      expect(formatTextValue(14.425, kw1, null)).toBe('14,4 kW');
      expect(formatTextValue(14.425, kw1, undefined)).toBe('14,4 kW');
      expect(formatTextValue(14.425, kw1, '  ')).toBe('14,4 kW');
    });

    it('formats in en-GB', () => {
      expect(formatTextValue(14.425, kw1, 'en-GB')).toBe('14.4 kW');
    });

    it('groups thousands as per locale', () => {
      // CLDR de-AT groups with a (non-breaking) space, like the KPI widgets do
      expect(plain(formatTextValue(1234.5, kw1, 'de-AT'))).toBe('1 234,5 kW');
      expect(formatTextValue(1234.5, kw1, 'de-DE')).toBe('1.234,5 kW');
      expect(formatTextValue(1234.5, kw1, 'en-GB')).toBe('1,234.5 kW');
    });

    it('defaults to 0 decimals and clamps decimals to 0–6', () => {
      expect(formatTextValue(14.6, { unit: 'kW' }, 'de-AT')).toBe('15 kW');
      expect(formatTextValue(1.23456789, { decimals: 9 }, 'en-GB')).toBe('1.234568');
      expect(formatTextValue(1.5, { decimals: -2 }, 'en-GB')).toBe('2');
      expect(textValueDecimals({ decimals: 2.4 })).toBe(2);
      expect(textValueDecimals(undefined)).toBe(0);
    });

    it('pads to the configured decimals', () => {
      expect(formatTextValue(11, kw1, 'de-AT')).toBe('11,0 kW');
      expect(formatTextValue(0, kw1, 'de-AT')).toBe('0,0 kW');
    });

    it('never shows a sign on a value that rounds to zero', () => {
      expect(formatTextValue(-0.04, kw1, 'de-AT')).toBe('0,0 kW');
      expect(formatTextValue(-3.24, kw1, 'de-AT')).toBe('-3,2 kW');
    });

    it('takes the property unit when the format has none, and no unit for an empty one', () => {
      expect(formatTextValue(5, { decimals: 0 }, 'de-AT', '%')).toBe('5 %');
      expect(formatTextValue(5, { unit: '' }, 'de-AT', '%')).toBe('5');
      expect(formatTextValue(5, undefined, 'de-AT')).toBe('5');
    });

    it('shows strings as they are with the unit, without number formatting', () => {
      expect(formatTextValue('1234.5', kw1, 'de-AT')).toBe('1234.5 kW');
      expect(formatTextValue('Import', { unit: '' }, 'de-AT')).toBe('Import');
      expect(formatTextValue(true, { unit: '' }, 'de-AT')).toBe('true');
    });

    it('shows the no-value text for missing values', () => {
      for (const missing of [undefined, null, NaN, Infinity, -Infinity, '', '   ', {}]) {
        expect(formatTextValue(missing, kw1, 'de-AT')).toBe(TEXT_VALUE_DEFAULT_NO_VALUE);
      }
      expect(TEXT_VALUE_DEFAULT_NO_VALUE).toBe(String.fromCharCode(0x2013));
      expect(formatTextValue(null, { noValueText: 'n/a' }, 'de-AT')).toBe('n/a');
      expect(formatTextValue(null, { noValueText: '' }, 'de-AT')).toBe('');
    });

    it('falls back to de-AT for a malformed culture code', () => {
      expect(formatTextValue(14.425, kw1, 'not a locale!')).toBe('14,4 kW');
    });
  });

  describe('evaluateTextValue', () => {
    const binding = (expression: string, textFormat = kw1) => ({ expression, textFormat });
    const numberProp = { type: 'number' as const, unit: 'W' };

    it('formats the value of a number property', () => {
      expect(evaluateTextValue(14.425, binding('value'), { evaluator, locale: 'de-AT', property: numberProp })).toBe('14,4 kW');
    });

    it('runs the expression before formatting', () => {
      expect(evaluateTextValue(-3.24, binding('abs(value)'), { evaluator, locale: 'de-AT', property: numberProp })).toBe('3,2 kW');
      expect(evaluateTextValue(14425, binding('value / 1000'), { evaluator, locale: 'en-GB', property: numberProp })).toBe('14.4 kW');
    });

    it('appends the unit to a string result without number formatting', () => {
      const result = evaluateTextValue(-3, binding("value >= 0 ? 'Bezug' : 'Einspeisung'", { unit: '', decimals: 1 }),
        { evaluator, locale: 'de-AT', property: numberProp });
      expect(result).toBe('Einspeisung');
    });

    it('treats undefined, null and non-numeric strings of a number property as no value — never 0', () => {
      for (const missing of [undefined, null, 'n/a', '', NaN]) {
        expect(evaluateTextValue(missing, binding('value'), { evaluator, locale: 'de-AT', property: numberProp })).toBe('–');
      }
    });

    it('does not run the expression without a value', () => {
      const evaluate = vi.fn();
      expect(evaluateTextValue(undefined, binding('abs(value)'), { evaluator: { evaluate }, property: numberProp })).toBe('–');
      expect(evaluate).not.toHaveBeenCalled();
    });

    it('parses numeric strings of a number property', () => {
      expect(evaluateTextValue(' 14.425 ', binding('value'), { evaluator, locale: 'de-AT', property: numberProp })).toBe('14,4 kW');
    });

    it('keeps strings of a string property', () => {
      expect(evaluateTextValue('Laden', binding('value', { unit: '', decimals: 0 }), { evaluator, property: { type: 'string' } })).toBe('Laden');
    });

    it('shows the no-value text when the expression fails', () => {
      expect(evaluateTextValue(5, binding('value +'), { evaluator, property: numberProp })).toBe('–');
    });

    it('uses the property unit when the binding has no format', () => {
      expect(evaluateTextValue(15.4, { expression: 'value' }, { evaluator, locale: 'de-AT', property: numberProp })).toBe('15 W');
    });

    it('passes extra context variables to the expression', () => {
      expect(evaluateTextValue(2, binding('value * factor'), { evaluator, locale: 'en-GB', property: numberProp, context: { factor: 3 } })).toBe('6.0 kW');
    });
  });

  describe('applyTextValueToPrimitive', () => {
    it('replaces the content of a text primitive', () => {
      const text = { type: 'text', config: { content: 'static', textStyle: { fontSize: 12 } } };
      const result = applyTextValueToPrimitive(text, '14,4 kW');
      expect(result.config).toEqual({ content: '14,4 kW', textStyle: { fontSize: 12 } });
    });

    it('leaves other primitives untouched', () => {
      const rect = { type: 'rectangle', config: { width: 10 } };
      expect(applyTextValueToPrimitive(rect, 'x').config).toEqual({ width: 10 });
    });
  });
});
