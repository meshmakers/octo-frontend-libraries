import {Injectable, inject} from '@angular/core';
import {DialogRef, DialogService} from '@progress/kendo-angular-dialog';
import {firstValueFrom} from 'rxjs';
import {ImportStrategyDialogComponent, ImportStrategyDialogResult} from './import-strategy-dialog.component';
import {ImportStrategyDto} from '../models/importStrategyDto';

@Injectable()
export class ImportStrategyDialogService {
  private readonly dialogService = inject(DialogService);

  public async showImportStrategyDialog(title = 'Import', message = 'Select an import strategy:'): Promise<ImportStrategyDto | null> {
    const dialogRef: DialogRef = this.dialogService.open({
      title,
      content: ImportStrategyDialogComponent
    });

    const component = dialogRef.content.instance as ImportStrategyDialogComponent;
    component.message = message;

    const result = await firstValueFrom(dialogRef.result);
    if (result instanceof ImportStrategyDialogResult) {
      return result.strategy;
    }
    return null;
  }
}
