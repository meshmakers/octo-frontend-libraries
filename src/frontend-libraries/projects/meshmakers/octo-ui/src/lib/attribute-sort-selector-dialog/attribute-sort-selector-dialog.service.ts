import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
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
  private readonly windowService = inject(WindowService);

  /**
   * Opens the attribute sort selector dialog
   * @param ckTypeId The CkType ID to fetch attributes for
   * @param selectedAttributes Optional array of pre-selected attributes with sort orders
   * @param dialogTitle Optional custom dialog title
   * @param includeNavigationProperties Optional flag to control navigation property inclusion
   * @param hideNavigationControls Optional flag to hide the navigation property controls
   * @returns Promise that resolves with the result containing selected attributes with sort orders and confirmation status
   */
  public async openAttributeSortSelector(
    ckTypeId: string,
    selectedAttributes?: AttributeSortItem[],
    dialogTitle?: string,
    includeNavigationProperties?: boolean,
    hideNavigationControls?: boolean
  ): Promise<AttributeSortSelectorResult> {
    const data: AttributeSortSelectorDialogData = {
      ckTypeId,
      selectedAttributes,
      dialogTitle,
      includeNavigationProperties,
      hideNavigationControls
    };

    const windowRef: WindowRef = this.windowService.open({
      content: AttributeSortSelectorDialogComponent,
      width: 1200,
      height: 750,
      minWidth: 1050,
      minHeight: 700,
      resizable: true,
      title: dialogTitle || 'Select Attributes with Sort Order'
    });

    // Pass data to the component
    const contentRef = windowRef.content as { instance?: AttributeSortSelectorDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = data;
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        // User closed the window via X button
        return {
          confirmed: false,
          selectedAttributes: []
        };
      }

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
