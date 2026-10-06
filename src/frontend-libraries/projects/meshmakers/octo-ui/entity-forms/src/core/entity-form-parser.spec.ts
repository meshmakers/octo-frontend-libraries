import { parseEntityForm, parseEntityForms } from './entity-form-parser';
import { LIVE_FORM_DEFAULT_ROW, LIVE_FORM_SFTP_ROW } from './testing/live-fixtures';

describe('parseEntityForm', () => {
  it('parses the live form-default payload (records as {ckRecordId, attributes:[...]})', () => {
    const def = parseEntityForm(LIVE_FORM_DEFAULT_ROW)!;
    expect(def).toEqual(expect.objectContaining({
      rtId: '670300000000000000000001',
      rtWellKnownName: 'form-default',
      isTenantForm: false,
      targetCkTypeId: 'System/Entity',
      includeDerivedTypes: true,
      priority: 0,
      canExport: true,
      generatedSectionTitle: 'Attributes',
    }));
    expect(def.sections).toEqual([
      { key: 'general', title: 'General', description: null, order: 0, collapsed: null, columns: 2 },
      { key: 'system', title: 'System', description: 'Blueprint provenance stamped by the engine when a blueprint seeded this entity.', order: 99, collapsed: true, columns: null },
    ]);
    expect(def.fields.map((f) => f.attributePath)).toEqual(['rtWellKnownName', 'Name', 'Description', 'RtBlueprintSource', 'RtBlueprintLocked', 'RtBlueprintAppliedAt']);
    expect(def.fields[0].readOnly).toBe('afterCreate');
    expect(def.listColumns[2]).toEqual({ attributePath: 'rtChangedDateTime', label: 'Changed', width: null, display: 'date' });
  });

  it('parses numbers, booleans and VisibleWhen of the live SFTP form', () => {
    const def = parseEntityForm(LIVE_FORM_SFTP_ROW)!;
    const port = def.fields.find((f) => f.attributePath === 'Port')!;
    expect(port).toEqual(expect.objectContaining({ min: 1, max: 65535, default: '22', required: true, editor: 'number' }));
    expect(def.fields.find((f) => f.attributePath === 'PrivateKeyPassphrase')).toEqual(expect.objectContaining({ secret: true, visibleWhen: 'PrivateKey=*' }));
    expect(def.category).toBe('connections');
    expect(def.includeDerivedTypes).toBe(false);
  });

  it('a tenant form has an empty or null rtBlueprintSource', () => {
    const row = (source: unknown) => ({ rtId: 'x', attributes: { items: [
      { attributeName: 'targetCkTypeId', value: 'T/X' }, { attributeName: 'rtBlueprintSource', value: source },
    ] } });
    expect(parseEntityForm(row(null))!.isTenantForm).toBe(true);
    expect(parseEntityForm(row(''))!.isTenantForm).toBe(true);
    expect(parseEntityForm(row('Bp-1.0.0'))!.isTenantForm).toBe(false);
  });

  it('missing optionals: defaults for flags, empty arrays, no undefined keys', () => {
    const def = parseEntityForm({ rtId: 'x', attributes: { items: [{ attributeName: 'TargetCkTypeId', value: 'T/X' }] } })!;
    expect(def).toEqual({
      rtId: 'x', rtWellKnownName: null, isTenantForm: true, targetCkTypeId: 'T/X', includeDerivedTypes: false, priority: 0,
      sections: [], fields: [], listColumns: [],
    });
  });

  it('accepts flat dict records and comma recordColumns defensively', () => {
    const def = parseEntityForm({ rtId: 'x', attributes: { items: [
      { attributeName: 'targetCkTypeId', value: 'T/X' },
      { attributeName: 'fields', value: [{ attributePath: 'Rows', recordColumns: 'a, b' }, { attributePath: 'Other', recordColumns: ['c'] }] },
    ] } })!;
    expect(def.fields).toEqual([{ attributePath: 'Rows', recordColumns: ['a', 'b'] }, { attributePath: 'Other', recordColumns: ['c'] }]);
  });

  it('reads referenceDisplayAttributes (System.UI 2.8.0) from field records', () => {
    const def = parseEntityForm({ rtId: 'x', attributes: { items: [
      { attributeName: 'targetCkTypeId', value: 'T/X' },
      { attributeName: 'fields', value: [
        { ckRecordId: 'System.UI/EntityFormField', attributes: [
          { attributeName: 'attributePath', value: 'HelmRepository' },
          { attributeName: 'referenceDisplayAttributes', value: ['repositoryUrl', 'channel'] },
        ] },
        { attributePath: 'Pool', referenceDisplayAttributes: null },
        { attributePath: 'Name' },
      ] },
    ] } })!;
    expect(def.fields).toEqual([
      { attributePath: 'HelmRepository', referenceDisplayAttributes: ['repositoryUrl', 'channel'] },
      { attributePath: 'Pool', referenceDisplayAttributes: null },
      { attributePath: 'Name' },
    ]);
  });

  it('drops rows without a target type', () => {
    expect(parseEntityForms([{ rtId: 'x', attributes: { items: [] } }, null, LIVE_FORM_DEFAULT_ROW]).map((f) => f.rtId)).toEqual(['670300000000000000000001']);
  });
});
