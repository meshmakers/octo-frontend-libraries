import {
  formValuesEqual,
  parseDefault,
  toAttributeInputs,
  toFormValue,
  toWireValue,
} from './entity-form-value-mapper';
import { attr } from './testing/factories';

const REC = 'System.UI-2.7.0/EntityFormSection-1';
const records = { [REC]: { ckRecordId: REC, attributes: [attr('key'), attr('order', 'INTEGER'), attr('when', 'DATE_TIME')] } };
const enumAttr = attr('channel', 'ENUM', { enumOptions: [{ key: 0, name: 'Dev' }, { key: 1, name: 'Release' }] });

describe('toFormValue (read)', () => {
  it('turns a record array {ckRecordId, attributes:[...]} into flat dicts', () => {
    const raw = [{ ckRecordId: 'System.UI/EntityFormSection', attributes: [{ attributeName: 'key', value: 'general' }, { attributeName: 'order', value: 0 }] }];
    expect(toFormValue(raw, attr('sections', 'RECORD_ARRAY', { ckRecordId: REC }), records)).toEqual([{ key: 'general', order: 0 }]);
  });

  it('turns a single record into an array of at most one dict; null into []', () => {
    const a = attr('one', 'RECORD', { ckRecordId: REC });
    expect(toFormValue({ attributes: [{ attributeName: 'key', value: 'k' }] }, a, records)).toEqual([{ key: 'k' }]);
    expect(toFormValue(null, a, records)).toEqual([]);
  });

  it('converts record sub-values (dates) with the record metadata', () => {
    const raw = [{ attributes: [{ attributeName: 'when', value: '2026-01-01T00:00:00Z' }] }];
    expect(toFormValue(raw, attr('s', 'RECORD_ARRAY', { ckRecordId: REC }), records)).toEqual([{ when: new Date('2026-01-01T00:00:00Z') }]);
  });

  it('maps enum names to keys and keeps keys', () => {
    expect(toFormValue('Release', enumAttr)).toBe(1);
    expect(toFormValue(0, enumAttr)).toBe(0);
  });

  it('dates become Date; invalid become null', () => {
    expect(toFormValue('2026-10-05T21:09:36.997Z', attr('d', 'DATE_TIME'))).toEqual(new Date('2026-10-05T21:09:36.997Z'));
    expect(toFormValue('nope', attr('d', 'DATE_TIME'))).toBeNull();
  });

  it('arrays become primitive arrays; null array becomes []', () => {
    expect(toFormValue(['a', 'b'], attr('t', 'STRING_ARRAY'))).toEqual(['a', 'b']);
    expect(toFormValue([{ key: 1 }, '2'], attr('t', 'INT_ARRAY'))).toEqual([1, 2]);
    expect(toFormValue(null, attr('t', 'STRING_ARRAY'))).toEqual([]);
  });
});

describe('toWireValue (write)', () => {
  it('record array is sent as an array of flat dicts (not {attributes:[...]})', () => {
    const a = attr('sections', 'RECORD_ARRAY', { ckRecordId: REC });
    expect(toWireValue([{ key: 'general', order: '2' }], a, records)).toEqual({ include: true, value: [{ key: 'general', order: 2 }] });
  });

  it('single record is sent as a flat dict', () => {
    expect(toWireValue([{ key: 'k' }], attr('one', 'RECORD', { ckRecordId: REC }), records)).toEqual({ include: true, value: { key: 'k' } });
  });

  it('record sub-values pass through without metadata, empty record subs become null', () => {
    expect(toWireValue([{ x: 1, key: '' }], attr('r', 'RECORD_ARRAY', { ckRecordId: REC }), records)).toEqual({ include: true, value: [{ x: 1, key: null }] });
  });

  it('enum name maps to key', () => {
    expect(toWireValue('Release', enumAttr)).toEqual({ include: true, value: 1 });
    expect(toWireValue(0, enumAttr)).toEqual({ include: true, value: 0 });
  });

  it('date ISO round trip', () => {
    const iso = '2026-10-05T21:09:36.997Z';
    const formValue = toFormValue(iso, attr('d', 'DATE_TIME'));
    expect(toWireValue(formValue, attr('d', 'DATE_TIME'))).toEqual({ include: true, value: iso });
  });

  it('optional empty gives null, required empty is omitted', () => {
    expect(toWireValue('', attr('o', 'STRING', { isOptional: true }))).toEqual({ include: true, value: null });
    expect(toWireValue(null, attr('o', 'INT', { isOptional: true }))).toEqual({ include: true, value: null });
    expect(toWireValue([], attr('o', 'RECORD_ARRAY', { isOptional: true }))).toEqual({ include: true, value: null });
    expect(toWireValue('', attr('r', 'STRING', { isOptional: false }))).toEqual({ include: false, value: undefined });
    expect(toWireValue([], attr('r', 'STRING_ARRAY', { isOptional: false }))).toEqual({ include: false, value: undefined });
  });

  it('chips arrays are normalised', () => {
    expect(toWireValue(['a', 2], attr('t', 'STRING_ARRAY'))).toEqual({ include: true, value: ['a', '2'] });
    expect(toWireValue(['1', 2], attr('t', 'INTEGER_ARRAY'))).toEqual({ include: true, value: [1, 2] });
  });

  it('numeric strings become numbers', () => {
    expect(toWireValue('22', attr('port', 'INTEGER'))).toEqual({ include: true, value: 22 });
  });

  it('toAttributeInputs skips absent keys and omitted values', () => {
    const inputs = toAttributeInputs({ a: 'x', b: '', c: '' }, [attr('a'), attr('b', 'STRING', { isOptional: false }), attr('c'), attr('d')]);
    expect(inputs).toEqual([{ attributeName: 'a', value: 'x' }, { attributeName: 'c', value: null }]);
  });
});

describe('parseDefault', () => {
  it('parses per type', () => {
    expect(parseDefault('22', attr('p', 'INTEGER'))).toBe(22);
    expect(parseDefault('1.5', attr('p', 'DOUBLE'))).toBe(1.5);
    expect(parseDefault('false', attr('p', 'BOOLEAN'))).toBe(false);
    expect(parseDefault('dev', enumAttr)).toBe(0);
    expect(parseDefault('1', enumAttr)).toBe(1);
    expect(parseDefault('nope', enumAttr)).toBeUndefined();
    expect(parseDefault('["a","b"]', attr('t', 'STRING_ARRAY'))).toEqual(['a', 'b']);
    expect(parseDefault('1, 2', attr('t', 'INT_ARRAY'))).toEqual([1, 2]);
    expect(parseDefault('', attr('s'))).toBeUndefined();
    expect(parseDefault('x', attr('b', 'BINARY'))).toBeUndefined();
  });
});

describe('formValuesEqual', () => {
  it('treats empties alike and compares dates, arrays and dicts structurally', () => {
    expect(formValuesEqual(null, '')).toBe(true);
    expect(formValuesEqual([], null)).toBe(true);
    expect(formValuesEqual(new Date(5), '1970-01-01T00:00:00.005Z')).toBe(true);
    expect(formValuesEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(formValuesEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
    expect(formValuesEqual(1, '1')).toBe(false);
  });
});
