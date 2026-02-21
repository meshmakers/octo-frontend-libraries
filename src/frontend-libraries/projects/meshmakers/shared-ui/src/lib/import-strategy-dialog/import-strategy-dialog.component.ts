import {Component, inject, Input} from '@angular/core';
import {DialogActionsComponent, DialogContentBase, DialogRef} from '@progress/kendo-angular-dialog';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {FormsModule} from '@angular/forms';
import {ImportStrategyDto} from '../models/importStrategyDto';

export class ImportStrategyDialogResult {
  constructor(public strategy: ImportStrategyDto) {}
}

@Component({
  selector: 'mm-import-strategy-dialog',
  imports: [
    DialogActionsComponent,
    ButtonComponent,
    FormsModule
  ],
  templateUrl: './import-strategy-dialog.component.html',
  styleUrl: './import-strategy-dialog.component.css'
})
export class ImportStrategyDialogComponent extends DialogContentBase {
  private readonly dialogRef: DialogRef;

  @Input() message = '';

  protected selectedStrategy = ImportStrategyDto.Upsert;
  protected readonly ImportStrategyDto = ImportStrategyDto;

  constructor() {
    const dialogRef = inject(DialogRef);
    super(dialogRef);
    this.dialogRef = dialogRef;
  }

  onImport(): void {
    this.dialogRef.close(new ImportStrategyDialogResult(this.selectedStrategy));
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
