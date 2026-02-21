import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSymbolDefinitionsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type GetSymbolDefinitionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUISymbolDefinition?: { __typename?: 'SystemUISymbolDefinitionConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemUISymbolDefinition', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, boundsWidth: number, boundsHeight: number, category?: string | null, tags?: string | null, previewImage?: string | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

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