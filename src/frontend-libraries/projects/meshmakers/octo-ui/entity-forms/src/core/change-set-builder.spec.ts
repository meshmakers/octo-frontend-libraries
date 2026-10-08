import { CkTypeInfo } from '../models/entity-form.models';
import { associationRoleName, buildChangeSet } from './change-set-builder';
import { toCkTypeInfo } from './ck-metadata';
import { parseEntityForm } from './entity-form-parser';
import { resolveEntityForm } from './entity-form-resolver';
import { attr, ckType, form } from './testing/factories';
import { LIVE_FORM_SFTP_ROW, LIVE_SFTP_CK_TYPE } from './testing/live-fixtures';

const sftpModel = resolveEntityForm(toCkTypeInfo(LIVE_SFTP_CK_TYPE), [parseEntityForm(LIVE_FORM_SFTP_ROW)!]);
const loaded = { rtWellKnownName: 'cfg', host: 'a.example.com', port: 22, username: 'u', password: '', privateKey: '', privateKeyPassphrase: '', maxConcurrentConnections: 3 };

describe('buildChangeSet', () => {
  it('edit sends only dirty controls', () => {
    const cs = buildChangeSet(loaded, { ...loaded, host: 'b.example.com' }, sftpModel, 'edit', { password: true });
    expect(cs.attributes).toEqual([{ attributeName: 'host', value: 'b.example.com' }]);
    expect(cs.isEmpty).toBe(false);
  });

  it('edit with no changes is empty', () => {
    expect(buildChangeSet(loaded, { ...loaded }, sftpModel, 'edit').isEmpty).toBe(true);
  });

  it('an empty secret is left out, a typed secret is included', () => {
    const cs = buildChangeSet(loaded, { ...loaded, password: 'new!' }, sftpModel, 'edit', { password: true });
    expect(cs.attributes).toEqual([{ attributeName: 'password', value: 'new!' }]);
    const create = buildChangeSet({}, { rtWellKnownName: 'x', host: 'h', port: 22, username: 'u', password: '' }, sftpModel, 'create');
    expect(create.attributes.map((a) => a.attributeName)).toEqual(['host', 'port', 'username']);
  });

  it('a staged SECRET clear goes to clearSecretAttributes; a typed value wins; never on create (AB#5542 Q8)', () => {
    const model = resolveEntityForm(ckType('T/S', { attributes: [attr('apiKey', 'SECRET'), attr('token', 'SECRET')] }), [form('T/S')]);
    const cleared = new Set(['apiKey', 'token']);
    const cs = buildChangeSet({ apiKey: null, token: null }, { token: 'typed' }, model, 'edit', {}, { clearedSecrets: cleared });
    expect(cs.clearSecretAttributes).toEqual(['apiKey']);
    expect(cs.attributes).toEqual([{ attributeName: 'token', value: 'typed' }]);
    expect(cs.isEmpty).toBe(false);
    const onlyClear = buildChangeSet({ apiKey: null }, {}, model, 'edit', {}, { clearedSecrets: new Set(['apiKey']) });
    expect(onlyClear).toMatchObject({ attributes: [], clearSecretAttributes: ['apiKey'], isEmpty: false });
    expect(buildChangeSet({}, {}, model, 'create', {}, { clearedSecrets: cleared }).clearSecretAttributes).toBeUndefined();
  });

  it('afterCreate and read-only fields are never sent on edit; rtWellKnownName only on create', () => {
    const model = resolveEntityForm(ckType('T/X', { attributes: [attr('a'), attr('rtBlueprintSource')] }), [form('T/X', { fields: [{ attributePath: 'a', readOnly: 'afterCreate' }, { attributePath: 'rtWellKnownName' }] })]);
    const edit = buildChangeSet({ a: '1', rtWellKnownName: 'w', rtBlueprintSource: 's' }, { a: '2', rtWellKnownName: 'w2', rtBlueprintSource: 't' }, model, 'edit');
    expect(edit.isEmpty).toBe(true);
    expect(edit.rtWellKnownName).toBeUndefined();
    const create = buildChangeSet({}, { a: '2', rtWellKnownName: ' w2 ' }, model, 'create');
    expect(create.rtWellKnownName).toBe('w2');
    expect(create.attributes).toEqual([{ attributeName: 'a', value: '2' }]);
  });

  it('a key absent from current (disabled/hidden control) is never sent', () => {
    const { maxConcurrentConnections: _m, ...rest } = loaded;
    const cs = buildChangeSet(loaded, { ...rest, host: 'x' }, sftpModel, 'edit');
    expect(cs.attributes.map((a) => a.attributeName)).toEqual(['host']);
  });

  it('clearing an optional attribute on edit sends null', () => {
    const cs = buildChangeSet(loaded, { ...loaded, maxConcurrentConnections: null }, sftpModel, 'edit');
    expect(cs.attributes).toEqual([{ attributeName: 'maxConcurrentConnections', value: null }]);
  });

  it('view mode is always empty', () => {
    expect(buildChangeSet(loaded, { ...loaded, host: 'x' }, sftpModel, 'view').isEmpty).toBe(true);
  });

  describe('associations', () => {
    const type: CkTypeInfo = ckType('T/S', { associations: [
      { rtRoleId: 'T/Owner', navigationPropertyName: 'Owner', direction: 'out', multiplicity: 'ZERO_OR_ONE', otherRtCkTypeId: 'T/P' },
      { rtRoleId: 'System/Related', navigationPropertyName: 'RelatesTo', direction: 'out', multiplicity: 'N', otherRtCkTypeId: 'System/Entity' },
    ] });
    const model = resolveEntityForm(type, [form('T/S', { fields: [
      { attributePath: 'Owner', editor: 'reference', associationRoleId: 'T/Owner' },
      { attributePath: 'Related', editor: 'reference', associationRoleId: 'System/Related' },
    ] })]);
    const p = (rtId: string) => ({ rtId, ckTypeId: 'T/P', displayName: rtId });

    it('single replace gives DELETE old plus CREATE new, roleName is the camelCase navigation property', () => {
      const cs = buildChangeSet({ 'assoc:T/Owner': [p('1')] }, { 'assoc:T/Owner': [p('2')] }, model, 'edit');
      expect(cs.associations).toEqual([{ roleName: 'owner', targets: [
        { modOption: 'DELETE', target: { ckTypeId: 'T/P', rtId: '1' } },
        { modOption: 'CREATE', target: { ckTypeId: 'T/P', rtId: '2' } },
      ] }]);
    });

    it('multi gives an add/remove set', () => {
      const cs = buildChangeSet({ 'assoc:System/Related': [p('1'), p('2')] }, { 'assoc:System/Related': [p('2'), p('3')] }, model, 'edit');
      expect(cs.associations).toEqual([{ roleName: 'relatesTo', targets: [
        { modOption: 'DELETE', target: { ckTypeId: 'T/P', rtId: '1' } },
        { modOption: 'CREATE', target: { ckTypeId: 'T/P', rtId: '3' } },
      ] }]);
    });

    it('create sends every selected target as CREATE', () => {
      const cs = buildChangeSet({}, { 'assoc:System/Related': [p('1')] }, model, 'create');
      expect(cs.associations).toEqual([{ roleName: 'relatesTo', targets: [{ modOption: 'CREATE', target: { ckTypeId: 'T/P', rtId: '1' } }] }]);
    });

    it('associationRoleName lower-cases the first letter', () => {
      expect(associationRoleName('UsedBy')).toBe('usedBy');
    });
  });

  it('attribute-held reference writes the selected rtId', () => {
    const model = resolveEntityForm(ckType('T/R', { attributes: [attr('targetId')] }), [form('T/R', { fields: [{ attributePath: 'TargetId', editor: 'reference', referenceCkTypeId: 'T/P' }] })]);
    const cs = buildChangeSet({ targetId: [{ rtId: 'a', ckTypeId: 'T/P' }] }, { targetId: [{ rtId: 'b', ckTypeId: 'T/P' }] }, model, 'edit');
    expect(cs.attributes).toEqual([{ attributeName: 'targetId', value: 'b' }]);
  });
});
