import { Injectable, inject } from '@angular/core';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { WindowStateService } from '@meshmakers/shared-ui';
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

@Injectable({
  providedIn: 'root'
})
export class AttributeSelectorDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

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

    const dialogKey = singleSelect ? 'attribute-selector-single' : 'attribute-selector';
    const defaultWidth = singleSelect ? 550 : 1000;
    const defaultHeight = singleSelect ? 650 : 700;
    const size = this.windowStateService.resolveWindowSize(dialogKey, { width: defaultWidth, height: defaultHeight });

    const windowRef: WindowRef = this.windowService.open({
      content: AttributeSelectorDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: singleSelect ? 450 : 850,
      minHeight: singleSelect ? 550 : 650,
      resizable: true,
      title: dialogTitle || 'Select Attributes'
    });

    this.windowStateService.applyModalBehavior(dialogKey, windowRef);

    // Pass data to the component
    const contentRef = windowRef.content as { instance?: AttributeSelectorDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.data = data;
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return {
          confirmed: false,
          selectedAttributes: []
        };
      }

      if (result && typeof result === 'object' && 'selectedAttributes' in result) {
        const dialogResult = result as AttributeSelectorDialogResult;
        return {
          confirmed: true,
          selectedAttributes: dialogResult.selectedAttributes
        };
      } else {
        return {
          confirmed: false,
          selectedAttributes: []
        };
      }
    } catch {
      return {
        confirmed: false,
        selectedAttributes: []
      };
    }
  }
}
