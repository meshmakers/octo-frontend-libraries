import {ModuleWithProviders, NgModule} from '@angular/core';
import {CommonModule} from "@angular/common";
import {HttpClientModule} from "@angular/common/http";
import {LoginMenuComponent} from "./login-menu/login-menu.component";
import {AuthorizeOptions, AuthorizeService} from "./authorize.service";
import {OAuthModule} from "angular-oauth2-oidc";
import {AuthorizeGuard} from "./authorize.guard";

@NgModule({
  declarations: [LoginMenuComponent],
  exports: [LoginMenuComponent],
  providers: [],
  imports: [
    CommonModule,
    HttpClientModule,
    OAuthModule.forRoot()
  ]
})
export class SharedAuthModule {
  static forRoot(authorizeOptions: AuthorizeOptions): ModuleWithProviders<SharedAuthModule> {
    return {
      ngModule: SharedAuthModule,
      providers: [
        {
          provide: AuthorizeOptions,
          useValue: authorizeOptions
        },
        AuthorizeService,
        AuthorizeGuard
      ]
    }
  }
}
