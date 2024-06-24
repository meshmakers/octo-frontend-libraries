import { Component, OnInit } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import { MatDialog } from '@angular/material/dialog';
import { MmMessageDetailsComponent } from '../mm-message-details/mm-message-details.component';

@Component({
  selector: 'mm-notification-bar',
  templateUrl: './mm-notification-bar.component.html',
  styleUrls: ['./mm-notification-bar.component.css']
})
export class MmNotificationBarComponent implements OnInit {
  public errorMessage: ErrorMessage | null;

  constructor(
    private readonly messageService: MessageService,
    private readonly dialog: MatDialog
  ) {
    this.errorMessage = null;
  }

  ngOnInit(): void {
    this.messageService.getLatestErrorMessage().subscribe((value) => {
      this.errorMessage = value;
    });
  }

  onHide(): void {
    this.errorMessage = null;
  }

  onShowDetails(): void {
    this.dialog.open(MmMessageDetailsComponent, {
      data: {
        errorMessage: this.errorMessage
      }
    });
  }
}
