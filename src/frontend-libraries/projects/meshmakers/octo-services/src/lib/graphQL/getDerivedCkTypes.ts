import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetDerivedCkTypesQueryVariablesDto = Exact<{
  rtCkTypeId: string;
  ignoreAbstractTypes?: boolean | null | undefined;
  includeSelf?: boolean | null | undefined;
}>;


export type GetDerivedCkTypesQueryDto = { constructionKit: { types: { items: Array<{ directAndIndirectDerivedTypes: { totalCount: number | null, items: Array<{ rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, description: string | null, baseType: { rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, ckTypeId: { fullName: string } } | null, ckTypeId: { fullName: string } } | null> | null } | null } | null> | null } | null } | null };

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