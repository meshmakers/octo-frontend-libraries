import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetProcessDiagramsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type GetProcessDiagramsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUIProcessDiagram?: { __typename?: 'SystemUIProcessDiagramConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemUIProcessDiagram', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, canvasWidth: number, canvasHeight: number, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const GetProcessDiagramsDocumentDto = gql`
    query getProcessDiagrams($first: Int, $searchFilter: SearchFilter) {
  runtime {
    systemUIProcessDiagram(first: $first, searchFilter: $searchFilter) {
      totalCount
      items {
        rtId
        ckTypeId
        name
        description
        version
        canvasWidth
        canvasHeight
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
  export class GetProcessDiagramsDtoGQL extends Apollo.Query<GetProcessDiagramsQueryDto, GetProcessDiagramsQueryVariablesDto> {
    document = GetProcessDiagramsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }