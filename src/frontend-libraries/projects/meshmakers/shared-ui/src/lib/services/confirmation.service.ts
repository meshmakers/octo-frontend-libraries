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
import {ConfirmationWindowMessages} from '../confirmation-window/confirmation-window.messages';

@Injectable()
export class ConfirmationService {
  private readonly dialogService = inject(DialogService);

  public defaultMessages: Partial<ConfirmationWindowMessages> | undefined;

  public async showYesNoConfirmationDialog(title: string, message: string, cssClass?: string, buttonLabels?: ConfirmationButtonLabels, messages?: Partial<ConfirmationWindowMessages>): Promise<boolean> {

    const dialogRef = this.openDialog(title, message, DialogType.YesNo, cssClass, buttonLabels, messages);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Yes;
    } else {
      return false;
    }
  }

  public async showYesNoCancelConfirmationDialog(title: string, message: string, buttonLabels?: ConfirmationButtonLabels, messages?: Partial<ConfirmationWindowMessages>): Promise<ConfirmationWindowResult | undefined> {

    const dialogRef = this.openDialog(title, message, DialogType.YesNoCancel, undefined, buttonLabels, messages);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result;
    }
    return undefined;
  }

  public async showOkCancelConfirmationDialog(title: string, message: string, messages?: Partial<ConfirmationWindowMessages>): Promise<boolean> {

    const dialogRef = this.openDialog(title, message, DialogType.OkCancel, undefined, undefined, messages);

    const component = dialogRef.content.instance as ConfirmationWindowComponent;
    component.data = {
      title,
      message,
      dialogType: DialogType.OkCancel,
      messages: messages ?? this.defaultMessages,
    } as ConfirmationWindowData

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    } else {
      return false;
    }
  }

  /**
   * Confirmation of a destructive action: explicit verb labels instead of Yes / No (e.g.
   * "Rotate" / "Cancel") and the confirming button styled as danger. Resolves `true` only when
   * the confirming button was clicked.
   */
  public async showDestructiveConfirmationDialog(title: string, message: string, confirmLabel: string, cancelLabel = 'Cancel'): Promise<boolean> {
    const dialogRef = this.openDialog(title, message, DialogType.YesNo, undefined, { yes: confirmLabel, no: cancelLabel }, undefined, true);
    const result = await firstValueFrom(dialogRef.result);
    return result instanceof ConfirmationWindowResult && result.result === ButtonTypes.Yes;
  }

  public async showOkDialog(title: string, message: string, messages?: Partial<ConfirmationWindowMessages>): Promise<boolean> {
    const dialogRef = this.openDialog(title, message, DialogType.Ok, undefined, undefined, messages);

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    } else {
      return false;
    }
  }

  private openDialog(title: string, message: string, dialogType: DialogType, cssClass?: string, buttonLabels?: ConfirmationButtonLabels, messages?: Partial<ConfirmationWindowMessages>, danger = false) {
    // A confirmation is a short text: cap its width so a long message wraps instead of
    // stretching the dialog over the whole viewport.
    const dialogRef: DialogRef = this.dialogService.open({
      title,
      content: ConfirmationWindowComponent,
      cssClass,
      // Both bounds leave a 16 px gutter on each side, so a phone (< 352 px) never overflows.
      minWidth: 'min(320px, calc(100vw - 32px))',
      maxWidth: 'min(560px, calc(100vw - 32px))'
    });

    const component = dialogRef.content.instance as ConfirmationWindowComponent;
    component.data = {
      title,
      message,
      dialogType,
      buttonLabels,
      messages: messages ?? this.defaultMessages,
      ...(danger ? { danger: true } : {}),
    };
    return dialogRef;
  }
}
