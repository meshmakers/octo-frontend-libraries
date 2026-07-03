import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetStreamDataQueryArchiveQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetStreamDataQueryArchiveQueryDto = { __typename?: 'OctoQuery', streamData?: { __typename?: 'StreamDataModelQuery', streamDataQuery?: { __typename?: 'StreamDataQueryDtoConnection', items?: Array<{ __typename?: 'StreamDataQuery', queryRtId: any, associatedCkTypeId: any, archiveRtId: any }> | null } | null } | null };

export const GetStreamDataQueryArchiveDocumentDto = gql`
    query getStreamDataQueryArchive($rtId: OctoObjectId!) {
  streamData {
    streamDataQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        archiveRtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetStreamDataQueryArchiveDtoGQL extends Apollo.Query<GetStreamDataQueryArchiveQueryDto, GetStreamDataQueryArchiveQueryVariablesDto> {
    document = GetStreamDataQueryArchiveDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }