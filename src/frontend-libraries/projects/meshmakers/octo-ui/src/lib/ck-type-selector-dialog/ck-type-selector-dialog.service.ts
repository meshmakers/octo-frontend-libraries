import { Injectable, inject } from '@angular/core';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { CkTypeSelectorItem } from '@meshmakers/octo-services';
import {
  CkTypeSelectorDialogComponent,
  CkTypeSelectorDialogData,
  CkTypeSelectorDialogResult
} from './ck-type-selector-dialog.component';

export interface CkTypeSelectorResult {
  confirmed: boolean;
  selectedCkType: CkTypeSelectorItem | null;
}

@Injectable()
export class CkTypeSelectorDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens the CkType selector dialog
   * @param options Dialog options
   * @returns Promise that resolves with the result containing selected CkType and confirmation status
   */
  public async openCkTypeSelector(options: {
    selectedCkTypeId?: string;
    ckModelIds?: string[];
    dialogTitle?: string;
    allowAbstract?: boolean;
  } = {}): Promise<CkTypeSelectorResult> {
    const data: CkTypeSelectorDialogData = {
      selectedCkTypeId: options.selectedCkTypeId,
      ckModelIds: options.ckModelIds,
      dialogTitle: options.dialogTitle,
      allowAbstract: options.allowAbstract
    };

    const dialogRef: DialogRef = this.dialogService.open({
      content: CkTypeSelectorDialogComponent,
      width: 900,
      height: 650,
      minWidth: 750,
      minHeight: 550,
      title: options.dialogTitle || 'Select Construction Kit Type'
    });

    // Pass data to the component
    if ((dialogRef.content as any)?.instance) {
      ((dialogRef.content as any).instance as any).data = data;
    }

    try {
      const result = await firstValueFrom(dialogRef.result);

      if (result && typeof result === 'object' && 'selectedCkType' in result) {
        // User clicked OK and we have a result
        const dialogResult = result as CkTypeSelectorDialogResult;
        return {
          confirmed: true,
          selectedCkType: dialogResult.selectedCkType
        };
      } else {
        // User clicked Cancel or closed dialog
        return {
          confirmed: false,
          selectedCkType: null
        };
      }
    } catch {
      // Dialog was closed without result (e.g., ESC key, X button)
      return {
        confirmed: false,
        selectedCkType: null
      };
    }
  }
}
