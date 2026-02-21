import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSymbolDefinitionQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetSymbolDefinitionQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUISymbolDefinition?: { __typename?: 'SystemUISymbolDefinitionConnection', items?: Array<{ __typename?: 'SystemUISymbolDefinition', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, primitives: string, symbolInstances?: string | null, boundsWidth: number, boundsHeight: number, connectionPoints?: string | null, parameters?: string | null, category?: string | null, tags?: string | null, previewImage?: string | null, gridSize?: number | null, canvasSizeWidth?: number | null, canvasSizeHeight?: number | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const GetSymbolDefinitionDocumentDto = gql`
    query getSymbolDefinition($rtId: OctoObjectId!) {
  runtime {
    systemUISymbolDefinition(rtIds: [$rtId]) {
      items {
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
        rtCreationDateTime
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSymbolDefinitionDtoGQL extends Apollo.Query<GetSymbolDefinitionQueryDto, GetSymbolDefinitionQueryVariablesDto> {
    document = GetSymbolDefinitionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }