import { Component, Input, inject } from '@angular/core';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {FormsModule} from '@angular/forms';
import {LabelComponent} from '@progress/kendo-angular-label';
import {TextBoxComponent} from '@progress/kendo-angular-inputs';
import {InputDialogResult} from '../models/inputDialogResult';

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
  styleUrl: './input-dialog.component.scss'
})
export class InputDialogComponent extends DialogContentBase {
  private readonly dialogRef: DialogRef;

  @Input() public buttonOkText = "OK";
  @Input() public message = "";
  @Input() public placeholder = "Enter value";

  @Input() protected inputValue: any | null = "";

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
