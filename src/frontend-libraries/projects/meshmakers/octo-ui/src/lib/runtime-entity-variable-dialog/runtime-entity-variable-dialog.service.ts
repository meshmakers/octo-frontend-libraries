import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { WindowStateService } from '@meshmakers/shared-ui';
import { RuntimeEntityVariableDialogComponent } from './runtime-entity-variable-dialog.component';
import {
  RuntimeEntityVariableDialogData,
  RuntimeEntityVariableDialogResult
} from './runtime-entity-variable-dialog.models';

export interface RuntimeEntityVariableResult {
  confirmed: boolean;
  result?: RuntimeEntityVariableDialogResult;
}

@Injectable({
  providedIn: 'root'
})
export class RuntimeEntityVariableDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  /**
   * Opens the runtime entity variable dialog.
   * @param data Optional pre-populated data for editing
   * @returns Promise with confirmation status and dialog result
   */
  public async openRuntimeEntityVariableDialog(
    data?: RuntimeEntityVariableDialogData
  ): Promise<RuntimeEntityVariableResult> {
    const size = this.windowStateService.resolveWindowSize('runtime-entity-variable', { width: 800, height: 600 });

    const windowRef = this.windowService.open({
      content: RuntimeEntityVariableDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 650,
      minHeight: 500,
      resizable: true,
      title: 'Runtime Entity Variables'
    });

    this.windowStateService.applyModalBehavior('runtime-entity-variable', windowRef);

    const contentRef = windowRef.content as { instance?: RuntimeEntityVariableDialogComponent } | undefined;
    if (contentRef?.instance && data) {
      contentRef.instance.data = data;
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return { confirmed: false };
      }

      if (result && typeof result === 'object' && 'variables' in result) {
        return {
          confirmed: true,
          result: result as RuntimeEntityVariableDialogResult
        };
      }

      return { confirmed: false };
    } catch {
      return { confirmed: false };
    }
  }
}
