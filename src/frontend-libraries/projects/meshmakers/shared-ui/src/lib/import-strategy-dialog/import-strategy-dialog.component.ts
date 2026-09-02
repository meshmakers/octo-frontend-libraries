import {Component, inject, Input, ChangeDetectionStrategy} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './import-strategy-dialog.component.css'
})
export class ImportStrategyDialogComponent extends DialogContentBase {
  private readonly dialogRef: DialogRef;

  @Input() message = '';

  protected selectedStrategy: ImportStrategyDto;
  protected get ImportStrategyDto(): typeof ImportStrategyDto { return ImportStrategyDto; }

  constructor() {
    const dialogRef = inject(DialogRef);
    super(dialogRef);
    this.dialogRef = dialogRef;
    // Assigned here rather than as a field initialiser: a class field initialised from a
    // relative import reads `undefined` under the Vitest module runner, so the member access
    // would throw (see CLAUDE.md, "Vite/esbuild class-field snapshot").
    this.selectedStrategy = ImportStrategyDto.Upsert;
  }

  onImport(): void {
    this.dialogRef.close(new ImportStrategyDialogResult(this.selectedStrategy));
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
