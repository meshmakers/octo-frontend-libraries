import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { WindowStateService } from '@meshmakers/shared-ui';
import { EntitySelectorDialogComponent } from './entity-selector-dialog.component';
import {
  EntitySelectorDialogData,
  EntitySelectorDialogResult
} from './entity-selector-dialog.models';

export interface EntitySelectorResult {
  confirmed: boolean;
  entity?: EntitySelectorDialogResult;
}

@Injectable({
  providedIn: 'root'
})
export class EntitySelectorDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  public async openEntitySelector(
    data?: EntitySelectorDialogData
  ): Promise<EntitySelectorResult> {
    const size = this.windowStateService.resolveWindowSize('entity-selector', { width: 600, height: 350 });

    const windowRef = this.windowService.open({
      content: EntitySelectorDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 500,
      minHeight: 280,
      resizable: true,
      title: data?.title ?? 'Select Target Entity'
    });

    this.windowStateService.applyModalBehavior('entity-selector', windowRef);

    const contentRef = windowRef.content as { instance?: EntitySelectorDialogComponent } | undefined;
    if (contentRef?.instance && data) {
      contentRef.instance.data = data;
      if (data.currentTargetRtId && data.currentTargetCkTypeId) {
        contentRef.instance.entityIdentifier =
          `${data.currentTargetCkTypeId}@${data.currentTargetRtId}`;
        contentRef.instance.onIdentifierChange(contentRef.instance.entityIdentifier);
      }
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return { confirmed: false };
      }

      if (result && typeof result === 'object' && 'rtId' in result) {
        return {
          confirmed: true,
          entity: result as EntitySelectorDialogResult
        };
      }

      return { confirmed: false };
    } catch {
      return { confirmed: false };
    }
  }
}
