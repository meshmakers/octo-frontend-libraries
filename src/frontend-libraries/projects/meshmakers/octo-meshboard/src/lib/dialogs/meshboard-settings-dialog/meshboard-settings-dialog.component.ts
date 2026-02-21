import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { InputsModule, CheckBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { FormFieldModule } from '@progress/kendo-angular-inputs';
import { MeshBoardVariable, MeshBoardTimeFilterConfig } from '../../models/meshboard.models';
import { VariablesEditorComponent } from '../../components/variables-editor/variables-editor.component';

/**
 * Result returned when the dialog is closed with save action.
 */
export class MeshBoardSettingsResult {
  constructor(
    public name: string,
    public description: string,
    public columns: number,
    public rowHeight: number,
    public gap: number,
    public variables: MeshBoardVariable[],
    public timeFilter?: MeshBoardTimeFilterConfig,
    public rtWellKnownName?: string
  ) {}
}

/**
 * Dialog for editing MeshBoard settings.
 * Allows configuration of name, description, columns, rowHeight, and gap.
 */
@Component({
  selector: 'mm-meshboard-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputsModule,
    CheckBoxModule,
    LabelModule,
    FormFieldModule,
    VariablesEditorComponent
  ],
  templateUrl: './meshboard-settings-dialog.component.html',
  styleUrl: './meshboard-settings-dialog.component.scss'
})
export class MeshBoardSettingsDialogComponent {
  private readonly dialogRef = inject(DialogRef);

  // Form fields
  name = '';
  description = '';
  rtWellKnownName = '';
  columns = 6;
  rowHeight = 200;
  gap = 16;
  variables: MeshBoardVariable[] = [];
  timeFilterEnabled = false;

  // Validation
  get isValid(): boolean {
    return (
      this.name.trim().length > 0 &&
      this.columns >= 1 && this.columns <= 12 &&
      this.rowHeight >= 100 && this.rowHeight <= 1000 &&
      this.gap >= 0 && this.gap <= 100
    );
  }

  /**
   * Sets the initial values for the form fields.
   */
  setInitialValues(settings: {
    name: string;
    description: string;
    rtWellKnownName?: string | null;
    columns: number;
    rowHeight: number;
    gap: number;
    variables?: MeshBoardVariable[];
    timeFilter?: MeshBoardTimeFilterConfig;
  }): void {
    this.name = settings.name;
    this.description = settings.description;
    this.rtWellKnownName = settings.rtWellKnownName ?? '';
    this.columns = settings.columns;
    this.rowHeight = settings.rowHeight;
    this.gap = settings.gap;
    this.variables = settings.variables ? [...settings.variables] : [];
    this.timeFilterEnabled = settings.timeFilter?.enabled ?? false;
  }

  /**
   * Saves the settings and closes the dialog.
   */
  save(): void {
    if (!this.isValid) {
      return;
    }

    const timeFilter: MeshBoardTimeFilterConfig = {
      enabled: this.timeFilterEnabled
    };

    const result = new MeshBoardSettingsResult(
      this.name.trim(),
      this.description.trim(),
      this.columns,
      this.rowHeight,
      this.gap,
      this.variables,
      timeFilter,
      this.rtWellKnownName.trim() || undefined
    );

    this.dialogRef.close(result);
  }

  /**
   * Cancels and closes the dialog.
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
