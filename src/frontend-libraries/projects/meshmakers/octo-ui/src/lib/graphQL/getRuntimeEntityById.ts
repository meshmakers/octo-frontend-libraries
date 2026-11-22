import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetRuntimeEntityByIdQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  attributeNames: Array<string> | string;
}>;


export type GetRuntimeEntityByIdQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, rtCreationDateTime: any, rtChangedDateTime: any, attributes: { items: Array<{ attributeName: string | null, value: any, secretIsSet: boolean | null, secretKeyMissing: boolean | null, secretSetAt: any } | null> | null } | null, associations: { definitions: { totalCount: number | null } | null } | null } | null> | null } | null } | null };

export const GetRuntimeEntityByIdDocumentDto = gql`
    query getRuntimeEntityById($rtId: OctoObjectId!, $ckTypeId: String!, $attributeNames: [String!]!) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId) {
      items {
        rtId
        rtDisplayName
        rtDisplayDescription
        ckTypeId
        rtWellKnownName
        rtCreationDateTime
        rtChangedDateTime
        attributes(attributeNames: $attributeNames, resolveEnumValuesToNames: true) {
          items {
            attributeName
            value
            secretIsSet
            secretKeyMissing
            secretSetAt
          }
        }
        associations {
          definitions(direction: ANY, first: 0) {
            totalCount
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
  export class GetRuntimeEntityByIdDtoGQL extends Apollo.Query<GetRuntimeEntityByIdQueryDto, GetRuntimeEntityByIdQueryVariablesDto> {
    document = GetRuntimeEntityByIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }