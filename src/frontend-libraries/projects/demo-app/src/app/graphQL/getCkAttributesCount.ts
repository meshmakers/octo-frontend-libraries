import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkAttributesCountQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type GetCkAttributesCountQueryDto = { constructionKit: { attributes: { totalCount: number | null } | null } | null };

export const GetCkAttributesCountDocumentDto = gql`
    query getCkAttributesCount {
  constructionKit {
    attributes {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkAttributesCountDtoGQL extends Apollo.Query<GetCkAttributesCountQueryDto, GetCkAttributesCountQueryVariablesDto> {
    document = GetCkAttributesCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }