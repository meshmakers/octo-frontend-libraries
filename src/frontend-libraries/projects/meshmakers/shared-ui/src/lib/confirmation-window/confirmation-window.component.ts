import { Component, Input, OnInit, inject } from '@angular/core';
import {ButtonTypes, ConfirmationWindowData, ConfirmationWindowResult, DialogType} from '../models/confirmation';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {NgIf} from '@angular/common';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {
  ConfirmationWindowMessages,
  DEFAULT_CONFIRMATION_WINDOW_MESSAGES,
} from './confirmation-window.messages';

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
    this.button1Text = DEFAULT_CONFIRMATION_WINDOW_MESSAGES.ok;
    this.button1Result = ButtonTypes.Ok;
  }

  ngOnInit(): void {

    if (this.data){
      // Precedence: buttonLabels > messages > English defaults.
      const messages: ConfirmationWindowMessages = {
        ...DEFAULT_CONFIRMATION_WINDOW_MESSAGES,
        ...(this.data.messages ?? {}),
      };
      const labels = this.data.buttonLabels;
      const okLabel = labels?.ok ?? messages.ok;
      const cancelLabel = labels?.cancel ?? messages.cancel;
      const yesLabel = labels?.yes ?? messages.yes;
      const noLabel = labels?.no ?? messages.no;

      if (this.data.dialogType === DialogType.OkCancel) {
        this.button1Text = okLabel;
        this.button1Result = ButtonTypes.Ok;
        this.button2Text = cancelLabel;
        this.button2Result = ButtonTypes.Cancel;
      } else if (this.data.dialogType === DialogType.YesNoCancel) {
        this.button1Text = yesLabel;
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = noLabel;
        this.button2Result = ButtonTypes.No;
        this.button3Text = cancelLabel;
        this.button3Result = ButtonTypes.Cancel;
      } else if (this.data.dialogType === DialogType.Ok) {
        this.button1Text = okLabel;
        this.button1Result = ButtonTypes.Ok;
      } else {
        this.button1Text = yesLabel;
        this.button1Result = ButtonTypes.Yes;
        this.button2Text = noLabel;
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
