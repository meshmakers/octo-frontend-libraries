import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationService } from './services/configuration.service';
import { AuthorizeService, SharedAuthModule } from '@meshmakers/shared-auth';
import { defaultAuthorizeOptions } from './config/defaultAuthorizeOptions';
import { MmSharedUiModule } from "@meshmakers/shared-ui-legacy";
import { MmOctoUiModule } from "@meshmakers/octo-ui-legacy";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from "@angular/common";
import { SharedServicesModule } from "@meshmakers/shared-services";
import { MatCard, MatCardModule } from "@angular/material/card";
import { FormsModule } from "@angular/forms";
import { MatIcon, MatIconModule } from "@angular/material/icon";
import { HomeComponent } from './home/home.component';
import { ErrorDemoComponent } from './error-demo/error-demo.component';
import { TableDemoComponent } from './table-demo/table-demo.component';
import { FileUploadDemoComponent } from './file-upload-demo/file-upload-demo.component';
import { NfcDemoComponent } from './nfc-demo/nfc-demo.component';
import { QrDemoComponent } from './qr-demo/qr-demo.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';

export function initServices(configurationService: ConfigurationService, authorizeService: AuthorizeService) {
  return async () => {};
}

@NgModule({
  declarations: [AppComponent, HomeComponent, ErrorDemoComponent, TableDemoComponent, FileUploadDemoComponent, NfcDemoComponent, QrDemoComponent],
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
    MatCardModule,
    FormsModule,
    MatIcon,
    MatIconModule,
    MatDialogModule,
    MatCheckboxModule
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
