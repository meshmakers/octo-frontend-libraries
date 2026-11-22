import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkRecordDetailedQueryVariablesDto = Exact<{
  ckId?: string | null | undefined;
}>;


export type GetCkRecordDetailedQueryDto = { constructionKit: { records: { totalCount: number | null, items: Array<{ isAbstract: boolean, ckRecordId: { fullName: string }, attributes: { items: Array<{ isOptional: boolean, attributeName: string, attributeValueType: Types.AttributeValueTypeDto, ckAttributeId: { fullName: string }, attribute: { defaultValues: Array<any> | null, ckRecord: { ckRecordId: { fullName: string } } | null, ckEnum: { ckEnumId: { fullName: string }, values: Array<{ key: number | null, name: string | null } | null> } | null, metaData: Array<{ key: string, value: string | null } | null> | null } | null } | null> | null } | null } | null> | null } | null } | null };

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
              metaData {
                key
                value
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
  export class GetCkRecordDetailedDtoGQL extends Apollo.Query<GetCkRecordDetailedQueryDto, GetCkRecordDetailedQueryVariablesDto> {
    document = GetCkRecordDetailedDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }