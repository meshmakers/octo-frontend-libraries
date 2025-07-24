import { Component, OnInit, inject } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import { MatDialog } from '@angular/material/dialog';
import { MmMessageDetailsComponent } from '../mm-message-details/mm-message-details.component';

@Component({
  selector: 'mm-notification-bar',
  standalone: false,
  templateUrl: './mm-notification-bar.component.html',
  styleUrls: ['./mm-notification-bar.component.scss']
})
export class MmNotificationBarComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  private readonly dialog = inject(MatDialog);

  public errorMessage: ErrorMessage | null;

  constructor() {
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
