import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
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
  private readonly windowService = inject(WindowService);

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
    derivedFromRtCkTypeId?: string;
  } = {}): Promise<CkTypeSelectorResult> {
    const data: CkTypeSelectorDialogData = {
      selectedCkTypeId: options.selectedCkTypeId,
      ckModelIds: options.ckModelIds,
      dialogTitle: options.dialogTitle,
      allowAbstract: options.allowAbstract,
      derivedFromRtCkTypeId: options.derivedFromRtCkTypeId
    };

    const windowRef = this.windowService.open({
      content: CkTypeSelectorDialogComponent,
      width: 900,
      height: 650,
      minWidth: 750,
      minHeight: 550,
      resizable: true,
      title: options.dialogTitle || 'Select Construction Kit Type'
    });

    // Pass data to the component
    const contentRef = windowRef.content as { instance?: CkTypeSelectorDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = data;
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return {
          confirmed: false,
          selectedCkType: null
        };
      }

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
