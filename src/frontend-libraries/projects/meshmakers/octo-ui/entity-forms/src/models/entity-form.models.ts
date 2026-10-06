/**
 * Contract types of the `@meshmakers/octo-ui/entity-forms` entry point (AB#5522).
 *
 * The `*Def` interfaces mirror the `System.UI/EntityForm` runtime entities as parsed from the
 * generic runtime API. The `Resolved*` interfaces are the output of `resolveEntityForm()`: a
 * form definition matched against the CK metadata of one concrete type, ready to render.
 */

import type { SecretState } from '@meshmakers/octo-services';

/** Editor kinds a resolved field can use. */
export type EntityFormEditor = 'text' | 'multiline' | 'password' | 'number' | 'toggle' | 'enum' | 'datetime'
  | 'url' | 'email' | 'json' | 'yaml' | 'cron' | 'chips' | 'reference' | 'records' | 'unsupported';

/** Read-only behaviour of a field. `afterCreate` means editable on create, read-only on edit. */
export type ReadOnlyMode = 'never' | 'always' | 'afterCreate';

/** Mode a form is rendered in. */
export type EntityFormMode = 'create' | 'edit' | 'view';

/** CK metadata of one attribute of a type or record. */
export interface CkAttributeInfo {
  /** camelCase, canonical attribute name as returned by the CK API. */
  attributeName: string;
  /** AttributeValueType (STRING, INT, INTEGER_64, RECORD_ARRAY, ...). */
  valueType: string;
  isOptional: boolean;
  description?: string | null;
  defaultValues: unknown[];
  enumOptions?: { key: number; name: string }[];
  /** Versioned record full name (usable with `records(ckId:)`). */
  ckRecordId?: string | null;
  /** True when the CK attribute metaData carries `secret = true`. */
  secret: boolean;
  /**
   * The CK metaData `secret` marker as a tri-state (AB#5542): `true`, `false` (explicit opt-out of
   * the credential-name rule) or `undefined` (no marker).
   */
  metaSecret?: boolean;
}

/** One association role a type takes part in. */
export interface CkAssociationRoleInfo {
  rtRoleId: string;
  navigationPropertyName: string;
  direction: 'out' | 'in';
  multiplicity: 'ONE' | 'ZERO_OR_ONE' | 'N';
  otherRtCkTypeId: string;
}

/** CK metadata of one type. */
export interface CkTypeInfo {
  rtCkTypeId: string;
  ckTypeIdFullName: string;
  isAbstract: boolean;
  /** Ancestor rtCkTypeIds, nearest first, ending with System/Entity; excludes the type itself. */
  ancestors: string[];
  /** Attributes in model order as returned (inherited ones included). */
  attributes: CkAttributeInfo[];
  associations: CkAssociationRoleInfo[];
}

/** CK metadata of one record. */
export interface CkRecordInfo {
  ckRecordId: string;
  attributes: CkAttributeInfo[];
}

export interface EntityFormSectionDef {
  key: string;
  title?: string | null;
  description?: string | null;
  order?: number | null;
  collapsed?: boolean | null;
  columns?: number | null;
}

export interface EntityFormFieldDef {
  attributePath: string;
  sectionKey?: string | null;
  order?: number | null;
  label?: string | null;
  help?: string | null;
  placeholder?: string | null;
  editor?: string | null;
  readOnly?: string | null;
  required?: boolean | null;
  width?: string | null;
  default?: string | null;
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
  secret?: boolean | null;
  visibleWhen?: string | null;
  referenceCkTypeId?: string | null;
  associationRoleId?: string | null;
  recordColumns?: string[] | null;
  hidden?: boolean | null;
  /**
   * `EntityFormField.ReferenceDisplayAttributes` (System.UI 2.8.0; host fallback forms may set it
   * too): non-secret attributes of the reference target shown next to its name in the picker, e.g.
   * `['repositoryUrl', 'channel']`. Read with an explicit `attributeNames` list of exactly these
   * names (AB#5547).
   */
  referenceDisplayAttributes?: string[] | null;
}

export interface EntityFormColumnDef {
  attributePath: string;
  label?: string | null;
  width?: number | null;
  display?: string | null;
}

/** A parsed `System.UI/EntityForm` entity. */
export interface EntityFormDefinition {
  rtId: string;
  rtWellKnownName?: string | null;
  /** True when `rtBlueprintSource` is empty or null (the form was authored in the tenant). */
  isTenantForm: boolean;
  targetCkTypeId: string;
  includeDerivedTypes: boolean;
  priority: number;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  canCreate?: boolean | null;
  canEdit?: boolean | null;
  canDelete?: boolean | null;
  canDuplicate?: boolean | null;
  canExport?: boolean | null;
  singleton?: boolean | null;
  singletonWellKnownName?: string | null;
  customComponent?: string | null;
  generateRemainingFields?: boolean | null;
  generatedSectionTitle?: string | null;
  sections: EntityFormSectionDef[];
  fields: EntityFormFieldDef[];
  listColumns: EntityFormColumnDef[];
}

/** A parsed `VisibleWhen` expression: `Path=value` or `Path=*` (any value). */
export interface VisibleWhenRule {
  /** Form control key of the source field (canonical). */
  path: string;
  value: string | '*';
}

export interface ResolvedField {
  /** Form control name: attributeName | 'rtWellKnownName' | 'assoc:<rtRoleId with . → _>' (`associationFieldKey`). */
  key: string;
  kind: 'attribute' | 'system' | 'association';
  attributeName?: string;
  valueType?: string;
  label: string;
  help?: string;
  placeholder?: string;
  editor: EntityFormEditor;
  required: boolean;
  readOnly: ReadOnlyMode;
  width: 'full' | 'half';
  order: number;
  /** Already parsed to the form value shape. Applied in create mode only. */
  defaultValue?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  secret: boolean;
  visibleWhen?: VisibleWhenRule;
  enumOptions?: { key: number; name: string }[];
  record?: { ckRecordId: string; single: boolean; columns: { path: string; label: string }[] };
  /** `role` absent means the attribute itself holds the target rtId. */
  reference?: {
    targetCkTypeId: string;
    role?: CkAssociationRoleInfo;
    multiple: boolean;
    displayAttributes?: string[];
    /**
     * CK metadata of the display attributes on the target type (set by `EntityFormService.resolve`),
     * used to format their values (enum names, yes/no, dates). Missing when the target type could not
     * be read; the raw values are shown then.
     */
    displayAttributeInfo?: CkAttributeInfo[];
  };
  generated: boolean;
}

export interface ResolvedSection {
  key: string;
  title: string | null;
  description?: string;
  columns: 1 | 2;
  collapsed: boolean;
  generated: boolean;
  fields: ResolvedField[];
}

export interface ResolvedListColumn {
  field: string;
  label: string;
  width?: number;
  display: 'text' | 'chip' | 'date' | 'mono';
  kind: 'attribute' | 'system';
  /**
   * CK value type of an attribute column (ENUM, BOOLEAN, DATE_TIME, ...). The list formats the
   * cells by it like the reference display does: enum key → name, boolean → yes/no (AB#5547).
   */
  valueType?: string;
  /** Options of an ENUM column (the API returns the key, e.g. `0`). */
  enumOptions?: { key: number; name: string }[];
}

export interface ResolvedEntityForm {
  source: 'tenant' | 'seeded' | 'builtIn';
  formRtId?: string;
  formWellKnownName?: string;
  rtCkTypeId: string;
  formTargetCkTypeId: string;
  isAbstract: boolean;
  includeDerivedTypes: boolean;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  customComponent?: string;
  capabilities: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canDuplicate: boolean;
    canExport: boolean;
    createRequiresSubtype: boolean;
  };
  singleton?: { wellKnownName?: string };
  sections: ResolvedSection[];
  listColumns: ResolvedListColumn[];
  /**
   * Attribute names to read (non-secret fields plus record sub-attribute names, plus the SECRET
   * fields of {@link secretStateFields}, whose value the server never returns).
   */
  readAttributeNames: string[];
  /** attributeNames of all secret fields (never prefilled, never listed). */
  secretFields: string[];
  /**
   * The secret fields of value type SECRET (AB#5528): their state is read with the values
   * (`secretIsSet`, later `secretKeyMissing` / `secretSetAt`) and they can be cleared explicitly
   * (`clearSecretAttributes`). The other secret fields (credential-name / metadata fallback) are
   * probed for presence with a field filter and cannot be cleared.
   */
  secretStateFields?: string[];
  warnings: string[];
}

/**
 * State of one secret field (AB#5528): the shared octo-services {@link SecretState}
 * (`keyMissing` implies `isSet: false`). Kept as an alias for existing imports.
 */
export type EntityFormSecretFieldState = SecretState;

export interface EntityFormValueState {
  values: Record<string, unknown>;
  /** Per secret attributeName: set, or stored but unreadable (counts as present for "required"). */
  secretPresence: Record<string, boolean>;
  /** Per SECRET attributeName: the full state (badge "Set · set at …" / "Key missing — re-enter"). */
  secretStates?: Record<string, EntityFormSecretFieldState>;
  associations: Record<string, { rtId: string; ckTypeId: string; displayName: string }[]>;
  rtWellKnownName?: string | null;
}

export interface EntityFormChangeSet {
  rtWellKnownName?: string;
  attributes: { attributeName: string; value: unknown }[];
  /** camelCase names of optional SECRET attributes to clear on save (edit mode only, Q8). */
  clearSecretAttributes?: string[];
  associations: {
    roleName: string;
    targets: { modOption: 'CREATE' | 'DELETE'; target: { ckTypeId: string; rtId: string } }[];
  }[];
  isEmpty: boolean;
}
