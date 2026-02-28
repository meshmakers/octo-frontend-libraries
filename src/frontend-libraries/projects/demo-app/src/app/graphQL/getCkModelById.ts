import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkModelByIdQueryVariablesDto = Types.Exact<{
  model: Types.Scalars['SimpleScalar']['input'];
}>;


export type GetCkModelByIdQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', models?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkModel', modelState?: Types.ModelStateDto | null, id: { __typename?: 'CkModelId', name: string, version: any, fullName: string, semanticVersionedFullName: string } } | null> | null } | null } | null };

export const GetCkModelByIdDocumentDto = gql`
    query getCkModelById($model: SimpleScalar!) {
  constructionKit {
    models(
      fieldFilter: [{attributePath: "modelState", operator: EQUALS, comparisonValue: "AVAILABLE"}, {attributePath: "modelId", operator: EQUALS, comparisonValue: $model}]
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
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkModelByIdDtoGQL extends Apollo.Query<GetCkModelByIdQueryDto, GetCkModelByIdQueryVariablesDto> {
    document = GetCkModelByIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }