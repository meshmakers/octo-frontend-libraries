import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetProcessDiagramQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetProcessDiagramQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUIProcessDiagram?: { __typename?: 'SystemUIProcessDiagramConnection', items?: Array<{ __typename?: 'SystemUIProcessDiagram', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, canvasWidth: number, canvasHeight: number, canvasBackgroundColor?: string | null, elements: string, primitives?: string | null, symbolInstances?: string | null, connections: string, variables?: string | null, transformProperties?: string | null, propertyBindings?: string | null, animations?: string | null, refreshInterval?: number | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const GetProcessDiagramDocumentDto = gql`
    query getProcessDiagram($rtId: OctoObjectId!) {
  runtime {
    systemUIProcessDiagram(rtIds: [$rtId]) {
      items {
        rtId
        ckTypeId
        name
        description
        version
        canvasWidth
        canvasHeight
        canvasBackgroundColor
        elements
        primitives
        symbolInstances
        connections
        variables
        transformProperties
        propertyBindings
        animations
        refreshInterval
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
  export class GetProcessDiagramDtoGQL extends Apollo.Query<GetProcessDiagramQueryDto, GetProcessDiagramQueryVariablesDto> {
    document = GetProcessDiagramDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }