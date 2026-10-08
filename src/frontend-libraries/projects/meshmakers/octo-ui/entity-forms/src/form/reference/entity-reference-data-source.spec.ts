import { firstValueFrom, of } from 'rxjs';
import { FieldNode, Kind, OperationDefinitionNode, SelectionSetNode, visit } from 'graphql';
import { SearchFilterTypesDto } from '@meshmakers/octo-services';
import {
  EntityFormGetReferenceOptionsDocumentDto,
  EntityFormGetReferenceOptionsDtoGQL
} from '../../graphQL/getEntityFormReferenceOptions';
import { EntityReferenceDataSource, nameAttributeOf, referenceDisplayName } from './entity-reference-data-source';

function response(items: unknown[], totalCount = items.length): unknown {
  return { data: { runtime: { runtimeEntities: { totalCount, pageInfo: { endCursor: null, hasNextPage: false }, items } } } };
}

function fakeGql(result: unknown = response([])): { gql: EntityFormGetReferenceOptionsDtoGQL; fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn().mockReturnValue(of(result));
  return { gql: { fetch, document: EntityFormGetReferenceOptionsDocumentDto } as unknown as EntityFormGetReferenceOptionsDtoGQL, fetch };
}

/** Collects the names of every field selected anywhere in the document. */
function selectedFieldNames(): string[] {
  const names: string[] = [];
  visit(EntityFormGetReferenceOptionsDocumentDto, {
    Field(node: FieldNode) {
      names.push(node.name.value);
    }
  });
  return names;
}

/** Field names selected directly under `runtimeEntities { items { … } }`. */
function itemFieldNames(): string[] {
  const op = EntityFormGetReferenceOptionsDocumentDto.definitions.find(
    d => d.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
  const child = (set: SelectionSetNode | undefined, name: string): FieldNode | undefined =>
    set?.selections.find((s): s is FieldNode => s.kind === Kind.FIELD && s.name.value === name);
  const items = child(child(child(op.selectionSet, 'runtime')?.selectionSet, 'runtimeEntities')?.selectionSet, 'items');
  return (items?.selectionSet?.selections ?? [])
    .filter((s): s is FieldNode => s.kind === Kind.FIELD)
    .map(s => s.name.value);
}

describe('EntityReferenceDataSource (secret-safe reference picker)', () => {
  describe('request shape', () => {
    it('the only attributes selection is the literal, non-secret ["name"] list', () => {
      const names = selectedFieldNames();
      expect(names).toContain('runtimeEntities');
      expect(names.filter(n => n === 'attributes')).toHaveLength(1);
      expect(names).not.toContain('associations');
      const lists: string[][] = [];
      visit(EntityFormGetReferenceOptionsDocumentDto, {
        Field(node: FieldNode) {
          if (node.name.value === 'attributes') {
            const arg = node.arguments?.find(a => a.name.value === 'attributeNames');
            lists.push(arg?.value.kind === Kind.LIST ? arg.value.values.map(v => (v.kind === Kind.STRING ? v.value : '?')) : []);
          }
        }
      });
      expect(lists).toEqual([['name']]);
    });

    it('selects exactly the system properties of the targets plus the name attribute, rtId included', () => {
      expect(itemFieldNames().sort()).toEqual(
        ['attributes', 'ckTypeId', 'rtDisplayDescription', 'rtDisplayName', 'rtId', 'rtWellKnownName'].sort());
    });

    it('the document declares no attributeNames variable', () => {
      const op = EntityFormGetReferenceOptionsDocumentDto.definitions.find(
        d => d.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
      const variables = (op.variableDefinitions ?? []).map(v => v.variable.name.value);
      expect(variables).not.toContain('attributeNames');
    });

    it('the typeahead request carries no attribute selection in its variables', async () => {
      const { gql, fetch } = fakeGql();
      const ds = new EntityReferenceDataSource(gql, 'System.Communication/HelmRepository');

      await ds.onFilter('repo', 10);

      expect(fetch).toHaveBeenCalledTimes(1);
      const options = fetch.mock.calls[0][0];
      expect(Object.keys(options.variables)).not.toContain('attributeNames');
      expect(JSON.stringify(options.variables)).not.toMatch(/attribute(s|Names)"/);
      expect(options.variables).toEqual(expect.objectContaining({
        ckTypeId: 'System.Communication/HelmRepository',
        first: 10,
        searchFilter: {
          type: SearchFilterTypesDto.AttributeFilterDto,
          attributePaths: ['rtWellKnownName', 'rtDisplayName'],
          searchTerm: 'repo'
        }
      }));
      expect(options.fetchPolicy).toBe('network-only');
    });

    it('the dialog request pages with an arrayconnection cursor and searches system properties only', async () => {
      const { gql, fetch } = fakeGql();
      const ds = new EntityReferenceDataSource(gql, 'Basic/Tree');

      await firstValueFrom(ds.fetchData({ skip: 20, take: 10, textSearch: '  north ' }));

      const variables = fetch.mock.calls[0][0].variables;
      expect(variables.after).toBe(btoa('arrayconnection:19'));
      expect(variables.first).toBe(10);
      expect(variables.searchFilter.searchTerm).toBe('north');
      expect(variables.searchFilter.attributePaths).toEqual(['rtWellKnownName', 'rtDisplayName']);
      expect(Object.keys(variables)).not.toContain('attributeNames');
    });

    it('omits the search filter and cursor on the first unfiltered page', () => {
      const { gql } = fakeGql();
      const variables = new EntityReferenceDataSource(gql, 'Basic/Tree').buildVariables('', 25, 0);
      expect(variables.searchFilter).toBeUndefined();
      expect(variables.after).toBeUndefined();
    });
  });

  describe('result mapping', () => {
    it('maps rows to items and keeps the total count', async () => {
      const { gql } = fakeGql(response([
        { rtId: 'a1', ckTypeId: 'Basic/Tree', rtWellKnownName: 'north', rtDisplayName: 'North wing', rtDisplayDescription: null },
        null
      ], 7));
      const ds = new EntityReferenceDataSource(gql, 'Basic/Tree');

      const result = await ds.onFilter('no');

      expect(result.totalCount).toBe(7);
      expect(result.items).toEqual([
        { rtId: 'a1', ckTypeId: 'Basic/Tree', rtWellKnownName: 'north', rtDisplayName: 'North wing', rtDisplayDescription: undefined, displayName: 'North wing' }
      ]);
      expect(ds.onDisplayEntity(result.items[0])).toBe('North wing');
      expect(ds.getIdEntity(result.items[0])).toBe('a1');
    });

    it('offers display, well-known name, type and rtId columns', () => {
      const { gql } = fakeGql();
      const fields = new EntityReferenceDataSource(gql, 'Basic/Tree').getColumns()
        .map(c => (typeof c === 'string' ? c : c.field));
      expect(fields).toEqual(['displayName', 'rtWellKnownName', 'ckTypeId', 'rtId']);
    });
  });

  describe('referenceDisplayName', () => {
    it('uses a computed rtDisplayName', () => {
      expect(referenceDisplayName({ rtId: '1', ckTypeId: 'A/B', rtWellKnownName: 'wk', rtDisplayName: 'Nice' })).toBe('Nice');
    });

    it('treats the synthetic "<ckTypeId>@<rtId>" form as absent and prefers rtWellKnownName', () => {
      expect(referenceDisplayName({ rtId: '1', ckTypeId: 'A/B', rtWellKnownName: 'wk', rtDisplayName: 'A/B@1' })).toBe('wk');
    });

    it('prefers the name attribute over rtWellKnownName (pool "Default Cloud", not "CommunicationPool")', () => {
      const pool = { rtId: '670000000000000000000001', ckTypeId: 'System.Communication/Pool', rtWellKnownName: 'CommunicationPool' };
      const name = nameAttributeOf({ attributes: { items: [{ attributeName: 'name', value: 'Default Cloud' }] } });
      expect(referenceDisplayName({ ...pool, rtDisplayName: 'System.Communication/Pool@670000000000000000000001', name })).toBe('Default Cloud');
      expect(referenceDisplayName({ ...pool, rtDisplayName: 'Computed', name })).toBe('Computed');
      expect(nameAttributeOf({ attributes: { items: [{ attributeName: 'name', value: '  ' }] } })).toBeNull();
      expect(nameAttributeOf({})).toBeNull();
    });

    it('falls back to the synthetic form, then to the rtId', () => {
      expect(referenceDisplayName({ rtId: '1', ckTypeId: 'A/B', rtWellKnownName: null, rtDisplayName: 'A/B@1' })).toBe('A/B@1');
      expect(referenceDisplayName({ rtId: '1', ckTypeId: 'A/B', rtWellKnownName: null, rtDisplayName: null })).toBe('1');
    });
  });
});
