import { Injectable, inject } from '@angular/core';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { SaveAsDialogComponent } from './save-as-dialog.component';
import { SaveAsDialogOptions, SaveAsDialogResult } from './save-as-dialog-data-source';

@Injectable({
  providedIn: 'root'
})
export class SaveAsDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens a Save As dialog
   * @param options Dialog options including title, suggested name, and optional data source for validation
   * @returns Promise that resolves with the result containing confirmed status and entered name
   */
  public async showSaveAsDialog(options: SaveAsDialogOptions): Promise<SaveAsDialogResult> {
    const dialogRef: DialogRef = this.dialogService.open({
      content: SaveAsDialogComponent,
      width: options.width ?? 450,
      title: options.title
    });

    // Pass options to the component
    const contentRef = dialogRef.content as { instance?: { options?: SaveAsDialogOptions } };
    if (contentRef?.instance) {
      contentRef.instance.options = options;
    }

    try {
      const result = await firstValueFrom(dialogRef.result);

      if (result && typeof result === 'object' && 'confirmed' in result) {
        return result as SaveAsDialogResult;
      } else {
        return { confirmed: false };
      }
    } catch {
      // Dialog was closed without result (e.g., ESC key, X button)
      return { confirmed: false };
    }
  }
}
