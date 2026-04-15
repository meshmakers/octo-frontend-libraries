import { Injectable, inject } from '@angular/core';
import { DialogService, DialogCloseResult } from '@progress/kendo-angular-dialog';
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

@Injectable({
  providedIn: 'root'
})
export class EntitySelectorDialogService {
  private readonly dialogService = inject(DialogService);

  public async openEntitySelector(
    data?: EntitySelectorDialogData
  ): Promise<EntitySelectorResult> {
    const dialogRef = this.dialogService.open({
      content: EntitySelectorDialogComponent,
      width: 500,
      height: 600,
      minWidth: 400,
      minHeight: 400,
      title: data?.title ?? 'Select Target Entity',
    });

    const contentRef = dialogRef.content.instance as EntitySelectorDialogComponent;
    if (data) {
      contentRef.data = data;
    }

    try {
      const result = await firstValueFrom(dialogRef.result);

      if (result instanceof DialogCloseResult) {
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
