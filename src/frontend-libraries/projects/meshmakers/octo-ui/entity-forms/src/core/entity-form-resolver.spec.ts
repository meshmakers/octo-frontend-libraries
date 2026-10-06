import { ResolvedEntityForm } from '../models/entity-form.models';
import { BUILT_IN_DEFAULT_FORM } from './built-in-default-form';
import { toCkRecordInfo, toCkTypeInfo } from './ck-metadata';
import { parseEntityForm } from './entity-form-parser';
import {
  autoEditorFor,
  DEFAULT_GENERATED_SECTION_TITLE,
  GENERATED_SECTION_KEY,
  isSecretAttribute,
  pickEntityForm,
  resolveEntityForm,
} from './entity-form-resolver';
import { attr, ckType, form } from './testing/factories';
import {
  LIVE_ENTITY_FORM_CK_TYPE,
  LIVE_ENTITY_FORM_SECTION_RECORD,
  LIVE_FORM_DEFAULT_ROW,
  LIVE_FORM_SFTP_ROW,
  LIVE_SFTP_CK_TYPE,
} from './testing/live-fixtures';

const SFTP = 'System.Communication/SftpConfiguration';

function fields(model: ResolvedEntityForm) {
  return model.sections.flatMap((s) => s.fields);
}
function field(model: ResolvedEntityForm, key: string) {
  return fields(model).find((f) => f.key === key);
}

describe('pickEntityForm', () => {
  const type = ckType(SFTP, { ancestors: ['System/Configuration', 'System/Entity'] });

  it('exact beats ancestor', () => {
    const exact = form(SFTP);
    const base = form('System/Configuration', { includeDerivedTypes: true, priority: 100, isTenantForm: true });
    expect(pickEntityForm(type, [base, exact])?.form).toBe(exact);
  });

  it('exact tenant beats exact seeded even at lower priority', () => {
    const seeded = form(SFTP, { priority: 50 });
    const tenant = form(SFTP, { priority: 1, isTenantForm: true });
    const picked = pickEntityForm(type, [seeded, tenant]);
    expect(picked?.form).toBe(tenant);
    expect(picked?.source).toBe('tenant');
  });

  it('priority breaks a tie within the same origin', () => {
    const low = form(SFTP, { priority: 1 });
    const high = form(SFTP, { priority: 5 });
    expect(pickEntityForm(type, [low, high])?.form).toBe(high);
  });

  it('absent priority counts as 0', () => {
    const none = form(SFTP, { priority: undefined as unknown as number });
    const one = form(SFTP, { priority: 1 });
    expect(pickEntityForm(type, [none, one])?.form).toBe(one);
  });

  it('uses a deterministic final tie-break (rtWellKnownName ascending)', () => {
    const b = form(SFTP, { rtWellKnownName: 'form-b' });
    const a = form(SFTP, { rtWellKnownName: 'form-a' });
    expect(pickEntityForm(type, [b, a])?.form).toBe(a);
    expect(pickEntityForm(type, [a, b])?.form).toBe(a);
  });

  it('nearest ancestor with includeDerivedTypes wins over a farther one', () => {
    const far = form('System/Entity', { includeDerivedTypes: true, priority: 99 });
    const near = form('System/Configuration', { includeDerivedTypes: true });
    expect(pickEntityForm(type, [far, near])?.form).toBe(near);
  });

  it('ignores an ancestor form without includeDerivedTypes', () => {
    const near = form('System/Configuration', { includeDerivedTypes: false });
    const far = form('System/Entity', { includeDerivedTypes: true });
    expect(pickEntityForm(type, [near, far])?.form).toBe(far);
  });

  it('an exact form with includeDerivedTypes false still applies to the type itself', () => {
    const exact = form(SFTP, { includeDerivedTypes: false });
    expect(pickEntityForm(type, [exact])?.form).toBe(exact);
  });

  it('form-default matches any type through System/Entity', () => {
    const def = parseEntityForm(LIVE_FORM_DEFAULT_ROW)!;
    const picked = pickEntityForm(ckType('Foo/Bar', { ancestors: ['Foo/Base', 'System/Entity'] }), [def]);
    expect(picked?.form.rtWellKnownName).toBe('form-default');
    expect(picked?.source).toBe('seeded');
  });

  it('returns null when nothing matches', () => {
    expect(pickEntityForm(type, [form('Other/Type', { includeDerivedTypes: true })])).toBeNull();
  });
});

describe('resolveEntityForm with live fixtures', () => {
  const sftpType = toCkTypeInfo(LIVE_SFTP_CK_TYPE);
  const defaultForm = parseEntityForm(LIVE_FORM_DEFAULT_ROW)!;
  const sftpForm = parseEntityForm(LIVE_FORM_SFTP_ROW)!;

  it('maps the live SftpConfiguration metadata (ancestors, abstract flag)', () => {
    expect(sftpType.ancestors).toEqual(['System/Configuration', 'System/Entity']);
    expect(sftpType.isAbstract).toBe(false);
    expect(sftpType.attributes.map((a) => a.attributeName)).toContain('privateKeyPassphrase');
  });

  it('uses form-sftp-configuration for SftpConfiguration, matching PascalCase paths to camelCase attributes', () => {
    const model = resolveEntityForm(sftpType, [defaultForm, sftpForm]);
    expect(model.source).toBe('seeded');
    expect(model.formWellKnownName).toBe('form-sftp-configuration');
    expect(model.title).toBe('SFTP configuration');
    expect(model.category).toBe('connections');
    expect(model.sections.map((s) => s.key)).toEqual(['server', 'auth', 'limits', GENERATED_SECTION_KEY]);
    expect(model.sections[0].fields.map((f) => f.key)).toEqual(['rtWellKnownName', 'host', 'port']);
    expect(field(model, 'port')).toEqual(expect.objectContaining({ editor: 'number', min: 1, max: 65535, defaultValue: 22, width: 'half', required: true }));
    expect(field(model, 'rtWellKnownName')).toEqual(expect.objectContaining({ kind: 'system', required: true, readOnly: 'afterCreate' }));
  });

  it('forms are never merged: the subtype form has none of form-default\'s sections', () => {
    const model = resolveEntityForm(sftpType, [defaultForm, sftpForm]);
    expect(model.sections.find((s) => s.key === 'general' || s.key === 'system')).toBeUndefined();
    // rtBlueprint* are not in the SFTP form, so they are generated (and forced read-only)
    const generated = model.sections.find((s) => s.key === GENERATED_SECTION_KEY)!;
    expect(generated.title).toBe(DEFAULT_GENERATED_SECTION_TITLE);
    expect(generated.fields.map((f) => f.key)).toEqual(['rtBlueprintSource', 'rtBlueprintLocked', 'rtBlueprintAppliedAt']);
    expect(generated.fields.every((f) => f.readOnly === 'always' && f.generated)).toBe(true);
  });

  it('secrets: password/privateKey/passphrase are secret, never read, presence-checked', () => {
    const model = resolveEntityForm(sftpType, [defaultForm, sftpForm]);
    expect(model.secretFields).toEqual(['password', 'privateKey', 'privateKeyPassphrase']);
    for (const s of model.secretFields) {
      expect(model.readAttributeNames).not.toContain(s);
    }
    expect(model.readAttributeNames).toEqual(expect.arrayContaining(['host', 'port', 'username', 'maxConcurrentConnections']));
    expect(field(model, 'privateKeyPassphrase')?.visibleWhen).toEqual({ path: 'privateKey', value: '*' });
  });

  it('list columns from the form: Name (rtWellKnownName), Host mono, Username', () => {
    const model = resolveEntityForm(sftpType, [defaultForm, sftpForm]);
    expect(model.listColumns).toEqual([
      { field: 'rtWellKnownName', label: 'Name', kind: 'system', display: 'text' },
      { field: 'host', label: 'Host', kind: 'attribute', display: 'mono' },
      { field: 'username', label: 'Username', kind: 'attribute', display: 'text' },
    ]);
  });

  it('form-default on SftpConfiguration skips Name/Description silently', () => {
    const model = resolveEntityForm(sftpType, [defaultForm]);
    expect(model.formWellKnownName).toBe('form-default');
    expect(model.title).toBe('Sftp configuration');
    expect(model.sections.map((s) => s.key)).toEqual(['general', 'system', GENERATED_SECTION_KEY]);
    expect(model.sections[0].fields.map((f) => f.key)).toEqual(['rtWellKnownName']);
    expect(model.warnings).toEqual([]);
    expect(model.sections[2].title).toBe('Attributes');
    expect(model.listColumns.map((c) => c.field)).toEqual(['rtWellKnownName', 'rtChangedDateTime']);
    expect(model.capabilities).toEqual({ canCreate: true, canEdit: true, canDelete: true, canDuplicate: false, canExport: true, createRequiresSubtype: false });
    expect(model.category).toBeUndefined();
  });

  it('generated SFTP secrets are secret under form-default through the name heuristic (no CK marker yet)', () => {
    const model = resolveEntityForm(sftpType, [defaultForm]);
    expect(model.secretFields).toEqual(['password', 'privateKey', 'privateKeyPassphrase']);
    expect(model.readAttributeNames).not.toContain('password');
    expect(field(model, 'host')?.secret).toBe(false);
  });

  it('an explicit Secret: false opts out of the name heuristic', () => {
    const model = resolveEntityForm(sftpType, [form(SFTP, { fields: [{ attributePath: 'Password', secret: false }] })]);
    expect(field(model, 'password')?.secret).toBe(false);
    expect(model.readAttributeNames).toContain('password');
    expect(model.secretFields).toEqual(['privateKey', 'privateKeyPassphrase']);
  });

  it('uses the shared octo-services credential rule: text types only, full suffix list (AB#5542)', () => {
    expect(isSecretAttribute(attr('connectionString'))).toBe(true);
    expect(isSecretAttribute(attr('secretKey'))).toBe(true);
    expect(isSecretAttribute(attr('isSecret', 'BOOLEAN'))).toBe(false);
    expect(isSecretAttribute(attr('credentials', 'RECORD'))).toBe(false);
    const type = ckType('Test/Cfg', { attributes: [attr('name'), attr('isSecret', 'BOOLEAN'), attr('connectionString')] });
    const model = resolveEntityForm(type, []);
    expect(model.secretFields).toEqual(['connectionString']);
    expect(model.readAttributeNames).toContain('isSecret');
  });

  it('applies the shared precedence: form decision > CK metadata (true/false) > name rule (AB#5542)', () => {
    // metadata secret: false opts out of the name rule
    expect(isSecretAttribute(attr('apiToken', 'STRING', { metaSecret: false }))).toBe(false);
    // metadata secret: true wins over a harmless name
    expect(isSecretAttribute(attr('host', 'STRING', { secret: true, metaSecret: true }))).toBe(true);
    const type = ckType('Test/Cfg', {
      attributes: [attr('apiToken', 'STRING', { metaSecret: false }), attr('host', 'STRING', { secret: true, metaSecret: true }), attr('password')],
    });
    expect(resolveEntityForm(type, []).secretFields).toEqual(['host', 'password']);
    // an explicit form decision beats the metadata
    const optedOut = resolveEntityForm(type, [form('Test/Cfg', { fields: [{ attributePath: 'Host', secret: false }] })]);
    expect(field(optedOut, 'host')?.secret).toBe(false);
    expect(optedOut.readAttributeNames).toContain('host');
  });

  it('with no forms, the built-in default resolves exactly like the parsed seed form-default', () => {
    const seeded = resolveEntityForm(sftpType, [defaultForm]);
    const builtIn = resolveEntityForm(sftpType, []);
    expect(builtIn.source).toBe('builtIn');
    expect(builtIn.warnings).toEqual([`No entity form applies to '${SFTP}'; using the built-in default form.`]);
    const strip = (m: ResolvedEntityForm) => ({ ...m, source: undefined, formRtId: undefined, formWellKnownName: undefined, warnings: undefined });
    expect(strip(builtIn)).toEqual(strip(seeded));
  });

  it('the built-in default definition equals the parsed seed (nulls normalised)', () => {
    const normalise = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (_k, v) => (v === null ? undefined : v)));
    const { rtId: _a, ...seed } = defaultForm;
    const { rtId: _b, ...builtIn } = BUILT_IN_DEFAULT_FORM;
    expect(normalise(builtIn)).toEqual(normalise(seed));
  });

  it('resolves System.UI/EntityForm itself with record fields and record sub-names in the read set', () => {
    const type = toCkTypeInfo(LIVE_ENTITY_FORM_CK_TYPE);
    const section = toCkRecordInfo(LIVE_ENTITY_FORM_SECTION_RECORD);
    const model = resolveEntityForm(type, [defaultForm], { records: { [section.ckRecordId]: section } });
    const sections = field(model, 'sections');
    expect(sections?.editor).toBe('records');
    expect(sections?.record).toEqual({ ckRecordId: 'System.UI-2.7.0/EntityFormSection-1', single: false, columns: [
      { path: 'key', label: 'Key' }, { path: 'title', label: 'Title' }, { path: 'description', label: 'Description' }, { path: 'order', label: 'Order' },
    ] });
    expect(model.readAttributeNames).toEqual(expect.arrayContaining(['sections', 'key', 'title', 'order', 'columns', 'collapsed']));
    // the record sub-attribute 'description' collides with nothing secret, so the field stays editable
    expect(sections?.readOnly).toBe('never');
  });
});

describe('resolveEntityForm field rules', () => {
  const base = ckType('T/Thing', {
    attributes: [
      attr('name'),
      attr('count', 'INT', { isOptional: false }),
      attr('enabled', 'BOOLEAN'),
      attr('kind', 'ENUM', { enumOptions: [{ key: 0, name: 'Dev' }, { key: 1, name: 'Release' }] }),
      attr('when', 'DATE_TIME'),
      attr('tags', 'STRING_ARRAY'),
      attr('rtBlueprintSource'),
    ],
  });

  it('skips unknown and dotted paths, never makes rtId a field', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'RtId' }, { attributePath: 'Nope' }, { attributePath: 'Address.City' }, { attributePath: 'Name' },
    ] })]);
    expect(fields(model).map((f) => f.key)).toEqual(['name']);
    expect(model.warnings).toEqual(["Field 'Address.City': dotted attribute paths are not supported yet; skipped."]);
  });

  it('Hidden is neither listed nor generated', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { fields: [{ attributePath: 'Count', hidden: true }] })]);
    expect(field(model, 'count')).toBeUndefined();
    expect(model.readAttributeNames).not.toContain('count');
  });

  it('remaining fields come in model order into a titled generated section', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generatedSectionTitle: 'More', fields: [{ attributePath: 'Enabled' }] })]);
    const gen = model.sections[model.sections.length - 1];
    expect(gen).toEqual(expect.objectContaining({ key: GENERATED_SECTION_KEY, title: 'More', generated: true, columns: 1 }));
    expect(gen.fields.map((f) => f.key)).toEqual(['name', 'count', 'kind', 'when', 'tags', 'rtBlueprintSource']);
  });

  it('generateRemainingFields false generates nothing; implicit default section has no title', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [{ attributePath: 'name' }] })]);
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0]).toEqual(expect.objectContaining({ key: '__default', title: null }));
  });

  it('duplicate path: first definition wins with a warning', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'Name', label: 'First' }, { attributePath: 'name', label: 'Second' },
    ] })]);
    expect(fields(model).map((f) => f.label)).toEqual(['First']);
    expect(model.warnings).toEqual(["Field 'name': duplicate definition; the first one wins."]);
  });

  it('auto editor table covers every value type', () => {
    expect(['STRING', 'INT', 'INTEGER', 'INT_64', 'INTEGER_64', 'DOUBLE', 'BOOLEAN', 'DATE_TIME', 'DATE_TIME_OFFSET', 'ENUM',
      'STRING_ARRAY', 'INT_ARRAY', 'INTEGER_ARRAY', 'RECORD', 'RECORD_ARRAY', 'BINARY', 'BINARY_LINKED', 'GEOSPATIAL_POINT', 'TIME_SPAN']
      .map(autoEditorFor)).toEqual(['text', 'number', 'number', 'number', 'number', 'number', 'toggle', 'datetime', 'datetime', 'enum',
      'chips', 'chips', 'chips', 'records', 'records', 'unsupported', 'unsupported', 'unsupported', 'unsupported']);
  });

  it('an incompatible explicit editor falls back with a warning; an unknown editor means auto silently', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'Count', editor: 'toggle' }, { attributePath: 'Name', editor: 'fancy' }, { attributePath: 'Enabled', editor: 'AUTO' },
    ] })]);
    expect(field(model, 'count')?.editor).toBe('number');
    expect(field(model, 'name')?.editor).toBe('text');
    expect(field(model, 'enabled')?.editor).toBe('toggle');
    expect(model.warnings).toEqual(["Field 'Count': editor 'toggle' is not compatible with INT; using 'number'."]);
  });

  it('unsupported value types are read-only', () => {
    const t = ckType('T/X', { attributes: [attr('blob', 'BINARY')] });
    expect(field(resolveEntityForm(t, []), 'blob')).toEqual(expect.objectContaining({ editor: 'unsupported', readOnly: 'always' }));
  });

  it('required: optional + true gives true, mandatory + false stays true', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'Name', required: true }, { attributePath: 'Count', required: false }, { attributePath: 'Enabled' },
    ] })]);
    expect(field(model, 'name')?.required).toBe(true);
    expect(field(model, 'count')?.required).toBe(true);
    expect(field(model, 'enabled')?.required).toBe(false);
  });

  it('forces read-only for rtBlueprint* and system timestamps; passes afterCreate through', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'RtBlueprintSource', readOnly: 'never' }, { attributePath: 'rtChangedDateTime' },
      { attributePath: 'Name', readOnly: 'afterCreate' }, { attributePath: 'Count', readOnly: 'bogus' },
    ] })]);
    expect(field(model, 'rtBlueprintSource')?.readOnly).toBe('always');
    expect(field(model, 'rtChangedDateTime')).toEqual(expect.objectContaining({ kind: 'system', readOnly: 'always', editor: 'datetime' }));
    expect(field(model, 'name')?.readOnly).toBe('afterCreate');
    expect(field(model, 'count')?.readOnly).toBe('never');
  });

  it('width is forced to full in one-column sections; columns other than 2 mean 1', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false,
      sections: [{ key: 'a', columns: 3 }, { key: 'b', columns: 2 }],
      fields: [{ attributePath: 'Name', sectionKey: 'a', width: 'half' }, { attributePath: 'Count', sectionKey: 'b', width: 'half' }, { attributePath: 'Enabled', sectionKey: 'b' }],
    })]);
    expect(model.sections.map((s) => s.columns)).toEqual([1, 2]);
    expect(field(model, 'name')?.width).toBe('full');
    expect(field(model, 'count')?.width).toBe('half');
    expect(field(model, 'enabled')?.width).toBe('full');
  });

  it('section order: explicit ascending, missing orders after, definition order stable; empty sections dropped; title defaults to key', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false,
      sections: [{ key: 'x' }, { key: 'y', order: 2 }, { key: 'z' }, { key: 'w', order: 1 }, { key: 'empty', order: 0 }],
      fields: [{ attributePath: 'Name', sectionKey: 'x' }, { attributePath: 'Count', sectionKey: 'y' }, { attributePath: 'Enabled', sectionKey: 'z' }, { attributePath: 'Kind', sectionKey: 'w' }],
    })]);
    expect(model.sections.map((s) => s.key)).toEqual(['w', 'y', 'x', 'z']);
    expect(model.sections[0].title).toBe('w');
  });

  it('field order within a section uses the same rule; unknown section key goes to the first section', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false,
      sections: [{ key: 'second', order: 5 }, { key: 'first', order: 1 }],
      fields: [{ attributePath: 'Name', sectionKey: 'nope' }, { attributePath: 'Count', sectionKey: 'first', order: 0 }, { attributePath: 'Enabled', sectionKey: 'second' }],
    })]);
    expect(model.sections[0].fields.map((f) => [f.key, f.order])).toEqual([['count', 0], ['name', 1]]);
  });

  it('min/max only on numeric types; pattern only on text-like editors', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [
      { attributePath: 'Name', min: 1, max: 5, pattern: '^a' }, { attributePath: 'Count', min: 1, max: 5, pattern: '^a' },
    ] })]);
    expect(field(model, 'name')).toEqual(expect.objectContaining({ pattern: '^a' }));
    expect(field(model, 'name')?.min).toBeUndefined();
    expect(field(model, 'count')).toEqual(expect.objectContaining({ min: 1, max: 5 }));
    expect(field(model, 'count')?.pattern).toBeUndefined();
  });

  it('Default parsing per type and CK default fallback', () => {
    const t = ckType('T/D', { attributes: [
      attr('i', 'INT'), attr('d', 'DOUBLE'), attr('b', 'BOOLEAN'), attr('e', 'ENUM', { enumOptions: [{ key: 0, name: 'Dev' }, { key: 1, name: 'Release' }] }),
      attr('t', 'DATE_TIME'), attr('a', 'STRING_ARRAY'), attr('ck', 'INT', { defaultValues: [7] }),
    ] });
    const model = resolveEntityForm(t, [form('T/D', { fields: [
      { attributePath: 'i', default: '42' }, { attributePath: 'd', default: '1.5' }, { attributePath: 'b', default: 'true' },
      { attributePath: 'e', default: 'Release' }, { attributePath: 't', default: '2026-01-02T03:04:05Z' }, { attributePath: 'a', default: 'x, y' },
    ] })]);
    expect(field(model, 'i')?.defaultValue).toBe(42);
    expect(field(model, 'd')?.defaultValue).toBe(1.5);
    expect(field(model, 'b')?.defaultValue).toBe(true);
    expect(field(model, 'e')?.defaultValue).toBe(1);
    expect(field(model, 't')?.defaultValue).toEqual(new Date('2026-01-02T03:04:05Z'));
    expect(field(model, 'a')?.defaultValue).toEqual(['x', 'y']);
    expect(field(model, 'ck')?.defaultValue).toBe(7);
  });

  it('VisibleWhen with an unresolvable path drops the rule with a warning', () => {
    const model = resolveEntityForm(base, [form('T/Thing', { generateRemainingFields: false, fields: [{ attributePath: 'Name', visibleWhen: 'Ghost=1' }] })]);
    expect(field(model, 'name')?.visibleWhen).toBeUndefined();
    expect(model.warnings).toEqual(["Field 'Name': VisibleWhen 'Ghost=1' cannot be resolved; rule dropped."]);
  });
});

describe('resolveEntityForm associations', () => {
  const type = ckType('T/Src', {
    attributes: [attr('name'), attr('targetId')],
    associations: [
      { rtRoleId: 'System/Related', navigationPropertyName: 'RelatesFrom', direction: 'in', multiplicity: 'N', otherRtCkTypeId: 'System/Entity' },
      { rtRoleId: 'System/Related', navigationPropertyName: 'RelatesTo', direction: 'out', multiplicity: 'N', otherRtCkTypeId: 'System/Entity' },
      { rtRoleId: 'T/Owner', navigationPropertyName: 'Owner', direction: 'out', multiplicity: 'ZERO_OR_ONE', otherRtCkTypeId: 'T/Person' },
    ],
  });

  it('resolves a role from out roles first, multiple from N', () => {
    const model = resolveEntityForm(type, [form('T/Src', { generateRemainingFields: false, fields: [
      { attributePath: 'Related', editor: 'reference', associationRoleId: 'system/related' },
      { attributePath: 'Owner', editor: 'reference', associationRoleId: 'T/Owner', referenceCkTypeId: 'T/Employee' },
    ] })]);
    const rel = field(model, 'assoc:System/Related');
    expect(rel).toEqual(expect.objectContaining({ kind: 'association', editor: 'reference', label: 'Relates to' }));
    expect(rel?.reference).toEqual({ targetCkTypeId: 'System/Entity', role: type.associations[1], multiple: true });
    expect(field(model, 'assoc:T/Owner')?.reference).toEqual(expect.objectContaining({ targetCkTypeId: 'T/Employee', multiple: false }));
  });

  it('skips an unknown role with a warning; associations are never generated', () => {
    const model = resolveEntityForm(type, [form('T/Src', { fields: [{ attributePath: 'X', editor: 'reference', associationRoleId: 'T/Nope' }] })]);
    expect(fields(model).some((f) => f.kind === 'association')).toBe(false);
    expect(model.warnings).toEqual(["Field 'X': association role 'T/Nope' not found on 'T/Src'; skipped."]);
  });

  it('reference without a role on a STRING attribute stores the target rtId (single)', () => {
    const model = resolveEntityForm(type, [form('T/Src', { generateRemainingFields: false, fields: [
      { attributePath: 'TargetId', editor: 'reference', referenceCkTypeId: 'T/Person' },
    ] })]);
    expect(field(model, 'targetId')).toEqual(expect.objectContaining({ kind: 'attribute', editor: 'reference', reference: { targetCkTypeId: 'T/Person', multiple: false } }));
  });
});

describe('resolveEntityForm default-table rows', () => {
  it('abstract type gives createRequiresSubtype (create stays available)', () => {
    const model = resolveEntityForm(ckType('System/Configuration', { isAbstract: true }), [form('System/Configuration')]);
    expect(model.capabilities.createRequiresSubtype).toBe(true);
    expect(model.capabilities.canCreate).toBe(true);
    expect(model.isAbstract).toBe(true);
  });

  it('singleton is never implied', () => {
    expect(resolveEntityForm(ckType('T/S'), [form('T/S', { singletonWellKnownName: 'X' })]).singleton).toBeUndefined();
    expect(resolveEntityForm(ckType('T/S'), [form('T/S', { singleton: true, singletonWellKnownName: 'X' })]).singleton).toEqual({ wellKnownName: 'X' });
    expect(resolveEntityForm(ckType('T/S'), [form('T/S', { singleton: true })]).singleton).toEqual({});
  });

  it('capability defaults are true, true, true, false, false', () => {
    expect(resolveEntityForm(ckType('T/S'), [form('T/S')]).capabilities).toEqual({
      canCreate: true, canEdit: true, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false,
    });
  });

  it('Category is passed through; tenant form source', () => {
    const model = resolveEntityForm(ckType('T/S'), [form('T/S', { category: 'connections', isTenantForm: true, icon: 'plug', customComponent: 'X' })]);
    expect(model).toEqual(expect.objectContaining({ category: 'connections', source: 'tenant', icon: 'plug', customComponent: 'X' }));
  });
});

describe('resolveEntityForm secrets and read set', () => {
  const recordId = 'T-1.0.0/Cred-1';
  const type = ckType('T/Sec', { attributes: [
    attr('a'), attr('b'), attr('c', 'STRING', { secret: true }), attr('token'), attr('creds', 'RECORD_ARRAY', { ckRecordId: recordId }),
  ] });
  const records = { [recordId]: { ckRecordId: recordId, attributes: [attr('user'), attr('token')] } };

  it('secret from field flag, password editor and CK metaData', () => {
    const model = resolveEntityForm(type, [form('T/Sec', { fields: [{ attributePath: 'a', secret: true }, { attributePath: 'b', editor: 'password' }] })], { records });
    expect(model.secretFields).toEqual(['a', 'b', 'c', 'token']);
    expect(model.readAttributeNames).not.toContain('a');
    expect(model.readAttributeNames).not.toContain('b');
    expect(model.readAttributeNames).not.toContain('c');
  });

  it('a record sub-name colliding with a secret top-level name is dropped and the record field becomes read-only', () => {
    const model = resolveEntityForm(type, [form('T/Sec', { fields: [{ attributePath: 'Token', secret: true }] })], { records });
    expect(model.readAttributeNames).toEqual(expect.arrayContaining(['creds', 'user']));
    expect(model.readAttributeNames).not.toContain('token');
    expect(field(model, 'creds')?.readOnly).toBe('always');
    expect(model.warnings.some((w) => w.includes("'creds'"))).toBe(true);
  });

  it('list columns drop secret and unknown columns; derived fallback when empty', () => {
    const model = resolveEntityForm(type, [form('T/Sec', { listColumns: [{ attributePath: 'C' }, { attributePath: 'Ghost' }, { attributePath: 'A', width: 120, display: 'chip' }] })], { records });
    expect(model.listColumns).toEqual([{ field: 'a', label: 'A', kind: 'attribute', display: 'chip', width: 120 }]);
    const fallback = resolveEntityForm(ckType('T/F', { attributes: [attr('name'), attr('x', 'INT'), attr('pw', 'STRING', { secret: true }), attr('y'), attr('z'), attr('w')] }), [form('T/F')]);
    expect(fallback.listColumns.map((c) => c.field)).toEqual(['rtWellKnownName', 'name', 'rtChangedDateTime', 'x', 'y', 'z']);
  });
});
