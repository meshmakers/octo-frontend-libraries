import {
  CkRecordInfo,
  EntityFormChangeSet,
  EntityFormMode,
  ResolvedEntityForm,
  ResolvedField,
} from '../models/entity-form.models';
import { formValuesEqual, isEmptyFormValue, toWireValue } from './entity-form-value-mapper';

/** One selected reference target as held by a reference control. */
export interface EntityFormReferenceValue {
  rtId: string;
  ckTypeId: string;
  displayName?: string;
}

export interface BuildChangeSetOptions {
  /** Record metadata keyed by versioned ckRecordId, for type conversion of record sub-values. */
  records?: Record<string, CkRecordInfo>;
}

/**
 * The association `roleName` written in `RtEntityAssociationInput`: the navigation property name
 * with a lower-case first letter (the backend matches it case-insensitively; verified live, and
 * the role id `System/Related` is NOT accepted as roleName — it is silently ignored).
 */
export function associationRoleName(navigationPropertyName: string): string {
  return navigationPropertyName.charAt(0).toLowerCase() + navigationPropertyName.slice(1);
}

function references(value: unknown): EntityFormReferenceValue[] {
  if (!Array.isArray(value)) {
    return value && typeof value === 'object' && 'rtId' in (value as object) ? [value as EntityFormReferenceValue] : [];
  }
  return value.filter((v): v is EntityFormReferenceValue => !!v && typeof v === 'object' && typeof (v as EntityFormReferenceValue).rtId === 'string');
}

function isEditable(field: ResolvedField, mode: EntityFormMode): boolean {
  if (field.editor === 'unsupported' || field.readOnly === 'always') {
    return false;
  }
  if (field.readOnly === 'afterCreate' && mode !== 'create') {
    return false;
  }
  return true;
}

/**
 * Builds the change set of a form (D6: only dirty controls on edit).
 *
 * - `current` is the form's enabled value: a key that is absent (disabled control, e.g. hidden by
 *   VisibleWhen) is never sent.
 * - Create mode sends every non-empty editable value (defaults included) plus `rtWellKnownName`.
 * - Edit mode sends only attributes whose value differs from `initial`; read-only, `afterCreate`
 *   and unsupported fields and `rtWellKnownName` are never sent.
 * - Secrets: an empty secret is left out (= unchanged); a typed secret is always sent.
 * - Associations: diff of the selected targets by rtId; a single-valued replace produces DELETE old
 *   plus CREATE new.
 * - View mode produces an empty change set.
 */
export function buildChangeSet(
  initial: Record<string, unknown>,
  current: Record<string, unknown>,
  model: ResolvedEntityForm,
  mode: EntityFormMode,
  // Reserved for presence-dependent rules; an empty secret is "unchanged" whatever the presence.
  _secretPresence: Record<string, boolean> = {},
  options: BuildChangeSetOptions = {},
): EntityFormChangeSet {
  const changeSet: EntityFormChangeSet = { attributes: [], associations: [], isEmpty: true };
  if (mode === 'view') {
    return changeSet;
  }
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(current, key);

  for (const field of model.sections.flatMap((s) => s.fields)) {
    if (!has(field.key) || !isEditable(field, mode)) {
      continue;
    }
    const value = current[field.key];

    if (field.kind === 'system') {
      if (field.key === 'rtWellKnownName' && mode === 'create' && typeof value === 'string' && value.trim()) {
        changeSet.rtWellKnownName = value.trim();
      }
      continue;
    }

    if (field.kind === 'association' && field.reference?.role) {
      const role = field.reference.role;
      const before = mode === 'create' ? [] : references(initial[field.key]);
      const after = references(value);
      const removed = before.filter((b) => !after.some((a) => a.rtId === b.rtId));
      const added = after.filter((a) => !before.some((b) => b.rtId === a.rtId));
      if (removed.length || added.length) {
        changeSet.associations.push({
          roleName: associationRoleName(role.navigationPropertyName),
          targets: [
            ...removed.map((t) => ({ modOption: 'DELETE' as const, target: { ckTypeId: t.ckTypeId, rtId: t.rtId } })),
            ...added.map((t) => ({ modOption: 'CREATE' as const, target: { ckTypeId: t.ckTypeId, rtId: t.rtId } })),
          ],
        });
      }
      continue;
    }

    if (field.kind !== 'attribute' || !field.attributeName) {
      continue;
    }

    // Attribute-held reference: the control holds [{rtId,...}], the attribute stores the rtId.
    let formValue = value;
    if (field.editor === 'reference') {
      formValue = references(value)[0]?.rtId ?? null;
    }

    if (field.secret) {
      if (isEmptyFormValue(formValue, field.valueType)) {
        continue;
      }
    } else if (mode === 'create') {
      if (isEmptyFormValue(formValue, field.valueType)) {
        continue;
      }
    } else {
      let initialValue = initial[field.key];
      if (field.editor === 'reference') {
        initialValue = typeof initialValue === 'string' ? initialValue : references(initialValue)[0]?.rtId ?? null;
      }
      if (formValuesEqual(initialValue, formValue)) {
        continue;
      }
    }

    const mapped = toWireValue(formValue, {
      attributeName: field.attributeName,
      valueType: field.valueType ?? 'STRING',
      isOptional: !field.required,
      enumOptions: field.enumOptions,
      ckRecordId: field.record?.ckRecordId,
    }, options.records);
    if (mapped.include) {
      changeSet.attributes.push({ attributeName: field.attributeName, value: mapped.value });
    }
  }

  changeSet.isEmpty = changeSet.attributes.length === 0 && changeSet.associations.length === 0 && !changeSet.rtWellKnownName;
  return changeSet;
}
