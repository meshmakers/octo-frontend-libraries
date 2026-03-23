import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetBinaryInfoQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetBinaryInfoQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemReportingFileSystemItem?: { __typename?: 'SystemReportingFileSystemItemConnection', items?: Array<{ __typename?: 'SystemReportingFileSystemItem', rtId: any, ckTypeId: any, name: string, content: { __typename?: 'LargeBinaryInfo', binaryId: any, size: any, contentType: string, filename: string, downloadUri: any } } | null> | null } | null } | null };

export const GetBinaryInfoDocumentDto = gql`
    query getBinaryInfo($rtId: OctoObjectId!) {
  runtime {
    systemReportingFileSystemItem(rtId: $rtId) {
      items {
        rtId
        ckTypeId
        name
        content {
          binaryId
          size
          contentType
          filename
          downloadUri
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetBinaryInfoDtoGQL extends Apollo.Query<GetBinaryInfoQueryDto, GetBinaryInfoQueryVariablesDto> {
    document = GetBinaryInfoDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }