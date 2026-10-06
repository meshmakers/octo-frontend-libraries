import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSecretSafeTypeAttributesQueryVariablesDto = Types.Exact<{
  rtCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetSecretSafeTypeAttributesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, attribute?: { __typename?: 'CkAttribute', metaData?: Array<{ __typename?: 'CkAttributeMetaData', key: string, value?: string | null } | null> | null, ckRecord?: { __typename?: 'CkRecord', ckRecordId: { __typename?: 'CkRecordId', fullName: string } } | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const GetSecretSafeTypeAttributesDocumentDto = gql`
    query getSecretSafeTypeAttributes($rtCkTypeId: String!) {
  constructionKit {
    types(rtCkId: $rtCkTypeId, first: 1) {
      items {
        attributes {
          items {
            attributeName
            attributeValueType
            isOptional
            attribute {
              metaData {
                key
                value
              }
              ckRecord {
                ckRecordId {
                  fullName
                }
              }
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
  export class GetSecretSafeTypeAttributesDtoGQL extends Apollo.Query<GetSecretSafeTypeAttributesQueryDto, GetSecretSafeTypeAttributesQueryVariablesDto> {
    document = GetSecretSafeTypeAttributesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }