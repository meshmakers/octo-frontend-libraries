import { Injectable, inject } from '@angular/core';
import { WindowCloseResult, WindowRef, WindowService } from '@progress/kendo-angular-dialog';
import { WindowStateService } from '@meshmakers/shared-ui';
import { firstValueFrom } from 'rxjs';
import {
  MappingEditDialogComponent,
  MappingEditDialogData,
  MappingEditDialogResult,
  MappingEditValue,
} from './mapping-edit-dialog.component';

const DIALOG_KEY = 'mapping-edit-dialog';
const DEFAULT_SIZE = { width: 760, height: 760 };

@Injectable({ providedIn: 'root' })
export class MappingEditDialogService {
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  /**
   * Opens the focused mapping editor as a resizable Kendo Window and returns
   * the user's choice. The window's size is persisted across sessions via
   * `WindowStateService` (same pattern as the AttributeSelectorDialog and the
   * EntitySelectDialog).
   *
   * The host is responsible for persisting changes when `confirmed=true` — the
   * dialog itself only mutates a local copy.
   */
  public async open(data: MappingEditDialogData): Promise<MappingEditDialogResult> {
    const size = this.windowStateService.resolveWindowSize(DIALOG_KEY, DEFAULT_SIZE);

    const windowRef: WindowRef = this.windowService.open({
      title: data.title ?? 'Edit Mapping',
      content: MappingEditDialogComponent,
      width: size.width,
      height: size.height,
      minWidth: 540,
      minHeight: 480,
      resizable: true,
    });

    this.windowStateService.applyModalBehavior(DIALOG_KEY, windowRef);

    const contentRef = windowRef.content as { instance?: MappingEditDialogComponent } | undefined;
    if (contentRef?.instance) {
      contentRef.instance.initialise(data);
    }

    try {
      const result = await firstValueFrom(windowRef.result);
      if (result instanceof WindowCloseResult) {
        return { confirmed: false };
      }
      if (result && typeof result === 'object' && 'confirmed' in result) {
        return result as MappingEditDialogResult;
      }
      return { confirmed: false };
    } catch {
      return { confirmed: false };
    }
  }
}

export type { MappingEditDialogData, MappingEditDialogResult, MappingEditValue };
