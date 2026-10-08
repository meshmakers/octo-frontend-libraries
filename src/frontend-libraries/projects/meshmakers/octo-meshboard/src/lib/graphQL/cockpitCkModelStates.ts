import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CockpitCkModelStatesQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type CockpitCkModelStatesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', all?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null } | null, available?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null } | null, importing?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null } | null, resolveFailed?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkModel', id: { __typename?: 'CkModelId', fullName: string } } | null> | null } | null } | null };

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