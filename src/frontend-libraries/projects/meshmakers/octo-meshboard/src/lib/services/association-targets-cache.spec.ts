import { InMemoryCache } from '@apollo/client/core';
import type { FieldNode, OperationDefinitionNode, SelectionSetNode } from 'graphql';
import { GetAssociationTargetsDocumentDto, GetAssociationTargetsQueryDto } from '../graphQL/getAssociationTargets';

/**
 * AB#7649: a host that declares `typePolicies: { RtEntity: { keyFields: ['rtId'] } }` (voest-app)
 * cannot normalize an RtEntity selected without rtId - the server does not send the field, and the
 * cache write throws "Missing field 'rtId' while extracting keyFields". `fetchAssociationTargets`
 * feeds the entity-selector child scope and the associations widget, so the throw left the scope
 * empty and the widget blank although the server had answered. The library cannot see a host's
 * typePolicies, so the selection is asserted here (same rule as octo-ui's
 * `runtime entity queries carry rtId for cache normalization`).
 */
describe('getAssociationTargets with a host cache keyed by rtId (AB#7649)', () => {
  /** Field names selected directly on a selection set (no descent). */
  const directFields = (set: SelectionSetNode): string[] =>
    set.selections.filter((s): s is FieldNode => s.kind === 'Field').map(s => s.name.value);

  /** Every `items` selection set below `runtimeEntities` or an association's `targets` (RtEntity rows). */
  const entityItemSets = (set: SelectionSetNode | undefined, insideEntityField = false): SelectionSetNode[] =>
    (set?.selections ?? [])
      .filter((s): s is FieldNode => s.kind === 'Field')
      .flatMap(field => [
        ...(insideEntityField && field.name.value === 'items' && field.selectionSet ? [field.selectionSet] : []),
        ...entityItemSets(field.selectionSet, ['runtimeEntities', 'targets'].includes(field.name.value))
      ]);

  it('selects rtId directly on every entity items selection', () => {
    const operation = GetAssociationTargetsDocumentDto.definitions.find(
      (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition'
    );
    const itemSets = entityItemSets(operation?.selectionSet);

    expect(itemSets.length).toBe(2);
    for (const set of itemSets) {
      expect(directFields(set)).toContain('rtId');
    }
  });

  it('writes and reads back the targets in a cache keyed by rtId', () => {
    const variables = {
      rtId: 'mp-1',
      ckTypeId: 'TestModel/Parent',
      targetCkTypeId: 'TestModel/Child',
      roleId: 'System/ParentChild',
      direction: 'INBOUND',
      first: 100,
      attributeNames: []
    };
    const data: GetAssociationTargetsQueryDto = {
      __typename: 'OctoQuery',
      runtime: {
        __typename: 'RuntimeModelQuery',
        runtimeEntities: {
          __typename: 'RtEntityGenericDtoConnection',
          items: [{
            __typename: 'RtEntity',
            rtId: 'mp-1',
            associations: {
              __typename: 'RtEntityGenericAssociation',
              targets: {
                __typename: 'RtEntityGenericDtoConnection',
                totalCount: 2,
                items: ['em-1', 'em-2'].map(rtId => ({
                  __typename: 'RtEntity' as const,
                  rtId,
                  ckTypeId: 'TestModel/Child',
                  rtWellKnownName: null,
                  rtDisplayName: rtId,
                  attributes: { __typename: 'RtEntityAttributeDtoConnection' as const, items: [] }
                }))
              }
            }
          }]
        }
      }
    };
    const cache = new InMemoryCache({ typePolicies: { RtEntity: { keyFields: ['rtId'] } } });

    expect(() => cache.writeQuery({ query: GetAssociationTargetsDocumentDto, variables, data })).not.toThrow();

    const read = cache.readQuery<GetAssociationTargetsQueryDto>({ query: GetAssociationTargetsDocumentDto, variables });
    const targets = read?.runtime?.runtimeEntities?.items?.[0]?.associations?.targets?.items ?? [];
    expect(targets.map(t => t?.rtId)).toEqual(['em-1', 'em-2']);
  });
});
