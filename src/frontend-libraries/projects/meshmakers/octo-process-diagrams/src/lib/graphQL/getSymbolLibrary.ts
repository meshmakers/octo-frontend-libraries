import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSymbolLibraryQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type GetSymbolLibraryQueryDto = { runtime: { systemUISymbolLibrary: { items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, author: string | null, isBuiltIn: boolean | null, isReadOnly: boolean | null, rtCreationDateTime: any, rtChangedDateTime: any, children: { items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, primitives: string, symbolInstances: string | null, boundsWidth: number, boundsHeight: number, connectionPoints: string | null, parameters: string | null, category: string | null, tags: string | null, previewImage: string | null, gridSize: number | null, canvasSizeWidth: number | null, canvasSizeHeight: number | null } | null> | null } | null } | null> | null } | null } | null };

export const GetSymbolLibraryDocumentDto = gql`
    query getSymbolLibrary($rtId: OctoObjectId!) {
  runtime {
    systemUISymbolLibrary(rtIds: [$rtId]) {
      items {
        rtId
        ckTypeId
        name
        description
        version
        author
        isBuiltIn
        isReadOnly
        rtCreationDateTime
        rtChangedDateTime
        children(ckTypeIds: ["System.UI/SymbolDefinition"]) {
          items {
            ... on SystemUISymbolDefinition {
              rtId
              ckTypeId
              name
              description
              version
              primitives
              symbolInstances
              boundsWidth
              boundsHeight
              connectionPoints
              parameters
              category
              tags
              previewImage
              gridSize
              canvasSizeWidth
              canvasSizeHeight
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
  export class GetSymbolLibraryDtoGQL extends Apollo.Query<GetSymbolLibraryQueryDto, GetSymbolLibraryQueryVariablesDto> {
    document = GetSymbolLibraryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }