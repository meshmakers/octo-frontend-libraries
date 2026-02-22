import { Component, inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType } from './confirmation.model';

@Component({
  selector: 'mm-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="onButton1()">{{ button1Text }}</button>
      @if (button2Text) {
        <button mat-stroked-button (click)="onButton2()">{{ button2Text }}</button>
      }
      @if (button3Text) {
        <button mat-stroked-button (click)="onButton3()">{{ button3Text }}</button>
      }
    </mat-dialog-actions>
  `
})
export class ConfirmationDialogComponent implements OnInit {
  private readonly dialogRef = inject<MatDialogRef<ConfirmationDialogComponent>>(MatDialogRef);
  readonly data = inject<ConfirmationWindowData>(MAT_DIALOG_DATA);

  button1Text = 'OK';
  button2Text: string | null = null;
  button3Text: string | null = null;

  private button1Result: ButtonTypes = ButtonTypes.Ok;
  private button2Result: ButtonTypes | null = null;
  private button3Result: ButtonTypes | null = null;

  ngOnInit(): void {
    switch (this.data.dialogType) {
      case DialogType.OkCancel:
        this.button1Text = 'OK';
        this.button1Result = ButtonTypes.Ok;
        this.button2Text = 'Cancel';
        this.button2Result = ButtonTypes.Cancel;
        break;
      case DialogType.YesNoCancel:
        this.button1Text = 'Yes';
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = 'No';
        this.button2Result = ButtonTypes.No;
        this.button3Text = 'Cancel';
        this.button3Result = ButtonTypes.Cancel;
        break;
      case DialogType.Ok:
        this.button1Text = 'OK';
        this.button1Result = ButtonTypes.Ok;
        break;
      default: // YesNo
        this.button1Text = 'Yes';
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = 'No';
        this.button2Result = ButtonTypes.No;
        break;
    }
  }

  onButton1(): void {
    this.dialogRef.close(new ConfirmationWindowResult(this.button1Result));
  }

  onButton2(): void {
    this.dialogRef.close(new ConfirmationWindowResult(this.button2Result!));
  }

  onButton3(): void {
    this.dialogRef.close(new ConfirmationWindowResult(this.button3Result!));
  }
}
