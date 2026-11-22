import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateSymbolLibraryMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiSymbolLibraryInputUpdateDto | null | undefined> | Types.SystemUiSymbolLibraryInputUpdateDto;
}>;


export type UpdateSymbolLibraryMutationDto = { runtime: { systemUISymbolLibrarys: { update: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, author: string | null, isBuiltIn: boolean | null, isReadOnly: boolean | null, rtChangedDateTime: any } | null> | null } | null } | null };

export const UpdateSymbolLibraryDocumentDto = gql`
    mutation updateSymbolLibrary($entities: [SystemUISymbolLibraryInputUpdate]!) {
  runtime {
    systemUISymbolLibrarys {
      update(entities: $entities) {
        rtId
        ckTypeId
        name
        description
        version
        author
        isBuiltIn
        isReadOnly
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateSymbolLibraryDtoGQL extends Apollo.Mutation<UpdateSymbolLibraryMutationDto, UpdateSymbolLibraryMutationVariablesDto> {
    document = UpdateSymbolLibraryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }