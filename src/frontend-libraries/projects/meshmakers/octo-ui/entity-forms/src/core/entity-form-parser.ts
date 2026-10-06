import {
  EntityFormColumnDef,
  EntityFormDefinition,
  EntityFormFieldDef,
  EntityFormSectionDef,
} from '../models/entity-form.models';

/** Minimal shape of an `RtEntity` row as returned by `entityFormGetEntityForms`. */
export interface RawRtEntityRow {
  rtId: string;
  rtWellKnownName?: string | null;
  ckTypeId?: string | null;
  attributes?: { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null } | null;
}

type Dict = Record<string, unknown>;

/**
 * Turns the attribute list of an entity (or of a record read through the generic API) into a
 * dictionary keyed by the lower-cased attribute name, so lookups are casing-agnostic.
 */
export function attributeListToDict(items: readonly ({ attributeName?: string | null; value?: unknown } | null)[] | null | undefined): Dict {
  const dict: Dict = {};
  for (const item of items ?? []) {
    if (item?.attributeName) {
      dict[item.attributeName.toLowerCase()] = item.value;
    }
  }
  return dict;
}

/**
 * Normalises one record value to a lower-cased dictionary. Accepts the query shape
 * `{ ckRecordId, attributes: [{ attributeName, value }] }` and, defensively, a flat
 * `{ key: value }` dictionary.
 */
export function recordToDict(value: unknown): Dict | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const v = value as Dict;
  if (Array.isArray(v['attributes'])) {
    return attributeListToDict(v['attributes'] as { attributeName?: string; value?: unknown }[]);
  }
  const dict: Dict = {};
  for (const [k, val] of Object.entries(v)) {
    if (k !== 'ckRecordId' && k !== '__typename') {
      dict[k.toLowerCase()] = val;
    }
  }
  return dict;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : v === null || v === undefined ? null : String(v));
const strOrUndef = (d: Dict, k: string): string | null | undefined => (k in d ? str(d[k]) : undefined);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') {
    return null;
  }
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const numOrUndef = (d: Dict, k: string): number | null | undefined => (k in d ? num(d[k]) : undefined);
const bool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'string') {
    return v.toLowerCase() === 'true' ? true : v.toLowerCase() === 'false' ? false : null;
  }
  return Boolean(v);
};
const boolOrUndef = (d: Dict, k: string): boolean | null | undefined => (k in d ? bool(d[k]) : undefined);

/** A StringArray value; a comma-separated string is accepted defensively. Absent key = `undefined`. */
const strListOrUndef = (d: Dict, k: string): string[] | null | undefined => {
  if (!(k in d)) {
    return undefined;
  }
  const v = d[k];
  if (v === null || v === undefined) {
    return null;
  }
  return Array.isArray(v) ? v.map((c) => String(c)) : String(v).split(',').map((c) => c.trim()).filter(Boolean);
};

function records(value: unknown): Dict[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(recordToDict).filter((d): d is Dict => d !== null);
}

function stripUndefined<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] === undefined) {
      delete o[k];
    }
  }
  return o;
}

function parseSection(d: Dict): EntityFormSectionDef | null {
  const key = str(d['key']);
  if (!key) {
    return null;
  }
  return stripUndefined({
    key,
    title: strOrUndef(d, 'title'),
    description: strOrUndef(d, 'description'),
    order: numOrUndef(d, 'order'),
    collapsed: boolOrUndef(d, 'collapsed'),
    columns: numOrUndef(d, 'columns'),
  });
}

function parseField(d: Dict): EntityFormFieldDef | null {
  const attributePath = str(d['attributepath']);
  if (!attributePath) {
    return null;
  }
  return stripUndefined({
    attributePath,
    sectionKey: strOrUndef(d, 'sectionkey'),
    order: numOrUndef(d, 'order'),
    label: strOrUndef(d, 'label'),
    help: strOrUndef(d, 'help'),
    placeholder: strOrUndef(d, 'placeholder'),
    editor: strOrUndef(d, 'editor'),
    readOnly: strOrUndef(d, 'readonly'),
    required: boolOrUndef(d, 'required'),
    width: strOrUndef(d, 'width'),
    default: strOrUndef(d, 'default'),
    min: numOrUndef(d, 'min'),
    max: numOrUndef(d, 'max'),
    pattern: strOrUndef(d, 'pattern'),
    secret: boolOrUndef(d, 'secret'),
    visibleWhen: strOrUndef(d, 'visiblewhen'),
    referenceCkTypeId: strOrUndef(d, 'referencecktypeid'),
    associationRoleId: strOrUndef(d, 'associationroleid'),
    recordColumns: strListOrUndef(d, 'recordcolumns'),
    hidden: boolOrUndef(d, 'hidden'),
    // System.UI 2.8.0 (AB#5547); absent on older models, so the field simply stays unset.
    referenceDisplayAttributes: strListOrUndef(d, 'referencedisplayattributes'),
  });
}

function parseColumn(d: Dict): EntityFormColumnDef | null {
  const attributePath = str(d['attributepath']);
  if (!attributePath) {
    return null;
  }
  return stripUndefined({
    attributePath,
    label: strOrUndef(d, 'label'),
    width: numOrUndef(d, 'width'),
    display: strOrUndef(d, 'display'),
  });
}

/**
 * Parses one `System.UI/EntityForm` row of the generic runtime API into an
 * {@link EntityFormDefinition}. Returns `null` when the row has no `TargetCkTypeId`.
 * Absent optionals stay `undefined`; explicit `null` values from the server are kept as `null`.
 */
export function parseEntityForm(row: RawRtEntityRow): EntityFormDefinition | null {
  const a = attributeListToDict(row.attributes?.items);
  const targetCkTypeId = str(a['targetcktypeid']);
  if (!targetCkTypeId) {
    return null;
  }
  const blueprintSource = str(a['rtblueprintsource']);
  const def: EntityFormDefinition = {
    rtId: row.rtId,
    rtWellKnownName: row.rtWellKnownName ?? null,
    isTenantForm: !blueprintSource,
    targetCkTypeId,
    includeDerivedTypes: bool(a['includederivedtypes']) === true,
    priority: num(a['priority']) ?? 0,
    name: strOrUndef(a, 'name'),
    description: strOrUndef(a, 'description'),
    category: strOrUndef(a, 'category'),
    icon: strOrUndef(a, 'icon'),
    canCreate: boolOrUndef(a, 'cancreate'),
    canEdit: boolOrUndef(a, 'canedit'),
    canDelete: boolOrUndef(a, 'candelete'),
    canDuplicate: boolOrUndef(a, 'canduplicate'),
    canExport: boolOrUndef(a, 'canexport'),
    singleton: boolOrUndef(a, 'singleton'),
    singletonWellKnownName: strOrUndef(a, 'singletonwellknownname'),
    customComponent: strOrUndef(a, 'customcomponent'),
    generateRemainingFields: boolOrUndef(a, 'generateremainingfields'),
    generatedSectionTitle: strOrUndef(a, 'generatedsectiontitle'),
    sections: records(a['sections']).map(parseSection).filter((s): s is EntityFormSectionDef => s !== null),
    fields: records(a['fields']).map(parseField).filter((f): f is EntityFormFieldDef => f !== null),
    listColumns: records(a['listcolumns']).map(parseColumn).filter((c): c is EntityFormColumnDef => c !== null),
  };
  return stripUndefined(def);
}

/** Parses every row; rows without a target type are dropped. */
export function parseEntityForms(rows: readonly (RawRtEntityRow | null | undefined)[] | null | undefined): EntityFormDefinition[] {
  return (rows ?? [])
    .filter((r): r is RawRtEntityRow => !!r)
    .map(parseEntityForm)
    .filter((f): f is EntityFormDefinition => f !== null);
}
