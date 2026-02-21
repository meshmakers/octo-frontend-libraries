import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypeByRtCkTypeIdQueryVariablesDto = Types.Exact<{
  rtCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetCkTypeByRtCkTypeIdQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, ckTypeId: { __typename?: 'CkTypeId', fullName: string } } | null> | null } | null } | null };

export const GetCkTypeByRtCkTypeIdDocumentDto = gql`
    query getCkTypeByRtCkTypeId($rtCkTypeId: String!) {
  constructionKit {
    types(rtCkId: $rtCkTypeId) {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypeByRtCkTypeIdDtoGQL extends Apollo.Query<GetCkTypeByRtCkTypeIdQueryDto, GetCkTypeByRtCkTypeIdQueryVariablesDto> {
    document = GetCkTypeByRtCkTypeIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }