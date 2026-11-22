import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSdkCustomersQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  rtIds?: Array<any> | any | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetSdkCustomersQueryDto = { runtime: { octoSdkDemoCustomer: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtDisplayName: string, rtDisplayDescription: string | null, rtCreationDateTime: any, rtChangedDateTime: any, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { legalEntityType: Types.BasicLegalEntityTypeDto | null, firstName: string | null, lastName: string | null, companyName: string | null, address: { street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

export const GetSdkCustomersDocumentDto = gql`
    query getSdkCustomers($after: String, $first: Int, $rtIds: [OctoObjectId], $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    octoSdkDemoCustomer(
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
        rtDisplayName
        rtDisplayDescription
        rtCreationDateTime
        rtChangedDateTime
        customerStatus
        contact {
          legalEntityType
          firstName
          lastName
          companyName
          address {
            street
            zipcode
            cityTown
            nationalCode
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSdkCustomersDtoGQL extends Apollo.Query<GetSdkCustomersQueryDto, GetSdkCustomersQueryVariablesDto> {
    document = GetSdkCustomersDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }