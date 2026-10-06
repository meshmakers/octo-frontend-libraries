/**
 * SECRET value type (AB#5528) — frontend contract types and helpers (AB#5542).
 *
 * Contract: `octo-construction-kit-engine/docs/secret-frontend-handover.md` §2 (asset repository
 * GraphQL) and §4/§8 (identity providers REST). Field names are binding.
 *
 * The generated `globalTypes.ts` carries the live WP5 schema (`OctoSecretStateDto { isSet }`,
 * `secretIsSet`, `clearSecretAttributes`). `keyMissing` / `setAt` (`secretKeyMissing` /
 * `secretSetAt`) are contract fields of 01fda94e that the local backend does not serve yet: the
 * shapes below declare them OPTIONAL so the UI shows them as soon as documents select them.
 * TODO(AB#5542): after the backend rebuild, add `keyMissing setAt` / `secretKeyMissing secretSetAt`
 * to the documents, re-run codegen and type the helpers with the generated DTOs.
 *
 * Rules (decisions 2026-10-06):
 * - A secret is never read. Typed fields select `{ isSet keyMissing setAt }`, generic attribute
 *   lists select `secretIsSet secretKeyMissing secretSetAt` (`value` is always null for secrets).
 * - Input: a non-empty string sets / rotates; omitted, `null` or `""` keeps the stored value.
 *   Clearing is explicit: the camelCase name goes into `clearSecretAttributes` (only optional
 *   secrets; a new value and a clear for the same field in one request are rejected).
 * - Placeholders (`<…>`, `TODO_SET_*`) have no meaning — they are ordinary values.
 * - `keyMissing` (value stored, key id unknown in this environment) reads as `isSet: false` for
 *   consumers; the UI shows "Key missing — re-enter".
 */

/** The CK value type name of a secret attribute as reported by the CK model API (`AttributeValueTypesDto.Secret = 17`). */
export const SECRET_VALUE_TYPE = 'SECRET';

/** Whether a CK value type is the SECRET value type (case-insensitive). */
export function isSecretValueType(valueType: string | null | undefined): boolean {
  return !!valueType && valueType.toUpperCase() === SECRET_VALUE_TYPE;
}

/** `type OctoSecretState` — the read projection of a typed secret field (contract shape, see header). */
export interface SecretStateFieldsDto {
  /** False when not set OR when the stored value cannot be read (key missing / corrupt). */
  isSet: boolean;
  /** A value is stored, but its key id is not in this environment's key ring → re-entry needed. */
  keyMissing?: boolean | null;
  /** When the current value was set (UTC, ISO-8601 on the wire); null for legacy / not set. */
  setAt?: string | Date | null;
}

/** The secret fields of a generic `RtEntityAttribute` (null for every non-secret attribute). */
export interface RtEntityAttributeSecretStateDto {
  secretIsSet?: boolean | null;
  secretKeyMissing?: boolean | null;
  secretSetAt?: string | Date | null;
}

/** Display status of a secret. */
export type SecretStatus = 'set' | 'notSet' | 'keyMissing';

/** Normalised secret state used by the UI. */
export interface SecretState {
  isSet: boolean;
  keyMissing: boolean;
  setAt: Date | null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalises a typed `OctoSecretState` (null/undefined = not set). */
export function toSecretState(state: SecretStateFieldsDto | null | undefined): SecretState {
  return {
    isSet: state?.isSet === true,
    keyMissing: state?.keyMissing === true,
    setAt: toDate(state?.setAt),
  };
}

/**
 * The secret state of a generic attribute, or `null` when the attribute is not a secret
 * (`secretIsSet` is null for every non-secret attribute).
 */
export function secretStateFromAttribute(attribute: RtEntityAttributeSecretStateDto | null | undefined): SecretState | null {
  if (!attribute || (attribute.secretIsSet !== true && attribute.secretIsSet !== false)) return null;
  return {
    isSet: attribute.secretIsSet,
    keyMissing: attribute.secretKeyMissing === true,
    setAt: toDate(attribute.secretSetAt),
  };
}

/** Display status: key missing wins (it implies `isSet: false`), then set / not set. */
export function secretStatusOf(state: Pick<SecretState, 'isSet' | 'keyMissing'> | null | undefined): SecretStatus {
  if (state?.keyMissing) return 'keyMissing';
  return state?.isSet ? 'set' : 'notSet';
}

/**
 * Whether a secret counts as present for "required" checks: set, or stored but unreadable (the
 * server treats a key-missing secret as present, handover §2).
 */
export function isSecretPresent(state: Pick<SecretState, 'isSet' | 'keyMissing'> | null | undefined): boolean {
  return state?.isSet === true || state?.keyMissing === true;
}

/**
 * The wire value of a typed secret input: the string when the user typed one, else `undefined`
 * (= omit = keep). Never trims — whitespace can be part of a secret.
 */
export function secretInputValue(typed: string | null | undefined): string | undefined {
  return typeof typed === 'string' && typed.length > 0 ? typed : undefined;
}

/** Labels of {@link formatSecretStatus}. `{setAt}` is replaced by the formatted timestamp. */
export interface SecretStatusLabels {
  set: string;
  setAt: string;
  notSet: string;
  keyMissing: string;
}

export const DEFAULT_SECRET_STATUS_LABELS: SecretStatusLabels = {
  set: 'Set',
  setAt: 'Set · set at {setAt}',
  notSet: 'Not set',
  keyMissing: 'Key missing — re-enter',
};

/**
 * Human-readable status: "Set · set at …" / "Set" (legacy, no timestamp) / "Not set" /
 * "Key missing — re-enter".
 */
export function formatSecretStatus(
  state: SecretState | null | undefined,
  formatDate: (date: Date) => string = (d) => d.toLocaleString(),
  labels: SecretStatusLabels = DEFAULT_SECRET_STATUS_LABELS,
): string {
  switch (secretStatusOf(state)) {
    case 'keyMissing':
      return labels.keyMissing;
    case 'set':
      return state?.setAt ? labels.setAt.replace('{setAt}', formatDate(state.setAt)) : labels.set;
    default:
      return labels.notSet;
  }
}
