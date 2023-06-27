import { Component, OnInit } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import { MatDialog } from '@angular/material/dialog';
import { MessageDetailsComponent } from '../message-details/message-details.component';

@Component({
  selector: 'ia-notification-bar',
  templateUrl: './ia-notification-bar.component.html',
  styleUrls: ['./ia-notification-bar.component.css'],
})
export class IaNotificationBarComponent implements OnInit {
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
    this.dialog.open(MessageDetailsComponent, {
      data: {
        errorMessage: this.errorMessage,
      },
    });
  }
}
