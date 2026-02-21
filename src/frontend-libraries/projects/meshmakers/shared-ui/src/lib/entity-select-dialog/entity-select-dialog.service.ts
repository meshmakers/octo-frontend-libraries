import { Injectable, inject } from '@angular/core';
import { DialogService } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { EntitySelectDialogComponent } from './entity-select-dialog.component';
import {
  EntitySelectDialogDataSource,
  EntitySelectDialogOptions,
  EntitySelectDialogResult
} from './entity-select-dialog-data-source';

@Injectable()
export class EntitySelectDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens the entity select dialog
   * @param dataSource The data source providing grid data and column definitions
   * @param options Dialog configuration options
   * @returns Promise resolving to selected entities or null if cancelled
   */
  async open<T>(
    dataSource: EntitySelectDialogDataSource<T>,
    options: EntitySelectDialogOptions<T>
  ): Promise<EntitySelectDialogResult<T> | null> {
    const dialogRef = this.dialogService.open({
      title: options.title,
      content: EntitySelectDialogComponent,
      width: options.width ?? 800,
      height: options.height ?? 600
    });

    const component = dialogRef.content.instance as EntitySelectDialogComponent<T>;
    component.dataSource = dataSource;
    component.multiSelect = options.multiSelect ?? false;
    component.preSelectedEntities = options.selectedEntities ?? [];

    const result = await firstValueFrom(dialogRef.result);

    if (result instanceof Object && 'selectedEntities' in result) {
      return result as EntitySelectDialogResult<T>;
    }

    return null;
  }
}
