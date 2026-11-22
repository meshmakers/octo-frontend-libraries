import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSymbolLibrariesQueryVariablesDto = Exact<{
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
}>;


export type GetSymbolLibrariesQueryDto = { runtime: { systemUISymbolLibrary: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, author: string | null, isBuiltIn: boolean | null, isReadOnly: boolean | null, rtCreationDateTime: any, rtChangedDateTime: any, children: { totalCount: number | null } | null } | null> | null } | null } | null };

export const GetSymbolLibrariesDocumentDto = gql`
    query getSymbolLibraries($first: Int, $searchFilter: SearchFilter) {
  runtime {
    systemUISymbolLibrary(first: $first, searchFilter: $searchFilter) {
      totalCount
      items {
        rtId
        ckTypeId
        name
        description
        version
        author
        isBuiltIn
        isReadOnly
        rtCreationDateTime
        rtChangedDateTime
        children(ckTypeIds: ["System.UI/SymbolDefinition"]) {
          totalCount
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSymbolLibrariesDtoGQL extends Apollo.Query<GetSymbolLibrariesQueryDto, GetSymbolLibrariesQueryVariablesDto> {
    document = GetSymbolLibrariesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }