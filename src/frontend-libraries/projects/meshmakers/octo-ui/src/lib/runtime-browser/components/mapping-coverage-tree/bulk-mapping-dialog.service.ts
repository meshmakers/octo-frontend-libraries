import { Injectable, inject } from '@angular/core';
import { WindowCloseResult, WindowRef, WindowService } from '@progress/kendo-angular-dialog';
import { WindowStateService } from '@meshmakers/shared-ui';
import { firstValueFrom } from 'rxjs';
import {
  BulkMappingDialogComponent,
  BulkMappingDialogData,
  BulkMappingDialogResult,
  BulkMappingValue,
} from './bulk-mapping-dialog.component';

const DIALOG_KEY = 'bulk-mapping-dialog';
const DEFAULT_SIZE = { width: 700, height: 640 };

@Injectable({ providedIn: 'root' })
export class BulkMappingDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  /**
   * Opens the bulk mapping editor for the given source entities and returns
   * the shared mapping settings on confirm. The host creates the actual
   * mapping entities (one per source) — the dialog only collects the values.
   */
  public async open(data: BulkMappingDialogData): Promise<BulkMappingDialogResult> {
    const size = this.windowStateService.resolveWindowSize(DIALOG_KEY, DEFAULT_SIZE);

    const windowRef: WindowRef = this.windowService.open({
      title: data.title ?? `Map ${data.sources.length} sources`,
      content: BulkMappingDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 520,
      minHeight: 460,
      resizable: true,
    });

    this.windowStateService.applyModalBehavior(DIALOG_KEY, windowRef);

    const contentRef = windowRef.content as { instance?: BulkMappingDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.initialise(data);
    }

    try {
      const result = await firstValueFrom(windowRef.result);
      if (result instanceof WindowCloseResult) {
        return { confirmed: false };
      }
      if (result && typeof result === 'object' && 'confirmed' in result) {
        return result as BulkMappingDialogResult;
      }
      return { confirmed: false };
    } catch {
      return { confirmed: false };
    }
  }
}

export type { BulkMappingDialogData, BulkMappingDialogResult, BulkMappingValue };
