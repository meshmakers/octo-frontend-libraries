import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';
import * as Apollo from 'apollo-angular';
import { SearchFilterDto, SortDto, FieldFilterDto, InputMaybe } from '@meshmakers/octo-services';

export interface OctoSdkDemoCustomerDto {
  rtId: string;
  ckTypeId: string;
  rtCreationDateTime?: string | null;
  rtChangedDateTime?: string | null;
  customerStatus: string;
  contact: {
    legalEntityType: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    address: {
      street: string;
      zipcode: number;
      cityTown: string;
      nationalCode: string;
    };
  };
}

export interface GetSdkCustomersQueryVariablesDto {
  after?: InputMaybe<string>;
  first?: InputMaybe<number>;
  rtIds?: InputMaybe<InputMaybe<string>[] | InputMaybe<string>>;
  searchFilter?: InputMaybe<SearchFilterDto>;
  fieldFilters?: InputMaybe<InputMaybe<FieldFilterDto>[] | InputMaybe<FieldFilterDto>>;
  sort?: InputMaybe<InputMaybe<SortDto>[] | InputMaybe<SortDto>>;
}

export interface GetSdkCustomersQueryDto {
  runtime?: {
    octoSdkDemoCustomer?: {
      totalCount?: number | null;
      items?: (OctoSdkDemoCustomerDto | null)[] | null;
    } | null;
  } | null;
}

export const GetSdkCustomersDocumentDto = gql`
  query getSdkCustomers(
    $after: String
    $first: Int
    $rtIds: [OctoObjectId]
    $searchFilter: SearchFilter
    $fieldFilters: [FieldFilter]
    $sort: [Sort]
  ) {
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
  override document = GetSdkCustomersDocumentDto;
}
