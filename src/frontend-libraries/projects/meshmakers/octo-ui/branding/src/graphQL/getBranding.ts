import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetBrandingQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type GetBrandingQueryDto = { runtime: { systemUIBranding: { totalCount: number | null, items: Array<{ rtId: any, rtWellKnownName: string | null, appName: string | null, appTitle: string | null, headerLogo: Array<any> | null, footerLogo: Array<any> | null, favicon: Array<any> | null, lightTheme: { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null, neutralColor: string | null, backgroundColor: string | null, headerGradient: { startColor: string, endColor: string } | null, footerGradient: { startColor: string, endColor: string } | null } | null, darkTheme: { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null, neutralColor: string | null, backgroundColor: string | null, headerGradient: { startColor: string, endColor: string } | null, footerGradient: { startColor: string, endColor: string } | null } | null } | null> | null } | null } | null };

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