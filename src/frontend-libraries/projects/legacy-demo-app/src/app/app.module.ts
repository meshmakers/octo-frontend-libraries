import { APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA, inject, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationService } from './services/configuration.service';
import { MmSharedUiModule, ProgressWindowService } from "@meshmakers/shared-ui-legacy";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { HomeComponent } from './home/home.component';
import { ErrorDemoComponent } from './error-demo/error-demo.component';
import { TableDemoComponent } from './table-demo/table-demo.component';
import { FileUploadDemoComponent } from './file-upload-demo/file-upload-demo.component';
import { ConfirmationDemoComponent } from './confirmation-demo/confirmation-demo.component';
import { ProgressDemoComponent } from './progress-demo/progress-demo.component';
import { DetailsDemoComponent } from './details-demo/details-demo.component';
import { EntitySelectDemoComponent } from './entity-select-demo/entity-select-demo.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CONFIGURATION_SERVICE, OctoErrorLink, provideOctoServices } from '@meshmakers/octo-services';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MmBreadcrumbComponent, MmNotificationBarComponent, MmEntitySelectInputComponent, MmOctoTableComponent } from '@meshmakers/octo-ui-legacy';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { ApolloClient } from '@apollo/client';
import { AuthorizeService, authorizeInterceptor, provideMmSharedAuth, AuthorizeOptions } from '@meshmakers/shared-auth';

const TENANT_ID = 'meshtest';

export function initServices(configurationService: ConfigurationService, authorizeService: AuthorizeService) {
  return async () => {
    await configurationService.loadConfigAsync();

    const authOptions: AuthorizeOptions = {
      issuer: configurationService.config.issuer,
      clientId: configurationService.config.clientId,
      redirectUri: configurationService.config.redirectUri || window.location.origin + '/',
      postLogoutRedirectUri: configurationService.config.postLogoutRedirectUri || window.location.origin + '/',
      scope: 'openid profile email role offline_access octo_api',
      showDebugInformation: true,
      sessionChecksEnabled: false,
      wellKnownServiceUris: ['/'],
    };

    await authorizeService.initialize(authOptions);
  };
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    ErrorDemoComponent,
    TableDemoComponent,
    FileUploadDemoComponent,
    ConfirmationDemoComponent,
    ProgressDemoComponent,
    DetailsDemoComponent,
    EntitySelectDemoComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MmSharedUiModule.forRoot(),
    MatButtonModule,
    CommonModule,
    MatCardModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    MatCheckboxModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MmBreadcrumbComponent,
    MmNotificationBarComponent,
    MmEntitySelectInputComponent,
    MmOctoTableComponent,
  ],
  providers: [
    ConfigurationService,
    ProgressWindowService,
    { provide: CONFIGURATION_SERVICE, useExisting: ConfigurationService },
    provideHttpClient(withInterceptors([authorizeInterceptor])),
    provideOctoServices(),
    provideMmSharedAuth(),
    provideApollo((): ApolloClient.Options => {
      const httpLink = inject(HttpLink);
      const octoErrorLink = inject(OctoErrorLink);
      const configurationService = inject(CONFIGURATION_SERVICE);

      const apolloClientLink = ApolloLink.from([
        octoErrorLink,
        httpLink.create({
          uri: () => `${configurationService.config.assetServices ?? ''}tenants/${TENANT_ID}/GraphQL`,
        })
      ]);

      return {
        link: apolloClientLink,
        cache: new InMemoryCache(),
      };
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initServices,
      deps: [ConfigurationService, AuthorizeService],
      multi: true
    }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule {}
