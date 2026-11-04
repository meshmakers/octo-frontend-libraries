import {
  configuredValueLabel,
  duplicateValueLabelValues,
  fromValueLabelRows,
  normalizeChartValueLabels,
  seriesLabelsByRawValue,
  toValueLabelRows
} from './chart-value-labels';

describe('chart value labels (AB#7235)', () => {
  describe('normalizeChartValueLabels', () => {
    it('keeps complete entries, trims the name and keeps the raw value exactly as stored', () => {
      expect(normalizeChartValueLabels({ '1-1:2.9.0 G.03': ' Feed-in ', ' padded ': 'X' })).toEqual({ '1-1:2.9.0 G.03': 'Feed-in', ' padded ': 'X' });
    });

    it('drops blank names, empty keys and non-string names', () => {
      expect(normalizeChartValueLabels({ A: '   ', '': 'x', B: 5, C: null, D: 'ok' })).toEqual({ D: 'ok' });
    });

    it('returns undefined for an empty map and for anything that is not a plain object', () => {
      expect(normalizeChartValueLabels({})).toBeUndefined();
      expect(normalizeChartValueLabels({ A: '' })).toBeUndefined();
      expect(normalizeChartValueLabels(undefined)).toBeUndefined();
      expect(normalizeChartValueLabels(null)).toBeUndefined();
      expect(normalizeChartValueLabels(['a'])).toBeUndefined();
      expect(normalizeChartValueLabels('A=B')).toBeUndefined();
    });
  });

  describe('configuredValueLabel', () => {
    it('finds the exact raw value only', () => {
      const labels = { 'A1': 'Alpha' };
      expect(configuredValueLabel(labels, 'A1')).toBe('Alpha');
      expect(configuredValueLabel(labels, 'a1')).toBeUndefined();
      expect(configuredValueLabel(labels, 'A1 ')).toBeUndefined();
    });

    it('does not find inherited members of the map', () => {
      expect(configuredValueLabel({ A1: 'Alpha' }, 'constructor')).toBeUndefined();
      expect(configuredValueLabel({ A1: 'Alpha' }, 'toString')).toBeUndefined();
      expect(configuredValueLabel({ A1: 'Alpha' }, '__proto__')).toBeUndefined();
    });

    it('is undefined without a map', () => {
      expect(configuredValueLabel(undefined, 'A1')).toBeUndefined();
      expect(configuredValueLabel(null, 'A1')).toBeUndefined();
      expect(configuredValueLabel({}, 'A1')).toBeUndefined();
    });
  });

  describe('seriesLabelsByRawValue', () => {
    it('names the configured values and leaves the others as they are', () => {
      const names = seriesLabelsByRawValue(['A1', 'B2'], { A1: 'Alpha' });
      expect(names.get('A1')).toBe('Alpha');
      expect(names.get('B2')).toBe('B2');
    });

    it('keeps two raw values with the same name apart by the raw value', () => {
      const names = seriesLabelsByRawValue(['A1', 'B2', 'C3'], { A1: 'Same', B2: 'Same', C3: 'Other' });
      expect(names.get('A1')).toBe('Same (A1)');
      expect(names.get('B2')).toBe('Same (B2)');
      expect(names.get('C3')).toBe('Other');
    });

    it('keeps a configured name apart from an unlabelled raw value that looks the same', () => {
      const names = seriesLabelsByRawValue(['A1', 'Alpha'], { A1: 'Alpha' });
      expect(names.get('A1')).toBe('Alpha (A1)');
      expect(names.get('Alpha')).toBe('Alpha');
      expect(new Set(names.values()).size).toBe(2);
    });

    it('counts a repeated raw value once', () => {
      expect(seriesLabelsByRawValue(['A1', 'A1'], { A1: 'Alpha' }).get('A1')).toBe('Alpha');
    });

    it('maps every value to itself without labels', () => {
      expect([...seriesLabelsByRawValue(['A1', 'B2'], undefined).entries()]).toEqual([['A1', 'A1'], ['B2', 'B2']]);
    });
  });

  describe('editor rows', () => {
    it('turns a label map into rows with ids and back', () => {
      const rows = toValueLabelRows({ A1: 'Alpha', B2: 'Beta' }, 10);
      expect(rows).toEqual([{ id: 10, value: 'A1', label: 'Alpha' }, { id: 11, value: 'B2', label: 'Beta' }]);
      expect(fromValueLabelRows(rows)).toEqual({ A1: 'Alpha', B2: 'Beta' });
    });

    it('has no rows without labels', () => {
      expect(toValueLabelRows(undefined)).toEqual([]);
    });

    it('skips unfinished rows and returns undefined when none is complete', () => {
      expect(fromValueLabelRows([{ id: 1, value: 'A1', label: '' }, { id: 2, value: '', label: 'x' }, { id: 3, value: ' ', label: ' ' }])).toBeUndefined();
      expect(fromValueLabelRows([])).toBeUndefined();
      expect(fromValueLabelRows(undefined)).toBeUndefined();
    });

    it('trims the value of a typed row', () => {
      expect(fromValueLabelRows([{ id: 1, value: ' A1 ', label: ' Alpha ' }])).toEqual({ A1: 'Alpha' });
    });

    it('an unfinished duplicate row does not erase the name of the complete row', () => {
      const complete = { id: 1, value: 'A1', label: 'Alpha' };
      const unfinishedAfter = { id: 2, value: 'A1', label: '' };
      expect(fromValueLabelRows([complete, unfinishedAfter])).toEqual({ A1: 'Alpha' });
      expect(fromValueLabelRows([unfinishedAfter, complete])).toEqual({ A1: 'Alpha' });
      expect(fromValueLabelRows([complete, { id: 3, value: 'A1', label: '   ' }])).toEqual({ A1: 'Alpha' });
    });

    it('lets the later of two complete rows with the same value win', () => {
      expect(fromValueLabelRows([{ id: 1, value: 'A1', label: 'Old' }, { id: 2, value: 'A1', label: 'New' }])).toEqual({ A1: 'New' });
    });

    it('a name cleared to empty removes the entry', () => {
      expect(fromValueLabelRows([{ id: 1, value: 'A1', label: '' }, { id: 2, value: 'B2', label: 'Beta' }])).toEqual({ B2: 'Beta' });
    });
  });

  describe('duplicateValueLabelValues', () => {
    it('reports a value of two complete rows once', () => {
      const rows = [
        { id: 1, value: 'A1', label: 'a' }, { id: 2, value: ' A1 ', label: 'b' }, { id: 3, value: 'A1', label: 'c' }, { id: 4, value: 'B2', label: 'd' }
      ];
      expect(duplicateValueLabelValues(rows)).toEqual(['A1']);
    });

    it('ignores unfinished rows', () => {
      expect(duplicateValueLabelValues([{ id: 1, value: 'A1', label: 'a' }, { id: 2, value: 'A1', label: '' }, { id: 3, value: '', label: 'x' }, { id: 4, value: '', label: 'y' }])).toEqual([]);
    });
  });
});
