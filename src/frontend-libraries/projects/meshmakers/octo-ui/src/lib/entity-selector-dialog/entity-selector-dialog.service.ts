import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { WindowStateService } from '@meshmakers/shared-ui';
import { firstValueFrom } from 'rxjs';
import { EntitySelectorDialogComponent } from './entity-selector-dialog.component';
import {
  EntitySelectorDialogData,
  EntitySelectorDialogResult
} from './entity-selector-dialog.models';

export interface EntitySelectorResult {
  confirmed: boolean;
  entity?: EntitySelectorDialogResult;
}

const DIALOG_KEY = 'entity-selector';
const DEFAULT_SIZE = { width: 600, height: 680 };
const MIN_SIZE = { width: 480, height: 540 };

@Injectable({
  providedIn: 'root'
})
export class EntitySelectorDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  /**
   * Opens the entity selector as a Kendo Window so it stacks correctly above
   * other Kendo Windows (e.g. the Mapping-Edit dialog calls this from its
   * own Window — Kendo Dialogs would land underneath because Window and
   * Dialog use different z-index ranges).
   */
  public async openEntitySelector(
    data?: EntitySelectorDialogData
  ): Promise<EntitySelectorResult> {
    const size = this.windowStateService.resolveWindowSize(DIALOG_KEY, DEFAULT_SIZE, MIN_SIZE);

    const windowRef = this.windowService.open({
      content: EntitySelectorDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: MIN_SIZE.width,
      minHeight: MIN_SIZE.height,
      resizable: true,
      title: data?.title ?? 'Select Target Entity',
    });

    this.windowStateService.applyModalBehavior(DIALOG_KEY, windowRef);

    const contentRef = windowRef.content as { instance?: EntitySelectorDialogComponent } | undefined;
    if (data && contentRef?.instance) {
      contentRef.instance.data = data;
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return { confirmed: false };
      }

      if (result && typeof result === 'object' && 'rtId' in result) {
        return {
          confirmed: true,
          entity: result as unknown as EntitySelectorDialogResult
        };
      }

      return { confirmed: false };
    } catch {
      return { confirmed: false };
    }
  }
}
