import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetCkRecordQueryVariablesDto = Types.Exact<{
  ckRecordId: Types.Scalars['String']['input'];
}>;


export type EntityFormGetCkRecordQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', records?: { __typename?: 'CkRecordDtoConnection', items?: Array<{ __typename?: 'CkRecord', isAbstract: boolean, ckRecordId: { __typename?: 'CkRecordId', fullName: string }, attributes?: { __typename?: 'CkTypeAttributeDtoConnection', items?: Array<{ __typename?: 'CkTypeAttribute', attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, ckAttributeId: { __typename?: 'CkAttributeId', fullName: string }, attribute?: { __typename?: 'CkAttribute', description?: string | null, defaultValues?: Array<any | null> | null, metaData?: Array<{ __typename?: 'CkAttributeMetaData', key: string, value?: string | null } | null> | null, ckEnum?: { __typename?: 'CkEnum', ckEnumId: { __typename?: 'CkEnumId', fullName: string }, values: Array<{ __typename?: 'CkEnumValue', key?: number | null, name?: string | null } | null> } | null, ckRecord?: { __typename?: 'CkRecord', ckRecordId: { __typename?: 'CkRecordId', fullName: string } } | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetCkRecordDocumentDto = gql`
    query entityFormGetCkRecord($ckRecordId: String!) {
  constructionKit {
    records(ckId: $ckRecordId, first: 1) {
      items {
        ckRecordId {
          fullName
        }
        isAbstract
        attributes(first: 1000) {
          items {
            attributeName
            attributeValueType
            isOptional
            ckAttributeId {
              fullName
            }
            attribute {
              description
              defaultValues
              metaData {
                key
                value
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
  export class EntityFormGetCkRecordDtoGQL extends Apollo.Query<EntityFormGetCkRecordQueryDto, EntityFormGetCkRecordQueryVariablesDto> {
    document = EntityFormGetCkRecordDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }