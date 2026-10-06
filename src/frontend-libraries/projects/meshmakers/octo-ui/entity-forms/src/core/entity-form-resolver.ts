import {
  CkAssociationRoleInfo,
  CkAttributeInfo,
  CkRecordInfo,
  CkTypeInfo,
  EntityFormDefinition,
  EntityFormEditor,
  EntityFormFieldDef,
  ReadOnlyMode,
  ResolvedEntityForm,
  ResolvedField,
  ResolvedListColumn,
  ResolvedSection,
} from '../models/entity-form.models';
import { isSecretAttributeCandidate, isSecretValueType } from '@meshmakers/octo-services';
import { canonicalisePath, isForcedReadOnly } from './attribute-path';
import { BUILT_IN_DEFAULT_FORM } from './built-in-default-form';
import { parseDefault, isArrayType, isDateType, isNumericType, isRecordType } from './entity-form-value-mapper';
import { parseVisibleWhen } from './visible-when';

/** Section key of the implicit section used when a form declares no sections. */
export const DEFAULT_SECTION_KEY = '__default';
/** Section key of the section holding generated (unmentioned) attributes. */
export const GENERATED_SECTION_KEY = '__generated';
/** Default title of the generated section. */
export const DEFAULT_GENERATED_SECTION_TITLE = 'Further attributes';

export type EntityFormSource = 'tenant' | 'seeded';

export interface ResolveEntityFormOptions {
  /** Record metadata keyed by versioned ckRecordId (CkAttributeInfo.ckRecordId). */
  records?: Record<string, CkRecordInfo>;
}

const TEXT_LIKE_EDITORS: readonly EntityFormEditor[] = ['text', 'multiline', 'password', 'url', 'email', 'json', 'yaml', 'cron'];
const PATTERN_EDITORS: readonly EntityFormEditor[] = ['text', 'multiline', 'password', 'url', 'email'];
const KNOWN_EDITORS: readonly EntityFormEditor[] = [
  'text', 'multiline', 'password', 'number', 'toggle', 'enum', 'datetime', 'url', 'email', 'json', 'yaml',
  'cron', 'chips', 'reference', 'records', 'unsupported',
];
const SCALAR_LIST_TYPES: readonly string[] = ['STRING', 'INT', 'INTEGER', 'INT_64', 'INTEGER_64', 'DOUBLE', 'BOOLEAN', 'ENUM', 'DATE_TIME', 'DATE_TIME_OFFSET'];

/**
 * Secret decision of an attribute (AB#5522 D5, AB#5542) — the shared octo-services rule
 * `isSecretAttributeCandidate` with one precedence everywhere:
 * 1. an explicit form decision (`Secret: true|false`; editor `password` counts as `true`),
 * 2. the CK metaData marker (`secret: true|false` — `false` opts out of the name rule),
 * 3. the credential-name rule for TEXTUAL attributes only (suffixes password, passphrase, secret,
 *    secretKey, privateKey, apiKey, token, connectionString, credential(s), encryptedValue), so
 *    `isSecret: BOOLEAN` or a `credentials` record are never secrets by name.
 * 0. Before all of these: the SECRET value type (AB#5528) is always secret — a form cannot opt
 *    it out (`Secret: false` is ignored with a warning).
 * The marker and the name rule remain the fallback for non-SECRET attributes (models that have not
 * switched their credentials to SECRET yet).
 */
function decideSecret(attribute: CkAttributeInfo, formDecision?: boolean | null): boolean {
  const metaSecret = attribute.metaSecret ?? (attribute.secret ? true : undefined);
  return isSecretAttributeCandidate({
    attributeName: attribute.attributeName,
    attributeValueType: attribute.valueType,
    secret: formDecision ?? metaSecret,
  });
}

/** True when a CK attribute is secret by metaData or by the name heuristic (no form decision). */
export function isSecretAttribute(attribute: CkAttributeInfo): boolean {
  return decideSecret(attribute);
}

const sameId = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** `maxConcurrentConnections` -> `Max concurrent connections`; `SftpConfiguration` -> `Sftp configuration`. */
export function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function typeShortName(rtCkTypeId: string): string {
  return rtCkTypeId.includes('/') ? rtCkTypeId.substring(rtCkTypeId.lastIndexOf('/') + 1) : rtCkTypeId;
}

// ─── Picking ────────────────────────────────────────────────────────────────────────

function compareCandidates(a: EntityFormDefinition, b: EntityFormDefinition): number {
  if (a.isTenantForm !== b.isTenantForm) {
    return a.isTenantForm ? -1 : 1;
  }
  const pa = a.priority ?? 0;
  const pb = b.priority ?? 0;
  if (pa !== pb) {
    return pb - pa;
  }
  // Deterministic final tie-break (plan addition): rtWellKnownName, then rtId, ascending.
  const ka = a.rtWellKnownName || a.rtId || '';
  const kb = b.rtWellKnownName || b.rtId || '';
  if (ka !== kb) {
    return ka < kb ? -1 : 1;
  }
  return (a.rtId || '') < (b.rtId || '') ? -1 : (a.rtId || '') > (b.rtId || '') ? 1 : 0;
}

/**
 * Picks the form for a type. Exact-target forms win; otherwise the nearest ancestor that has
 * forms with `includeDerivedTypes` supplies the candidates. Candidates are ordered tenant before
 * seeded, then priority descending, then rtWellKnownName/rtId ascending. Forms are never merged.
 */
export function pickEntityForm(
  type: CkTypeInfo,
  forms: readonly EntityFormDefinition[],
): { form: EntityFormDefinition; source: EntityFormSource } | null {
  let candidates = forms.filter((f) => sameId(f.targetCkTypeId, type.rtCkTypeId));
  if (candidates.length === 0) {
    for (const ancestor of type.ancestors) {
      const atAncestor = forms.filter((f) => f.includeDerivedTypes === true && sameId(f.targetCkTypeId, ancestor));
      if (atAncestor.length > 0) {
        candidates = atAncestor;
        break;
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const form = [...candidates].sort(compareCandidates)[0];
  return { form, source: form.isTenantForm ? 'tenant' : 'seeded' };
}

// ─── Field rules ─────────────────────────────────────────────────────────────────────

/** Editor chosen when the form says `auto`, nothing, or something unknown. */
export function autoEditorFor(valueType: string | null | undefined): EntityFormEditor {
  switch (valueType) {
    case 'STRING':
      return 'text';
    case 'SECRET':
      // SECRET value type (AB#5528): a write-only secret field (badge, show toggle, clear).
      return 'password';
    case 'INT':
    case 'INTEGER':
    case 'INT_64':
    case 'INTEGER_64':
    case 'DOUBLE':
      return 'number';
    case 'BOOLEAN':
      return 'toggle';
    case 'DATE_TIME':
    case 'DATE_TIME_OFFSET':
      return 'datetime';
    case 'ENUM':
      return 'enum';
    case 'STRING_ARRAY':
    case 'INT_ARRAY':
    case 'INTEGER_ARRAY':
      return 'chips';
    case 'RECORD':
    case 'RECORD_ARRAY':
      return 'records';
    default:
      return 'unsupported';
  }
}

/** True when an explicit editor can edit the given value type. */
export function isEditorCompatible(editor: EntityFormEditor, valueType: string | null | undefined): boolean {
  if (editor === 'unsupported') {
    return true;
  }
  if (isSecretValueType(valueType)) {
    // A SECRET is always write-only text: single line (`password`) or multiline (PEM keys, Q10).
    return editor === 'password' || editor === 'multiline';
  }
  if (TEXT_LIKE_EDITORS.includes(editor)) {
    return valueType === 'STRING';
  }
  switch (editor) {
    case 'number':
      return isNumericType(valueType);
    case 'toggle':
      return valueType === 'BOOLEAN';
    case 'enum':
      return valueType === 'ENUM';
    case 'datetime':
      return isDateType(valueType);
    case 'records':
      return isRecordType(valueType);
    case 'chips':
      return isArrayType(valueType);
    case 'reference':
      return valueType === 'STRING';
    default:
      return false;
  }
}

function parseReadOnly(value: string | null | undefined): ReadOnlyMode {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'always') {
    return 'always';
  }
  if (v === 'aftercreate') {
    return 'afterCreate';
  }
  return 'never';
}

function resolveEditor(def: EntityFormFieldDef | null, attribute: CkAttributeInfo, warnings: string[]): EntityFormEditor {
  const auto = autoEditorFor(attribute.valueType);
  const raw = (def?.editor ?? '').trim().toLowerCase();
  if (!raw || raw === 'auto') {
    return auto;
  }
  const explicit = KNOWN_EDITORS.find((e) => e === raw);
  if (!explicit) {
    return auto;
  }
  if (!isEditorCompatible(explicit, attribute.valueType)) {
    warnings.push(`Field '${def?.attributePath}': editor '${explicit}' is not compatible with ${attribute.valueType}; using '${auto}'.`);
    return auto;
  }
  return explicit;
}

function recordColumns(attribute: CkAttributeInfo, def: EntityFormFieldDef | null, records?: Record<string, CkRecordInfo>): { path: string; label: string }[] {
  const record = attribute.ckRecordId ? records?.[attribute.ckRecordId] : undefined;
  if (def?.recordColumns?.length) {
    return def.recordColumns
      .map((c) => {
        const sub = record?.attributes.find((a) => a.attributeName.toLowerCase() === c.toLowerCase());
        if (record && !sub) {
          return null;
        }
        const path = sub?.attributeName ?? c.charAt(0).toLowerCase() + c.slice(1);
        return { path, label: humanize(path) };
      })
      .filter((c): c is { path: string; label: string } => c !== null);
  }
  return (record?.attributes ?? [])
    .filter((a) => SCALAR_LIST_TYPES.includes(a.valueType) && !isSecretAttribute(a))
    .slice(0, 4)
    .map((a) => ({ path: a.attributeName, label: humanize(a.attributeName) }));
}

function buildAttributeField(
  attribute: CkAttributeInfo,
  def: EntityFormFieldDef | null,
  generated: boolean,
  type: CkTypeInfo,
  warnings: string[],
  records?: Record<string, CkRecordInfo>,
): ResolvedField {
  let editor = resolveEditor(def, attribute, warnings);
  const explicitPassword = (def?.editor ?? '').trim().toLowerCase() === 'password';
  // A `password` editor always means secret (it cannot be opted out of with Secret: false).
  const formDecision = def?.secret === true || explicitPassword ? true : def?.secret === false ? false : undefined;
  const secret = decideSecret(attribute, formDecision);
  if (formDecision === false && isSecretValueType(attribute.valueType)) {
    warnings.push(`Field '${def?.attributePath}': Secret: false is ignored for a SECRET attribute.`);
  }
  let readOnly = parseReadOnly(def?.readOnly);
  if (isForcedReadOnly(attribute.attributeName) || editor === 'unsupported') {
    readOnly = 'always';
  }
  const numeric = isNumericType(attribute.valueType);
  const field: ResolvedField = {
    key: attribute.attributeName,
    kind: 'attribute',
    attributeName: attribute.attributeName,
    valueType: attribute.valueType,
    label: def?.label || humanize(attribute.attributeName),
    editor,
    required: !attribute.isOptional || def?.required === true,
    readOnly,
    width: 'full',
    order: 0,
    secret,
    generated,
  };
  const help = def?.help ?? (generated ? attribute.description ?? undefined : undefined);
  if (help) {
    field.help = help;
  }
  if (def?.placeholder) {
    field.placeholder = def.placeholder;
  }
  if (numeric && def?.min !== null && def?.min !== undefined) {
    field.min = def.min;
  }
  if (numeric && def?.max !== null && def?.max !== undefined) {
    field.max = def.max;
  }
  if (def?.pattern && PATTERN_EDITORS.includes(editor)) {
    field.pattern = def.pattern;
  }
  const defaultValue = def?.default !== null && def?.default !== undefined && def.default !== ''
    ? parseDefault(def.default, attribute)
    : parseDefault(attribute.defaultValues?.[0], attribute);
  if (defaultValue !== undefined) {
    field.defaultValue = defaultValue;
  }
  if (attribute.enumOptions?.length) {
    field.enumOptions = attribute.enumOptions;
  }
  if (isRecordType(attribute.valueType) && attribute.ckRecordId) {
    field.record = {
      ckRecordId: attribute.ckRecordId,
      single: attribute.valueType === 'RECORD',
      columns: recordColumns(attribute, def, records),
    };
  }
  if (editor === 'reference') {
    // Attribute-held reference: the STRING attribute stores the target rtId (single).
    const target = def?.referenceCkTypeId;
    if (target) {
      field.reference = { targetCkTypeId: target, multiple: false, ...displayAttributesOf(def) };
    } else {
      warnings.push(`Field '${def?.attributePath}': editor 'reference' needs ReferenceCkTypeId or AssociationRoleId; using text.`);
      editor = 'text';
      field.editor = editor;
    }
  }
  if (def?.visibleWhen) {
    const rule = parseVisibleWhen(def.visibleWhen, type.attributes);
    if (rule) {
      field.visibleWhen = rule;
    } else {
      warnings.push(`Field '${def.attributePath}': VisibleWhen '${def.visibleWhen}' cannot be resolved; rule dropped.`);
    }
  }
  return field;
}

function buildSystemField(name: string, def: EntityFormFieldDef, type: CkTypeInfo, warnings: string[]): ResolvedField {
  const isDate = name !== 'rtWellKnownName';
  const field: ResolvedField = {
    key: name,
    kind: 'system',
    valueType: isDate ? 'DATE_TIME' : 'STRING',
    label: def.label || (name === 'rtWellKnownName' ? 'Well-known name' : name === 'rtCreationDateTime' ? 'Created' : 'Changed'),
    editor: isDate ? 'datetime' : 'text',
    required: def.required === true,
    readOnly: isDate ? 'always' : parseReadOnly(def.readOnly),
    width: 'full',
    order: 0,
    secret: false,
    generated: false,
  };
  if (def.help) {
    field.help = def.help;
  }
  if (def.placeholder) {
    field.placeholder = def.placeholder;
  }
  if (!isDate && def.pattern) {
    field.pattern = def.pattern;
  }
  if (!isDate && def.default) {
    field.defaultValue = def.default;
  }
  if (def.visibleWhen) {
    const rule = parseVisibleWhen(def.visibleWhen, type.attributes);
    if (rule) {
      field.visibleWhen = rule;
    } else {
      warnings.push(`Field '${def.attributePath}': VisibleWhen '${def.visibleWhen}' cannot be resolved; rule dropped.`);
    }
  }
  return field;
}

function displayAttributesOf(def: EntityFormFieldDef | undefined | null): { displayAttributes?: string[] } {
  const names = (def?.referenceDisplayAttributes ?? []).map((n) => n.trim()).filter((n) => !!n);
  return names.length ? { displayAttributes: names } : {};
}

function findRole(type: CkTypeInfo, roleId: string): CkAssociationRoleInfo | undefined {
  const matches = type.associations.filter((r) => sameId(r.rtRoleId, roleId));
  return matches.find((r) => r.direction === 'out') ?? matches[0];
}

function buildAssociationField(role: CkAssociationRoleInfo, def: EntityFormFieldDef, type: CkTypeInfo, warnings: string[]): ResolvedField {
  const field: ResolvedField = {
    key: `assoc:${role.rtRoleId}`,
    kind: 'association',
    label: def.label || humanize(role.navigationPropertyName),
    editor: 'reference',
    required: def.required === true,
    readOnly: parseReadOnly(def.readOnly),
    width: 'full',
    order: 0,
    secret: false,
    generated: false,
    reference: {
      targetCkTypeId: def.referenceCkTypeId || role.otherRtCkTypeId,
      role,
      multiple: role.multiplicity === 'N',
      ...displayAttributesOf(def),
    },
  };
  if (def.help) {
    field.help = def.help;
  }
  if (def.placeholder) {
    field.placeholder = def.placeholder;
  }
  if (def.visibleWhen) {
    const rule = parseVisibleWhen(def.visibleWhen, type.attributes);
    if (rule) {
      field.visibleWhen = rule;
    } else {
      warnings.push(`Field '${def.attributePath}': VisibleWhen '${def.visibleWhen}' cannot be resolved; rule dropped.`);
    }
  }
  return field;
}

/** Sort by `order` ascending; absent orders after explicit ones, stable in definition order. */
function sortByOrder<T>(items: readonly T[], order: (item: T) => number | null | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, order: order(item) }))
    .sort((a, b) => {
      const ha = a.order !== null && a.order !== undefined;
      const hb = b.order !== null && b.order !== undefined;
      if (ha && hb && a.order !== b.order) {
        return (a.order as number) - (b.order as number);
      }
      if (ha !== hb) {
        return ha ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map((x) => x.item);
}

// ─── Read set ────────────────────────────────────────────────────────────────────────

function collectRecordSubNames(ckRecordId: string, records: Record<string, CkRecordInfo> | undefined, into: Set<string>, seen: Set<string>): void {
  if (seen.has(ckRecordId)) {
    return;
  }
  seen.add(ckRecordId);
  const record = records?.[ckRecordId];
  for (const sub of record?.attributes ?? []) {
    into.add(sub.attributeName);
    if (isRecordType(sub.valueType) && sub.ckRecordId) {
      collectRecordSubNames(sub.ckRecordId, records, into, seen);
    }
  }
}

// ─── List columns ────────────────────────────────────────────────────────────────────

const SYSTEM_COLUMN_LABELS: Record<string, string> = {
  rtWellKnownName: 'Well-known name',
  rtCreationDateTime: 'Created',
  rtChangedDateTime: 'Changed',
};

function resolveListColumns(form: EntityFormDefinition, type: CkTypeInfo, secretNames: Set<string>): ResolvedListColumn[] {
  const columns: ResolvedListColumn[] = [];
  const seen = new Set<string>();
  for (const def of form.listColumns) {
    const c = canonicalisePath(def.attributePath, type.attributes);
    let column: ResolvedListColumn | null = null;
    if (c.kind === 'system') {
      column = { field: c.name, label: def.label || SYSTEM_COLUMN_LABELS[c.name], kind: 'system', display: 'text' };
      column.display = normaliseDisplay(def.display, c.name === 'rtWellKnownName' ? 'STRING' : 'DATE_TIME');
    } else if (c.kind === 'attribute' && !secretNames.has(c.name) && !isSecretAttribute(c.attribute) && !isRecordType(c.attribute.valueType)) {
      column = { field: c.name, label: def.label || humanize(c.name), kind: 'attribute', display: normaliseDisplay(def.display, c.attribute.valueType) };
    }
    if (column && !seen.has(column.field)) {
      if (def.width !== null && def.width !== undefined) {
        column.width = def.width;
      }
      seen.add(column.field);
      columns.push(column);
    }
  }
  if (columns.length > 0) {
    return columns;
  }
  const derived: ResolvedListColumn[] = [{ field: 'rtWellKnownName', label: SYSTEM_COLUMN_LABELS['rtWellKnownName'], kind: 'system', display: 'text' }];
  const name = type.attributes.find((a) => a.attributeName === 'name');
  if (name && !secretNames.has('name') && !isSecretAttribute(name)) {
    derived.push({ field: 'name', label: 'Name', kind: 'attribute', display: 'text' });
  }
  derived.push({ field: 'rtChangedDateTime', label: SYSTEM_COLUMN_LABELS['rtChangedDateTime'], kind: 'system', display: 'date' });
  type.attributes
    .filter((a) => a.attributeName !== 'name' && !isSecretAttribute(a) && !secretNames.has(a.attributeName)
      && !isForcedReadOnly(a.attributeName) && SCALAR_LIST_TYPES.includes(a.valueType))
    .slice(0, 3)
    .forEach((a) => derived.push({ field: a.attributeName, label: humanize(a.attributeName), kind: 'attribute', display: normaliseDisplay(null, a.valueType) }));
  return derived;
}

function normaliseDisplay(display: string | null | undefined, valueType: string): ResolvedListColumn['display'] {
  const d = (display ?? '').trim().toLowerCase();
  if (d === 'text' || d === 'chip' || d === 'date' || d === 'mono') {
    return d;
  }
  return isDateType(valueType) ? 'date' : 'text';
}

// ─── Resolve ─────────────────────────────────────────────────────────────────────────

/**
 * Resolves the form for a type: picks it ({@link pickEntityForm}), falls back to
 * {@link BUILT_IN_DEFAULT_FORM} (`source: 'builtIn'`, with a warning), and matches every field
 * against the CK metadata. See plan §2.2 for the normative rules; they are implemented here
 * in the order they are listed there.
 */
export function resolveEntityForm(
  type: CkTypeInfo,
  forms: readonly EntityFormDefinition[],
  opts: ResolveEntityFormOptions = {},
): ResolvedEntityForm {
  const warnings: string[] = [];
  const picked = pickEntityForm(type, forms);
  const form = picked?.form ?? BUILT_IN_DEFAULT_FORM;
  if (!picked) {
    warnings.push(`No entity form applies to '${type.rtCkTypeId}'; using the built-in default form.`);
  }
  const exact = sameId(form.targetCkTypeId, type.rtCkTypeId);

  // Sections
  const sortedSections = sortByOrder(form.sections, (s) => s.order);
  const sections: ResolvedSection[] = sortedSections.length
    ? sortedSections.map((s) => {
      const section: ResolvedSection = {
        key: s.key,
        title: s.title ?? s.key,
        columns: s.columns === 2 ? 2 : 1,
        collapsed: s.collapsed === true,
        generated: false,
        fields: [],
      };
      if (s.description) {
        section.description = s.description;
      }
      return section;
    })
    : [{ key: DEFAULT_SECTION_KEY, title: null, columns: 1, collapsed: false, generated: false, fields: [] }];

  // Fields
  const mentioned = new Set<string>();
  const placed: { section: ResolvedSection; field: ResolvedField; def: EntityFormFieldDef }[] = [];
  for (const def of form.fields) {
    let field: ResolvedField;
    const editorRaw = (def.editor ?? '').trim().toLowerCase();
    if (editorRaw === 'reference' && def.associationRoleId) {
      const role = findRole(type, def.associationRoleId);
      if (!role) {
        warnings.push(`Field '${def.attributePath}': association role '${def.associationRoleId}' not found on '${type.rtCkTypeId}'; skipped.`);
        continue;
      }
      const key = `assoc:${role.rtRoleId}`;
      if (mentioned.has(key)) {
        warnings.push(`Field '${def.attributePath}': duplicate definition; the first one wins.`);
        continue;
      }
      mentioned.add(key);
      if (def.hidden === true) {
        continue;
      }
      field = buildAssociationField(role, def, type, warnings);
    } else {
      const c = canonicalisePath(def.attributePath, type.attributes);
      if (c.kind === 'rtId' || c.kind === 'unknown') {
        continue;
      }
      if (c.kind === 'dotted') {
        warnings.push(`Field '${def.attributePath}': dotted attribute paths are not supported yet; skipped.`);
        continue;
      }
      if (mentioned.has(c.name)) {
        warnings.push(`Field '${def.attributePath}': duplicate definition; the first one wins.`);
        continue;
      }
      mentioned.add(c.name);
      if (def.hidden === true) {
        continue;
      }
      field = c.kind === 'system'
        ? buildSystemField(c.name, def, type, warnings)
        : buildAttributeField(c.attribute, def, false, type, warnings, opts.records);
    }
    const section = sections.find((s) => def.sectionKey && s.key === def.sectionKey) ?? sections[0];
    placed.push({ section, field, def });
  }
  for (const section of sections) {
    const mine = placed.filter((p) => p.section === section);
    section.fields = sortByOrder(mine, (p) => p.def.order).map((p, index) => {
      p.field.order = index;
      p.field.width = section.columns === 2 && (p.def.width ?? '').trim().toLowerCase() === 'half' ? 'half' : 'full';
      return p.field;
    });
  }
  const resultSections = sections.filter((s) => s.fields.length > 0);

  // Remaining fields
  if (form.generateRemainingFields !== false) {
    const generatedFields = type.attributes
      .filter((a) => !mentioned.has(a.attributeName))
      .map((a, index) => {
        const f = buildAttributeField(a, null, true, type, warnings, opts.records);
        f.order = index;
        return f;
      });
    if (generatedFields.length > 0) {
      resultSections.push({
        key: GENERATED_SECTION_KEY,
        title: form.generatedSectionTitle || DEFAULT_GENERATED_SECTION_TITLE,
        columns: 1,
        collapsed: false,
        generated: true,
        fields: generatedFields,
      });
    }
  }

  // Read set and secrets (D5.2)
  const allFields = resultSections.flatMap((s) => s.fields);
  const attributeFields = allFields.filter((f) => f.kind === 'attribute' && f.attributeName);
  const secretNames = new Set<string>([
    ...attributeFields.filter((f) => f.secret).map((f) => f.attributeName as string),
    // Attributes without a field: metaData > name rule (a field's own decision is above).
    ...type.attributes.filter((a) => !attributeFields.some((f) => f.attributeName === a.attributeName) && isSecretAttribute(a)).map((a) => a.attributeName),
  ]);
  const secretFields = attributeFields.filter((f) => f.secret).map((f) => f.attributeName as string);
  // SECRET-typed attributes (AB#5528) are safe to READ: the server returns value null plus
  // secretIsSet. A name that is also a heuristic (non-SECRET) secret is never read.
  const secretValueTypeNames = new Set(type.attributes.filter((a) => isSecretValueType(a.valueType)).map((a) => a.attributeName));
  const heuristicSecretNames = new Set([...secretNames].filter((n) => !secretValueTypeNames.has(n)));
  const secretStateFields = secretFields.filter((n) => secretValueTypeNames.has(n) && !heuristicSecretNames.has(n));
  const readableSecrets = new Set(secretStateFields);
  const read = new Set<string>();
  for (const f of attributeFields) {
    if (f.secret) {
      continue;
    }
    read.add(f.attributeName as string);
    if (f.record) {
      const subs = new Set<string>();
      collectRecordSubNames(f.record.ckRecordId, opts.records, subs, new Set<string>());
      let collision = false;
      for (const sub of subs) {
        if (secretNames.has(sub) && !readableSecrets.has(sub)) {
          collision = true;
        } else {
          read.add(sub);
        }
      }
      if (collision) {
        f.readOnly = 'always';
        warnings.push(`Field '${f.attributeName}': a record sub-attribute shares its name with a secret attribute; the field is read-only so saving cannot erase it.`);
      }
    }
  }
  // A record sub-name must never re-add a secret top-level name.
  for (const s of secretNames) {
    read.delete(s);
  }
  // ...except SECRET attributes, which are read for their state only.
  for (const s of secretStateFields) {
    read.add(s);
  }

  const result: ResolvedEntityForm = {
    source: picked ? picked.source : 'builtIn',
    rtCkTypeId: type.rtCkTypeId,
    formTargetCkTypeId: form.targetCkTypeId,
    isAbstract: type.isAbstract,
    includeDerivedTypes: form.includeDerivedTypes,
    title: (exact && form.name) || humanize(typeShortName(type.rtCkTypeId)),
    capabilities: {
      canCreate: form.canCreate !== false,
      canEdit: form.canEdit !== false,
      canDelete: form.canDelete !== false,
      canDuplicate: form.canDuplicate === true,
      canExport: form.canExport === true,
      createRequiresSubtype: type.isAbstract,
    },
    sections: resultSections,
    listColumns: resolveListColumns(form, type, secretNames),
    readAttributeNames: [...read],
    secretFields,
    secretStateFields,
    warnings,
  };
  if (picked) {
    result.formRtId = form.rtId;
    if (form.rtWellKnownName) {
      result.formWellKnownName = form.rtWellKnownName;
    }
  }
  if (exact && form.description) {
    result.description = form.description;
  }
  if (form.category) {
    result.category = form.category;
  }
  if (form.icon) {
    result.icon = form.icon;
  }
  if (form.customComponent) {
    result.customComponent = form.customComponent;
  }
  if (form.singleton === true) {
    result.singleton = form.singletonWellKnownName ? { wellKnownName: form.singletonWellKnownName } : {};
  }
  return result;
}
