import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule, NumericTextBoxModule, TextBoxModule, CheckBoxModule } from '@progress/kendo-angular-inputs';
import { DatePickerModule, DateTimePickerModule } from '@progress/kendo-angular-dateinputs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon, trashIcon } from '@progress/kendo-svg-icons';
import { MeshBoardVariable, MeshBoardVariableType } from '../../models/meshboard.models';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';

interface VariableTypeOption {
  value: MeshBoardVariableType;
  label: string;
}

/**
 * Component for editing MeshBoard variables.
 * Allows adding, editing, and removing static variables with type-specific input controls.
 */
@Component({
  selector: 'mm-variables-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropDownListModule,
    InputsModule,
    NumericTextBoxModule,
    TextBoxModule,
    CheckBoxModule,
    DatePickerModule,
    DateTimePickerModule,
    SVGIconModule
  ],
  templateUrl: './variables-editor.component.html',
  styleUrl: './variables-editor.component.scss'
})
export class VariablesEditorComponent {
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() variables: MeshBoardVariable[] = [];
  @Output() variablesChange = new EventEmitter<MeshBoardVariable[]>();

  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = trashIcon;

  protected readonly typeOptions: VariableTypeOption[] = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'DateTime' }
  ];

  protected readonly booleanOptions = ['true', 'false'];

  /**
   * Adds a new static variable with default values.
   */
  addVariable(): void {
    const name = this.variableService.generateUniqueName('variable', this.variables);
    const newVariable = this.variableService.createDefaultVariable(name, 'string');

    this.variables = [...this.variables, newVariable];
    this.emitChange();
  }

  /**
   * Removes a variable at the given index.
   */
  removeVariable(index: number): void {
    this.variables = this.variables.filter((_, i) => i !== index);
    this.emitChange();
  }

  /**
   * Handles variable name change.
   */
  onNameChange(index: number, name: string): void {
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, name: sanitized } : v
    );
    this.emitChange();
  }

  /**
   * Handles variable type change.
   */
  onTypeChange(index: number, type: MeshBoardVariableType): void {
    const defaultVar = this.variableService.createDefaultVariable(
      this.variables[index].name,
      type
    );

    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, type, value: defaultVar.value, defaultValue: defaultVar.defaultValue } : v
    );
    this.emitChange();
  }

  /**
   * Handles string/text value change.
   */
  onValueChange(index: number, value: string): void {
    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, value } : v
    );
    this.emitChange();
  }

  /**
   * Handles number value change.
   */
  onNumberValueChange(index: number, value: number | null): void {
    const strValue = value !== null ? String(value) : '0';
    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, value: strValue } : v
    );
    this.emitChange();
  }

  /**
   * Handles date value change.
   */
  onDateValueChange(index: number, value: Date | null): void {
    const variable = this.variables[index];
    let strValue: string;

    if (value) {
      strValue = variable.type === 'datetime'
        ? value.toISOString()
        : value.toISOString().split('T')[0];
    } else {
      strValue = '';
    }

    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, value: strValue } : v
    );
    this.emitChange();
  }

  /**
   * Handles default value change.
   */
  onDefaultValueChange(index: number, defaultValue: string): void {
    this.variables = this.variables.map((v, i) =>
      i === index ? { ...v, defaultValue } : v
    );
    this.emitChange();
  }

  /**
   * Gets the numeric value for a variable.
   */
  getNumberValue(variable: MeshBoardVariable): number {
    return parseFloat(variable.value) || 0;
  }

  /**
   * Gets the Date value for a variable.
   */
  getDateValue(variable: MeshBoardVariable): Date | null {
    if (!variable.value) return null;
    const date = new Date(variable.value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Gets the type option for a variable.
   */
  getTypeOption(variable: MeshBoardVariable): VariableTypeOption {
    return this.typeOptions.find(t => t.value === variable.type) ?? this.typeOptions[0];
  }

  /**
   * Validates a variable name.
   */
  isValidName(name: string): boolean {
    return this.variableService.isValidVariableName(name);
  }

  /**
   * Checks if a variable name is duplicate.
   */
  isDuplicateName(name: string, currentIndex: number): boolean {
    return this.variables.some((v, i) => i !== currentIndex && v.name === name);
  }

  /**
   * Tracks variables by index for ngFor.
   */
  trackByIndex(index: number): number {
    return index;
  }

  private emitChange(): void {
    this.variablesChange.emit([...this.variables]);
  }
}
