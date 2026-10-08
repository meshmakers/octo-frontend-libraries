import { Attribute } from '../models/attribute';
import { SecretSafeAttributeAnalysis } from './secret-safe-attribute-names.service';

const RECORD_TYPES = new Set(['RECORD', 'RECORD_ARRAY']);

/** Result of {@link planSecretSafeUpdate}. */
export interface SecretSafeUpdatePlan {
  /** Attributes to send (blocked ones removed). */
  readonly attributes: { attributeName: string; value: unknown }[];
  /** camelCase/lower-case names that were not written back. */
  readonly blocked: ReadonlySet<string>;
  /** The user changed a blocked attribute — its change is dropped and must be reported once. */
  readonly blockedChanged: boolean;
  /** The user changed something that IS written back. When false, the update call is skipped. */
  readonly otherChanged: boolean;
}

/**
 * Decides what the runtime-browser update editor may write back (AB#5542).
 *
 * Only what was loaded completely may be written: an attribute is blocked when the secret-safe
 * analysis lists it (`blockedAttributes`: records carrying a secret or an excluded sub-attribute,
 * name collisions) or when it is not part of the loaded `attributeNames` at all (e.g. the CK
 * lookup failed) — except write-only secret scalars, whose empty value the mapper already omits.
 */
export function planSecretSafeUpdate(
  mapped: { attributeName: string; value: unknown }[],
  definitions: readonly Attribute[],
  analysis: SecretSafeAttributeAnalysis,
  formValue: Record<string, unknown>,
  initialJson: string | null,
): SecretSafeUpdatePlan {
  const loaded = new Set(analysis.attributeNames.map((n) => n.toLowerCase()));
  const listed = new Set(analysis.blockedAttributes.map((n) => n.toLowerCase()));
  const blocked = new Set<string>();
  for (const def of definitions) {
    const name = def.attributeName.toLowerCase();
    const writeOnlySecret = !!def.secret && !RECORD_TYPES.has(def.attributeValueType?.toUpperCase());
    if (listed.has(name) || (!writeOnlySecret && !loaded.has(name))) {
      blocked.add(name);
    }
  }

  let initial: Record<string, unknown> = {};
  try {
    initial = JSON.parse(initialJson ?? '{}') as Record<string, unknown>;
  } catch {
    initial = {};
  }
  const changedKeys = Object.keys(formValue).filter(
    (key) => JSON.stringify(formValue[key]) !== JSON.stringify(initial[key]),
  );

  return {
    attributes: mapped.filter((a) => !blocked.has(a.attributeName.toLowerCase())),
    blocked,
    blockedChanged: changedKeys.some((key) => blocked.has(key.toLowerCase())),
    otherChanged: changedKeys.some((key) => !blocked.has(key.toLowerCase())),
  };
}
