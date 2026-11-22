import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypeAttributesForMeshboardQueryVariablesDto = Exact<{
  ckTypeId: string;
  first?: number | null | undefined;
}>;


export type GetCkTypeAttributesForMeshboardQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, attributes: { items: Array<{ attributeName: string, attributeValueType: Types.AttributeValueTypeDto } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAttributesForMeshboardDocumentDto = gql`
    query getCkTypeAttributesForMeshboard($ckTypeId: String!, $first: Int) {
  constructionKit {
    types(rtCkId: $ckTypeId, first: 1) {
      items {
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
  export class GetCkTypeAttributesForMeshboardDtoGQL extends Apollo.Query<GetCkTypeAttributesForMeshboardQueryDto, GetCkTypeAttributesForMeshboardQueryVariablesDto> {
    document = GetCkTypeAttributesForMeshboardDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }