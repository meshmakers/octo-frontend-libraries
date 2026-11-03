import { KPI_MAX_DECIMAL_PLACES, normalizeKpiDecimalPlaces } from './kpi-decimal-places';

describe('normalizeKpiDecimalPlaces (AB#7686)', () => {
  it('accepts the integers 0 to 3', () => {
    expect(KPI_MAX_DECIMAL_PLACES).toBe(3);
    for (let i = 0; i <= 3; i++) {
      expect(normalizeKpiDecimalPlaces(i)).toBe(i);
    }
  });

  it('rejects a value above 3', () => {
    for (const value of [4, 6, 10, 20, 21, 100, 101, 1e21]) {
      expect(normalizeKpiDecimalPlaces(value)).toBeUndefined();
    }
  });

  it('rejects a non-integer, a negative value and non-finite numbers', () => {
    for (const value of [1.5, -1, NaN, Infinity, -Infinity]) {
      expect(normalizeKpiDecimalPlaces(value)).toBeUndefined();
    }
  });

  it('rejects everything that is not a number, numeric strings included', () => {
    for (const value of ['1', '', 'abc', null, undefined, true, {}, [1]]) {
      expect(normalizeKpiDecimalPlaces(value)).toBeUndefined();
    }
  });
});
