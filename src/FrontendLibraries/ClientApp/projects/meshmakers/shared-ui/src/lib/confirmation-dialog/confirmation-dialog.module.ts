import {ModuleWithProviders, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ConfirmationWindowComponent} from './confirmation-window/confirmation-window.component';
import {ConfirmationService} from "./services/confirmation.service";
import {MatDialogModule} from "@angular/material/dialog";
import {FlexLayoutModule} from "@angular/flex-layout";
import {MatButtonModule} from "@angular/material/button";


@NgModule({
  declarations: [ConfirmationWindowComponent],
  imports: [
    CommonModule,
    MatDialogModule,
    FlexLayoutModule,
    MatButtonModule,
  ]
})
export class ConfirmationDialogModule {
  static forRoot(): ModuleWithProviders<ConfirmationDialogModule> {
    return {
      ngModule: ConfirmationDialogModule,
      providers: [
        ConfirmationService
      ]
    }
  }
}
