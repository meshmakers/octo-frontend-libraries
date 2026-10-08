import type { CkAttributeInfo } from '../../models/entity-form.models';

/**
 * How the display attributes of a reference target (`referenceDisplayAttributes`, AB#5547) are
 * turned into text: by the CK value type of each attribute. Without metadata for an attribute the
 * raw value is shown (booleans still as yes/no).
 */
export interface ReferenceDisplayFormat {
  /** CK metadata of the target type's display attributes (matched case-insensitively by name). */
  attributes?: readonly CkAttributeInfo[];
  /** Label of `true` (default "Yes"). */
  yes?: string;
  /** Label of `false` (default "No"). */
  no?: string;
  /** Locale of dates; the browser locale when omitted. */
  locale?: string;
}

const DATE_TYPES = ['DATE_TIME', 'DATE_TIME_OFFSET', 'DATE'];

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0);
}

function enumLabel(value: unknown, options: readonly { key: number; name: string }[] | undefined): string {
  const found = (options ?? []).find((o) => o.key === value
    || (typeof value === 'string' && (String(o.key) === value.trim() || o.name.toLowerCase() === value.trim().toLowerCase())));
  return found ? found.name : String(value);
}

function booleanLabel(value: unknown, format: ReferenceDisplayFormat): string | null {
  const b = value === true || value === 'true' ? true : value === false || value === 'false' ? false : null;
  if (b === null) {
    return null;
  }
  return b ? (format.yes ?? 'Yes') : (format.no ?? 'No');
}

function dateLabel(value: unknown, type: string, locale?: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return type === 'DATE'
    ? date.toLocaleDateString(locale, { dateStyle: 'medium' })
    : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Text of one display attribute value, or `null` when it is empty or not displayable (records).
 * ENUM → the enum value's name (the API returns the key, e.g. `0` for "Release"); BOOLEAN →
 * yes/no; DATE_TIME(_OFFSET) → localized date and time; arrays → comma-separated.
 */
export function formatReferenceDisplayValue(value: unknown, attribute: CkAttributeInfo | undefined, format: ReferenceDisplayFormat = {}): string | null {
  if (isEmpty(value)) {
    return null;
  }
  const type = attribute?.valueType?.toUpperCase() ?? '';
  if (type === 'RECORD' || type === 'RECORD_ARRAY' || (!Array.isArray(value) && typeof value === 'object' && !(value instanceof Date))) {
    return null;
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatReferenceDisplayValue(v, attribute ? { ...attribute, valueType: type.replace(/_ARRAY$/, '') } : undefined, format))
      .filter((p): p is string => p !== null);
    return parts.length ? parts.join(', ') : null;
  }
  if (type === 'ENUM') {
    return enumLabel(value, attribute?.enumOptions);
  }
  if (type === 'BOOLEAN' || (!type && typeof value === 'boolean')) {
    return booleanLabel(value, format) ?? String(value);
  }
  if (DATE_TYPES.includes(type)) {
    return dateLabel(value, type, format.locale);
  }
  return String(value);
}
