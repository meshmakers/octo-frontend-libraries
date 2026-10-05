import { CkAttributeInfo, CkTypeInfo, EntityFormDefinition } from '../../models/entity-form.models';

/** Builds a CK attribute for specs. */
export function attr(attributeName: string, valueType = 'STRING', extra: Partial<CkAttributeInfo> = {}): CkAttributeInfo {
  return { attributeName, valueType, isOptional: true, defaultValues: [], secret: false, ...extra };
}

/** Builds a CK type for specs (ancestors default to System/Entity). */
export function ckType(rtCkTypeId: string, extra: Partial<CkTypeInfo> = {}): CkTypeInfo {
  return {
    rtCkTypeId,
    ckTypeIdFullName: `${rtCkTypeId}-1`,
    isAbstract: false,
    ancestors: ['System/Entity'],
    attributes: [],
    associations: [],
    ...extra,
  };
}

let counter = 0;

/** Builds a form definition for specs (seeded unless `isTenantForm: true`). */
export function form(targetCkTypeId: string, extra: Partial<EntityFormDefinition> = {}): EntityFormDefinition {
  counter++;
  return {
    rtId: `6703000000000000000000${String(counter).padStart(2, '0')}`,
    rtWellKnownName: `form-${counter}`,
    isTenantForm: false,
    targetCkTypeId,
    includeDerivedTypes: false,
    priority: 0,
    sections: [],
    fields: [],
    listColumns: [],
    ...extra,
  };
}
