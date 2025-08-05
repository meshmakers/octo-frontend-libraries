import { Component, OnInit, inject } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import {MatSnackBar} from "@angular/material/snack-bar";
import {NotificationSnackBar} from "./notification-snack-bar/notification-snack-bar";

@Component({
  selector: 'mm-notification-bar',
  standalone: false,
  templateUrl: './mm-notification-bar.component.html',
  styleUrls: ['./mm-notification-bar.component.scss']
})
export class MmNotificationBarComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly messageService = inject(MessageService);

  public errorMessage: ErrorMessage | null;

  constructor() {
    this.errorMessage = null;
  }

  ngOnInit(): void {
    this.messageService.getLatestErrorMessage().subscribe((value) => {
      this.errorMessage = value;
      if (this.errorMessage) {
        this.snackBar.openFromComponent(NotificationSnackBar, {
          data: this.errorMessage,
          horizontalPosition: "center",
          verticalPosition: "top"
        });
      }
    });
  }
}
