import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSymbolLibrariesQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type GetSymbolLibrariesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUISymbolLibrary?: { __typename?: 'SystemUISymbolLibraryConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemUISymbolLibrary', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, author?: string | null, isBuiltIn?: boolean | null, isReadOnly?: boolean | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, children?: { __typename?: 'SystemUISymbolDefinition_ChildrenUnionConnection', totalCount?: number | null } | null } | null> | null } | null } | null };

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