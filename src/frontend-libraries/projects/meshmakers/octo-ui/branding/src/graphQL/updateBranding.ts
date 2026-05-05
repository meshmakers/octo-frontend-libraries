import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateBrandingMutationVariablesDto = Types.Exact<{
  branding: Types.SystemUiBrandingInputUpdateDto;
}>;


export type UpdateBrandingMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIBrandings?: { __typename?: 'SystemUIBrandingMutations', update?: Array<{ __typename?: 'SystemUIBranding', rtId: any, rtWellKnownName?: string | null, appName?: string | null, appTitle?: string | null, headerLogo?: Array<any | null> | null, footerLogo?: Array<any | null> | null, favicon?: Array<any | null> | null, lightTheme?: { __typename?: 'SystemUIThemePalette', primaryColor?: string | null, secondaryColor?: string | null, tertiaryColor?: string | null, neutralColor?: string | null, backgroundColor?: string | null, headerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null, footerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null } | null, darkTheme?: { __typename?: 'SystemUIThemePalette', primaryColor?: string | null, secondaryColor?: string | null, tertiaryColor?: string | null, neutralColor?: string | null, backgroundColor?: string | null, headerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null, footerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null } | null } | null> | null } | null } | null };

export const UpdateBrandingDocumentDto = gql`
    mutation updateBranding($branding: SystemUIBrandingInputUpdate!) {
  runtime {
    systemUIBrandings {
      update(entities: [$branding]) {
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
  export class UpdateBrandingDtoGQL extends Apollo.Mutation<UpdateBrandingMutationDto, UpdateBrandingMutationVariablesDto> {
    document = UpdateBrandingDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }