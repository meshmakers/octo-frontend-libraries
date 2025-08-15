// noinspection JSUnusedGlobalSymbols

import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {map} from 'rxjs/operators';
import {MmConfirmationWindowComponent} from "../mm-confirmation-window/mm-confirmation-window.component";
import {ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType} from "../models/confirmation";

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private readonly dialog = inject(MatDialog);

  showYesNoConfirmationDialog(title: string, message: string, yesButtonText?: string, noButtonText?: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          yesButtonText,
          noButtonText,
          dialogType: DialogType.YesNo
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Yes));
  }

  showYesNoCancelConfirmationDialog(title: string, message: string, yesButtonText?: string, noButtonText?: string, cancelButtonText?: string): Observable<ConfirmationWindowResult | undefined> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          yesButtonText,
          noButtonText,
          cancelButtonText,
          dialogType: DialogType.YesNoCancel
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed();
  }

  showOkCancelConfirmationDialog(title: string, message: string, okButtonText?: string, cancelButtonText?: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          okButtonText,
          cancelButtonText,
          dialogType: DialogType.OkCancel
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Ok));
  }

  showOkDialog(title: string, message: string, okButtonText?: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          okButtonText,
          dialogType: DialogType.Ok
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Ok));
  }
}
