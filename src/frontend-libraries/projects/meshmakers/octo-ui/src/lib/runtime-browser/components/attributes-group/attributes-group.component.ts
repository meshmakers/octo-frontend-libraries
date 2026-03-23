import {
  Component,
  inject,
  forwardRef,
  computed,
  input,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormArray,
  FormGroup,
  ReactiveFormsModule,
  AbstractControl,
  FormControl,
  Validators,
} from "@angular/forms";
import { AttributeFieldComponent } from "../attribute-field/attribute-field.component";
import { rxResource } from "@angular/core/rxjs-interop";
import { finalize } from "rxjs";
import { Attribute } from "../../models/attribute";
import { AttributeDataService } from "../../services/attribute-data.service";
import { AttributeCoordinatorService } from "../../services/attribute-coordinator.service";
import { AttributeRecognitionService } from "../../services/attribute-recognition.service";
import { KENDO_LAYOUT, SelectEvent } from "@progress/kendo-angular-layout";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { KENDO_DROPDOWNS } from "@progress/kendo-angular-dropdowns";
import { KENDO_UPLOADS } from "@progress/kendo-angular-upload";
import {
  BINARY_LINKED_REFERENCE_FLAG,
  BINARY_REFERENCE_FLAG,
  AttributeMapperService,
} from "../../services/attribute-mapper.service";

/**
 * Attributes group: dynamic form for a CK type or record.
 * Loads definitions via rxResource, syncs initial values in an effect, supports RECORD/RECORD_ARRAY/scalars/geo/binary.
 */
@Component({
  selector: "mm-attributes-group",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KENDO_LAYOUT,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
    KENDO_DROPDOWNS,
    KENDO_DATEINPUTS,
    KENDO_UPLOADS,
    AttributeFieldComponent,
    forwardRef(() => AttributesGroupComponent),
  ],
  template: `
    <div class="attributes-form-container" [formGroup]="parentFormGroup()">
      <kendo-card [style.margin-bottom.px]="10">
        <kendo-card-header>
          <div class="header-title">
            <strong>{{ isRecord() ? 'Record' : 'Attributes' }}:</strong>
            {{ ckId() }}
          </div>
        </kendo-card-header>

        <kendo-card-body>
          @if (attributesResource.isLoading()) {
            <div class="k-i-loading"></div>
          }

          @for (attr of attributes(); track attr.attributeName) {
            @if (recognition.isRecordArray(attr.attributeValueType)) {
              <kendo-expansionpanel>
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
                    (tabSelect)="onTabSelect($event, attr.attributeName)"
                  >
                    @for (item of getArrayControls(attr); track $index) {
                      <kendo-tabstrip-tab
                        [title]="attr.attributeName + ' ' + ($index + 1)"
                        [selected]="
                          $index === getSelectedIndex(attr.attributeName)
                        "
                      >
                        <ng-template kendoTabContent>
                          <div
                            class="tab-content-wrapper"
                            style="padding-top: 10px;"
                          >
                            <mm-attributes-group
                              [ckId]="attr.id.ckId"
                              [isRecord]="true"
                              [parentFormGroup]="asFormGroup(item)"
                              [initialValues]="getRawInitialValue(attr.attributeName, $index)"
                            />
                          </div>
                        </ng-template>
                      </kendo-tabstrip-tab>
                    }
                  </kendo-tabstrip>

                  <div
                    class="record-array-actions"
                    style="margin-top: 10px; display: flex; gap: 8px;"
                  >
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
            } @else if (recognition.isRecord(attr.attributeValueType)) {
              <kendo-expansionpanel>
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

                @if ((!attr.isOptional || isRecordLoaded(attr.attributeName)) && parentFormGroup().contains(attr.attributeName)) {
                  <div style="margin-bottom: 10px;">
                    <mm-attributes-group
                      [ckId]="attr.id.ckId"
                      [isRecord]="true"
                      [parentFormGroup]="
                        asFormGroup(parentFormGroup().get(attr.attributeName)!)
                      "
                      [initialValues]="getRawInitialValue(attr.attributeName)"
                    />
                  </div>
                }

                @if (attr.isOptional) {
                  <div class="record-actions" style="display: flex; gap: 8px;">
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
            } @else if (
              recognition.isGeoSpatialPoint(attr.attributeValueType)
            ) {
              <kendo-expansionpanel [expanded]="true">
                <ng-template kendoExpansionPanelTitleDirective>
                  <div class="header-content">
                    <kendo-label
                      [text]="attr.attributeName"
                      [optional]="attr.isOptional"
                    ></kendo-label>
                  </div>
                </ng-template>

                @if (parentFormGroup().contains(attr.attributeName)) {
                  <div
                    [formGroupName]="attr.attributeName"
                    class="geospatial-grid"
                  >
                    <mm-attribute-field
                      [hintText]="'The longitude of the point on the Earth surface (-180 to 180 degrees).'"
                      [attribute]="attr"
                      [overrideLabelText]="'Longitude (X)'"
                      [control]="
                        parentFormGroup().get(attr.attributeName + '.longitude')!
                      "
                      [baselineValue]="getBaselineValue(attr.attributeName + '.longitude')"
                      [fieldId]="attr.attributeName + '_lon'"
                    >
                      <kendo-numerictextbox
                        [focusableId]="attr.attributeName + '_lon'"
                        formControlName="longitude"
                        [format]="'n6'"
                        [step]="0.000001"
                        [min]="-180"
                        [max]="180"
                      ></kendo-numerictextbox>
                    </mm-attribute-field>

                    <mm-attribute-field
                      [hintText]="'The latitude of the point on the Earth surface (-90 to 90 degrees).'"
                      [attribute]="attr"
                      [overrideLabelText]="'Latitude (Y)'"
                      [control]="
                        parentFormGroup().get(attr.attributeName + '.latitude')!
                      "
                      [baselineValue]="getBaselineValue(attr.attributeName + '.latitude')"
                      [fieldId]="attr.attributeName + '_lat'"
                    >
                      <kendo-numerictextbox
                        [focusableId]="attr.attributeName + '_lat'"
                        formControlName="latitude"
                        [format]="'n6'"
                        [step]="0.000001"
                        [min]="-90"
                        [max]="90"
                      ></kendo-numerictextbox>
                    </mm-attribute-field>
                  </div>
                }
              </kendo-expansionpanel>
            } @else if (parentFormGroup().contains(attr.attributeName)) {
              <mm-attribute-field
                [attribute]="attr"
                [control]="parentFormGroup().get(attr.attributeName)!"
                [baselineValue]="getBaselineValue(attr.attributeName)"
                [fieldId]="attr.attributeName"
              >
                @if (recognition.isNumber(attr.attributeValueType)) {
                  <kendo-numerictextbox
                    [focusableId]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                  />
                } @else if (recognition.isDate(attr.attributeValueType)) {
                  <kendo-datetimepicker
                    [focusableId]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                  />
                } @else if (recognition.isTime(attr.attributeValueType)) {
                  <kendo-timepicker
                    [focusableId]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                  />
                } @else if (recognition.isBoolean(attr.attributeValueType)) {
                  <kendo-switch
                    [attr.id]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                  />
                } @else if (attr.attributeValueType === "BINARY") {
                  <div class="binary-linked-wrap">
                    <kendo-fileselect
                      [multiple]="false"
                      [focusableId]="attr.attributeName"
                      [formControlName]="attr.attributeName"
                      [restrictions]="binaryRestrictions"
                    />
                    @if (isBinaryReferenceFile(attr.attributeName)) {
                      <span class="binary-linked-reference-hint" [title]="binaryReferenceTooltip">
                        {{ binaryReferenceLabel }}
                      </span>
                    }
                  </div>
                } @else if (attr.attributeValueType === "BINARY_LINKED") {
                  <div class="binary-linked-wrap">
                    <kendo-fileselect
                      [multiple]="false"
                      [focusableId]="attr.attributeName"
                      [formControlName]="attr.attributeName"
                    />
                    @if (isReferencePreviewFile(attr.attributeName)) {
                      <span class="binary-linked-reference-hint" [title]="referencePreviewTooltip">
                        {{ referencePreviewLabel }}
                      </span>
                    }
                  </div>
                } @else if (recognition.isEnum(attr.attributeValueType)) {
                  <kendo-dropdownlist
                    [attr.id]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                    [data]="attr.enumOptions || []"
                    textField="name"
                    valueField="key"
                    [valuePrimitive]="true"
                  />
                } @else if (recognition.isArray(attr.attributeValueType)) {
                  <kendo-multiselect
                    [attr.id]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                    [data]="getArrayDisplayData(attr.attributeName)"
                    [allowCustom]="true"
                    textField="name"
                    valueField="key"
                    [valuePrimitive]="true"
                  />
                } @else {
                  <kendo-textbox
                    [focusableId]="attr.attributeName"
                    [formControlName]="attr.attributeName"
                  />
                }
              </mm-attribute-field>
            }
          }
        </kendo-card-body>
      </kendo-card>
    </div>
  `,
  styleUrls: ["./attributes-group.component.scss"],
})
/**
 * Renders a dynamic form group for a CK type or record: loads attribute definitions,
 * syncs initial/entity values into the form, and supports RECORD (Load/Unload),
 * RECORD_ARRAY (Add/Remove), scalars, geo, binary. Used recursively for nested records.
 */
