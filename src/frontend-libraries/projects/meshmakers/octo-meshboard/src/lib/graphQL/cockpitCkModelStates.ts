import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CockpitCkModelStatesQueryVariablesDto = Exact<{
  first?: number | null | undefined;
}>;


export type CockpitCkModelStatesQueryDto = { constructionKit: { all: { totalCount: number | null } | null, available: { totalCount: number | null } | null, importing: { totalCount: number | null } | null, resolveFailed: { totalCount: number | null, items: Array<{ id: { fullName: string } } | null> | null } | null } | null };

export const CockpitCkModelStatesDocumentDto = gql`
    query cockpitCkModelStates($first: Int) {
  constructionKit {
    all: models(first: 1) {
      totalCount
    }
    available: models(
      first: 1
      fieldFilter: [{attributePath: "modelState", operator: EQUALS, comparisonValue: "Available"}]
    ) {
      totalCount
    }
    importing: models(
      first: 1
      fieldFilter: [{attributePath: "modelState", operator: EQUALS, comparisonValue: "Importing"}]
    ) {
      totalCount
    }
    resolveFailed: models(
      first: $first
      fieldFilter: [{attributePath: "modelState", operator: EQUALS, comparisonValue: "ResolveFailed"}]
    ) {
      totalCount
      items {
        id {
          fullName
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CockpitCkModelStatesDtoGQL extends Apollo.Query<CockpitCkModelStatesQueryDto, CockpitCkModelStatesQueryVariablesDto> {
    document = CockpitCkModelStatesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }