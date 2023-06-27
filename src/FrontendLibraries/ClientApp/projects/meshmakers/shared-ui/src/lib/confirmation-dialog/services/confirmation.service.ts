import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationWindowComponent } from '../confirmation-window/confirmation-window.component';
import { map } from 'rxjs/operators';
import {
  ButtonTypes,
  ConfirmationWindowData,
  ConfirmationWindowResult,
  DialogType,
} from '../shared/confirmation';

@Injectable({
  providedIn: 'root',
})
export class ConfirmationService {
  constructor(private readonly dialog: MatDialog) {}

  showYesNoConfirmationDialog(
    title: string,
    message: string
  ): Observable<boolean> {
    const dialogRef = this.dialog.open<
      ConfirmationWindowComponent,
      ConfirmationWindowData,
      ConfirmationWindowResult
    >(ConfirmationWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: <ConfirmationWindowData>{
        title,
        message,
        dialogType: DialogType.YesNo,
      },
    });

    return dialogRef
      .afterClosed()
      .pipe(map((value) => value?.result === ButtonTypes.Yes));
  }

  showYesNoCancelConfirmationDialog(
    title: string,
    message: string
  ): Observable<ConfirmationWindowResult | undefined> {
    const dialogRef = this.dialog.open<
      ConfirmationWindowComponent,
      ConfirmationWindowData,
      ConfirmationWindowResult
    >(ConfirmationWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: <ConfirmationWindowData>{
        title,
        message,
        dialogType: DialogType.YesNoCancel,
      },
    });

    return dialogRef.afterClosed();
  }

  showOkCancelConfirmationDialog(
    title: string,
    message: string
  ): Observable<boolean> {
    const dialogRef = this.dialog.open<
      ConfirmationWindowComponent,
      ConfirmationWindowData,
      ConfirmationWindowResult
    >(ConfirmationWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: <ConfirmationWindowData>{
        title,
        message,
        dialogType: DialogType.OkCancel,
      },
    });

    return dialogRef
      .afterClosed()
      .pipe(map((value) => value?.result === ButtonTypes.Ok));
  }

  showOkDialog(title: string, message: string): Observable<boolean> {
    const dialogRef = this.dialog.open<
      ConfirmationWindowComponent,
      ConfirmationWindowData,
      ConfirmationWindowResult
    >(ConfirmationWindowComponent, {
      width: '50vw',
      maxWidth: '50vw',
      data: <ConfirmationWindowData>{
        title,
        message,
        dialogType: DialogType.Ok,
      },
    });

    return dialogRef
      .afterClosed()
      .pipe(map((value) => value?.result === ButtonTypes.Ok));
  }
}
