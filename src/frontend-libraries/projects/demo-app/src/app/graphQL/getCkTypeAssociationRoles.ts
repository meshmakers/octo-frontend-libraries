import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypeAssociationRolesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
}>;


export type GetCkTypeAssociationRolesQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, associations?: { __typename?: 'CkTypeAssociationDirection', in?: { __typename?: 'CkTypeAssociationSource', all?: Array<{ __typename?: 'CkTypeAssociation', navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, roleId: { __typename?: 'CkAssociationRoleId', fullName: string, semanticVersionedFullName: string }, targetCkTypeId: { __typename?: 'CkTypeId', fullName: string } } | null> | null } | null, out?: { __typename?: 'CkTypeAssociationSource', all?: Array<{ __typename?: 'CkTypeAssociation', navigationPropertyName: string, multiplicity: Types.MultiplicitiesDto, roleId: { __typename?: 'CkAssociationRoleId', fullName: string, semanticVersionedFullName: string }, targetCkTypeId: { __typename?: 'CkTypeId', fullName: string } } | null> | null } | null } | null } | null> | null } | null } | null };

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
              navigationPropertyName
              multiplicity
              targetCkTypeId {
                fullName
              }
            }
          }
          out {
            all {
              roleId {
                fullName
                semanticVersionedFullName
              }
              navigationPropertyName
              multiplicity
              targetCkTypeId {
                fullName
              }
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