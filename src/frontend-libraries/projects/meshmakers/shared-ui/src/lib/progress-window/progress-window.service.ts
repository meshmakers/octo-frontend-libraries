import { Injectable, inject } from '@angular/core';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Observable } from 'rxjs';
import { ProgressValue } from '../models/progressValue';
import { ProgressWindowComponent } from './progress-window.component';

@Injectable()
export class ProgressWindowService {
  private readonly dialogService = inject(DialogService);

  /**
   * Opens a progress window dialog
   * @param config Configuration for the progress window
   * @returns DialogRef for the progress window
   */
  showProgress(config: ProgressWindowConfig): DialogRef {
    const dialogRef = this.dialogService.open({
      title: config.title,
      content: ProgressWindowComponent,
      width: config.width ?? 450,
      height: config.height ?? 'auto',
      cssClass: 'mm-progress-window-no-close',
      preventAction: () => true // Always prevent closing via X button or ESC
    });

    // Set component input properties
    const component = dialogRef.content.instance;
    component.isDeterminate = config.isDeterminate !== false;
    component.progress = config.progress;
    component.isCancelOperationAvailable = config.isCancelOperationAvailable || false;
    component.cancelOperation = config.cancelOperation || (() => { /* noop */ });

    return dialogRef;
  }

  /**
   * Shows a determinate progress window (with percentage)
   * @param title Window title
   * @param progress Observable that emits progress updates
   * @param options Additional options
   * @returns DialogRef for the progress window
   */
  showDeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): DialogRef {
    return this.showProgress({
      title,
      isDeterminate: true,
      progress,
      ...options
    });
  }

  /**
   * Shows an indeterminate progress window (spinning/pulsing animation)
   * @param title Window title
   * @param progress Observable that emits progress updates (statusText only)
   * @param options Additional options
   * @returns DialogRef for the progress window
   */
  showIndeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): DialogRef {
    return this.showProgress({
      title,
      isDeterminate: false,
      progress,
      ...options
    });
  }
}

export interface ProgressWindowConfig {
  title: string;
  progress: Observable<ProgressValue>;
  isDeterminate?: boolean;
  isCancelOperationAvailable?: boolean;
  cancelOperation?: () => void;
  width?: number;
  height?: number | string;
  allowClose?: boolean;
}

export interface ProgressWindowOptions {
  isCancelOperationAvailable?: boolean;
  cancelOperation?: () => void;
  width?: number;
  height?: number | string;
  allowClose?: boolean;
}
