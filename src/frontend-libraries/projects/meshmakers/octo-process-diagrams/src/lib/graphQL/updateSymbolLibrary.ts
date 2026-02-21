import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateSymbolLibraryMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiSymbolLibraryInputUpdateDto>> | Types.InputMaybe<Types.SystemUiSymbolLibraryInputUpdateDto>;
}>;


export type UpdateSymbolLibraryMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUISymbolLibrarys?: { __typename?: 'SystemUISymbolLibraryMutations', update?: Array<{ __typename?: 'SystemUISymbolLibrary', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, author?: string | null, isBuiltIn?: boolean | null, isReadOnly?: boolean | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

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