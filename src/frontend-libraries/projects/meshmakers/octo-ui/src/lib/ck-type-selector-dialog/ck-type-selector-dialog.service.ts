import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { CkTypeSelectorItem } from '@meshmakers/octo-services';
import { WindowStateService } from '@meshmakers/shared-ui';
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
  private readonly windowStateService = inject(WindowStateService);

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

    const size = this.windowStateService.resolveWindowSize('ck-type-selector', { width: 900, height: 650 });

    const windowRef = this.windowService.open({
      content: CkTypeSelectorDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 750,
      minHeight: 550,
      resizable: true,
      title: options.dialogTitle || 'Select Construction Kit Type'
    });

    this.windowStateService.applyModalBehavior('ck-type-selector', windowRef);

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
        const dialogResult = result as CkTypeSelectorDialogResult;
        return {
          confirmed: true,
          selectedCkType: dialogResult.selectedCkType
        };
      } else {
        return {
          confirmed: false,
          selectedCkType: null
        };
      }
    } catch {
      return {
        confirmed: false,
        selectedCkType: null
      };
    }
  }
}
