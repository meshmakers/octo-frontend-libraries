import { firstValueFrom, of } from 'rxjs';
import { Kind, OperationDefinitionNode } from 'graphql';
import { EntityFormGetReferenceOptionsDtoGQL } from '../../graphQL/getEntityFormReferenceOptions';
import {
  EntityFormGetReferenceOptionsWithAttributesDocumentDto,
  EntityFormGetReferenceOptionsWithAttributesDtoGQL
} from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { EntityReferenceDataSource, referenceLabel } from './entity-reference-data-source';
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
    expect(g.withAttributes.fetch.mock.calls[0][0].variables.attributeNames).toEqual(['repositoryUrl', 'channel']);
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
});
