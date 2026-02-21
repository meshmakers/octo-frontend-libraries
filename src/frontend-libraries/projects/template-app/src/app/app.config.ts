import {inject, ApplicationConfig, provideAppInitializer, provideZoneChangeDetection, LOCALE_ID, importProvidersFrom} from '@angular/core';
import {provideAnimations} from '@angular/platform-browser/animations';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  withJsonpSupport
} from '@angular/common/http';
import {authorizeInterceptor, AuthorizeService} from '@meshmakers/shared-auth';
import {defaultAuthorizeOptions} from './config/defaultAuthorizeOptions';
import {defaultOctoServiceOptions} from './config/defaultOctoServiceOptions';
import {AppConfigurationService} from './services/configuration.service';
import {CONFIGURATION_SERVICE} from '@meshmakers/octo-services';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {CommandService, CommandSettingsService, MmHttpErrorInterceptor} from '@meshmakers/shared-services';
import {provideApollo} from 'apollo-angular';
import {ApolloLink, InMemoryCache} from "@apollo/client/core";
import {MyCommandSettingsService} from './services/my-command-settings.service';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import {provideOctoUi} from '@meshmakers/octo-ui';
import { MessageListenerService } from '@meshmakers/shared-ui';
import {ApolloClient} from '@apollo/client';
import {HttpLink} from 'apollo-angular/http';
import {OctoErrorLink, TENANT_ID_PROVIDER} from '@meshmakers/octo-services';
import {provideMeshBoard, provideProcessWidget} from '@meshmakers/octo-meshboard';
import {provideMarkdown} from 'ngx-markdown';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GaugesModule} from '@progress/kendo-angular-gauges';

// Direct ES imports ensure Kendo CLDR locale data is registered before localeData('de') is called below.
import '@progress/kendo-angular-intl/locales/de/all';
import '@progress/kendo-angular-intl/locales/en/all';
// Re-register under "de-DE" so CldrIntlService finds it when LOCALE_ID is "de-DE"
import { localeData, setData } from '@progress/kendo-angular-intl';

registerLocaleData(localeDe, 'de-DE');

const deData = localeData('de');
setData({...deData, name: 'de-DE'});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideAnimations(),
    provideRouter(routes),
    provideOctoUi(),
    provideMeshBoard(),
    provideProcessWidget(),
    provideMarkdown(),
    {
      provide: TENANT_ID_PROVIDER,
      useFactory: () => {
        const route = inject(ActivatedRoute);
        const configService = inject(CONFIGURATION_SERVICE);
        return async (): Promise<string | null> => {
          if (route.firstChild) {
            const params = await firstValueFrom(route.firstChild.params);
            const tenantId = params['tenantId'] as string;
            if (tenantId) {
              return tenantId;
            }
          }
          return configService.config?.systemTenantId ?? null;
        };
      }
    },
    importProvidersFrom(GaugesModule),
    provideHttpClient(withJsonpSupport(), withInterceptors([authorizeInterceptor]), withInterceptorsFromDi()),
    // Provide the app-specific ConfigurationService implementation
    { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService },
    provideAppInitializer(initServices),
    provideApollo(() : ApolloClient.Options => {
      const tenantId = "octosystem";
      const httpLink = inject(HttpLink);
      const octoErrorLink = inject(OctoErrorLink);
      const configurationService = inject(CONFIGURATION_SERVICE);

      const apolloClientLink = ApolloLink.from([
        octoErrorLink,
        httpLink.create({
          uri: () => `${configurationService.config.assetServices ?? ''}tenants/${tenantId}/GraphQL`,
        })
      ]);

      return {
        // We create a minimal Apollo client here, the actual client will be created in the TenantComponent
        link: apolloClientLink,
        cache: new InMemoryCache(),
      };
    }),
    {provide: HTTP_INTERCEPTORS, useClass: MmHttpErrorInterceptor, multi: true},
    {provide: LOCALE_ID, useValue: "de-DE"},
    {provide: CommandSettingsService, useClass: MyCommandSettingsService}
  ]
};

export async function initServices(): Promise<void> {
  const configurationService = inject(CONFIGURATION_SERVICE);
  const authorizeService = inject(AuthorizeService);
  const commandService = inject(CommandService);
  const messageListener = inject(MessageListenerService);

  await configurationService.loadConfigAsync();

  defaultAuthorizeOptions.wellKnownServiceUris = [
    configurationService.config.assetServices,
    configurationService.config.botServices,
    configurationService.config.issuer,
  ];

  defaultOctoServiceOptions.assetServices = configurationService.config.assetServices;
  defaultAuthorizeOptions.issuer = configurationService.config.issuer;
  defaultAuthorizeOptions.clientId = configurationService.config.clientId;
  defaultAuthorizeOptions.showDebugInformation = true;

  await authorizeService.initialize(defaultAuthorizeOptions);
  await commandService.initialize();

  // Initialize the message listener to start displaying messages as notifications
  messageListener.initialize();
}
