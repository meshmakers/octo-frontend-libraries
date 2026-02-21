import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypesQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
  ckModelIds?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['String']['input']>> | Types.InputMaybe<Types.Scalars['String']['input']>>;
}>;


export type GetCkTypesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, description?: string | null, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, ckTypeId: { __typename?: 'CkTypeId', fullName: string } } | null, ckTypeId: { __typename?: 'CkTypeId', fullName: string } } | null> | null } | null } | null };

export const GetCkTypesDocumentDto = gql`
    query getCkTypes($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort], $ckModelIds: [String]) {
  constructionKit {
    types(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
      ckModelIds: $ckModelIds
    ) {
      totalCount
      items {
        baseType {
          ckTypeId {
            fullName
          }
          rtCkTypeId
          isAbstract
          isFinal
        }
        ckTypeId {
          fullName
        }
        rtCkTypeId
        isAbstract
        isFinal
        description
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypesDtoGQL extends Apollo.Query<GetCkTypesQueryDto, GetCkTypesQueryVariablesDto> {
    document = GetCkTypesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }