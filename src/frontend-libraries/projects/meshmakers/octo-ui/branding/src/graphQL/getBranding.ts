import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetBrandingQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type GetBrandingQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUIBranding?: { __typename?: 'SystemUIBrandingConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemUIBranding', rtId: any, rtWellKnownName?: string | null, appName?: string | null, appTitle?: string | null, headerLogo?: Array<any | null> | null, footerLogo?: Array<any | null> | null, favicon?: Array<any | null> | null, lightTheme?: { __typename?: 'SystemUIThemePalette', primaryColor?: string | null, secondaryColor?: string | null, tertiaryColor?: string | null, neutralColor?: string | null, backgroundColor?: string | null, headerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null, footerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null } | null, darkTheme?: { __typename?: 'SystemUIThemePalette', primaryColor?: string | null, secondaryColor?: string | null, tertiaryColor?: string | null, neutralColor?: string | null, backgroundColor?: string | null, headerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null, footerGradient?: { __typename?: 'SystemUIThemeGradient', startColor: string, endColor: string } | null } | null } | null> | null } | null } | null };

export const GetBrandingDocumentDto = gql`
    query getBranding {
  runtime {
    systemUIBranding(
      first: 1
      fieldFilter: [{attributePath: "rtWellKnownName", operator: EQUALS, comparisonValue: "Branding"}]
    ) {
      totalCount
      items {
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
  export class GetBrandingDtoGQL extends Apollo.Query<GetBrandingQueryDto, GetBrandingQueryVariablesDto> {
    document = GetBrandingDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }