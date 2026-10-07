import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CockpitBlueprintStatusQueryVariablesDto = Types.Exact<{
  take?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type CockpitBlueprintStatusQueryDto = { __typename?: 'OctoQuery', blueprints?: { __typename?: 'BlueprintsQuery', installations: Array<{ __typename?: 'BlueprintInstallation', blueprintId: string, isDependency: boolean }>, list: { __typename?: 'BlueprintListResponse', totalCount: number, items: Array<{ __typename?: 'Blueprint', name: string, version: string }> } } | null };

export const CockpitBlueprintStatusDocumentDto = gql`
    query cockpitBlueprintStatus($take: Int) {
  blueprints {
    installations {
      blueprintId
      isDependency
    }
    list(skip: 0, take: $take) {
      totalCount
      items {
        name
        version
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CockpitBlueprintStatusDtoGQL extends Apollo.Query<CockpitBlueprintStatusQueryDto, CockpitBlueprintStatusQueryVariablesDto> {
    document = CockpitBlueprintStatusDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }