import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateSymbolLibraryMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiSymbolLibraryInputDto>> | Types.InputMaybe<Types.SystemUiSymbolLibraryInputDto>;
}>;


export type CreateSymbolLibraryMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUISymbolLibrarys?: { __typename?: 'SystemUISymbolLibraryMutations', create?: Array<{ __typename?: 'SystemUISymbolLibrary', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, author?: string | null, isBuiltIn?: boolean | null, isReadOnly?: boolean | null, rtCreationDateTime?: any | null } | null> | null } | null } | null };

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