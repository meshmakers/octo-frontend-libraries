import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkAttributesDetailedQueryVariablesDto = Exact<{
  ckId: string;
}>;


export type GetCkAttributesDetailedQueryDto = { constructionKit: { types: { items: Array<{ ckTypeId: { fullName: string }, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, autoCompleteValues: Array<string | null> | null, ckAttributeId: { fullName: string }, attribute: { defaultValues: Array<any> | null, ckRecord: { ckRecordId: { fullName: string } } | null, ckEnum: { ckEnumId: { fullName: string }, values: Array<{ key: number | null, name: string | null } | null> } | null, metaData: Array<{ key: string, value: string | null } | null> | null } | null } | null> | null } | null } | null> | null } | null } | null };

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
  export class GetCkAttributesDetailedDtoGQL extends Apollo.Query<GetCkAttributesDetailedQueryDto, GetCkAttributesDetailedQueryVariablesDto> {
    document = GetCkAttributesDetailedDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }