import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypeAttributesForMeshboardQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCkTypeAttributesForMeshboardQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAttributesForMeshboardDocumentDto = gql`
    query getCkTypeAttributesForMeshboard($ckTypeId: String!, $first: Int) {
  constructionKit {
    types(rtCkId: $ckTypeId, first: 1) {
      items {
        rtCkTypeId
        attributes(first: $first) {
          items {
            attributeName
            attributeValueType
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
  export class GetCkTypeAttributesForMeshboardDtoGQL extends Apollo.Query<GetCkTypeAttributesForMeshboardQueryDto, GetCkTypeAttributesForMeshboardQueryVariablesDto> {
    document = GetCkTypeAttributesForMeshboardDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }