import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetStreamDataQueryArchiveQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type GetStreamDataQueryArchiveQueryDto = { streamData: { streamDataQuery: { items: Array<{ queryRtId: any, associatedCkTypeId: any, archiveRtId: any }> | null } | null } | null, runtime: { systemSimpleSdQuery: { items: Array<{ rtId: any, rtIds: Array<string> | null } | null> | null } | null } | null };

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
  runtime {
    systemSimpleSdQuery(rtId: $rtId) {
      items {
        rtId
        rtIds
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