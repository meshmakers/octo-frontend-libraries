import { ResolvedEntityForm } from '../models/entity-form.models';
import {
  EntityFormLabelRequest,
  EntityFormLabelResolver,
  localizeEntityForm,
  localizeEntityFormTitle,
  localizeEntityListColumns,
  resolveEntityFormLabel,
} from './entity-form-labels';

function model(): ResolvedEntityForm {
  return {
    source: 'seeded',
    formWellKnownName: 'form-rule',
    rtCkTypeId: 'Basic.Accounting/CategorizationRule',
    formTargetCkTypeId: 'Basic.Accounting/CategorizationRule',
    isAbstract: false,
    includeDerivedTypes: false,
    title: 'Categorization rules',
    description: 'Rules',
    capabilities: { canCreate: true, canEdit: true, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false },
    sections: [{
      key: 'main', title: 'Main', description: 'Main fields', columns: 1, collapsed: false, generated: false,
      fields: [
        {
          key: 'matchField', kind: 'attribute', attributeName: 'matchField', valueType: 'ENUM', label: 'Match field', help: 'Which field',
          editor: 'enum', required: false, readOnly: 'never', width: 'full', order: 0, secret: false, generated: false,
          enumOptions: [{ key: 0, name: 'COUNTERPARTY' }, { key: 1, name: 'PURPOSE' }],
        },
        {
          key: 'lines', kind: 'attribute', attributeName: 'lines', valueType: 'RECORD_ARRAY', label: 'Lines',
          editor: 'records', required: false, readOnly: 'never', width: 'full', order: 1, secret: false, generated: false,
          record: { ckRecordId: 'X/Line-1', single: false, columns: [{ path: 'amount', label: 'Amount' }] },
        },
        {
          key: 'account', kind: 'attribute', attributeName: 'account', valueType: 'STRING', label: 'Account',
          editor: 'reference', required: false, readOnly: 'never', width: 'full', order: 2, secret: false, generated: false,
          reference: {
            targetCkTypeId: 'Basic.Accounting/BankAccount', multiple: false, displayAttributes: ['kind'],
            displayAttributeInfo: [{ attributeName: 'kind', valueType: 'ENUM', isOptional: true, defaultValues: [], secret: false, enumOptions: [{ key: 0, name: 'GIRO' }] }],
          },
        },
      ],
    }],
    listColumns: [
      { field: 'matchField', label: 'Match field', display: 'chip', kind: 'attribute', valueType: 'ENUM', enumOptions: [{ key: 0, name: 'COUNTERPARTY' }] },
      { field: 'rtChangedDateTime', label: 'Changed', display: 'date', kind: 'system' },
    ],
    readAttributeNames: [],
    secretFields: [],
    warnings: [],
  };
}

const DE: Record<string, string> = {
  'formTitle:form-rule': 'Kategorisierungsregeln',
  'formDescription:form-rule': 'Regeln',
  'section:main': 'Allgemein',
  'sectionDescription:main': 'Hauptfelder',
  'field:matchField': 'Feld',
  'help:matchField': 'Welches Feld',
  'enumOption:COUNTERPARTY': 'Gegenpartei',
  'recordColumn:amount': 'Betrag',
  'listColumn:matchField': 'Feld (Liste)',
  'listColumn:rtChangedDateTime': 'Geändert',
};

describe('entity form labels (AB#5623)', () => {
  const calls: EntityFormLabelRequest[] = [];
  const resolver: EntityFormLabelResolver = (r) => {
    calls.push(r);
    return DE[`${r.kind}:${r.key}`];
  };

  beforeEach(() => calls.splice(0));

  it('falls back to the default text for missing / empty translations and without resolver', () => {
    const request: EntityFormLabelRequest = { kind: 'field', rtCkTypeId: 'A/B', key: 'x', defaultText: 'X' };
    expect(resolveEntityFormLabel(null, request)).toBe('X');
    expect(resolveEntityFormLabel(() => '', request)).toBe('X');
    expect(resolveEntityFormLabel(() => null, request)).toBe('X');
    expect(resolveEntityFormLabel(() => 'Ix', request)).toBe('Ix');
  });

  it('falls back to the default texts when the resolver throws and warns only once', () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const throwing: EntityFormLabelResolver = () => { throw new Error('missing translation table'); };
    const out = localizeEntityForm(model(), throwing);
    expect(out.title).toBe('Categorization rules');
    expect(out.sections[0].fields[0].label).toBe('Match field');
    expect(out.sections[0].fields[0].enumOptions?.[0].name).toBe('COUNTERPARTY');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the very same model without a resolver (no behaviour change)', () => {
    const m = model();
    expect(localizeEntityForm(m, null)).toBe(m);
    expect(localizeEntityListColumns(m, undefined)).toBe(m.listColumns);
    expect(localizeEntityFormTitle(m, null)).toBe('Categorization rules');
  });

  it('translates titles, sections, fields, help, enum options, record columns and list columns', () => {
    const m = model();
    const out = localizeEntityForm(m, resolver);
    expect(out.title).toBe('Kategorisierungsregeln');
    expect(out.description).toBe('Regeln');
    const s = out.sections[0];
    expect(s.title).toBe('Allgemein');
    expect(s.description).toBe('Hauptfelder');
    expect(s.fields[0].label).toBe('Feld');
    expect(s.fields[0].help).toBe('Welches Feld');
    expect(s.fields[0].enumOptions).toEqual([{ key: 0, name: 'Gegenpartei' }, { key: 1, name: 'PURPOSE' }]);
    expect(s.fields[1].record?.columns).toEqual([{ path: 'amount', label: 'Betrag' }]);
    expect(out.listColumns.map((c) => c.label)).toEqual(['Feld (Liste)', 'Geändert']);
    expect(out.listColumns[0].enumOptions).toEqual([{ key: 0, name: 'Gegenpartei' }]);
    // Keys, attribute names and enum keys are untouched; the input model is not mutated.
    expect(s.fields.map((f) => f.key)).toEqual(['matchField', 'lines', 'account']);
    expect(m.sections[0].fields[0].label).toBe('Match field');
    expect(m.listColumns[0].label).toBe('Match field');
  });

  it('passes the context the host needs to build its translation keys', () => {
    localizeEntityForm(model(), resolver);
    expect(calls).toContainEqual({
      kind: 'enumOption', rtCkTypeId: 'Basic.Accounting/CategorizationRule', formKey: 'form-rule',
      key: 'COUNTERPARTY', enumKey: 0, attributeName: 'matchField', defaultText: 'COUNTERPARTY',
    });
    // Enum options of reference display attributes are asked for in the target type's context.
    expect(calls).toContainEqual({
      kind: 'enumOption', rtCkTypeId: 'Basic.Accounting/BankAccount', key: 'GIRO', enumKey: 0, attributeName: 'kind', defaultText: 'GIRO',
    });
    expect(calls).toContainEqual(expect.objectContaining({ kind: 'recordColumn', key: 'amount', attributeName: 'lines' }));
  });
});
