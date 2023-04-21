import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType} from "../shared/confirmation";

@Component({
  selector: 'lib-shared-ui-confirmation-window',
  templateUrl: './confirmation-window.component.html',
  styleUrls: ['./confirmation-window.component.css']
})
export class ConfirmationWindowComponent implements OnInit {

  button1Text: string;
  button1Result: ButtonTypes;
  button2Text: string | null;
  button2Result: ButtonTypes | null;
  button3Text: string | null;
  button3Result: ButtonTypes | null;

  constructor(private dialogRef: MatDialogRef<ConfirmationWindowComponent>, @Inject(MAT_DIALOG_DATA) public data: ConfirmationWindowData) {

    this.button2Text = null;
    this.button2Result = null;
    this.button3Text = null;
    this.button3Result = null;

    if (data.dialogType === DialogType.OkCancel) {
      this.button1Text = "OK";
      this.button1Result = ButtonTypes.Ok;
      this.button2Text = "Cancel";
      this.button2Result = ButtonTypes.Cancel;

    } else if (data.dialogType === DialogType.YesNoCancel) {
      this.button1Text = "Yes";
      this.button1Result = ButtonTypes.Yes;
      this.button2Text = "No";
      this.button2Result = ButtonTypes.No;
      this.button3Text = "Cancel";
      this.button3Result = ButtonTypes.Cancel;
    } else if (data.dialogType === DialogType.Ok) {
      this.button1Text = "OK";
      this.button1Result = ButtonTypes.Ok;
    } else {
      this.button1Text = "Yes";
      this.button1Result = ButtonTypes.Yes;
      this.button2Text = "No";
      this.button2Result = ButtonTypes.No;
    }

  }

  ngOnInit(): void {

  }

  onButton1() {

    this.dialogRef.close(<ConfirmationWindowResult>{
      result: this.button1Result
    });
  }

  onButton2() {
    this.dialogRef.close(<ConfirmationWindowResult>{
      result: this.button2Result
    });
  }

  onButton3() {
    this.dialogRef.close(<ConfirmationWindowResult>{
      result: this.button3Result
    });
  }
}
