import { Injectable, inject } from '@angular/core';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import {
  AttributeSortSelectorDialogComponent,
  AttributeSortSelectorDialogData,
  AttributeSortSelectorDialogResult,
  AttributeSortItem
} from './attribute-sort-selector-dialog.component';

export interface AttributeSortSelectorResult {
  confirmed: boolean;
  selectedAttributes: AttributeSortItem[];
}

@Injectable()
export class AttributeSortSelectorDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens the attribute sort selector dialog
   * @param ckTypeId The CkType ID to fetch attributes for
   * @param selectedAttributes Optional array of pre-selected attributes with sort orders
   * @param dialogTitle Optional custom dialog title
   * @returns Promise that resolves with the result containing selected attributes with sort orders and confirmation status
   */
  public async openAttributeSortSelector(
    ckTypeId: string,
    selectedAttributes?: AttributeSortItem[],
    dialogTitle?: string
  ): Promise<AttributeSortSelectorResult> {
    const data: AttributeSortSelectorDialogData = {
      ckTypeId,
      selectedAttributes,
      dialogTitle
    };

    const dialogRef: DialogRef = this.dialogService.open({
      content: AttributeSortSelectorDialogComponent,
      width: 1100,
      height: 750,
      minWidth: 1050,
      minHeight: 700,
      title: dialogTitle || 'Select Attributes with Sort Order'
    });

    // Pass data to the component
    if ((dialogRef.content as any)?.instance) {
      ((dialogRef.content as any).instance as any).data = data;
    }

    try {
      const result = await firstValueFrom(dialogRef.result);
      
      if (result && typeof result === 'object' && 'selectedAttributes' in result) {
        // User clicked OK
        const dialogResult = result as AttributeSortSelectorDialogResult;
        return {
          confirmed: true,
          selectedAttributes: dialogResult.selectedAttributes || []
        };
      } else {
        // User clicked Cancel or closed dialog (result is undefined)
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