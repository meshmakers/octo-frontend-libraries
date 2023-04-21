import {ModuleWithProviders, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ProgressWindowComponent} from './progress-window/progress-window.component';
import {MatDialogModule} from "@angular/material/dialog";
import {FlexLayoutModule} from "@angular/flex-layout";
import {MatButtonModule} from "@angular/material/button";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {ProgressNotifierService} from "./services/progress-notifier.service";


@NgModule({
  declarations: [ProgressWindowComponent],
  imports: [
    CommonModule,
    MatDialogModule,
    FlexLayoutModule,
    MatButtonModule,
    MatProgressBarModule
  ]
})
export class ProgressNotifierModule {
  static forRoot(): ModuleWithProviders<ProgressNotifierModule> {
    return {
      ngModule: ProgressNotifierModule,
      providers: [
        ProgressNotifierService
      ]
    }
  }
}
