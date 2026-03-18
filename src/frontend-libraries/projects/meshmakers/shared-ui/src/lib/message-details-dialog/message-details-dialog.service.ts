import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef } from '@progress/kendo-angular-dialog';
import { MessageDetailsDialogComponent, MessageDetailsDialogData } from './message-details-dialog.component';
import { WindowStateService } from '../services/window-state.service';

@Injectable()
export class MessageDetailsDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  /**
   * Opens a resizable window to show message details with copy-to-clipboard functionality
   */
  showDetailsDialog(data: MessageDetailsDialogData): WindowRef {
    const size = this.windowStateService.resolveWindowSize('message-details', { width: 900, height: 600 });

    const windowRef = this.windowService.open({
      content: MessageDetailsDialogComponent,
      title: data.title,
      width: size.width,
      height: size.height,
      minWidth: 500,
      minHeight: 400,
      resizable: true,
    });

    this.windowStateService.applyModalBehavior('message-details', windowRef);

    const contentRef = windowRef.content as { instance?: MessageDetailsDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = data;
    }

    return windowRef;
  }
}
