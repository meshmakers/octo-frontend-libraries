import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef } from '@progress/kendo-angular-dialog';
import { MessageDetailsDialogComponent, MessageDetailsDialogData } from './message-details-dialog.component';

@Injectable()
export class MessageDetailsDialogService {
  private readonly windowService = inject(WindowService);

  /**
   * Opens a resizable window to show message details with copy-to-clipboard functionality
   */
  showDetailsDialog(data: MessageDetailsDialogData): WindowRef {
    const windowRef = this.windowService.open({
      content: MessageDetailsDialogComponent,
      title: data.title,
      width: 900,
      height: 600,
      minWidth: 500,
      minHeight: 400,
      resizable: true,
    });

    const contentRef = windowRef.content as { instance?: MessageDetailsDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = data;
    }

    return windowRef;
  }
}
