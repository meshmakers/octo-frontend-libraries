import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypeAttributesQueryVariablesDto = Exact<{
  ckTypeId: string;
  first?: number | null | undefined;
}>;


export type GetCkTypeAttributesQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, ckTypeId: { fullName: string }, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAttributesDocumentDto = gql`
    query getCkTypeAttributes($ckTypeId: String!, $first: Int) {
  constructionKit {
    types(rtCkId: $ckTypeId) {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId
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
  export class GetCkTypeAttributesDtoGQL extends Apollo.Query<GetCkTypeAttributesQueryDto, GetCkTypeAttributesQueryVariablesDto> {
    document = GetCkTypeAttributesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }