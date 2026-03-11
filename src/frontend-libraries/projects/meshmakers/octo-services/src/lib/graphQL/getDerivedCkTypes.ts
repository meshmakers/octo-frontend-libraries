import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetDerivedCkTypesQueryVariablesDto = Types.Exact<{
  rtCkTypeId: Types.Scalars['String']['input'];
  ignoreAbstractTypes?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  includeSelf?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
}>;


export type GetDerivedCkTypesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', directAndIndirectDerivedTypes?: { __typename?: 'CkTypeDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, description?: string | null, baseType?: { __typename?: 'CkType', rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, ckTypeId: { __typename?: 'CkTypeId', fullName: string } } | null, ckTypeId: { __typename?: 'CkTypeId', fullName: string } } | null> | null } | null } | null> | null } | null } | null };

export const GetDerivedCkTypesDocumentDto = gql`
    query getDerivedCkTypes($rtCkTypeId: String!, $ignoreAbstractTypes: Boolean, $includeSelf: Boolean) {
  constructionKit {
    types(rtCkId: $rtCkTypeId) {
      items {
        directAndIndirectDerivedTypes(
          ignoreAbstractTypes: $ignoreAbstractTypes
          includeSelf: $includeSelf
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
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetDerivedCkTypesDtoGQL extends Apollo.Query<GetDerivedCkTypesQueryDto, GetDerivedCkTypesQueryVariablesDto> {
    document = GetDerivedCkTypesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }