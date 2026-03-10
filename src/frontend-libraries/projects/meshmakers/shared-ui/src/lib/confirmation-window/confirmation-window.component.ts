import { Component, Input, OnInit, inject } from '@angular/core';
import {ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType} from '../models/confirmation';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {NgIf} from '@angular/common';
import {ButtonComponent} from '@progress/kendo-angular-buttons';

@Component({
  selector: 'mm-confirmation-window',
  imports: [
    DialogActionsComponent,
    NgIf,
    ButtonComponent
  ],
  templateUrl: './confirmation-window.component.html',
  styleUrl: './confirmation-window.component.css'
})
export class ConfirmationWindowComponent extends DialogContentBase implements OnInit {
  private readonly dialogRef: DialogRef;

  @Input() public data?: ConfirmationWindowData;

  protected button1Text: string;
  protected button1Result: ButtonTypes;
  protected button2Text: string | null;
  protected button2Result: ButtonTypes | null;
  protected button3Text: string | null;
  protected button3Result: ButtonTypes | null;

  constructor() {
    const dialogRef = inject(DialogRef);

    super(dialogRef);
    this.dialogRef = dialogRef;

    this.button2Text = null;
    this.button2Result = null;
    this.button3Text = null;
    this.button3Result = null;
    this.button1Text = 'OK';
    this.button1Result = ButtonTypes.Ok;
  }

  ngOnInit(): void {

    if (this.data){
      const labels = this.data.buttonLabels;
      if (this.data.dialogType === DialogType.OkCancel) {
        this.button1Text = labels?.ok ?? 'OK';
        this.button1Result = ButtonTypes.Ok;
        this.button2Text = labels?.cancel ?? 'Cancel';
        this.button2Result = ButtonTypes.Cancel;
      } else if (this.data.dialogType === DialogType.YesNoCancel) {
        this.button1Text = labels?.yes ?? 'Yes';
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = labels?.no ?? 'No';
        this.button2Result = ButtonTypes.No;
        this.button3Text = labels?.cancel ?? 'Cancel';
        this.button3Result = ButtonTypes.Cancel;
      } else if (this.data.dialogType === DialogType.Ok) {
        this.button1Text = labels?.ok ?? 'OK';
        this.button1Result = ButtonTypes.Ok;
      } else {
        this.button1Text = labels?.yes ?? 'Yes';
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = labels?.no ?? 'No';
        this.button2Result = ButtonTypes.No;
      }
    }
  }

  onButton1(): void {
    this.dialogRef.close((new ConfirmationWindowResult(this.button1Result!)));
  }

  onButton2(): void {
    this.dialogRef.close((new ConfirmationWindowResult(this.button2Result!)));
  }

  onButton3(): void {
    this.dialogRef.close((new ConfirmationWindowResult(this.button3Result!)));
  }
}
