import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypeAssociationRolesQueryVariablesDto = Exact<{
  ckTypeId: string;
}>;


export type GetCkTypeAssociationRolesQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, associations: { in: { all: Array<{ rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any, roleId: { fullName: string, semanticVersionedFullName: string }, targetCkTypeId: { fullName: string } } | null> | null } | null, out: { all: Array<{ rtRoleId: any, navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, rtTargetCkTypeId: any, rtOriginCkTypeId: any, roleId: { fullName: string, semanticVersionedFullName: string }, targetCkTypeId: { fullName: string } } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetCkTypeAssociationRolesDocumentDto = gql`
    query getCkTypeAssociationRoles($ckTypeId: String!) {
  constructionKit {
    types(rtCkId: $ckTypeId, first: 1) {
      items {
        rtCkTypeId
        associations {
          in {
            all {
              roleId {
                fullName
                semanticVersionedFullName
              }
              rtRoleId
              navigationPropertyName
              multiplicity
              targetCkTypeId {
                fullName
              }
              rtTargetCkTypeId
              rtOriginCkTypeId
            }
          }
          out {
            all {
              roleId {
                fullName
                semanticVersionedFullName
              }
              rtRoleId
              navigationPropertyName
              multiplicity
              targetCkTypeId {
                fullName
              }
              rtTargetCkTypeId
              rtOriginCkTypeId
            }
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
  export class GetCkTypeAssociationRolesDtoGQL extends Apollo.Query<GetCkTypeAssociationRolesQueryDto, GetCkTypeAssociationRolesQueryVariablesDto> {
    document = GetCkTypeAssociationRolesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }