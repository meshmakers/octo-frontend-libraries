import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkAttributesDetailedQueryVariablesDto = Types.Exact<{
  ckId: Types.Scalars['String']['input'];
}>;


export type GetCkAttributesDetailedQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', ckTypeId: { __typename?: 'CkTypeId', fullName: string }, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, autoCompleteValues?: Array<string | null> | null, ckAttributeId: { __typename?: 'CkAttributeId', fullName: string }, attribute?: { __typename?: 'CkAttribute', defaultValues?: Array<any | null> | null, ckRecord?: { __typename?: 'CkRecord', ckRecordId: { __typename?: 'CkRecordId', fullName: string } } | null, ckEnum?: { __typename?: 'CkEnum', ckEnumId: { __typename?: 'CkEnumId', fullName: string }, values: Array<{ __typename?: 'CkEnumValue', key?: number | null, name?: string | null } | null> } | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const GetCkAttributesDetailedDocumentDto = gql`
    query getCkAttributesDetailed($ckId: String!) {
  constructionKit {
    types(ckId: $ckId) {
      items {
        ckTypeId {
          fullName
        }
        attributes {
          items {
            attributeName
            attributeValueType
            isOptional
            autoCompleteValues
            ckAttributeId {
              fullName
            }
            attribute {
              ckRecord {
                ckRecordId {
                  fullName
                }
              }
              ckEnum {
                ckEnumId {
                  fullName
                }
                values {
                  key
                  name
                }
              }
              defaultValues
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
  export class GetCkAttributesDetailedDtoGQL extends Apollo.Query<GetCkAttributesDetailedQueryDto, GetCkAttributesDetailedQueryVariablesDto> {
    document = GetCkAttributesDetailedDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }