import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationService } from './services/configuration.service';
import { AuthorizeService, SharedAuthModule } from '@meshmakers/shared-auth';
import { defaultAuthorizeOptions } from './config/defaultAuthorizeOptions';

export function initServices(
  configurationService: ConfigurationService,
  authorizeService: AuthorizeService
) {
  return async () => {};
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SharedAuthModule.forRoot(defaultAuthorizeOptions),
  ],
  providers: [
    ConfigurationService,
    {
      provide: APP_INITIALIZER,
      useFactory: initServices,
      deps: [ConfigurationService, AuthorizeService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
