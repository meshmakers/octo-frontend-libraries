import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateSymbolLibraryMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiSymbolLibraryInputDto | null | undefined> | Types.SystemUiSymbolLibraryInputDto;
}>;


export type CreateSymbolLibraryMutationDto = { runtime: { systemUISymbolLibrarys: { create: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, author: string | null, isBuiltIn: boolean | null, isReadOnly: boolean | null, rtCreationDateTime: any } | null> | null } | null } | null };

export const CreateSymbolLibraryDocumentDto = gql`
    mutation createSymbolLibrary($entities: [SystemUISymbolLibraryInput]!) {
  runtime {
    systemUISymbolLibrarys {
      create(entities: $entities) {
        rtId
        ckTypeId
        name
        description
        version
        author
        isBuiltIn
        isReadOnly
        rtCreationDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateSymbolLibraryDtoGQL extends Apollo.Mutation<CreateSymbolLibraryMutationDto, CreateSymbolLibraryMutationVariablesDto> {
    document = CreateSymbolLibraryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }