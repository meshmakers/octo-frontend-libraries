import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypeByRtCkTypeIdQueryVariablesDto = Exact<{
  rtCkTypeId: string;
}>;


export type GetCkTypeByRtCkTypeIdQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, ckTypeId: { fullName: string } } | null> | null } | null } | null };

export const GetCkTypeByRtCkTypeIdDocumentDto = gql`
    query getCkTypeByRtCkTypeId($rtCkTypeId: String!) {
  constructionKit {
    types(rtCkId: $rtCkTypeId) {
      items {
        ckTypeId {
          fullName
        }
        rtCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypeByRtCkTypeIdDtoGQL extends Apollo.Query<GetCkTypeByRtCkTypeIdQueryDto, GetCkTypeByRtCkTypeIdQueryVariablesDto> {
    document = GetCkTypeByRtCkTypeIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }