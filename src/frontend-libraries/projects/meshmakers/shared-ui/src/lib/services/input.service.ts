import { Injectable, inject } from '@angular/core';
import {DialogService} from '@progress/kendo-angular-dialog';
import {InputDialogComponent} from '../input-dialog/input-dialog.component';
import {firstValueFrom} from 'rxjs';
import {InputDialogResult} from '../models/inputDialogResult';

@Injectable()
export class InputService {
  private readonly dialogService = inject(DialogService);

  public async showInputDialog(title: string, message: string, placeholder: string, buttonOkText: string | null = null): Promise<string | null> {
    const dialogRef = this.dialogService.open({
      title,
      content: InputDialogComponent,
      autoFocusedElement: "input"
    });

    const component = dialogRef.content.instance;
    component.message = message;
    component.placeholder = placeholder;
    if (buttonOkText) {
      component.buttonOkText = buttonOkText;
    }

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof InputDialogResult) {
      return result.newValue as string;
    }

    return null;
  }
}
