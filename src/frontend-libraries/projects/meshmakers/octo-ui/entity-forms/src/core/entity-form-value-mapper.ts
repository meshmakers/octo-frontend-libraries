import { CkAttributeInfo, CkRecordInfo } from '../models/entity-form.models';

/*
 * Pure value conversion between the generic runtime API and form controls. The rules are ported
 * from octo-ui's (non-exported) `AttributeMapperService`:
 *
 * - READ:  a record comes back as `{ ckRecordId, attributes: [{ attributeName, value }] }`; the form
 *          works with flat `{ camelSub: value }` dictionaries. A single RECORD is represented as an
 *          array with at most one dictionary (the records editor always edits a list).
 * - WRITE: a record is sent as a flat `{ camelSub: value }` dict (NOT `{ attributes: [...] }`, which
 *          the backend ignores -> ASSET1004), a record array as an array of those.
 * - Enums use the numeric key; names coming back are mapped to keys on read.
 * - DATE_TIME / DATE_TIME_OFFSET are `Date` in the form and ISO strings on the wire.
 * - An empty optional value is sent as `null`; an empty required value is omitted.
 */

export const NUMERIC_TYPES: readonly string[] = ['INT', 'INTEGER', 'INT_64', 'INTEGER_64', 'DOUBLE'];
export const DATE_TYPES: readonly string[] = ['DATE_TIME', 'DATE_TIME_OFFSET'];
export const ARRAY_TYPES: readonly string[] = ['STRING_ARRAY', 'INT_ARRAY', 'INTEGER_ARRAY'];
export const RECORD_TYPES: readonly string[] = ['RECORD', 'RECORD_ARRAY'];

export const isNumericType = (t?: string | null): boolean => !!t && NUMERIC_TYPES.includes(t);
export const isDateType = (t?: string | null): boolean => !!t && DATE_TYPES.includes(t);
export const isArrayType = (t?: string | null): boolean => !!t && ARRAY_TYPES.includes(t);
export const isRecordType = (t?: string | null): boolean => !!t && RECORD_TYPES.includes(t);

/** Record infos keyed by versioned `ckRecordId` (as found in `CkAttributeInfo.ckRecordId`). */
export type RecordInfoMap = Record<string, CkRecordInfo>;

/** Attribute metadata the mapper needs (a subset of {@link CkAttributeInfo}). */
export type MapperAttribute = Pick<CkAttributeInfo, 'attributeName' | 'valueType' | 'isOptional'>
  & Partial<Pick<CkAttributeInfo, 'enumOptions' | 'ckRecordId'>>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function enumKey(value: unknown, options?: { key: number; name: string }[]): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (options?.length) {
    const found = options.find((o) => o.key === value || o.name === value
      || (typeof value === 'string' && o.name.toLowerCase() === value.toLowerCase())
      || (typeof value === 'string' && String(o.key) === value));
    if (found) {
      return found.key;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) && value !== '' ? n : value;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    if (typeof value === 'string' && !value.trim()) {
      return null;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toPrimitiveArray(value: unknown, mode: 'number' | 'string'): (number | string)[] {
  let source: unknown = value;
  if (isPlainObject(source) && '_v' in source) {
    source = source['_v'];
  }
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((v) => (isPlainObject(v) && 'key' in v ? v['key'] : v))
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => (mode === 'number' ? Number(v) : String(v)));
}

/** Converts a record value read from the API to a flat dict `{ camelSub: formValue }`. */
export function recordToFormDict(value: unknown, record?: CkRecordInfo, records?: RecordInfoMap): Record<string, unknown> {
  const dict: Record<string, unknown> = {};
  if (!isPlainObject(value)) {
    return dict;
  }
  const entries: [string, unknown][] = Array.isArray(value['attributes'])
    ? (value['attributes'] as { attributeName?: string; value?: unknown }[])
      .filter((a) => !!a?.attributeName)
      .map((a) => [a.attributeName as string, a.value])
    : Object.entries(value).filter(([k]) => k !== 'ckRecordId' && k !== '__typename');
  for (const [name, raw] of entries) {
    const sub = record?.attributes.find((a) => a.attributeName.toLowerCase() === name.toLowerCase());
    const key = sub?.attributeName ?? name;
    dict[key] = sub ? toFormValue(raw, sub, records) : raw;
  }
  return dict;
}

/**
 * Converts a raw API value to the form value shape of the given attribute.
 * Records/record arrays become arrays of flat dicts; unsupported types pass through unchanged.
 */
export function toFormValue(raw: unknown, attribute: MapperAttribute, records?: RecordInfoMap): unknown {
  const type = attribute.valueType;
  const record = attribute.ckRecordId ? records?.[attribute.ckRecordId] : undefined;
  if (type === 'RECORD') {
    if (raw === null || raw === undefined) {
      return [];
    }
    const items = Array.isArray(raw) ? raw : [raw];
    return items.slice(0, 1).map((r) => recordToFormDict(r, record, records));
  }
  if (type === 'RECORD_ARRAY') {
    return Array.isArray(raw) ? raw.map((r) => recordToFormDict(r, record, records)) : [];
  }
  if (raw === null || raw === undefined) {
    return isArrayType(type) ? [] : null;
  }
  if (type === 'ENUM') {
    return enumKey(raw, attribute.enumOptions);
  }
  if (isDateType(type)) {
    return toDate(raw);
  }
  if (type === 'STRING_ARRAY') {
    return toPrimitiveArray(raw, 'string');
  }
  if (type === 'INT_ARRAY' || type === 'INTEGER_ARRAY') {
    return toPrimitiveArray(raw, 'number');
  }
  if (isNumericType(type)) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'BOOLEAN') {
    return raw === true || raw === 'true' || raw === 1;
  }
  return raw;
}

/** True when a form value is "empty" for the empty/optional rules. */
export function isEmptyFormValue(value: unknown, valueType?: string | null): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0 && (isArrayType(valueType) || isRecordType(valueType))) {
    return true;
  }
  if (valueType === 'RECORD' && isPlainObject(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

function recordDictToWire(value: unknown, record?: CkRecordInfo, records?: RecordInfoMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!isPlainObject(value)) {
    return result;
  }
  for (const [key, subValue] of Object.entries(value)) {
    if (!key) {
      continue;
    }
    const sub = record?.attributes.find((a) => a.attributeName === key);
    if (!sub) {
      // Pass-through without metadata (keeps explicit nulls), as AttributeMapperService does.
      result[key] = subValue;
      continue;
    }
    // Record sub-attributes count as optional (CK reports isOptional:false for every record
    // attribute; the server still enforces mandatory ones).
    const mapped = toWireValue(subValue, { ...sub, isOptional: true }, records);
    if (mapped.include) {
      result[key] = mapped.value;
    }
  }
  return result;
}

/**
 * Converts a form value to the mutation wire value.
 * `include: false` means "omit the attribute" (empty value of a required attribute).
 */
export function toWireValue(value: unknown, attribute: MapperAttribute, records?: RecordInfoMap): { include: boolean; value: unknown } {
  const type = attribute.valueType;
  const record = attribute.ckRecordId ? records?.[attribute.ckRecordId] : undefined;
  if (isEmptyFormValue(value, type)) {
    return attribute.isOptional ? { include: true, value: null } : { include: false, value: undefined };
  }
  switch (type) {
    case 'RECORD': {
      const first = Array.isArray(value) ? value[0] : value;
      const dict = recordDictToWire(first, record, records);
      if (Object.keys(dict).length === 0) {
        return attribute.isOptional ? { include: true, value: null } : { include: false, value: undefined };
      }
      return { include: true, value: dict };
    }
    case 'RECORD_ARRAY':
      return { include: true, value: (Array.isArray(value) ? value : [value]).map((r) => recordDictToWire(r, record, records)) };
    case 'ENUM':
      return { include: true, value: enumKey(value, attribute.enumOptions) };
    case 'DATE_TIME':
    case 'DATE_TIME_OFFSET': {
      const d = toDate(value);
      if (!d) {
        return attribute.isOptional ? { include: true, value: null } : { include: false, value: undefined };
      }
      return { include: true, value: d.toISOString() };
    }
    case 'STRING_ARRAY': {
      const arr = toPrimitiveArray(value, 'string');
      return arr.length ? { include: true, value: arr } : (attribute.isOptional ? { include: true, value: null } : { include: false, value: undefined });
    }
    case 'INT_ARRAY':
    case 'INTEGER_ARRAY': {
      const arr = toPrimitiveArray(value, 'number');
      return arr.length ? { include: true, value: arr } : (attribute.isOptional ? { include: true, value: null } : { include: false, value: undefined });
    }
    default:
      if (isNumericType(type) && typeof value === 'string') {
        const n = Number(value);
        return { include: true, value: Number.isFinite(n) ? n : value };
      }
      return { include: true, value };
  }
}

/**
 * Maps form values to `RtEntityAttributeInput[]` for the given attributes (in the given order).
 * Values whose key is absent from `values` are skipped.
 */
export function toAttributeInputs(
  values: Record<string, unknown>,
  attributes: readonly MapperAttribute[],
  records?: RecordInfoMap,
): { attributeName: string; value: unknown }[] {
  const result: { attributeName: string; value: unknown }[] = [];
  for (const attribute of attributes) {
    if (!Object.prototype.hasOwnProperty.call(values, attribute.attributeName)) {
      continue;
    }
    const mapped = toWireValue(values[attribute.attributeName], attribute, records);
    if (mapped.include) {
      result.push({ attributeName: attribute.attributeName, value: mapped.value });
    }
  }
  return result;
}

/**
 * Parses a form `Default` string (or a CK `defaultValues[0]`) into the form value shape:
 * Int via parseInt, Double via parseFloat, Boolean via 'true'/'false', ENUM by name or key,
 * DateTime as ISO -> Date, arrays as a JSON array or a comma list. Returns `undefined` when the
 * input is empty or cannot be parsed.
 */
export function parseDefault(raw: unknown, attribute: MapperAttribute): unknown {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return undefined;
  }
  const type = attribute.valueType;
  const s = typeof raw === 'string' ? raw.trim() : raw;
  if (type === 'INT' || type === 'INTEGER' || type === 'INT_64' || type === 'INTEGER_64') {
    const n = typeof s === 'number' ? Math.trunc(s) : parseInt(String(s), 10);
    return Number.isNaN(n) ? undefined : n;
  }
  if (type === 'DOUBLE') {
    const n = typeof s === 'number' ? s : parseFloat(String(s));
    return Number.isNaN(n) ? undefined : n;
  }
  if (type === 'BOOLEAN') {
    if (s === true || s === false) {
      return s;
    }
    const lower = String(s).toLowerCase();
    return lower === 'true' ? true : lower === 'false' ? false : undefined;
  }
  if (type === 'ENUM') {
    const options = attribute.enumOptions ?? [];
    const found = options.find((o) => String(o.key) === String(s) || o.name.toLowerCase() === String(s).toLowerCase());
    if (found) {
      return found.key;
    }
    const n = Number(s);
    return options.length === 0 && Number.isFinite(n) ? n : undefined;
  }
  if (isDateType(type)) {
    return toDate(s) ?? undefined;
  }
  if (isArrayType(type)) {
    let arr: unknown[];
    if (Array.isArray(s)) {
      arr = s;
    } else {
      const text = String(s);
      try {
        const parsed: unknown = JSON.parse(text);
        arr = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        arr = text.split(',').map((p) => p.trim()).filter(Boolean);
      }
    }
    return type === 'STRING_ARRAY' ? arr.map((v) => String(v)) : arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  }
  if (type === 'STRING') {
    return String(s);
  }
  return undefined;
}

/** Deep equality for form values (Dates by time, arrays/objects structurally). */
export function formValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  const emptyA = isEmpty(a);
  const emptyB = isEmpty(b);
  if (emptyA && emptyB) {
    return true;
  }
  if (a instanceof Date || b instanceof Date) {
    const da = toDate(a);
    const db = toDate(b);
    return !!da && !!db && da.getTime() === db.getTime();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => formValuesEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!formValuesEqual(a[k], b[k])) {
        return false;
      }
    }
    return true;
  }
  return false;
}
