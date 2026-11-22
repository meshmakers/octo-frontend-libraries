import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CockpitBlueprintStatusQueryVariablesDto = Exact<{
  take?: number | null | undefined;
}>;


export type CockpitBlueprintStatusQueryDto = { blueprints: { installations: Array<{ blueprintId: string, isDependency: boolean }>, list: { totalCount: number, items: Array<{ name: string, version: string }> } } | null };

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