import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';
import {
  ButtonTypes,
  ConfirmationWindowData,
  ConfirmationWindowResult,
  DialogType,
} from './confirmation.model';

@Injectable()
export class ConfirmationService {
  private readonly dialog = inject(MatDialog);

  public async showYesNoConfirmationDialog(title: string, message: string): Promise<boolean> {
    const result = await this.openDialog(title, message, DialogType.YesNo);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Yes;
    }
    return false;
  }

  public async showYesNoCancelConfirmationDialog(title: string, message: string): Promise<ConfirmationWindowResult | undefined> {
    const result = await this.openDialog(title, message, DialogType.YesNoCancel);
    if (result instanceof ConfirmationWindowResult) {
      return result;
    }
    return undefined;
  }

  public async showOkCancelConfirmationDialog(title: string, message: string): Promise<boolean> {
    const result = await this.openDialog(title, message, DialogType.OkCancel);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    }
    return false;
  }

  public async showOkDialog(title: string, message: string): Promise<boolean> {
    const result = await this.openDialog(title, message, DialogType.Ok);
    if (result instanceof ConfirmationWindowResult) {
      return result.result === ButtonTypes.Ok;
    }
    return false;
  }

  private async openDialog(title: string, message: string, dialogType: DialogType): Promise<ConfirmationWindowResult | undefined> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: { title, message, dialogType } as ConfirmationWindowData,
    });

    return firstValueFrom(dialogRef.afterClosed());
  }
}
