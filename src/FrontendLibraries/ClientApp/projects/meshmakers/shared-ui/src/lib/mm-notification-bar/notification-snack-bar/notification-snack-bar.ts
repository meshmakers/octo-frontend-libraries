import {Component, Inject, inject} from '@angular/core';
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
  protected readonly snackBarRef = inject(MatSnackBarRef);
  private readonly dialog = inject(MatDialog);

  constructor(@Inject(MAT_SNACK_BAR_DATA) public readonly errorMessage: ErrorMessage) {

  }

  onShowDetails(): void {
    this.dialog.open(MmMessageDetailsComponent, {
      data: {
        errorMessage: this.errorMessage
      }
    });
  }
}
