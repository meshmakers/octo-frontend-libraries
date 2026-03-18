import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { InputsModule, CheckBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { FormFieldModule } from '@progress/kendo-angular-inputs';
import { TabStripModule } from '@progress/kendo-angular-layout';
import { MeshBoardVariable, MeshBoardTimeFilterConfig, TimeRangeSelection, EntitySelectorConfig } from '../../models/meshboard.models';
import { VariablesEditorComponent } from '../../components/variables-editor/variables-editor.component';
import { EntitySelectorEditorComponent } from '../../components/entity-selector-editor/entity-selector-editor.component';
import {
  TimeRangePickerComponent,
  TimeRangeSelection as SharedTimeRangeSelection
} from '@meshmakers/shared-ui';

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
    public rtWellKnownName?: string,
    public entitySelectors?: EntitySelectorConfig[]
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
    InputsModule,
    CheckBoxModule,
    LabelModule,
    FormFieldModule,
    TabStripModule,
    VariablesEditorComponent,
    EntitySelectorEditorComponent,
    TimeRangePickerComponent
  ],
  templateUrl: './meshboard-settings-dialog.component.html',
  styleUrl: './meshboard-settings-dialog.component.scss'
})
export class MeshBoardSettingsDialogComponent {
  private readonly windowRef = inject(WindowRef);

  // Form fields
  name = '';
  description = '';
  rtWellKnownName = '';
  columns = 6;
  rowHeight = 200;
  gap = 16;
  variables: MeshBoardVariable[] = [];
  entitySelectors: EntitySelectorConfig[] = [];
  entitySelectorEditing = false;
  timeFilterEnabled = false;
  defaultSelection?: TimeRangeSelection;
  initialDefaultSelection?: SharedTimeRangeSelection;

  /** Static and time filter variable names for duplicate detection in entity selector editor */
  get staticVariableNames(): string[] {
    return this.variables
      .filter(v => v.source === 'static' || v.source === 'timeFilter')
      .map(v => v.name);
  }

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
    entitySelectors?: EntitySelectorConfig[];
  }): void {
    this.name = settings.name;
    this.description = settings.description;
    this.rtWellKnownName = settings.rtWellKnownName ?? '';
    this.columns = settings.columns;
    this.rowHeight = settings.rowHeight;
    this.gap = settings.gap;
    this.variables = settings.variables ? [...settings.variables] : [];
    this.entitySelectors = settings.entitySelectors ? settings.entitySelectors.map(es => ({ ...es })) : [];
    this.timeFilterEnabled = settings.timeFilter?.enabled ?? false;
    this.defaultSelection = settings.timeFilter?.defaultSelection;
    if (this.defaultSelection) {
      this.initialDefaultSelection = {
        ...this.defaultSelection,
        customFrom: this.defaultSelection.customFrom ? new Date(this.defaultSelection.customFrom) : undefined,
        customTo: this.defaultSelection.customTo ? new Date(this.defaultSelection.customTo) : undefined
      } as SharedTimeRangeSelection;
    }
  }

  /**
   * Handles default selection change from the time range picker.
   */
  onDefaultSelectionChange(sharedSelection: SharedTimeRangeSelection): void {
    this.defaultSelection = {
      type: sharedSelection.type,
      year: sharedSelection.year,
      quarter: sharedSelection.quarter,
      month: sharedSelection.month,
      day: sharedSelection.day,
      hourFrom: sharedSelection.hourFrom,
      hourTo: sharedSelection.hourTo,
      relativeValue: sharedSelection.relativeValue,
      relativeUnit: sharedSelection.relativeUnit,
      customFrom: sharedSelection.customFrom?.toISOString(),
      customTo: sharedSelection.customTo?.toISOString()
    };
  }

  /**
   * Saves the settings and closes the dialog.
   */
  save(): void {
    if (!this.isValid) {
      return;
    }

    const timeFilter: MeshBoardTimeFilterConfig = {
      enabled: this.timeFilterEnabled,
      defaultSelection: this.timeFilterEnabled ? this.defaultSelection : undefined
    };

    const result = new MeshBoardSettingsResult(
      this.name.trim(),
      this.description.trim(),
      this.columns,
      this.rowHeight,
      this.gap,
      this.variables,
      timeFilter,
      this.rtWellKnownName.trim() || undefined,
      this.entitySelectors.length > 0 ? this.entitySelectors : undefined
    );

    this.windowRef.close(result);
  }

  /**
   * Cancels and closes the dialog.
   */
  cancel(): void {
    this.windowRef.close();
  }
}
