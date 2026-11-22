import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetCkRecordQueryVariablesDto = Exact<{
  ckRecordId: string;
}>;


export type EntityFormGetCkRecordQueryDto = { constructionKit: { records: { items: Array<{ isAbstract: boolean, ckRecordId: { fullName: string }, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, ckAttributeId: { fullName: string }, attribute: { description: string | null, defaultValues: Array<any> | null, metaData: Array<{ key: string, value: string | null } | null> | null, ckEnum: { ckEnumId: { fullName: string }, values: Array<{ key: number | null, name: string | null } | null> } | null, ckRecord: { ckRecordId: { fullName: string } } | null } | null } | null> | null } | null } | null> | null } | null } | null };

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