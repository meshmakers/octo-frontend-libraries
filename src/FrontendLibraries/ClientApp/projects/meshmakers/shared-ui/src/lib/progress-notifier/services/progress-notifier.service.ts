import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProgressValue } from '../shared/progressValue';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MmProgressWindowComponent, ProgressWindowData, ProgressWindowResult } from '../progress-window/mm-progress-window.component';

@Injectable()
export class ProgressNotifierService {
  private readonly _currentProgressValue: BehaviorSubject<ProgressValue | null>;
  private currentDialogRef: MatDialogRef<MmProgressWindowComponent, ProgressWindowResult> | null;

  constructor(private readonly dialog: MatDialog) {
    this._currentProgressValue = new BehaviorSubject<ProgressValue | null>(null);
    this.currentDialogRef = null;
    this._isCanceled = false;
  }

  private _isCanceled: boolean;

  get isCanceled(): boolean {
    return this._isCanceled;
  }

  set isCanceled(value) {
    this._isCanceled = value;
  }

  start(title: string, isDeterminate: boolean, isCancelOperationAvailable: boolean): void {
    this.isCanceled = false;
    this.reportProgressDeterminate(0, 100, 'Working...');

    this.currentDialogRef = this.dialog.open<MmProgressWindowComponent, ProgressWindowData, ProgressWindowResult>(MmProgressWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: {
        title,
        isDeterminate,
        progress: this._currentProgressValue.asObservable(),
        isCancelOperationAvailable,
        cancelOperation: () => {
          this.reportProgressIndeterminate('Canceling operation...');
          this.isCanceled = true;
        }
      } as ProgressWindowData
    });
  }

  reportProgressDeterminate(progressCurrent: number, progressMax: number, statusText: string): void {
    const progressPercentage = (progressMax / 100) * progressCurrent;

    this._currentProgressValue.next(({
      statusText,
      progressValue: progressPercentage
    } as ProgressValue));
  }

  reportProgressIndeterminate(statusText: string): void {
    this._currentProgressValue.next(({
      statusText,
      progressValue: 0
    } as ProgressValue));
  }

  complete(): void {
    this.currentDialogRef?.close();
  }
}
