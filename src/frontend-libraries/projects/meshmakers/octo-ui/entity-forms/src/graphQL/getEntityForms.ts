import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetEntityFormsQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type EntityFormGetEntityFormsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, rtWellKnownName?: string | null, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetEntityFormsDocumentDto = gql`
    query entityFormGetEntityForms {
  runtime {
    runtimeEntities(ckId: "System.UI/EntityForm", first: 500) {
      totalCount
      items {
        rtId
        rtWellKnownName
        ckTypeId
        attributes {
          items {
            attributeName
            value
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
  export class EntityFormGetEntityFormsDtoGQL extends Apollo.Query<EntityFormGetEntityFormsQueryDto, EntityFormGetEntityFormsQueryVariablesDto> {
    document = EntityFormGetEntityFormsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }