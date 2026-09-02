import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {FormsModule} from '@angular/forms';
import {LabelComponent} from '@progress/kendo-angular-label';
import {TextBoxComponent} from '@progress/kendo-angular-inputs';
import {InputDialogResult} from '../models/inputDialogResult';
import {
  InputDialogMessages,
  DEFAULT_INPUT_DIALOG_MESSAGES,
} from './input-dialog.messages';

@Component({
  selector: 'mm-input-dialog',
  imports: [
    DialogActionsComponent,
    ButtonComponent,
    FormsModule,
    LabelComponent,
    TextBoxComponent
  ],
  templateUrl: './input-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './input-dialog.component.scss'
})
export class InputDialogComponent extends DialogContentBase {
  private readonly dialogRef: DialogRef;

  @Input() public buttonOkText = DEFAULT_INPUT_DIALOG_MESSAGES.ok;
  @Input() public message = '';
  @Input() public placeholder = DEFAULT_INPUT_DIALOG_MESSAGES.placeholder;

  @Input() protected inputValue: string | null = '';

  public _messages: InputDialogMessages = { ...DEFAULT_INPUT_DIALOG_MESSAGES };

  @Input() set messages(value: Partial<InputDialogMessages> | undefined) {
    this._messages = { ...DEFAULT_INPUT_DIALOG_MESSAGES, ...(value ?? {}) };
    if (this.buttonOkText === DEFAULT_INPUT_DIALOG_MESSAGES.ok) {
      this.buttonOkText = this._messages.ok;
    }
    if (this.placeholder === DEFAULT_INPUT_DIALOG_MESSAGES.placeholder) {
      this.placeholder = this._messages.placeholder;
    }
  }

  constructor() {
    const dialogRef = inject(DialogRef);

    super(dialogRef);

    this.dialogRef = dialogRef;
  }

  protected onOk(): void {
    this.dialogRef.close(new InputDialogResult(this.inputValue!));
  }

  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
