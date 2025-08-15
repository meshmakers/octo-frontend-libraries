import {Component, OnInit, inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType} from "../models/confirmation";

@Component({
  selector: 'mm-confirmation-window',
  standalone: false,
  templateUrl: './mm-confirmation-window.component.html',
  styleUrls: ['./mm-confirmation-window.component.css']
})
export class MmConfirmationWindowComponent implements OnInit {
  private readonly dialogRef = inject<MatDialogRef<MmConfirmationWindowComponent>>(MatDialogRef);
  data = inject<ConfirmationWindowData>(MAT_DIALOG_DATA);

  button1Text: string;
  button1Result: ButtonTypes;
  button2Text: string | null;
  button2Result: ButtonTypes | null;
  button3Text: string | null;
  button3Result: ButtonTypes | null;

  constructor() {
    const data = this.data;

    this.button2Text = null;
    this.button2Result = null;
    this.button3Text = null;
    this.button3Result = null;

    if (data.dialogType === DialogType.OkCancel) {
      this.button1Text = data.okButtonText ?? 'OK';
      this.button1Result = ButtonTypes.Ok;
      this.button2Text = data.cancelButtonText ?? 'Cancel';
      this.button2Result = ButtonTypes.Cancel;
    } else if (data.dialogType === DialogType.YesNoCancel) {
      this.button1Text = data.yesButtonText ?? 'Yes';
      this.button1Result = ButtonTypes.Yes;
      this.button2Text = data.noButtonText ?? 'No';
      this.button2Result = ButtonTypes.No;
      this.button3Text = data.cancelButtonText ?? 'Cancel';
      this.button3Result = ButtonTypes.Cancel;
    } else if (data.dialogType === DialogType.Ok) {
      this.button1Text = data.okButtonText ?? 'OK';
      this.button1Result = ButtonTypes.Ok;
    } else {
      this.button1Text = data.yesButtonText ?? 'Yes';
      this.button1Result = ButtonTypes.Yes;
      this.button2Text = data.noButtonText ?? 'No';
      this.button2Result = ButtonTypes.No;
    }
  }

  ngOnInit(): void {
  }

  onButton1(): void {
    this.dialogRef.close(({
      result: this.button1Result
    } as ConfirmationWindowResult));
  }

  onButton2(): void {
    this.dialogRef.close(({
      result: this.button2Result
    } as ConfirmationWindowResult));
  }

  onButton3(): void {
    this.dialogRef.close(({
      result: this.button3Result
    } as ConfirmationWindowResult));
  }
}
