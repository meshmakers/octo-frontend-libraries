import {Injectable} from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {ProgressValue} from "../shared/progressValue";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {
  ProgressWindowComponent,
  ProgressWindowData,
  ProgressWindowResult
} from "../progress-window/progress-window.component";

@Injectable()
export class ProgressNotifierService {

  private readonly _currentProgressValue: BehaviorSubject<ProgressValue | null>;
  private currentDialogRef: MatDialogRef<ProgressWindowComponent, ProgressWindowResult> | null;

  constructor(private dialog: MatDialog) {
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

  start(title: string, isDeterminate: boolean, isCancelOperationAvailable: boolean) {

    this.isCanceled = false;
    this.reportProgressDeterminate(0, 100, "Working...");

    this.currentDialogRef = this.dialog.open<ProgressWindowComponent, ProgressWindowData, ProgressWindowResult>(ProgressWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: <ProgressWindowData>{
        title: title,
        isDeterminate: isDeterminate,
        progress: this._currentProgressValue.asObservable(),
        isCancelOperationAvailable: isCancelOperationAvailable,
        cancelOperation: () => {
          this.reportProgressIndeterminate("Canceling operation...");
          this.isCanceled = true;
        }
      }
    });
  }

  reportProgressDeterminate(progressCurrent: number, progressMax: number, statusText: string) {

    const progressPercentage = (progressMax / 100) * progressCurrent;

    this._currentProgressValue.next(<ProgressValue>{
      statusText: statusText,
      progressValue: progressPercentage
    });
  }

  reportProgressIndeterminate(statusText: string) {
    this._currentProgressValue.next(<ProgressValue>{
      statusText: statusText,
      progressValue: 0
    });
  }

  complete() {
    this.currentDialogRef?.close();
  }
}
