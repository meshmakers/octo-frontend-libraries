import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetTenantConfigurationByWellKnownNameQueryVariablesDto = Exact<{
  wellKnownName?: any;
}>;


export type GetTenantConfigurationByWellKnownNameQueryDto = { runtime: { systemTenantConfiguration: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, configurationValue: string | null } | null> | null } | null } | null };

export const GetTenantConfigurationByWellKnownNameDocumentDto = gql`
    query getTenantConfigurationByWellKnownName($wellKnownName: SimpleScalar) {
  runtime {
    systemTenantConfiguration(
      fieldFilter: [{attributePath: "rtWellKnownName", operator: EQUALS, comparisonValue: $wellKnownName}]
    ) {
      totalCount
      items {
        rtId
        ckTypeId
        rtWellKnownName
        configurationValue
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetTenantConfigurationByWellKnownNameDtoGQL extends Apollo.Query<GetTenantConfigurationByWellKnownNameQueryDto, GetTenantConfigurationByWellKnownNameQueryVariablesDto> {
    document = GetTenantConfigurationByWellKnownNameDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }