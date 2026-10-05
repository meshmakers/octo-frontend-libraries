import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormTypeProbeQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type EntityFormTypeProbeQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any } | null> | null } | null } | null };

export const EntityFormTypeProbeDocumentDto = gql`
    query entityFormTypeProbe {
  constructionKit {
    types(rtCkId: "System.UI/EntityForm", first: 1) {
      items {
        rtCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormTypeProbeDtoGQL extends Apollo.Query<EntityFormTypeProbeQueryDto, EntityFormTypeProbeQueryVariablesDto> {
    document = EntityFormTypeProbeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }