import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSdkMeteringPointQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  rtIds?: Array<any> | any | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetSdkMeteringPointQueryDto = { runtime: { octoSdkDemoMeteringPoint: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, name: string, meteringPointNumber: string, networkOperator: Types.OctoSdkDemoNetworkOperatorDto | null, operatingStatus: Types.OctoSdkDemoOperatingStatusDto } | null> | null } | null } | null };

export const GetSdkMeteringPointDocumentDto = gql`
    query getSdkMeteringPoint($after: String, $first: Int, $rtIds: [OctoObjectId], $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    octoSdkDemoMeteringPoint(
      after: $after
      first: $first
      rtIds: $rtIds
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
    ) {
      totalCount
      items {
        rtId
        ckTypeId
        name
        meteringPointNumber
        networkOperator
        operatingStatus
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSdkMeteringPointDtoGQL extends Apollo.Query<GetSdkMeteringPointQueryDto, GetSdkMeteringPointQueryVariablesDto> {
    document = GetSdkMeteringPointDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }