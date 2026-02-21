import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypeAttributesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCkTypeAttributesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, ckTypeId: { __typename?: 'CkTypeId', fullName: string }, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAttributesDocumentDto = gql`
    query getCkTypeAttributes($ckTypeId: String!, $first: Int) {
  constructionKit {
    types(ckId: $ckTypeId) {
      items {
        ckTypeId {
          fullName
        }
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
  export class GetCkTypeAttributesDtoGQL extends Apollo.Query<GetCkTypeAttributesQueryDto, GetCkTypeAttributesQueryVariablesDto> {
    document = GetCkTypeAttributesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }