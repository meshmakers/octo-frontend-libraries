import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetAssociationDefinitionsQueryVariablesDto = Exact<{
  ckTypeId: string;
  rtId: any;
  roleId: string;
  direction: Types.GraphDirectionDto;
  first?: number | null | undefined;
}>;


export type EntityFormGetAssociationDefinitionsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, associations: { definitions: { totalCount: number | null, items: Array<{ originRtId: any, originCkTypeId: any, targetRtId: any, targetCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const EntityFormGetAssociationDefinitionsDocumentDto = gql`
    query entityFormGetAssociationDefinitions($ckTypeId: String!, $rtId: OctoObjectId!, $roleId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId, first: 1) {
      items {
        rtId
        associations {
          definitions(direction: $direction, roleId: $roleId, first: $first) {
            totalCount
            items {
              originRtId
              originCkTypeId
              targetRtId
              targetCkTypeId
              ckAssociationRoleId
            }
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetAssociationDefinitionsDtoGQL extends Apollo.Query<EntityFormGetAssociationDefinitionsQueryDto, EntityFormGetAssociationDefinitionsQueryVariablesDto> {
    document = EntityFormGetAssociationDefinitionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }