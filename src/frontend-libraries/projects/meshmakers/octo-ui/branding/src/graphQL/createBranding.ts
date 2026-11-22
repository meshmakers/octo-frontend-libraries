import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateBrandingMutationVariablesDto = Exact<{
  branding: Types.SystemUiBrandingInputDto;
}>;


export type CreateBrandingMutationDto = { runtime: { systemUIBrandings: { create: Array<{ rtId: any, rtWellKnownName: string | null, appName: string | null, appTitle: string | null, headerLogo: Array<any> | null, footerLogo: Array<any> | null, favicon: Array<any> | null, lightTheme: { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null, neutralColor: string | null, backgroundColor: string | null, headerGradient: { startColor: string, endColor: string } | null, footerGradient: { startColor: string, endColor: string } | null } | null, darkTheme: { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null, neutralColor: string | null, backgroundColor: string | null, headerGradient: { startColor: string, endColor: string } | null, footerGradient: { startColor: string, endColor: string } | null } | null } | null> | null } | null } | null };

export const CreateBrandingDocumentDto = gql`
    mutation createBranding($branding: SystemUIBrandingInput!) {
  runtime {
    systemUIBrandings {
      create(entities: [$branding]) {
        rtId
        rtWellKnownName
        appName
        appTitle
        headerLogo
        footerLogo
        favicon
        lightTheme {
          primaryColor
          secondaryColor
          tertiaryColor
          neutralColor
          backgroundColor
          headerGradient {
            startColor
            endColor
          }
          footerGradient {
            startColor
            endColor
          }
        }
        darkTheme {
          primaryColor
          secondaryColor
          tertiaryColor
          neutralColor
          backgroundColor
          headerGradient {
            startColor
            endColor
          }
          footerGradient {
            startColor
            endColor
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
  export class CreateBrandingDtoGQL extends Apollo.Mutation<CreateBrandingMutationDto, CreateBrandingMutationVariablesDto> {
    document = CreateBrandingDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }