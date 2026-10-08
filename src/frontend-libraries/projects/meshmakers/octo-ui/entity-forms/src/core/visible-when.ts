import { CkAttributeInfo, VisibleWhenRule } from '../models/entity-form.models';
import { canonicalisePath } from './attribute-path';

/**
 * Parses a `VisibleWhen` expression (`Path=value` or `Path=*`). The expression is split at the
 * FIRST `=`, so values may contain `=`. The path is canonicalised against the type's attributes
 * (system properties allowed); returns `null` for an empty, malformed or unresolvable expression.
 */
export function parseVisibleWhen(expression: string | null | undefined, attributes: readonly CkAttributeInfo[]): VisibleWhenRule | null {
  const raw = (expression ?? '').trim();
  const eq = raw.indexOf('=');
  if (eq <= 0) {
    return null;
  }
  const canonical = canonicalisePath(raw.substring(0, eq).trim(), attributes);
  if (canonical.kind !== 'attribute' && canonical.kind !== 'system') {
    return null;
  }
  const value = raw.substring(eq + 1).trim();
  return { path: canonical.name, value: value === '*' ? '*' : value };
}

/** True when a form value counts as "has a value" (`Path=*`). */
export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * Evaluates a rule against the current form values.
 *
 * - `*`: visible when the source has a value, or (for a secret source) when the server reports the
 *   secret as set (`secretPresence[path] === true`).
 * - Booleans compare against `true`/`false` (case-insensitive).
 * - Enums compare against the key or the name (case-insensitive) using `enumOptions`.
 * - Everything else compares the string form (case-sensitive).
 */
export function isVisible(
  rule: VisibleWhenRule | undefined | null,
  values: Record<string, unknown>,
  secretPresence: Record<string, boolean> = {},
  enumOptions?: { key: number; name: string }[],
): boolean {
  if (!rule) {
    return true;
  }
  const value = values[rule.path];
  if (rule.value === '*') {
    return hasValue(value) || secretPresence[rule.path] === true;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'boolean') {
    return String(value) === rule.value.toLowerCase();
  }
  if (enumOptions?.length) {
    const target = enumOptions.find((o) => String(o.key) === rule.value || o.name.toLowerCase() === rule.value.toLowerCase());
    const current = enumOptions.find((o) => o.key === Number(value) || (typeof value === 'string' && o.name.toLowerCase() === value.toLowerCase()));
    if (target && current) {
      return target.key === current.key;
    }
  }
  return String(value) === rule.value;
}
