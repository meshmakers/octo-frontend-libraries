import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSymbolDefinitionsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
}>;


export type GetSymbolDefinitionsQueryDto = { runtime: { systemUISymbolDefinition: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, boundsWidth: number, boundsHeight: number, category: string | null, tags: string | null, previewImage: string | null, rtCreationDateTime: any, rtChangedDateTime: any } | null> | null } | null } | null };

export const GetSymbolDefinitionsDocumentDto = gql`
    query getSymbolDefinitions($first: Int, $searchFilter: SearchFilter) {
  runtime {
    systemUISymbolDefinition(first: $first, searchFilter: $searchFilter) {
      totalCount
      items {
        rtId
        ckTypeId
        name
        description
        version
        boundsWidth
        boundsHeight
        category
        tags
        previewImage
        rtCreationDateTime
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSymbolDefinitionsDtoGQL extends Apollo.Query<GetSymbolDefinitionsQueryDto, GetSymbolDefinitionsQueryVariablesDto> {
    document = GetSymbolDefinitionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }