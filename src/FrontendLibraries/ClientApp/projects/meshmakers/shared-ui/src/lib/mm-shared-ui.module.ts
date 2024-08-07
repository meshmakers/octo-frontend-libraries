import { ModuleWithProviders, NgModule } from "@angular/core";
import { CommonModule } from '@angular/common';
import { MmNotificationBarComponent } from './mm-notification-bar/mm-notification-bar.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MmMessageDetailsComponent } from './mm-message-details/mm-message-details.component';
import { MmAutocompleteInputComponent } from './mm-autocomplete-input/mm-autocomplete-input.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule } from '@angular/forms';
import { MmEntitySelectInputComponent } from './mm-entity-select-input/mm-entity-select-input.component';
import { MmMultipleEntitySelectInputComponent } from './mm-multiple-entity-select-input/mm-multiple-entity-select-input.component';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon, MatIconModule } from "@angular/material/icon";
import {MmBreadcrumbComponent} from "./mm-breadcrumb/mm-breadcrumb.component";
import {MmConfirmationWindowComponent} from "./mm-confirmation-window/mm-confirmation-window.component";
import {MmProgressWindowComponent} from "./mm-progress-window/mm-progress-window.component";
import { ConfirmationService } from "./services/confirmation.service";
import { ProgressNotifierService } from "./services/progress-notifier.service";
import { FileUploadService } from "./services/file-upload.service";
import { MmFileUploadComponent } from "./mm-file-upload/mm-file-upload.component";

@NgModule({
  declarations: [
    MmBreadcrumbComponent,
    MmConfirmationWindowComponent,
    MmProgressWindowComponent,
    MmNotificationBarComponent,
    MmMessageDetailsComponent,
    MmAutocompleteInputComponent,
    MmEntitySelectInputComponent,
    MmMultipleEntitySelectInputComponent,
    MmFileUploadComponent
  ],
  exports: [
    MmBreadcrumbComponent,
    MmConfirmationWindowComponent,
    MmNotificationBarComponent,
    MmAutocompleteInputComponent,
    MmEntitySelectInputComponent,
    MmMultipleEntitySelectInputComponent,
    MmFileUploadComponent
  ],
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatAutocompleteModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule,
    ReactiveFormsModule,
    MatIcon,
    MatIcon
  ]
})
export class MmSharedUiModule {
  static forRoot(): ModuleWithProviders<MmSharedUiModule> {
    return {
      ngModule: MmSharedUiModule,
      providers: [
        FileUploadService,
        ConfirmationService,
        ProgressNotifierService
      ]
    };
  }
}
