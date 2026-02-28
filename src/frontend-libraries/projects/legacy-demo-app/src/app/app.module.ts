import { APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationService } from './services/configuration.service';
import { MmSharedUiModule } from "@meshmakers/shared-ui-legacy";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { HomeComponent } from './home/home.component';
import { ErrorDemoComponent } from './error-demo/error-demo.component';
import { TableDemoComponent } from './table-demo/table-demo.component';
import { FileUploadDemoComponent } from './file-upload-demo/file-upload-demo.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideHttpClient } from '@angular/common/http';
import { provideOctoServices } from '@meshmakers/octo-services';

export function initServices(_configurationService: ConfigurationService) {
  return () => Promise.resolve();
}

@NgModule({
  declarations: [AppComponent, HomeComponent, ErrorDemoComponent, TableDemoComponent, FileUploadDemoComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MmSharedUiModule.forRoot(),
    MatButtonModule,
    CommonModule,
    MatCardModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    MatCheckboxModule
  ],
  providers: [
    ConfigurationService,
    provideHttpClient(),
    provideOctoServices(),
    {
      provide: APP_INITIALIZER,
      useFactory: initServices,
      deps: [ConfigurationService],
      multi: true
    }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule {}
