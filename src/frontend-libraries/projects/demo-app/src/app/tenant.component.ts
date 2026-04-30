import { Component, inject } from '@angular/core';
import {ActivatedRoute, RouterOutlet} from '@angular/router';
import { Apollo } from 'apollo-angular';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { CONFIGURATION_SERVICE } from '@meshmakers/octo-services';
import { AuthorizeService } from "@meshmakers/shared-auth";
import { defaultAuthorizeOptions } from "./config/defaultAuthorizeOptions";
import {AppTitleService} from '@meshmakers/shared-services';
import {OctoErrorLink, possibleTypes} from '@meshmakers/octo-services';
import {ApolloLink} from '@apollo/client';

@Component({
  selector: 'app-tenant',
  templateUrl: './tenant.component.html',
  imports: [
    RouterOutlet
  ],
  styleUrl: './tenant.component.scss'
})
export class TenantComponent {

  constructor() {
    const activatedRoute = inject(ActivatedRoute);
    const configurationService = inject(CONFIGURATION_SERVICE);
    const authorizeService = inject(AuthorizeService);
    const httpLink = inject(HttpLink);
    const apollo = inject(Apollo);
    const appTitleService = inject(AppTitleService);
    const octoErrorLink = inject(OctoErrorLink);


    activatedRoute.params.subscribe(async (params) => {
      const tenantId = params['tenantId'];
      console.log(`Used tenant: '${tenantId}'`);
      // document.title is owned by AppTitleService (TitleStrategy from
      // @meshmakers/octo-ui) — it composes ${branding.appTitle} | ${route}.
      // The shared-services AppTitleService still drives the in-app <h1>.
      appTitleService.setTitle(`${tenantId} - OctoMesh Template App`);

      const service = configurationService.config.assetServices ?? '';
      const uri = `${service}tenants/${tenantId}/GraphQL`;

      const apolloClientLink = ApolloLink.from([
        octoErrorLink,
        httpLink.create({
          uri
        })
      ]);

      apollo.removeClient();
      apollo.create({
        cache: new InMemoryCache({
          dataIdFromObject: (o) => (o['rtId'] as string),
          possibleTypes: possibleTypes.possibleTypes,
          typePolicies: {
            ConstructionKitQuery: {
              merge: false,
            },
            RuntimeModelQuery: {
              merge: false,
            }
          }
        }),
        link: apolloClientLink
      });

      defaultAuthorizeOptions.redirectUri = `${configurationService.config.redirectUri}${tenantId}`;
      defaultAuthorizeOptions.postLogoutRedirectUri = `${configurationService.config.postLogoutRedirectUri}${tenantId}`;
      await authorizeService.initialize(defaultAuthorizeOptions);

      // Branding load is driven by the auth-aware effect in AppComponent —
      // see comment there. Triggering load() here would race authorizeService
      // initialize() and hit Apollo before the bearer token is available.
    });
  }
}
