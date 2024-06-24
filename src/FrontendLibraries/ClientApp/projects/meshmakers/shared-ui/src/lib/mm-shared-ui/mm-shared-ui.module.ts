import { NgModule } from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    MmNotificationBarComponent,
    MmMessageDetailsComponent,
    MmAutocompleteInputComponent,
    MmEntitySelectInputComponent,
    MmMultipleEntitySelectInputComponent
  ],
  exports: [MmNotificationBarComponent, MmAutocompleteInputComponent, MmEntitySelectInputComponent, MmMultipleEntitySelectInputComponent],
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
    ReactiveFormsModule
  ]
})
export class MmSharedUiModule {}
