import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkRecordDetailedQueryVariablesDto = Types.Exact<{
  ckId?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type GetCkRecordDetailedQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', records?: { __typename?: 'CkRecordDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkRecord', isAbstract: boolean, ckRecordId: { __typename?: 'CkRecordId', fullName: string }, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', isOptional: boolean, attributeName: string, attributeValueType: Types.AttributeValueTypeDto, ckAttributeId: { __typename?: 'CkAttributeId', fullName: string }, attribute?: { __typename?: 'CkAttribute', defaultValues?: Array<any | null> | null, ckRecord?: { __typename?: 'CkRecord', ckRecordId: { __typename?: 'CkRecordId', fullName: string } } | null, ckEnum?: { __typename?: 'CkEnum', ckEnumId: { __typename?: 'CkEnumId', fullName: string }, values: Array<{ __typename?: 'CkEnumValue', key?: number | null, name?: string | null } | null> } | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const GetCkRecordDetailedDocumentDto = gql`
    query getCkRecordDetailed($ckId: String) {
  constructionKit {
    records(ckId: $ckId) {
      totalCount
      items {
        ckRecordId {
          fullName
        }
        isAbstract
        attributes {
          items {
            ckAttributeId {
              fullName
            }
            isOptional
            attributeName
            attributeValueType
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
  export class GetCkRecordDetailedDtoGQL extends Apollo.Query<GetCkRecordDetailedQueryDto, GetCkRecordDetailedQueryVariablesDto> {
    document = GetCkRecordDetailedDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }