import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetProcessDiagramsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
}>;


export type GetProcessDiagramsQueryDto = { runtime: { systemUIProcessDiagram: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, canvasWidth: number, canvasHeight: number, rtCreationDateTime: any, rtChangedDateTime: any } | null> | null } | null } | null };

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