export class AttributesGroupComponent {
  // ─── Injected services ───────────────────────────────────────────────────────────
  private coordinator = inject(AttributeCoordinatorService);
  private dataService = inject(AttributeDataService);
  protected recognition = inject(AttributeRecognitionService);
  private mapper = inject(AttributeMapperService);
  private isRecordValue(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // ─── Inputs (public API for parent / template) ─────────────────────────────────────
  ckId = input.required<string>();
  parentFormGroup = input.required<FormGroup>();
  isRecord = input<boolean>(false);
  initialValues = input<RawInitialValue[]>();

  // ─── Derived state & resource ────────────────────────────────────────────────────
  protected attributes = computed(() => this.attributesResource.value() ?? []);
  private selectedIndices = new Map<string, number>();
  private loadedRecords = new Map<string, boolean>();
  private baselineValues = new Map<string, unknown>();
  protected readonly binaryRestrictions = { maxFileSize: 16 * 1024 * 1024 };

  /** Label and tooltip for BINARY when value was restored from base64 (content is real; file name is a placeholder). */
  protected readonly binaryReferenceLabel =
    "Preview (restored from stored data)";
  protected readonly binaryReferenceTooltip =
    "Content and size are from stored data. File name is a placeholder because the original name is not stored.";

  /** Label and tooltip for BINARY_LINKED when value is a reference/mockup (no content, metadata only). */
  protected readonly referencePreviewLabel = "Preview (reference file)";
  protected readonly referencePreviewTooltip =
    "Shows metadata of an existing file in the system; content is not loaded. Replace with a file to change.";

  /** True when the control value is a BINARY file restored from base64 (reference: real content, placeholder name). */
  protected isBinaryReferenceFile(attrName: string): boolean {
    const control = this.parentFormGroup()?.get(attrName);
    const value = control?.value;
    if (!Array.isArray(value) || value.length !== 1 || !(value[0] instanceof File))
      return false;
    return (
      (value[0] as unknown as Record<string, unknown>)[
        BINARY_REFERENCE_FLAG
      ] === true
    );
  }

  /** True when the control value is a synthetic BINARY_LINKED file (reference preview without content). */
  protected isReferencePreviewFile(attrName: string): boolean {
    const control = this.parentFormGroup()?.get(attrName);
    const value = control?.value;
    if (!Array.isArray(value) || value.length !== 1 || !(value[0] instanceof File))
      return false;
    return (
      (value[0] as unknown as Record<string, unknown>)[
        BINARY_LINKED_REFERENCE_FLAG
      ] === true
    );
  }

  protected attributesResource = rxResource({
    params: () => ({ id: this.ckId(), isRec: this.isRecord() }),
    stream: ({ params }) => {
      this.coordinator.startLoading();
      return this.dataService
        .getAttributesDefinition$(params.id, params.isRec)
        .pipe(finalize(() => this.coordinator.stopLoading()));
    },
  });

  // ─── Form sync: effect builds/patches controls from attributes + initial values ────
  constructor() {
    effect(() => {
      const attrs = this.attributes();
      const form = this.parentFormGroup();
      // Use stable empty to avoid new [] reference on every run (prevents infinite detection loop)
      const rawInitial = this.initialValues() ?? EMPTY_INITIAL_VALUES;

      if (attrs.length > 0) {
        attrs.forEach((attrMetadata) => {
          const rawValue = rawInitial.find(
            (val) => val.attributeName === attrMetadata.attributeName,
          )?.value;

          // Use parsed initial when entity data exists; otherwise use attribute.value from resource (already has Default or Empty from mapper)
          const hasInitialFromEntity = rawValue !== undefined && rawValue !== null;
          const finalValue = hasInitialFromEntity
            ? this.mapper.getFormValueFromRawInitial(attrMetadata, rawValue)
            : attrMetadata.value;

          if (!form.contains(attrMetadata.attributeName)) {
            this.initializeControl(form, attrMetadata, finalValue);
          } else {
            const control = form.get(attrMetadata.attributeName);
            if (control) {
              const isInitialEmpty =
                rawInitial === EMPTY_INITIAL_VALUES ||
                this.isDefaultEmptyValue(finalValue, attrMetadata.attributeValueType);
              const hasUserData = !this.isControlValueEmpty(
                control,
                attrMetadata.attributeValueType,
              );
              if (isInitialEmpty && hasUserData) {
                return;
              }
              // Only patch from initialValues when control has not been edited (preserves tab state when switching RECORD_ARRAY tabs)
              if (control.pristine && !control.touched) {
                const current = control.value;
                const changed =
                  JSON.stringify(current) !== JSON.stringify(finalValue);
                if (changed) {
                  control.patchValue(finalValue, { emitEvent: false });
                  this.setBaselineForAttr(attrMetadata, finalValue);
                }
              }
            }
          }
        });

        this.coordinator.markStructureAsReady();
      }
    });
  }

  // ─── Form structure: create control per attribute type, set baseline for UNDO ───────
  private initializeControl(
    form: FormGroup,
    attr: Attribute,
    initialValue: unknown,
  ) {
    let control: AbstractControl;

    if (this.recognition.isRecordArray(attr.attributeValueType)) {
      const initialArray = Array.isArray(initialValue) ? initialValue : [];
      const formArray = new FormArray<FormGroup>(
        [],
        attr.isOptional ? [] : [Validators.required],
      );

      // For each "record" in the array create a form group
      initialArray.forEach(() => {
        formArray.push(new FormGroup({}));
      });
      control = formArray;
    } else if (this.recognition.isRecord(attr.attributeValueType)) {
      control = new FormGroup({}, attr.isOptional ? [] : [Validators.required]);
    } else if (this.recognition.isGeoSpatialPoint(attr.attributeValueType)) {
      const longitudeValidators = [Validators.min(-180), Validators.max(180)];
      const latitudeValidators = [Validators.min(-90), Validators.max(90)];
      if (!attr.isOptional) {
        longitudeValidators.unshift(Validators.required);
        latitudeValidators.unshift(Validators.required);
      }
      const geoValue = this.isRecordValue(initialValue) ? initialValue : {};
      const geoGroup = new FormGroup({
        longitude: new FormControl(
          geoValue["longitude"] ?? null,
          longitudeValidators,
        ),
        latitude: new FormControl(
          geoValue["latitude"] ?? null,
          latitudeValidators,
        ),
      });
      form.addControl(attr.attributeName, geoGroup);
      this.setBaselineForAttr(attr, initialValue);
      return;
    } else {
      // Plain text/numeric/etc. field
      control = new FormControl(
        initialValue,
        attr.isOptional ? [] : [Validators.required],
      );
    }

    form.addControl(attr.attributeName, control);
    this.setBaselineForAttr(attr, initialValue);

    if (!(control instanceof FormArray || control instanceof FormGroup)) {
      control.patchValue(initialValue, { emitEvent: false });
    }
  }

  private setBaselineForAttr(attr: Attribute, value: unknown): void {
    const key = attr.attributeName;
    if (this.recognition.isGeoSpatialPoint(attr.attributeValueType)) {
      const v = this.isRecordValue(value) ? value : {};
      this.baselineValues.set(
        key + ".longitude",
        this.cloneForBaseline(v["longitude"] ?? null),
      );
      this.baselineValues.set(
        key + ".latitude",
        this.cloneForBaseline(v["latitude"] ?? null),
      );
    } else if (
      !this.recognition.isRecord(attr.attributeValueType) &&
      !this.recognition.isRecordArray(attr.attributeValueType)
    ) {
      this.baselineValues.set(key, this.cloneForBaseline(value));
    }
  }

  private cloneForBaseline(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return new Date(v.getTime());
    if (typeof v === "object" && v instanceof File) return v;
    if (Array.isArray(v)) return v.map((x) => this.cloneForBaseline(x));
    if (this.isRecordValue(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v))
        out[k] = this.cloneForBaseline(v[k]);
      return out;
    }
    return v;
  }

  getBaselineValue(controlKey: string): unknown {
    return this.baselineValues.has(controlKey)
      ? this.baselineValues.get(controlKey)
      : undefined;
  }

  asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  // ─── Value / empty checks (for effect: when to patch vs skip) ──────────────────────
  private isDefaultEmptyValue(value: unknown, type: string): boolean {
    if (value === null || value === undefined) return true;
    if (this.recognition.isRecordArray(type) || this.recognition.isRecord(type))
      return Array.isArray(value)
        ? value.length === 0
        : !this.isRecordValue(value) || Object.keys(value).length === 0;
    if (this.recognition.isGeoSpatialPoint(type)) {
      const v = this.isRecordValue(value) ? value : {};
      return v["longitude"] == null && v["latitude"] == null;
    }
    if (this.recognition.isArray(type)) return Array.isArray(value) && value.length === 0;
    return false;
  }

  private isControlValueEmpty(control: AbstractControl, type: string): boolean {
    const value = control.value;
    if (value === null || value === undefined || value === "") return true;
    if (this.recognition.isRecordArray(type) || this.recognition.isRecord(type)) {
      if (Array.isArray(value)) return value.length === 0;
      const obj = value && typeof value === "object" ? value : {};
      return Object.keys(obj).length === 0;
    }
    if (this.recognition.isGeoSpatialPoint(type)) {
      const v = value as { longitude?: number | null; latitude?: number | null };
      return v?.longitude == null && v?.latitude == null;
    }
    if (this.recognition.isArray(type))
      return !Array.isArray(value) || value.length === 0;
    return false;
  }

  // ─── RECORD (single optional group): Load / Unload ─────────────────────────────────
  isRecordLoaded(name: string): boolean {
    // Respect explicit user choice (Load/Unload): once set, don't override from initial data
    if (this.loadedRecords.has(name)) {
      return this.loadedRecords.get(name)!;
    }
    // Auto-load if initial value is present (record is filled)
    const initial = this.getRawInitialValue(name);
    if (initial && Array.isArray(initial) && initial.length > 0) {
      this.loadedRecords.set(name, true);
      return true;
    }
    return false;
  }

  loadRecord(attr: Attribute): void {
    if (!attr.isOptional || this.isRecordLoaded(attr.attributeName)) return;
    if (!this.parentFormGroup().contains(attr.attributeName)) {
      this.parentFormGroup().addControl(attr.attributeName, new FormGroup({}));
    }
    this.loadedRecords.set(attr.attributeName, true);
  }

  unloadRecord(attr: Attribute): void {
    if (!this.isRecordLoaded(attr.attributeName)) return;

    const group = this.parentFormGroup().get(attr.attributeName) as FormGroup;
    if (group) {
      Object.keys(group.controls).forEach((key) => group.removeControl(key));
      group.reset();
    }

    this.loadedRecords.set(attr.attributeName, false);
  }

  // ─── RECORD_ARRAY: tabs, Add / Remove, selected index ─────────────────────────────
  getArrayControls(attr: Attribute): FormGroup[] {
    const control = this.parentFormGroup().get(attr.attributeName);
    return control instanceof FormArray
      ? (control.controls as FormGroup[])
      : [];
  }

  getSelectedIndex(name: string): number {
    return this.selectedIndices.get(name) ?? 0;
  }

  setSelectedIndex(name: string, index: number): void {
    this.selectedIndices.set(name, index);
  }

  onTabSelect(event: SelectEvent, name: string): void {
    this.setSelectedIndex(name, event.index);
  }

  /** Builds display data for Kendo MultiSelect when value is primitive[] (valuePrimitive: true). */
  getArrayDisplayData(attributeName: string): { name: string; key: string | number }[] {
    const value = this.parentFormGroup().get(attributeName)?.value;
    if (!Array.isArray(value)) return [];
    return value.map((v: string | number) => ({
      name: String(v),
      key: v,
    }));
  }

  addRecord(attr: Attribute): void {
    let array = this.parentFormGroup().get(attr.attributeName) as FormArray;
    if (!array) {
      array = new FormArray<FormGroup>(
        [],
        attr.isOptional ? [] : [Validators.required],
      );
      this.parentFormGroup().addControl(attr.attributeName, array);
    }
    array.push(new FormGroup({}));
    this.setSelectedIndex(attr.attributeName, array.length - 1);
  }

  canRemoveRecord(attr: Attribute): boolean {
    const array = this.parentFormGroup().get(attr.attributeName) as FormArray;
    if (!array || array.length === 0) return false;
    const index = this.getSelectedIndex(attr.attributeName);
    return index >= 0 && index < array.length;
  }

  removeRecord(attr: Attribute): void {
    if (!this.canRemoveRecord(attr)) return;

    const array = this.parentFormGroup().get(attr.attributeName) as FormArray;
    let index = this.getSelectedIndex(attr.attributeName);

    array.removeAt(index);

    if (array.length === 0) {
      index = 0;
    } else if (index >= array.length) {
      index = array.length - 1;
    }
    this.setSelectedIndex(attr.attributeName, index);
  }

  // ─── Initial values for nested RECORD / RECORD_ARRAY (stable empty to avoid loops) ─
  getRawInitialValue(attributeName: string, index?: number): RawInitialValue[] {
    const source = this.initialValues() ?? EMPTY_INITIAL_VALUES;
    const raw = source.find((val) => val.attributeName === attributeName)?.value;
    if (index !== undefined && Array.isArray(raw)) {
      const item = raw[index]?.attributes ?? EMPTY_INITIAL_VALUES;
      return Array.isArray(item) ? item : EMPTY_INITIAL_VALUES;
    }
    if (this.isRecordValue(raw) && Array.isArray(raw["attributes"])) {
      return raw["attributes"];
    }
    if (raw !== undefined && raw !== null && Array.isArray(raw)) {
      return raw;
    }
    return EMPTY_INITIAL_VALUES;
  }
}

// ─── Exported types (used by attribute-data-service and parent components) ───────────
export interface RawInitialValue {
  attributeName: string;
  value: unknown;
  __typename?: string;
}

/** Stable empty array to avoid new [] references that would retrigger effects (infinite loop). */
const EMPTY_INITIAL_VALUES: RawInitialValue[] = [];

export interface RtEntityValuesResponse {
  initial: RawInitialValue[];
}
