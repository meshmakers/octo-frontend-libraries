import { TableColumn } from '../../models/meshboard.models';
import {
  TableColumnLabelProblems,
  mergePersistentQueryColumns,
  mergeRuntimeEntityColumns,
  resolveColumnTitle,
  resolveValueLabels
} from './table-column-labels';

function problems(): TableColumnLabelProblems {
  return { unknownCultureKeys: [], malformedValueKeys: [] };
}

describe('resolveColumnTitle (AB#7655)', () => {
  const column: TableColumn = {
    field: 'dataquality_max',
    title: 'Dataquality',
    titles: { 'de-AT': 'Datenqualität', 'en-GB': 'Data quality' }
  };

  it('picks the exact culture', () => {
    expect(resolveColumnTitle(column, 'de-AT')).toBe('Datenqualität');
    expect(resolveColumnTitle(column, 'en-GB')).toBe('Data quality');
  });

  it('matches the culture case-insensitively', () => {
    expect(resolveColumnTitle(column, 'de-at')).toBe('Datenqualität');
  });

  it('falls back to a key equal to the language part', () => {
    const withLanguageKey: TableColumn = { ...column, titles: { de: 'Qualität (de)', 'de-AT': 'Datenqualität' } };
    expect(resolveColumnTitle(withLanguageKey, 'de-DE')).toBe('Qualität (de)');
    expect(resolveColumnTitle(withLanguageKey, 'de-AT')).toBe('Datenqualität');
  });

  it('never picks a sibling culture (de-DE does not take de-AT) and falls back to title', () => {
    expect(resolveColumnTitle(column, 'de-DE')).toBe('Dataquality');
    expect(resolveColumnTitle(column, 'fr')).toBe('Dataquality');
  });

  it('a bare language does not pick a culture key', () => {
    expect(resolveColumnTitle(column, 'de')).toBe('Dataquality');
  });

  it('is title without a language (AC 2) or without titles', () => {
    expect(resolveColumnTitle(column, null)).toBe('Dataquality');
    expect(resolveColumnTitle({ field: 'a', title: 'A' }, 'de-AT')).toBe('A');
  });

  it('ignores and reports unknown culture keys', () => {
    const p = problems();
    const bad: TableColumn = { field: 'a', title: 'A', titles: { german: 'Deutsch', de_AT: 'X', 'en-GB': 'English' } };
    expect(resolveColumnTitle(bad, 'en-GB', p)).toBe('English');
    expect(p.unknownCultureKeys).toEqual(['german', 'de_AT']);
  });

  it('ignores a non-object titles value', () => {
    expect(resolveColumnTitle({ field: 'a', title: 'A', titles: 'oops' as never }, 'de-AT')).toBe('A');
  });
});

describe('resolveValueLabels (AB#7655)', () => {
  const quality: TableColumn = {
    field: 'q',
    title: 'Q',
    valueLabels: { '1': { label: 'L1' }, '2': { label: 'L2', color: 'var(--kendo-color-warning)' }, '3': { label: 'L3' } }
  };

  it('maps raw values to labels with their optional colour', () => {
    const labels = resolveValueLabels(quality, null)!;
    expect(labels.get('1')).toEqual({ text: 'L1' });
    expect(labels.get('2')).toEqual({ text: 'L2', color: 'var(--kendo-color-warning)' });
    expect(labels.get('4')).toBeUndefined();
  });

  it('resolves labels given per language like the titles', () => {
    const column: TableColumn = {
      field: 'q', title: 'Q',
      valueLabels: { '1': { label: { 'de-AT': 'gut', en: 'good' } } }
    };
    expect(resolveValueLabels(column, 'de-AT')!.get('1')).toEqual({ text: 'gut' });
    expect(resolveValueLabels(column, 'en-GB')!.get('1')).toEqual({ text: 'good' });
    // No match (and no language): the entry is left out, so the cell shows the raw value.
    expect(resolveValueLabels(column, 'de-DE')!.get('1')).toBeUndefined();
    expect(resolveValueLabels(column, null)!.get('1')).toBeUndefined();
  });

  it('is null without valueLabels', () => {
    expect(resolveValueLabels({ field: 'a', title: 'A' }, 'de-AT')).toBeNull();
  });

  it('ignores and reports malformed entries and unknown culture keys, keeping the good ones', () => {
    const p = problems();
    const column = {
      field: 'q', title: 'Q',
      valueLabels: {
        '1': { label: 'L1' },
        '2': 'L2',
        '3': { color: 'red' },
        '4': { label: 'L4', color: 7 },
        '5': { label: { german: 'fünf', 'en-GB': 'five' } },
        '6': { label: {} },
        '7': { label: { 'de-AT': 3 } }
      }
    } as unknown as TableColumn;
    const labels = resolveValueLabels(column, 'en-GB', p)!;
    expect(labels.get('1')).toEqual({ text: 'L1' });
    expect(labels.get('5')).toEqual({ text: 'five' });
    expect([...labels.keys()]).toEqual(['1', '5']);
    expect(p.malformedValueKeys).toEqual(['2', '3', '4', '6', '7']);
    expect(p.unknownCultureKeys).toEqual(['german']);
  });

  it('reports a valueLabels value that is not an object and returns null', () => {
    const p = problems();
    expect(resolveValueLabels({ field: 'q', title: 'Q', valueLabels: [] as never }, null, p)).toBeNull();
    expect(p.malformedValueKeys).toEqual(['*']);
  });
});

describe('table config dialog column merge (AB#7655 AC 6)', () => {
  const authored: TableColumn[] = [
    {
      field: 'quality', title: 'Quality', width: 120, format: '1.0-0',
      titles: { 'de-AT': 'Qualität' },
      valueLabels: { '1': { label: 'L1' } },
      statusMapping: { ok: { icon: 'check-circle', tooltip: 'OK' } }
    },
    { field: 'name', title: 'Name' }
  ];
  const title = (field: string) => `T:${field}`;

  it('keeps every property of columns that stay selected on the same CK type', () => {
    const merged = mergeRuntimeEntityColumns(['quality', 'name'], authored, true, title);
    expect(merged).toEqual(authored);
    expect(merged[0]).toBe(authored[0]);
  });

  it('adds new fields with a default title and drops deselected ones, in the selected order', () => {
    const merged = mergeRuntimeEntityColumns(['state', 'quality'], authored, true, title);
    expect(merged).toEqual([{ field: 'state', title: 'T:state', width: undefined }, authored[0]]);
  });

  it('starts fresh when the CK type changed', () => {
    const merged = mergeRuntimeEntityColumns(['quality'], authored, false, title);
    expect(merged).toEqual([{ field: 'quality', title: 'T:quality', width: undefined }]);
  });

  it('keeps the explicit columns of a persistent-query table on the same query, else none', () => {
    expect(mergePersistentQueryColumns(authored, true)).toEqual(authored);
    expect(mergePersistentQueryColumns(authored, false)).toEqual([]);
    expect(mergePersistentQueryColumns(undefined, true)).toEqual([]);
  });
});
