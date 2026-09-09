import { Injectable, inject } from '@angular/core';
import {DialogService} from '@progress/kendo-angular-dialog';
import {InputDialogComponent} from '../input-dialog/input-dialog.component';
import {firstValueFrom} from 'rxjs';
import {InputDialogResult} from '../models/inputDialogResult';
import {InputDialogMessages} from '../input-dialog/input-dialog.messages';

@Injectable()
export class InputService {
  private readonly dialogService = inject(DialogService);

  public defaultMessages: Partial<InputDialogMessages> | undefined;

  public async showInputDialog(
    title: string,
    message: string,
    placeholder: string,
    buttonOkText: string | null = null,
    messages?: Partial<InputDialogMessages>,
  ): Promise<string | null> {
    const dialogRef = this.dialogService.open({
      title,
      content: InputDialogComponent,
      autoFocusedElement: 'input'
    });

    const component = dialogRef.content.instance;
    component.message = message;
    component.placeholder = placeholder;
    if (buttonOkText) {
      component.buttonOkText = buttonOkText;
    }
    const effectiveMessages = messages ?? this.defaultMessages;
    if (effectiveMessages) {
      component.messages = effectiveMessages;
    }

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof InputDialogResult) {
      return result.newValue as string;
    }

    return null;
  }
}
