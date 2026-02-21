import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkRecordAttributesQueryVariablesDto = Types.Exact<{
  ckRecordId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCkRecordAttributesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', records?: { __typename?: 'CkRecordDtoConnection', items?: Array<{ __typename?: 'CkRecord', rtCkRecordId: any, ckRecordId: { __typename?: 'CkRecordId', fullName: string }, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkRecordAttributesDocumentDto = gql`
    query getCkRecordAttributes($ckRecordId: String!, $first: Int) {
  constructionKit {
    records(ckId: $ckRecordId) {
      items {
        ckRecordId {
          fullName
        }
        rtCkRecordId
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
  export class GetCkRecordAttributesDtoGQL extends Apollo.Query<GetCkRecordAttributesQueryDto, GetCkRecordAttributesQueryVariablesDto> {
    document = GetCkRecordAttributesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }