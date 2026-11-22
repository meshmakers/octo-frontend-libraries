import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypesCountQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type GetCkTypesCountQueryDto = { constructionKit: { types: { totalCount: number | null } | null } | null };

export const GetCkTypesCountDocumentDto = gql`
    query getCkTypesCount {
  constructionKit {
    types {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypesCountDtoGQL extends Apollo.Query<GetCkTypesCountQueryDto, GetCkTypesCountQueryVariablesDto> {
    document = GetCkTypesCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }