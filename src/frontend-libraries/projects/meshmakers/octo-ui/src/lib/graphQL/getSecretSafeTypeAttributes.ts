import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSecretSafeTypeAttributesQueryVariablesDto = Exact<{
  rtCkTypeId: string;
}>;


export type GetSecretSafeTypeAttributesQueryDto = { constructionKit: { types: { items: Array<{ attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto, isOptional: boolean, attribute: { metaData: Array<{ key: string, value: string | null } | null> | null, ckRecord: { ckRecordId: { fullName: string } } | null } | null } | null> | null } | null } | null> | null } | null } | null };

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