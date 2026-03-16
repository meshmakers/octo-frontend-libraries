import { Injectable, inject } from '@angular/core';
import { WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { firstValueFrom } from 'rxjs';
import { EntitySelectDialogComponent } from './entity-select-dialog.component';
import {
  EntitySelectDialogDataSource,
  EntitySelectDialogOptions,
  EntitySelectDialogResult
} from './entity-select-dialog-data-source';
import { WindowStateService } from '../services/window-state.service';

@Injectable()
export class EntitySelectDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

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
    const defaultWidth = options.width ?? 800;
    const defaultHeight = options.height ?? 600;
    const size = this.windowStateService.resolveWindowSize('entity-select', { width: defaultWidth, height: defaultHeight });

    const windowRef = this.windowService.open({
      title: options.title,
      content: EntitySelectDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 550,
      minHeight: 400,
      resizable: true
    });

    this.windowStateService.applyModalBehavior('entity-select', windowRef);

    const contentRef = windowRef.content as { instance?: EntitySelectDialogComponent<T> } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.dataSource = dataSource;
      contentRef.instance.multiSelect = options.multiSelect ?? false;
      contentRef.instance.preSelectedEntities = options.selectedEntities ?? [];
      if (options.messages) {
        contentRef.instance.messages = options.messages;
      }
    }

    const result = await firstValueFrom(windowRef.result);

    if (result instanceof WindowCloseResult) {
      return null;
    }

    if (result && typeof result === 'object' && 'selectedEntities' in result) {
      return result as EntitySelectDialogResult<T>;
    }

    return null;
  }
}
