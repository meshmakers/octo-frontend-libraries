import { Injectable, inject } from '@angular/core';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import {
  AttributeSelectorDialogComponent,
  AttributeSelectorDialogData,
  AttributeSelectorDialogResult
} from './attribute-selector-dialog.component';
import { AttributeItem } from '@meshmakers/octo-services';

export interface AttributeSelectorResult {
  confirmed: boolean;
  selectedAttributes: AttributeItem[];
}

@Injectable()
export class AttributeSelectorDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens the attribute selector dialog
   * @param rtCkTypeId The RtCkType ID to fetch attributes for
   * @param selectedAttributes Optional array of pre-selected attribute paths
   * @param dialogTitle Optional custom dialog title
   * @returns Promise that resolves with the result containing selected attributes and confirmation status
   */
  public async openAttributeSelector(
    rtCkTypeId: string,
    selectedAttributes?: string[],
    dialogTitle?: string,
    singleSelect?: boolean
  ): Promise<AttributeSelectorResult> {
    const data: AttributeSelectorDialogData = {
      rtCkTypeId,
      selectedAttributes,
      dialogTitle,
      singleSelect
    };

    const dialogRef: DialogRef = this.dialogService.open({
      content: AttributeSelectorDialogComponent,
      width: singleSelect ? 500 : 900,
      height: singleSelect ? 600 : 700,
      minWidth: singleSelect ? 400 : 800,
      minHeight: singleSelect ? 500 : 650,
      title: dialogTitle || 'Select Attributes'
    });

    // Pass data to the component
    if ((dialogRef.content as any)?.instance) {
      ((dialogRef.content as any).instance as any).data = data;
    }

    try {
      const result = await firstValueFrom(dialogRef.result);

      if (result && typeof result === 'object' && 'selectedAttributes' in result) {
        // User clicked OK and we have a result
        const dialogResult = result as AttributeSelectorDialogResult;
        return {
          confirmed: true,
          selectedAttributes: dialogResult.selectedAttributes
        };
      } else {
        // User clicked Cancel or closed dialog
        return {
          confirmed: false,
          selectedAttributes: []
        };
      }
    } catch {
      // Dialog was closed without result (e.g., ESC key, X button)
      return {
        confirmed: false,
        selectedAttributes: []
      };
    }
  }
}
