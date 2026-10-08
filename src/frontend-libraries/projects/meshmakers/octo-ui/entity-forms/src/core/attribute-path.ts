import { CkAttributeInfo } from '../models/entity-form.models';

/**
 * Entity system properties that a form may reference by AttributePath. They are not CK
 * attributes: `rtWellKnownName` is written through `RtEntityInput.rtWellKnownName`, the two
 * timestamps are engine-stamped and always read-only.
 */
export const SYSTEM_PROPERTIES: readonly string[] = ['rtWellKnownName', 'rtCreationDateTime', 'rtChangedDateTime'];

/** Attributes the engine stamps; forced read-only whatever the form says. */
export const ENGINE_STAMPED_ATTRIBUTES: readonly string[] = [
  'rtBlueprintSource', 'rtBlueprintLocked', 'rtBlueprintAppliedAt',
];

/**
 * Runtime state written by services and operators, never by a user (CK `ownership: RuntimeState`
 * of the System.Communication base types: deployable entity, communication entity, deployable
 * workload, adapter). The library cannot read the CK ownership marker yet (not in the schema it is
 * generated from), so this documented list stands in for it; it is the same set the Studio's
 * runtime-object forms hide. A **generated** field of one of these names (`form-default`, "Further
 * attributes") is read-only, so the generic editor (e.g. the Data Explorer peek) cannot overwrite
 * it. A field a form defines explicitly keeps the form's `ReadOnly` setting.
 */
export const RUNTIME_STATE_ATTRIBUTES: readonly string[] = [
  'deploymentState', 'statusMessage', 'lastDeploymentError', 'lastDeploymentErrorTimestamp',
  'communicationState', 'communicationStateTimestamp', 'configurationState', 'lastConfigurationError',
  'lastConfigurationErrorTimestamp', 'lastSyncedSequenceNumber',
  'lifecycleState', 'lastActivityAt', 'onDemandCapable', 'onDemandBlockingReasons',
];

/** True for a runtime-state attribute ({@link RUNTIME_STATE_ATTRIBUTES}; canonical camelCase name). */
export function isRuntimeStateAttribute(name: string): boolean {
  return RUNTIME_STATE_ATTRIBUTES.includes(name);
}

/** Result of matching a form AttributePath against the CK metadata of a type. */
export type CanonicalPath =
  | { kind: 'attribute'; name: string; attribute: CkAttributeInfo }
  | { kind: 'system'; name: string }
  | { kind: 'rtId' }
  | { kind: 'dotted'; path: string }
  | { kind: 'unknown'; path: string };

/**
 * Canonicalises a form AttributePath (forms use PascalCase, the CK API camelCase):
 * system properties and attributes match case-insensitively, `rtId` is reported separately
 * (never a field), dotted paths are reported as deferred, everything else is unknown.
 */
export function canonicalisePath(path: string | null | undefined, attributes: readonly CkAttributeInfo[]): CanonicalPath {
  const raw = (path ?? '').trim();
  if (!raw) {
    return { kind: 'unknown', path: raw };
  }
  const lower = raw.toLowerCase();
  if (lower === 'rtid') {
    return { kind: 'rtId' };
  }
  const system = SYSTEM_PROPERTIES.find((p) => p.toLowerCase() === lower);
  if (system) {
    return { kind: 'system', name: system };
  }
  if (raw.includes('.')) {
    return { kind: 'dotted', path: raw };
  }
  const attribute = attributes.find((a) => a.attributeName.toLowerCase() === lower);
  if (attribute) {
    return { kind: 'attribute', name: attribute.attributeName, attribute };
  }
  return { kind: 'unknown', path: raw };
}

/** True when the given canonical name is an engine-stamped attribute or a system timestamp. */
export function isForcedReadOnly(name: string): boolean {
  return ENGINE_STAMPED_ATTRIBUTES.includes(name) || name === 'rtCreationDateTime' || name === 'rtChangedDateTime';
}

/** Converts `SftpConfiguration` / `System.Communication/SftpConfiguration` to `sftp-configuration`. */
export function toKebabTypeKey(rtCkTypeId: string): string {
  const name = rtCkTypeId.includes('/') ? rtCkTypeId.substring(rtCkTypeId.lastIndexOf('/') + 1) : rtCkTypeId;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_.]+/g, '-')
    .toLowerCase();
}
