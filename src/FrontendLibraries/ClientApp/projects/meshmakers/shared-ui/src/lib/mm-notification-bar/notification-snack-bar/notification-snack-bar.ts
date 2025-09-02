import { Component, inject } from '@angular/core';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarRef
} from "@angular/material/snack-bar";
import {MatButton} from "@angular/material/button";
import {ErrorMessage} from "@meshmakers/shared-services";
import {MatDialog} from "@angular/material/dialog";
import {MmMessageDetailsComponent} from "../../mm-message-details/mm-message-details.component";
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'mm-notification-snack-bar',
  imports: [
    MatSnackBarActions,
    MatButton,
    MatSnackBarAction,
    MatIcon
  ],
  templateUrl: './notification-snack-bar.html',
  styleUrl: './notification-snack-bar.scss'
})
export class NotificationSnackBar {
  readonly errorMessage = inject<ErrorMessage>(MAT_SNACK_BAR_DATA);

  protected readonly snackBarRef = inject(MatSnackBarRef);
  private readonly dialog = inject(MatDialog);

  onShowDetails(): void {
    this.dialog.open(MmMessageDetailsComponent, {
      data: {
        errorMessage: this.errorMessage
      },
      width: '50vw',
      maxWidth: '90vw',
      maxHeight: '80vh'
    });
  }
}
