import { Injectable, inject } from '@angular/core';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { MessageDetailsDialogComponent, MessageDetailsDialogData } from './message-details-dialog.component';

@Injectable()
export class MessageDetailsDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens a modal dialog to show message details with copy-to-clipboard functionality
   */
  showDetailsDialog(data: MessageDetailsDialogData): DialogRef {
    const dialogRef = this.dialogService.open({
      content: MessageDetailsDialogComponent,
      actions: [], // Actions are handled by the component itself
      minWidth: 700,
      maxWidth: 900,
      width: '70%',
      minHeight: 400,
      maxHeight: '80vh',
      height: '60vh'
    });

    // Pass data to the component instance
    if (dialogRef.content.instance) {
      dialogRef.content.instance.data = data;
    }

    return dialogRef;
  }
}
