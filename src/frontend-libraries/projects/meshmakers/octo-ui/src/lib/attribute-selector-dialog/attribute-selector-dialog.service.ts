import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
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
  private readonly windowService = inject(WindowService);

  /**
   * Opens the attribute selector dialog
   * @param rtCkTypeId The RtCkType ID to fetch attributes for
   * @param selectedAttributes Optional array of pre-selected attribute paths
   * @param dialogTitle Optional custom dialog title
   * @param singleSelect Optional flag for single-select mode
   * @param additionalAttributes Optional virtual attributes to include (e.g., Timestamp for stream data)
   * @param includeNavigationProperties Optional flag to control navigation property inclusion
   * @param maxDepth Optional max depth for navigation properties
   * @param hideNavigationControls Optional flag to hide the navigation property controls in the dialog
   * @returns Promise that resolves with the result containing selected attributes and confirmation status
   */
  public async openAttributeSelector(
    rtCkTypeId: string,
    selectedAttributes?: string[],
    dialogTitle?: string,
    singleSelect?: boolean,
    additionalAttributes?: AttributeItem[],
    includeNavigationProperties?: boolean,
    maxDepth?: number,
    hideNavigationControls?: boolean
  ): Promise<AttributeSelectorResult> {
    const data: AttributeSelectorDialogData = {
      rtCkTypeId,
      selectedAttributes,
      dialogTitle,
      singleSelect,
      additionalAttributes,
      includeNavigationProperties,
      maxDepth,
      hideNavigationControls
    };

    const windowRef: WindowRef = this.windowService.open({
      content: AttributeSelectorDialogComponent,
      width: singleSelect ? 550 : 1000,
      height: singleSelect ? 650 : 700,
      minWidth: singleSelect ? 450 : 850,
      minHeight: singleSelect ? 550 : 650,
      resizable: true,
      title: dialogTitle || 'Select Attributes'
    });

    // Pass data to the component
    const contentRef = windowRef.content as { instance?: AttributeSelectorDialogComponent } | undefined;
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
