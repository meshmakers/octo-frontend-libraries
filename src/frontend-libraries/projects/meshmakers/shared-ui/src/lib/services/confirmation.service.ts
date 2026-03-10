import { Injectable, inject } from '@angular/core';
import {DialogRef, DialogService} from '@progress/kendo-angular-dialog';
import {firstValueFrom} from 'rxjs';
import {ConfirmationWindowComponent} from '../confirmation-window/confirmation-window.component';
import {
  ButtonTypes,
  ConfirmationButtonLabels,
  ConfirmationWindowData,
  ConfirmationWindowResult,
  DialogType,
} from '../models/confirmation';

@Injectable()
export class ConfirmationService {
  private readonly dialogService = inject(DialogService);

  public async showYesNoConfirmationDialog(title: string, message: string, cssClass?: string, buttonLabels?: ConfirmationButtonLabels): Promise<boolean> {

    const dialogRef = this.openDialog(title, message, DialogType.YesNo, cssClass, buttonLabels);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Yes;
    } else {
      return false;
    }
  }

  public async showYesNoCancelConfirmationDialog(title: string, message: string, buttonLabels?: ConfirmationButtonLabels): Promise<ConfirmationWindowResult | undefined> {

    const dialogRef = this.openDialog(title, message, DialogType.YesNoCancel, undefined, buttonLabels);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result;
    }
    return undefined;
  }

  public async showOkCancelConfirmationDialog(title: string, message: string): Promise<boolean> {

    const dialogRef = this.openDialog(title, message, DialogType.OkCancel);

    const component = dialogRef.content.instance as ConfirmationWindowComponent;
    component.data = {
      title,
      message,
      dialogType: DialogType.OkCancel
    } as ConfirmationWindowData

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    } else {
      return false;
    }
  }

  public async showOkDialog(title: string, message: string): Promise<boolean> {
    const dialogRef = this.openDialog(title, message, DialogType.Ok);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    } else {
      return false;
    }
  }

  private openDialog(title: string, message: string, dialogType: DialogType, cssClass?: string, buttonLabels?: ConfirmationButtonLabels) {
    const dialogRef: DialogRef = this.dialogService.open({
      title,
      content: ConfirmationWindowComponent,
      cssClass
    });

    const component = dialogRef.content.instance as ConfirmationWindowComponent;
    component.data = {
      title,
      message,
      dialogType,
      buttonLabels,
    };
    return dialogRef;
  }
}
