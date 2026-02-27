import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkModelsQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
  ckId?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type GetCkModelsQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', models?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkModel', modelState?: Types.ModelStateDto | null, id: { __typename?: 'CkModelId', name: string, version: any, fullName: string, semanticVersionedFullName: string }, dependencies: Array<{ __typename?: 'CkModelId', fullName: string }> } | null> | null } | null } | null };

export const GetCkModelsDocumentDto = gql`
    query getCkModels($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort], $ckId: String) {
  constructionKit {
    models(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
      ckId: $ckId
    ) {
      totalCount
      items {
        id {
          name
          version
          fullName
          semanticVersionedFullName
        }
        modelState
        dependencies {
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
  export class GetCkModelsDtoGQL extends Apollo.Query<GetCkModelsQueryDto, GetCkModelsQueryVariablesDto> {
    document = GetCkModelsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }