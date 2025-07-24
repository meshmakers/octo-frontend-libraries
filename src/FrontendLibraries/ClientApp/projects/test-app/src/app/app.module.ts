import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationService } from './services/configuration.service';
import { AuthorizeService, SharedAuthModule } from '@meshmakers/shared-auth';
import { defaultAuthorizeOptions } from './config/defaultAuthorizeOptions';
import { MmSharedUiModule } from "@meshmakers/shared-ui";
import { MmOctoUiModule } from "@meshmakers/octo-ui";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from "@angular/common";
import { SharedServicesModule } from "@meshmakers/shared-services";
import { MatCard } from "@angular/material/card";
import { FormsModule } from "@angular/forms";
import { MatIcon } from "@angular/material/icon";

export function initServices(configurationService: ConfigurationService, authorizeService: AuthorizeService) {
  return async () => {};
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MmSharedUiModule.forRoot(),
    SharedAuthModule.forRoot(defaultAuthorizeOptions),
    MmOctoUiModule,
    MatButtonModule,
    CommonModule,
    SharedServicesModule.forRoot(),
    MatCard,
    FormsModule,
    MatIcon
  ],
  providers: [
    ConfigurationService,
    {
      provide: APP_INITIALIZER,
      useFactory: initServices,
      deps: [ConfigurationService, AuthorizeService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
