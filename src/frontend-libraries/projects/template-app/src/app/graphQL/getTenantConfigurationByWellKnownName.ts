import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetTenantConfigurationByWellKnownNameQueryVariablesDto = Types.Exact<{
  wellKnownName?: Types.InputMaybe<Types.Scalars['SimpleScalar']['input']>;
}>;


export type GetTenantConfigurationByWellKnownNameQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemTenantConfiguration?: { __typename?: 'SystemTenantConfigurationConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemTenantConfiguration', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, configurationValue?: string | null } | null> | null } | null } | null };

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