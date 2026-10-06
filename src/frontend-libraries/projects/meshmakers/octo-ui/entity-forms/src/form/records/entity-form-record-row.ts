import { SecretState, SecretStatusLabels, formatSecretStatus, isSecretStateObject, isSecretValueType, toSecretState } from '@meshmakers/octo-services';
import type { CkAttributeInfo } from '../../models/entity-form.models';

/**
 * Editor kinds of a record sub-field. A subset of `EntityFormEditor`, derived with the auto rules
 * of the resolver (record sub-fields carry no form definition of their own).
 */
export type RecordFieldEditor = 'text' | 'number' | 'toggle' | 'enum' | 'datetime' | 'chips' | 'nested' | 'secret' | 'unsupported';

/** One editable (or read-only displayed) sub-field of a record row. */
export interface RecordFieldModel {
  attributeName: string;
  valueType: string;
  label: string;
  description?: string | null;
  editor: RecordFieldEditor;
  /** Nested records and unsupported types are shown, never edited; their value is kept as is. */
  readOnly: boolean;
  enumOptions?: { key: number; name: string }[];
  /** True for INT/INTEGER arrays: chips are converted back to numbers. */
  numericChips?: boolean;
}

const NUMERIC = new Set(['INT', 'INTEGER', 'INT_64', 'INTEGER_64', 'DOUBLE']);
const DATES = new Set(['DATE_TIME', 'DATE_TIME_OFFSET']);
const NUMERIC_ARRAYS = new Set(['INT_ARRAY', 'INTEGER_ARRAY']);
const ARRAYS = new Set(['STRING_ARRAY', 'INT_ARRAY', 'INTEGER_ARRAY']);
const RECORDS = new Set(['RECORD', 'RECORD_ARRAY']);

/** Auto editor for a record sub-attribute (same table as the resolver's `auto` rule). */
export function recordFieldEditor(valueType: string): RecordFieldEditor {
  const t = (valueType ?? '').toUpperCase();
  if (isSecretValueType(t)) {
    // SECRET member (AB#5528): badge + write-only input; empty keeps the stored value (record key).
    return 'secret';
  }
  if (t === 'STRING') {
    return 'text';
  }
  if (NUMERIC.has(t)) {
    return 'number';
  }
  if (t === 'BOOLEAN') {
    return 'toggle';
  }
  if (DATES.has(t)) {
    return 'datetime';
  }
  if (t === 'ENUM') {
    return 'enum';
  }
  if (ARRAYS.has(t)) {
    return 'chips';
  }
  if (RECORDS.has(t)) {
    return 'nested';
  }
  return 'unsupported';
}

/** Turns `someAttributeName` into `Some attribute name` for a label. */
export function humanizeAttributeName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  if (!spaced) {
    return name;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Builds the sub-field models of a record. Record sub-fields are **always optional** in the UI:
 * the CK API reports `isOptional: false` for every record attribute (backend defect), so no
 * "required" state is derived from it; the server still enforces mandatory attributes.
 */
export function buildRecordFieldModels(attributes: CkAttributeInfo[]): RecordFieldModel[] {
  return attributes.map(a => {
    const editor = recordFieldEditor(a.valueType);
    return {
      attributeName: a.attributeName,
      valueType: a.valueType,
      label: humanizeAttributeName(a.attributeName),
      description: a.description ?? null,
      editor,
      readOnly: editor === 'nested' || editor === 'unsupported',
      enumOptions: editor === 'enum' ? (a.enumOptions ?? []) : undefined,
      numericChips: editor === 'chips' && NUMERIC_ARRAYS.has((a.valueType ?? '').toUpperCase())
    };
  });
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Converts a stored row value into the control value of its editor. */
export function toControlValue(field: RecordFieldModel, value: unknown): unknown {
  if (field.editor === 'secret') {
    // Never prefilled: a stored secret is a state object; a value typed earlier in this session
    // (not saved yet) is shown again so the row can still be corrected.
    return typeof value === 'string' ? value : null;
  }
  if (value === undefined || value === null) {
    return field.editor === 'chips' ? [] : null;
  }
  switch (field.editor) {
    case 'datetime': {
      if (value instanceof Date) {
        return value;
      }
      const date = new Date(String(value));
      return isNaN(date.getTime()) ? null : date;
    }
    case 'enum': {
      if (typeof value === 'number') {
        return value;
      }
      const byName = field.enumOptions?.find(o => o.name.toLowerCase() === String(value).toLowerCase());
      if (byName) {
        return byName.key;
      }
      const key = Number(value);
      return isNaN(key) ? null : key;
    }
    case 'chips':
      return Array.isArray(value) ? value.map(v => String(v)) : [String(value)];
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return isNaN(n) ? null : n;
    }
    case 'toggle':
      return value === true || value === 'true';
    default:
      return value;
  }
}

/** Converts a control value back into the flat form-dict value (value-mapper form shape); `undefined` drops the key. */
export function fromControlValue(field: RecordFieldModel, value: unknown): unknown {
  if (isEmpty(value)) {
    return undefined;
  }
  switch (field.editor) {
    case 'datetime':
      // The form shape of a date is a `Date` (value mapper); it becomes ISO on the wire.
      return value;
    case 'chips':
      return field.numericChips
        ? (value as unknown[]).map(v => Number(v)).filter(v => !isNaN(v))
        : (value as unknown[]).map(v => String(v));
    case 'text':
      return String(value);
    default:
      return value;
  }
}

/**
 * Builds the resulting row: values of read-only sub-fields and of keys the record model does not
 * know are kept verbatim; editable sub-fields are taken from the form, empty ones are removed.
 */
export function buildRow(
  fields: RecordFieldModel[],
  original: Record<string, unknown> | null | undefined,
  formValue: Record<string, unknown>
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...(original ?? {}) };
  for (const field of fields) {
    if (field.readOnly) {
      continue;
    }
    if (field.editor === 'secret') {
      // A typed value replaces the member; empty keeps the stored state (carried over on save).
      const typed = formValue[field.attributeName];
      if (typeof typed === 'string' && typed.length > 0) {
        row[field.attributeName] = typed;
      } else if (typeof row[field.attributeName] === 'string') {
        delete row[field.attributeName];
      }
      continue;
    }
    const value = fromControlValue(field, formValue[field.attributeName]);
    if (value === undefined) {
      delete row[field.attributeName];
    } else {
      row[field.attributeName] = value;
    }
  }
  return row;
}

/** The stored state of a SECRET member value (`null` for a typed, unsaved string). */
export function recordSecretState(value: unknown): SecretState | null {
  if (typeof value === 'string' && value.length > 0) {
    return null;
  }
  return toSecretState(isSecretStateObject(value) ? value : null);
}

/**
 * Cell / badge text of a SECRET member: the shared status wording for a stored value, `newValue`
 * for a typed, unsaved value — never the value itself.
 */
export function formatRecordSecretCell(
  value: unknown,
  labels: SecretStatusLabels,
  newValue: string,
  formatDate?: (date: Date) => string,
): string {
  const state = recordSecretState(value);
  return state ? formatSecretStatus(state, formatDate, labels) : newValue;
}

/** Short, single-line text of a cell value for the records grid and read-only displays. */
export function formatRecordCell(value: unknown, enumOptions?: { key: number; name: string }[]): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (enumOptions && typeof value === 'number') {
    return enumOptions.find(o => o.key === value)?.name ?? String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    if (value.some(v => v !== null && typeof v === 'object')) {
      return `[${value.length}]`;
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return '{…}';
  }
  return String(value);
}
