import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MmProgressWindowComponent } from './progress-window/mm-progress-window.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProgressNotifierService } from './services/progress-notifier.service';

@NgModule({
  declarations: [MmProgressWindowComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressBarModule]
})
export class ProgressNotifierModule {
  static forRoot(): ModuleWithProviders<ProgressNotifierModule> {
    return {
      ngModule: ProgressNotifierModule,
      providers: [ProgressNotifierService]
    };
  }
}
