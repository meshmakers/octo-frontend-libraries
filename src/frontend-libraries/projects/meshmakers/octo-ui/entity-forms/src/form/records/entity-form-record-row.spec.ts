import type { CkAttributeInfo } from '../../models/entity-form.models';
import {
  buildRecordFieldModels,
  buildRow,
  formatRecordCell,
  fromControlValue,
  humanizeAttributeName,
  recordFieldEditor,
  toControlValue
} from './entity-form-record-row';

function attr(attributeName: string, valueType: string, extra: Partial<CkAttributeInfo> = {}): CkAttributeInfo {
  // isOptional false on purpose: the CK API reports it for every record attribute.
  return { attributeName, valueType, isOptional: false, defaultValues: [], secret: false, ...extra };
}

describe('entity-form-record-row helpers', () => {
  it('maps every value type to the auto editor', () => {
    expect(recordFieldEditor('STRING')).toBe('text');
    for (const t of ['INT', 'INTEGER', 'INT_64', 'INTEGER_64', 'DOUBLE']) {
      expect(recordFieldEditor(t)).toBe('number');
    }
    expect(recordFieldEditor('BOOLEAN')).toBe('toggle');
    expect(recordFieldEditor('DATE_TIME')).toBe('datetime');
    expect(recordFieldEditor('DATE_TIME_OFFSET')).toBe('datetime');
    expect(recordFieldEditor('ENUM')).toBe('enum');
    for (const t of ['STRING_ARRAY', 'INT_ARRAY', 'INTEGER_ARRAY']) {
      expect(recordFieldEditor(t)).toBe('chips');
    }
    expect(recordFieldEditor('RECORD')).toBe('nested');
    expect(recordFieldEditor('RECORD_ARRAY')).toBe('nested');
    for (const t of ['BINARY', 'BINARY_LINKED', 'GEOSPATIAL_POINT', 'TIME_SPAN']) {
      expect(recordFieldEditor(t)).toBe('unsupported');
    }
  });

  it('builds field models: nested records and unsupported types are read-only, nothing is required', () => {
    const fields = buildRecordFieldModels([
      attr('key', 'STRING'),
      attr('children', 'RECORD_ARRAY', { ckRecordId: 'X/Child-1' }),
      attr('blob', 'BINARY'),
      attr('kind', 'ENUM', { enumOptions: [{ key: 0, name: 'A' }] }),
      attr('ids', 'INT_ARRAY')
    ]);
    expect(fields.map(f => [f.attributeName, f.editor, f.readOnly])).toEqual([
      ['key', 'text', false],
      ['children', 'nested', true],
      ['blob', 'unsupported', true],
      ['kind', 'enum', false],
      ['ids', 'chips', false]
    ]);
    expect(fields.some(f => 'required' in f)).toBe(false);
    expect(fields[3].enumOptions).toEqual([{ key: 0, name: 'A' }]);
    expect(fields[4].numericChips).toBe(true);
  });

  it('humanizes camelCase names', () => {
    expect(humanizeAttributeName('privateKeyPassphrase')).toBe('Private key passphrase');
    expect(humanizeAttributeName('order')).toBe('Order');
  });

  it('converts stored values to control values', () => {
    const [date, en, chips, num, flag] = buildRecordFieldModels([
      attr('at', 'DATE_TIME'),
      attr('kind', 'ENUM', { enumOptions: [{ key: 0, name: 'Alpha' }, { key: 1, name: 'Beta' }] }),
      attr('tags', 'STRING_ARRAY'),
      attr('order', 'INT'),
      attr('on', 'BOOLEAN')
    ]);
    expect(toControlValue(date, '2026-10-05T10:00:00.000Z')).toEqual(new Date('2026-10-05T10:00:00.000Z'));
    expect(toControlValue(en, 'beta')).toBe(1);
    expect(toControlValue(en, 0)).toBe(0);
    expect(toControlValue(chips, undefined)).toEqual([]);
    expect(toControlValue(num, '3')).toBe(3);
    expect(toControlValue(flag, 'true')).toBe(true);
  });

  it('converts control values back to the flat form-dict value (Date stays a Date); empty means "drop the key"', () => {
    const [date, chips, ints, text] = buildRecordFieldModels([
      attr('at', 'DATE_TIME'), attr('tags', 'STRING_ARRAY'), attr('ids', 'INTEGER_ARRAY'), attr('key', 'STRING')
    ]);
    expect(fromControlValue(date, new Date('2026-10-05T10:00:00.000Z'))).toEqual(new Date('2026-10-05T10:00:00.000Z'));
    expect(fromControlValue(chips, ['a', 'b'])).toEqual(['a', 'b']);
    expect(fromControlValue(ints, ['1', 'x', '3'])).toEqual([1, 3]);
    expect(fromControlValue(text, '')).toBeUndefined();
    expect(fromControlValue(chips, [])).toBeUndefined();
  });

  it('buildRow keeps read-only and unknown keys, updates editable ones and removes emptied ones', () => {
    const fields = buildRecordFieldModels([attr('key', 'STRING'), attr('title', 'STRING'), attr('children', 'RECORD_ARRAY')]);
    const original = { key: 'a', title: 'Old', children: [{ x: 1 }], legacy: 'kept' };
    const row = buildRow(fields, original, { key: 'b', title: '' });
    expect(row).toEqual({ key: 'b', children: [{ x: 1 }], legacy: 'kept' });
    expect(original.title).toBe('Old');
  });

  it('formats cells', () => {
    expect(formatRecordCell(null)).toBe('');
    expect(formatRecordCell(['a', 'b'])).toBe('a, b');
    expect(formatRecordCell([{ a: 1 }, { a: 2 }])).toBe('[2]');
    expect(formatRecordCell({ a: 1 })).toBe('{…}');
    expect(formatRecordCell(1, [{ key: 1, name: 'One' }])).toBe('One');
    expect(formatRecordCell(true)).toBe('true');
  });
});
