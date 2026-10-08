import { CkAssociationRoleInfo, CkAttributeInfo, CkRecordInfo, CkTypeInfo } from '../models/entity-form.models';

/** Shape of one attribute row of `entityFormGetCkType` / `entityFormGetCkRecord`. */
export interface RawCkAttribute {
  attributeName: string;
  attributeValueType: string;
  isOptional: boolean;
  ckAttributeId?: { fullName: string } | null;
  attribute?: {
    description?: string | null;
    defaultValues?: (unknown | null)[] | null;
    metaData?: ({ key: string; value?: string | null } | null)[] | null;
    ckEnum?: { values: ({ key?: number | null; name?: string | null } | null)[] } | null;
    ckRecord?: { ckRecordId: { fullName: string } } | null;
  } | null;
}

interface RawBaseType {
  rtCkTypeId: string;
  isAbstract?: boolean;
  baseType?: RawBaseType | null;
}

interface RawRole {
  rtRoleId: string;
  navigationPropertyName: string;
  multiplicity: string;
  rtTargetCkTypeId: string;
  rtOriginCkTypeId: string;
}

/** Shape of one type of `entityFormGetCkType`. */
export interface RawCkType {
  rtCkTypeId: string;
  isAbstract: boolean;
  description?: string | null;
  ckTypeId: { fullName: string };
  baseType?: RawBaseType | null;
  attributes?: { items?: (RawCkAttribute | null)[] | null } | null;
  associations?: {
    in?: { all?: (RawRole | null)[] | null } | null;
    out?: { all?: (RawRole | null)[] | null } | null;
  } | null;
}

/** Shape of one record of `entityFormGetCkRecord`. */
export interface RawCkRecord {
  ckRecordId: { fullName: string };
  isAbstract?: boolean;
  attributes?: { items?: (RawCkAttribute | null)[] | null } | null;
}

/**
 * The CK attribute metaData `secret` marker: `true`, `false` (explicit opt-out of the
 * credential-name rule) or `undefined` when there is no (valid) marker.
 */
export function secretMetaDataMarker(metaData: readonly ({ key: string; value?: string | null } | null)[] | null | undefined): boolean | undefined {
  const marker = (metaData ?? []).find((m) => !!m && m.key?.toLowerCase() === 'secret');
  const value = (marker?.value ?? '').trim().toLowerCase();
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

/** True when the CK attribute metaData marks the attribute as secret (`secret = true`). */
export function isSecretMetaData(metaData: readonly ({ key: string; value?: string | null } | null)[] | null | undefined): boolean {
  return (metaData ?? []).some((m) => !!m && m.key?.toLowerCase() === 'secret' && (m.value ?? '').trim().toLowerCase() === 'true');
}

export function toCkAttributeInfo(raw: RawCkAttribute): CkAttributeInfo {
  const info: CkAttributeInfo = {
    attributeName: raw.attributeName,
    valueType: raw.attributeValueType,
    isOptional: raw.isOptional,
    description: raw.attribute?.description ?? null,
    defaultValues: (raw.attribute?.defaultValues ?? []).filter((v) => v !== null && v !== undefined),
    ckRecordId: raw.attribute?.ckRecord?.ckRecordId?.fullName ?? null,
    secret: isSecretMetaData(raw.attribute?.metaData),
  };
  const marker = secretMetaDataMarker(raw.attribute?.metaData);
  if (marker !== undefined) {
    info.metaSecret = marker;
  }
  const values = raw.attribute?.ckEnum?.values;
  if (values?.length) {
    info.enumOptions = values
      .filter((v): v is { key: number; name: string } => !!v && v.key !== null && v.key !== undefined && !!v.name)
      .map((v) => ({ key: v.key, name: v.name }));
  }
  return info;
}

function toRole(raw: RawRole, direction: 'out' | 'in'): CkAssociationRoleInfo {
  return {
    rtRoleId: raw.rtRoleId,
    navigationPropertyName: raw.navigationPropertyName,
    direction,
    multiplicity: raw.multiplicity === 'ONE' || raw.multiplicity === 'ZERO_OR_ONE' ? raw.multiplicity : 'N',
    // out: this type is the origin, the other end is the target; in: the other end is the origin.
    otherRtCkTypeId: direction === 'out' ? raw.rtTargetCkTypeId : raw.rtOriginCkTypeId,
  };
}

/** Maps a raw `entityFormGetCkType` item to {@link CkTypeInfo}. */
export function toCkTypeInfo(raw: RawCkType): CkTypeInfo {
  const ancestors: string[] = [];
  let base = raw.baseType;
  while (base) {
    ancestors.push(base.rtCkTypeId);
    base = base.baseType;
  }
  return {
    rtCkTypeId: raw.rtCkTypeId,
    ckTypeIdFullName: raw.ckTypeId.fullName,
    isAbstract: raw.isAbstract,
    ancestors,
    attributes: (raw.attributes?.items ?? []).filter((a): a is RawCkAttribute => !!a).map(toCkAttributeInfo),
    associations: [
      ...(raw.associations?.out?.all ?? []).filter((r): r is RawRole => !!r).map((r) => toRole(r, 'out')),
      ...(raw.associations?.in?.all ?? []).filter((r): r is RawRole => !!r).map((r) => toRole(r, 'in')),
    ],
  };
}

/** Maps a raw `entityFormGetCkRecord` item to {@link CkRecordInfo}. */
export function toCkRecordInfo(raw: RawCkRecord): CkRecordInfo {
  return {
    ckRecordId: raw.ckRecordId.fullName,
    attributes: (raw.attributes?.items ?? []).filter((a): a is RawCkAttribute => !!a).map(toCkAttributeInfo),
  };
}
