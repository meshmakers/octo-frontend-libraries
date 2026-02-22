import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ProgressValue } from './progress-value';
import { ProgressWindowComponent, ProgressWindowData } from './progress-window.component';

/**
 * Reference returned by showProgress methods.
 * Provides a close() method compatible with the Kendo DialogRef API.
 */
export class ProgressDialogRef {
  constructor(private readonly dialogRef: MatDialogRef<ProgressWindowComponent>) {}

  close(): void {
    this.dialogRef.close();
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
}

export interface ProgressWindowOptions {
  isCancelOperationAvailable?: boolean;
  cancelOperation?: () => void;
  width?: number;
  height?: number | string;
}

@Injectable()
export class ProgressWindowService {
  private readonly dialog = inject(MatDialog);

  showProgress(config: ProgressWindowConfig): ProgressDialogRef {
    const dialogRef = this.dialog.open(ProgressWindowComponent, {
      data: {
        isDeterminate: config.isDeterminate !== false,
        progress: config.progress,
        isCancelOperationAvailable: config.isCancelOperationAvailable || false,
        cancelOperation: config.cancelOperation || (() => { /* noop */ }),
      } as ProgressWindowData,
      width: config.width ? `${config.width}px` : '450px',
      disableClose: true,
    });

    if (config.title) {
      // MatDialog doesn't have a built-in title on the ref, but we set it via the component
    }

    return new ProgressDialogRef(dialogRef);
  }

  showDeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): ProgressDialogRef {
    return this.showProgress({
      title,
      isDeterminate: true,
      progress,
      ...options
    });
  }

  showIndeterminateProgress(
    title: string,
    progress: Observable<ProgressValue>,
    options?: Partial<ProgressWindowOptions>
  ): ProgressDialogRef {
    return this.showProgress({
      title,
      isDeterminate: false,
      progress,
      ...options
    });
  }
}
