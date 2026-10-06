import { firstValueFrom, of } from 'rxjs';
import { Kind, OperationDefinitionNode } from 'graphql';
import { EntityFormGetReferenceOptionsDtoGQL } from '../../graphQL/getEntityFormReferenceOptions';
import {
  EntityFormGetReferenceOptionsWithAttributesDocumentDto,
  EntityFormGetReferenceOptionsWithAttributesDtoGQL
} from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { EntityReferenceDataSource, referenceLabel } from './entity-reference-data-source';
import { formatReferenceDisplayValue } from './reference-display-format';
import { attr } from '../../core/testing/factories';
import { resolveEntityForm } from '../../core/entity-form-resolver';
import { CkTypeInfo, EntityFormDefinition } from '../../models/entity-form.models';

const row = {
  rtId: 'h1', ckTypeId: 'System.Communication/HelmRepositoryConfiguration', rtWellKnownName: 'main', rtDisplayName: null,
  attributes: { items: [{ attributeName: 'channel', value: 'stable' }, { attributeName: 'repositoryUrl', value: 'https://charts.example' }] }
};

function gqls() {
  const plain = { fetch: vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } })) };
  const withAttributes = { fetch: vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 1, items: [row] } } } })) };
  return {
    plain, withAttributes,
    plainGql: plain as unknown as EntityFormGetReferenceOptionsDtoGQL,
    attributesGql: withAttributes as unknown as EntityFormGetReferenceOptionsWithAttributesDtoGQL
  };
}

describe('reference display attributes (AB#5547)', () => {
  it('declares attributeNames as non-null in the attributes document', () => {
    const op = EntityFormGetReferenceOptionsWithAttributesDocumentDto.definitions.find(d => d.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
    const variable = op.variableDefinitions?.find(v => v.variable.name.value === 'attributeNames');
    expect(variable?.type.kind).toBe(Kind.NON_NULL_TYPE);
  });

  it('labels a target with the configured attributes in order', () => {
    expect(referenceLabel('main', row, ['repositoryUrl', 'channel'])).toBe('main · https://charts.example · stable');
    expect(referenceLabel('main', row, [])).toBe('main');
  });

  it('reads exactly the configured attribute names, and only with display attributes configured', async () => {
    const g = gqls();
    const source = new EntityReferenceDataSource(g.plainGql, 'System.Communication/HelmRepositoryConfiguration', undefined, ['repositoryUrl', 'channel'], g.attributesGql);
    const result = await source.onFilter('', 10);
    expect(g.plain.fetch).not.toHaveBeenCalled();
    expect(g.withAttributes.fetch.mock.calls[0][0].variables.attributeNames).toEqual(['name', 'repositoryUrl', 'channel']);
    expect(result.items[0].displayName).toBe('main · https://charts.example · stable');

    const plainSource = new EntityReferenceDataSource(g.plainGql, 'X/Y', undefined, [], g.attributesGql);
    await firstValueFrom(plainSource.fetchData({ skip: 0, take: 5, textSearch: null } as never));
    expect(g.plain.fetch).toHaveBeenCalled();
  });

  it('resolves referenceDisplayAttributes onto association reference fields', () => {
    const type: CkTypeInfo = {
      rtCkTypeId: 'System.Communication/Adapter', ckTypeIdFullName: 'x', isAbstract: false, ancestors: ['System/Entity'], attributes: [],
      associations: [{ rtRoleId: 'System.Communication/HelmRepository', navigationPropertyName: 'HelmRepository', direction: 'out', multiplicity: 'ZERO_OR_ONE', otherRtCkTypeId: 'System.Communication/HelmRepositoryConfiguration' }]
    };
    const form: EntityFormDefinition = {
      rtId: '', isTenantForm: false, targetCkTypeId: 'System.Communication/Adapter', includeDerivedTypes: false, priority: 0, sections: [], listColumns: [],
      fields: [{ attributePath: 'HelmRepository', editor: 'reference', associationRoleId: 'System.Communication/HelmRepository', referenceDisplayAttributes: ['repositoryUrl', ' channel '] }]
    };
    const field = resolveEntityForm(type, [form]).sections[0].fields[0];
    expect(field.reference?.displayAttributes).toEqual(['repositoryUrl', 'channel']);
  });

  describe('value formatting by CK value type', () => {
    const channel = attr('channel', 'ENUM', { enumOptions: [{ key: 0, name: 'Release' }, { key: 1, name: 'Preview' }] });

    it('shows the enum name instead of the key the API returns', () => {
      expect(formatReferenceDisplayValue(0, channel)).toBe('Release');
      expect(formatReferenceDisplayValue('1', channel)).toBe('Preview');
      expect(formatReferenceDisplayValue('PREVIEW', channel)).toBe('Preview');
      expect(formatReferenceDisplayValue(7, channel)).toBe('7');
    });

    it('shows booleans as yes/no (configurable labels) and dates localized', () => {
      expect(formatReferenceDisplayValue(true, attr('enabled', 'BOOLEAN'))).toBe('Yes');
      expect(formatReferenceDisplayValue(false, attr('enabled', 'BOOLEAN'), { yes: 'Ja', no: 'Nein' })).toBe('Nein');
      expect(formatReferenceDisplayValue(true, undefined)).toBe('Yes');
      const iso = '2026-10-06T12:30:00Z';
      expect(formatReferenceDisplayValue(iso, attr('since', 'DATE_TIME'), { locale: 'en-GB' }))
        .toBe(new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }));
      expect(formatReferenceDisplayValue('not a date', attr('since', 'DATE_TIME'))).toBe('not a date');
    });

    it('skips empty and record values and joins arrays', () => {
      expect(formatReferenceDisplayValue(null, channel)).toBeNull();
      expect(formatReferenceDisplayValue('  ', attr('x'))).toBeNull();
      expect(formatReferenceDisplayValue({ a: 1 }, attr('r', 'RECORD'))).toBeNull();
      expect(formatReferenceDisplayValue(['a', 'b'], attr('tags', 'STRING_ARRAY'))).toBe('a, b');
    });

    it('labels a Helm repository with its channel name (AB#5547 live check)', () => {
      const helm = { ...row, attributes: { items: [{ attributeName: 'channel', value: 0 }, { attributeName: 'repositoryUrl', value: 'https://charts.example' }] } };
      expect(referenceLabel('main', helm, ['repositoryUrl', 'channel'], { attributes: [channel] })).toBe('main · https://charts.example · Release');
      expect(referenceLabel('main', helm, ['repositoryUrl', 'channel'])).toBe('main · https://charts.example · 0');
    });

    it('formats picker rows with the metadata passed to the data source', async () => {
      const g = gqls();
      g.withAttributes.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 1, items: [{ ...row, attributes: { items: [{ attributeName: 'channel', value: 0 }] } }] } } } }));
      const source = new EntityReferenceDataSource(g.plainGql, 'X/Y', undefined, ['channel'], g.attributesGql, { attributes: [channel] });
      expect((await source.onFilter('', 5)).items[0].displayName).toBe('main · Release');
    });
  });

  it('looks up the current value by rtId with the same label rule', async () => {
    const g = gqls();
    const source = new EntityReferenceDataSource(g.plainGql, 'X/Y', undefined, ['repositoryUrl', 'channel'], g.attributesGql);
    const found = await source.lookup(['h1', 'h1', '']);
    const variables = g.withAttributes.fetch.mock.calls[0][0].variables;
    expect(variables.fieldFilters).toEqual([{ attributePath: 'rtId', operator: 'IN', comparisonValue: ['h1'] }]);
    expect(variables.first).toBe(1);
    expect(found.get('h1')?.displayName).toBe('main · https://charts.example · stable');
    expect((await source.lookup([])).size).toBe(0);
  });
});
