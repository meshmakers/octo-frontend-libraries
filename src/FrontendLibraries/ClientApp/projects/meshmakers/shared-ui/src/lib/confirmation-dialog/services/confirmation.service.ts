import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MmConfirmationWindowComponent } from '../confirmation-window/mm-confirmation-window.component';
import { map } from 'rxjs/operators';
import { ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType } from '../shared/confirmation';

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  constructor(private readonly dialog: MatDialog) {}

  showYesNoConfirmationDialog(title: string, message: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          dialogType: DialogType.YesNo
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Yes));
  }

  showYesNoCancelConfirmationDialog(title: string, message: string): Observable<ConfirmationWindowResult | undefined> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          dialogType: DialogType.YesNoCancel
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed();
  }

  showOkCancelConfirmationDialog(title: string, message: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          dialogType: DialogType.OkCancel
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Ok));
  }

  showOkDialog(title: string, message: string): Observable<boolean> {
    const dialogRef = this.dialog.open<MmConfirmationWindowComponent, ConfirmationWindowData, ConfirmationWindowResult>(
      MmConfirmationWindowComponent,
      {
        width: '50vw',
        maxWidth: '50vw',
        data: {
          title,
          message,
          dialogType: DialogType.Ok
        } as ConfirmationWindowData
      }
    );

    return dialogRef.afterClosed().pipe(map((value) => value?.result === ButtonTypes.Ok));
  }
}
