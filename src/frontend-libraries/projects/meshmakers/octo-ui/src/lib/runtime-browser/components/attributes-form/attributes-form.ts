import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from "@angular/forms";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_DROPDOWNS } from "@progress/kendo-angular-dropdowns";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { KENDO_LAYOUT, SelectEvent } from "@progress/kendo-angular-layout";
import { KENDO_UPLOADS } from "@progress/kendo-angular-upload";
import { AttributeField } from "../../models/attribute-field";
import { FormAttributesService } from "../../services/form-attributes-service";
import { AttributeFormFieldComponent } from "../attribute-form-field/attribute-form-field.component";
import { GeospatialPointAttributeComponent } from "../geospatial-point-attribute/geospatial-point-attribute.component";
@Component({
  selector: "mm-attributes-form",
  standalone: true,
  imports: [
    KENDO_LAYOUT,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
    KENDO_DROPDOWNS,
    KENDO_DATEINPUTS,
    ReactiveFormsModule,
    CommonModule,
    KENDO_UPLOADS,
    AttributeFormFieldComponent,
    GeospatialPointAttributeComponent,
  ],
  template: `
    <div [formGroup]="parentFormGroup" class="attributes-form-container">
      <kendo-card>
        <kendo-card-header>
          <h3>Attributes for {{ ckId }}</h3>
        </kendo-card-header>

        <kendo-card-body>
          @for (attr of attributes; track attr.attributeName) {
            @if (attr.attributeValueType === "RECORD_ARRAY") {
              <kendo-expansionpanel #panel [title]="attr.attributeName">
                <ng-template kendoExpansionPanelTitleDirective>
                  <div class="header-content">
                    <kendo-label
                      [text]="attr.attributeName"
                      [optional]="attr.isOptional"
                    ></kendo-label>
                  </div>
                </ng-template>

                <div class="record-array-content">
                  @if (attr.isOptional) {
                    <div class="record-actions-info">
                      <p class="record-actions-description">
                        Add records to this array. Remove to delete the selected
                        record. Empty arrays are not saved.
                      </p>
                    </div>
                  }

                  <kendo-tabstrip
                    (tabSelect)="
                      onRecordArrayTabSelect($event, attr.attributeName)
                    "
                  >
                    @for (item of getArrayControls(attr); track $index) {
                      <kendo-tabstrip-tab
                        [title]="attr.attributeName + ' ' + ($index + 1)"
                        [selected]="
                          $index === getSelectedIndex(attr.attributeName)
                        "
                      >
                        <ng-template kendoTabContent>
                          <div class="tab-content-wrapper">
                            <mm-attributes-form
                              [ckId]="attr.id.ckId"
                              [isRecord]="true"
                              [parentFormGroup]="item"
                              [isParentOptional]="attr.isOptional"
                            />
                          </div>
                        </ng-template>
                      </kendo-tabstrip-tab>
                    }
                  </kendo-tabstrip>

                  <div class="record-array-actions">
                    <button kendoButton size="small" (click)="addRecord(attr)">
                      Add
                    </button>
                    <button
                      kendoButton
                      size="small"
                      themeColor="error"
                      fillMode="flat"
                      [disabled]="!canRemoveRecord(attr)"
                      (click)="removeRecord(attr)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </kendo-expansionpanel>
            } @else if (attr.attributeValueType === "RECORD") {
              <kendo-expansionpanel #panel [title]="attr.attributeName">
                <ng-template kendoExpansionPanelTitleDirective>
                  <div class="header-content">
                    <kendo-label
                      [text]="attr.attributeName"
                      [optional]="attr.isOptional"
                    ></kendo-label>
                  </div>
                </ng-template>

                @if (attr.isOptional) {
                  <div class="record-actions-info">
                    <p class="record-actions-description">
                      Load attributes to edit this optional record. Unload to
                      remove all data and clear validation.
                    </p>
                  </div>
                }
                @if (!attr.isOptional || isRecordLoaded(attr.attributeName)) {
                  <mm-attributes-form
                    [ckId]="attr.id.ckId"
                    [isRecord]="true"
                    [parentFormGroup]="asFormGroup(attr.control)"
                    [isParentOptional]="attr.isOptional"
                  />
                }
                @if (attr.isOptional) {
                  <div class="record-actions">
                    <button
                      kendoButton
                      size="small"
                      [disabled]="isRecordLoaded(attr.attributeName)"
                      (click)="loadRecord(attr)"
                    >
                      Load
                    </button>
                    <button
                      kendoButton
                      size="small"
                      themeColor="error"
                      fillMode="flat"
                      [disabled]="!isRecordLoaded(attr.attributeName)"
                      (click)="unloadRecord(attr)"
                    >
                      Unload
                    </button>
                  </div>
                }
              </kendo-expansionpanel>
            } @else if (attr.attributeValueType === "GEOSPATIAL_POINT") {
              <mm-geospatial-point-attribute [attribute]="attr" />
            } @else if (attr.attributeValueType === "ENUM") {
              <mm-attribute-form-field
                [attribute]="attr"
                [fieldId]="'enum_' + attr.attributeName"
                [errorMessage]="
                  toTitleCase(attr.attributeName) + ' is required'
                "
                [onUndoClick]="getUndoHandler(attr)"
              >
                <kendo-dropdownlist
                  [id]="'enum_' + attr.attributeName"
                  [formControl]="asFormControl(attr.control)"
                  [data]="attr.enumOptions"
                  textField="name"
                  valueField="key"
                  [valuePrimitive]="true"
                >
                </kendo-dropdownlist>
              </mm-attribute-form-field>
            } @else if (
              attr.attributeValueType === "STRING_ARRAY" ||
              attr.attributeValueType === "INTEGER_ARRAY"
            ) {
              <mm-attribute-form-field
                [attribute]="attr"
                [fieldId]="'multiselect_' + attr.attributeName"
                [errorMessage]="
                  toTitleCase(attr.attributeName) + ' is required'
                "
                [onUndoClick]="getUndoHandler(attr)"
              >
                <kendo-multiselect
                  [id]="'multiselect_' + attr.attributeName"
                  [formControl]="asFormControl(attr.control)"
                  [data]="attr.enumOptions || []"
                  [allowCustom]="true"
                  [valuePrimitive]="true"
                  textField="name"
                  valueField="key"
                  placeholder="Select or type..."
                >
                </kendo-multiselect>
              </mm-attribute-form-field>
            } @else if (attr.attributeValueType === "BINARY_LINKED") {
              <mm-attribute-form-field
                [attribute]="attr"
                [fieldId]="'fileselect_' + attr.attributeName"
                [errorMessage]="'File is required'"
                [showUndoButton]="false"
              >
                <kendo-fileselect
                  [id]="'fileselect_' + attr.attributeName"
                  [multiple]="false"
                  [formControl]="asFormControl(attr.control)"
                >
                </kendo-fileselect>
              </mm-attribute-form-field>
            } @else if (attr.attributeValueType === "BINARY") {
              <mm-attribute-form-field
                [attribute]="attr"
                [fieldId]="'fileselect_' + attr.attributeName"
                [errorMessage]="'File is required'"
                [hintMessage]="'Maximum file size: 16 MB'"
                [showUndoButton]="false"
              >
                <kendo-fileselect
                  [multiple]="false"
                  [id]="'fileselect_' + attr.attributeName"
                  [formControl]="asFormControl(attr.control)"
                >
                </kendo-fileselect>
              </mm-attribute-form-field>
            } @else {
              <mm-attribute-form-field
                [attribute]="attr"
                [fieldId]="'input_' + attr.attributeName"
                [errorMessage]="
                  toTitleCase(attr.attributeName) + ' is required'
                "
                [onUndoClick]="getUndoHandler(attr)"
              >
                @if (checkIsNumber(attr)) {
                  <kendo-numerictextbox
                    [id]="'input_' + attr.attributeName"
                    [formControl]="asFormControl(attr.control)"
                  />
                } @else if (checkIsDateTime(attr)) {
                  <kendo-datetimepicker
                    [id]="'input_' + attr.attributeName"
                    [formControl]="asFormControl(attr.control)"
                  />
                } @else if (attr.attributeValueType === "TIME_SPAN") {
                  <kendo-timepicker
                    [id]="'input_' + attr.attributeName"
                    [formControl]="asFormControl(attr.control)"
                  />
                } @else if (attr.attributeValueType === "BOOLEAN") {
                  <kendo-switch
                    [id]="'input_' + attr.attributeName"
                    [formControl]="asFormControl(attr.control)"
                  />
                } @else {
                  <kendo-textbox
                    [id]="'input_' + attr.attributeName"
                    [formControl]="asFormControl(attr.control)"
                  />
                }
              </mm-attribute-form-field>
            }
          }
        </kendo-card-body>
      </kendo-card>
    </div>
  `,
  styleUrls: ["./attributes-form.scss"],
})
export class AttributesForm implements OnInit, OnChanges {
  @Input() ckId!: string;
  @Input() isRecord = false;
  @Input() parentFormGroup!: FormGroup;
  @Input() isParentOptional = false;

  attributes: AttributeField[] = [];
  private formAttributesService = inject(FormAttributesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private selectedIndices = new Map<string, number>();
  private loadedRecords = new Map<string, boolean>();

  /**
   * Reloads attributes when the CK type changes.
   */
  async ngOnChanges(changes: SimpleChanges) {
    if (changes["ckId"] && !changes["ckId"].firstChange) {
      await this.loadAttributes();
    }
  }

  /**
   * Loads initial attributes.
   */
  async ngOnInit() {
    await this.loadAttributes();
  }

  /**
   * Fetches attributes and syncs them with the parent form group.
   */
  private async loadAttributes() {
    if (!this.ckId || !this.parentFormGroup) {
      return;
    }

    const fetchedAttributes =
      await this.formAttributesService.getFormAttributes(
        this.ckId,
        undefined,
        this.isRecord,
      );

    this.attributes = fetchedAttributes
      .filter((attr: AttributeField) => Boolean(attr.attributeName))
      .map((attr: AttributeField) => {
        const existingControl = this.parentFormGroup.get(attr.attributeName);

        if (existingControl) {
          attr.control = existingControl;
        } else {
          this.parentFormGroup.addControl(attr.attributeName, attr.control);
        }
        return attr;
      });
  }

  /**
   * Casts controls to specific reactive form types.
   */
  asFormControl(control: AbstractControl | null): FormControl {
    return control as FormControl;
  }

  asFormGroup(control: AbstractControl | null): FormGroup {
    return control as FormGroup;
  }

  /**
   * Checks if the attribute type is numeric.
   */
  checkIsNumber(attr: AttributeField): boolean {
    const type = attr.attributeValueType;
    return ["INT", "INTEGER", "INT_64", "INTEGER_64", "DOUBLE"].includes(
      type || "",
    );
  }

  /**
   * Checks if the attribute type is a date time.
   */
  checkIsDateTime(attr: AttributeField): boolean {
    const type = attr.attributeValueType;
    return ["DATE_TIME", "DATE_TIME_OFFSET"].includes(type || "");
  }

  /**
   * Undoes the attribute to the initial value.
   */
  undoAttribute(attr: AttributeField) {
    attr.control.reset();
    this.selectedIndices.delete(attr.attributeName);
  }

  /**
   * Returns the selected index for a record array.
   */
  getSelectedIndex(attributeName: string): number {
    const index = this.selectedIndices.get(attributeName);
    return index !== undefined ? index : 0;
  }

  /**
   * Sets the selected index for a record array.
   */
  setSelectedIndex(attributeName: string, index: number): void {
    if (!attributeName || index < 0) {
      return;
    }
    this.selectedIndices.set(attributeName, index);
  }

  /**
   * Returns a handler function for undo button that is bound to the specific attribute.
   */
  getUndoHandler(attr: AttributeField): () => void {
    return () => this.undoAttribute(attr);
  }

  /**
   * Gets the FormArray for a record array attribute.
   */
  private getFormArray(attr: AttributeField): FormArray {
    if (!attr || !attr.control) {
      throw new Error("Attribute or control is missing");
    }
    return attr.control as FormArray;
  }

  /**
   * Gets array of FormGroup controls for a record array attribute.
   */
  getArrayControls(attr: AttributeField): FormGroup[] {
    return this.getFormArray(attr).controls as FormGroup[];
  }

  /**
   * Handles tab selection for record array.
   */
  onRecordArrayTabSelect(event: SelectEvent, attributeName: string): void {
    if (!attributeName || event.index < 0) {
      return;
    }
    this.setSelectedIndex(attributeName, event.index);
  }

  /**
   * Checks if a record can be removed from the array.
   */
  canRemoveRecord(attr: AttributeField): boolean {
    if (!attr) {
      return false;
    }

    try {
      const formArray = this.getFormArray(attr);
      const selectedIndex = this.getSelectedIndex(attr.attributeName);
      return (
        formArray.length > 0 &&
        selectedIndex >= 0 &&
        selectedIndex < formArray.length
      );
    } catch {
      return false;
    }
  }

  /**
   * Adds a new record to the array and selects it.
   */
  addRecord(attr: AttributeField): void {
    const formArray = this.getFormArray(attr);
    formArray.push(new FormGroup({}));
    this.setSelectedIndex(attr.attributeName, formArray.length - 1);
  }

  /**
   * Removes the selected record from the array and updates selection.
   */
  removeRecord(attr: AttributeField): void {
    if (!attr || !this.canRemoveRecord(attr)) {
      return;
    }

    const formArray = this.getFormArray(attr);
    let selectedIndex = this.getSelectedIndex(attr.attributeName);

    if (selectedIndex < 0 || selectedIndex >= formArray.length) {
      return;
    }

    formArray.removeAt(selectedIndex);

    // Update selected index after removal
    if (formArray.length === 0) {
      selectedIndex = 0;
    } else if (selectedIndex >= formArray.length) {
      selectedIndex = formArray.length - 1;
    }

    this.setSelectedIndex(attr.attributeName, selectedIndex);
    this.cdr.detectChanges();
  }

  /**
   * Formats a string as title case.
   */
  public toTitleCase(str: string): string {
    if (!str) {
      return "";
    }
    const firstLetter = str[0].toUpperCase();
    const restLetters = str.slice(1).toLowerCase();
    return firstLetter + restLetters;
  }

  /**
   * Checks if a RECORD is loaded.
   */
  isRecordLoaded(attributeName: string): boolean {
    if (!attributeName) {
      return false;
    }
    return this.loadedRecords.get(attributeName) ?? false;
  }

  /**
   * Loads attributes for an optional RECORD.
   */
  loadRecord(attr: AttributeField): void {
    if (!attr.isOptional || this.isRecordLoaded(attr.attributeName)) {
      return;
    }

    // Mark as loaded - this will trigger Angular to render the nested form
    // The nested form will automatically load attributes in its ngOnInit
    this.loadedRecords.set(attr.attributeName, true);
    this.cdr.detectChanges();
  }

  /**
   * Unloads (clears) an optional RECORD.
   */
  unloadRecord(attr: AttributeField): void {
    if (!attr || !attr.isOptional || !attr.attributeName) {
      return;
    }

    if (!this.isRecordLoaded(attr.attributeName)) {
      return;
    }

    const recordGroup = this.asFormGroup(attr.control);
    if (!recordGroup) {
      return;
    }

    Object.keys(recordGroup.controls).forEach((key) => {
      recordGroup.removeControl(key);
    });

    this.loadedRecords.set(attr.attributeName, false);
    recordGroup.reset();
    this.cdr.detectChanges();
  }
}
