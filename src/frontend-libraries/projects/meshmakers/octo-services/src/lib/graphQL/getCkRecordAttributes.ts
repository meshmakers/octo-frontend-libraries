import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkRecordAttributesQueryVariablesDto = Exact<{
  ckRecordId: string;
  first?: number | null | undefined;
}>;


export type GetCkRecordAttributesQueryDto = { constructionKit: { records: { items: Array<{ rtCkRecordId: any, ckRecordId: { fullName: string }, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkRecordAttributesDocumentDto = gql`
    query getCkRecordAttributes($ckRecordId: String!, $first: Int) {
  constructionKit {
    records(rtCkId: $ckRecordId) {
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