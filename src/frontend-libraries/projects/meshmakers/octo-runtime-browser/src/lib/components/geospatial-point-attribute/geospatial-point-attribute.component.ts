import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { KENDO_LAYOUT } from "@progress/kendo-angular-layout";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { arrowRotateCcwIcon, SVGIcon } from "@progress/kendo-svg-icons";
import { AttributeField } from "../../models/attribute-field";

/**
 * Component for rendering GEOSPATIAL_POINT attribute type.
 * Displays longitude and latitude inputs within an expansion panel.
 */
@Component({
  selector: "mm-geospatial-point-attribute",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KENDO_LAYOUT,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
  ],
  template: `
    <kendo-expansionpanel #panel [title]="attribute.attributeName">
      <ng-template kendoExpansionPanelTitleDirective>
        <div class="header-content">
          <kendo-label
            [text]="attribute.attributeName"
            [optional]="attribute.isOptional"
          ></kendo-label>
        </div>
      </ng-template>

      <div class="geospatial-point-content">
        <div class="k-form-field">
          <kendo-label
            [for]="'longitude_' + attribute.attributeName"
            text="Longitude (X)"
          ></kendo-label>
          <div class="field-input-container">
            <kendo-numerictextbox
              [id]="'longitude_' + attribute.attributeName"
              [formControl]="longitudeControl"
              [format]="'n6'"
              [step]="0.000001"
              [min]="-180"
              [max]="180"
            >
            </kendo-numerictextbox>
            <button
              kendoButton
              size="small"
              [svgIcon]="undoIcon"
              (click)="onUndo('longitude')"
              title="Reset to initial value"
              type="button"
            ></button>
          </div>
          @if (
            longitudeControl.invalid &&
            (longitudeControl.dirty || longitudeControl.touched)
          ) {
            <div class="k-form-error">
              Longitude is either missing or it's value exceeds -180 or 180
              degrees
            </div>
          }
        </div>

        <div class="k-form-field">
          <kendo-label
            [for]="'latitude_' + attribute.attributeName"
            text="Latitude (Y)"
          ></kendo-label>
          <div class="field-input-container">
            <kendo-numerictextbox
              [id]="'latitude_' + attribute.attributeName"
              [formControl]="latitudeControl"
              [format]="'n6'"
              [step]="0.000001"
              [min]="-90"
              [max]="90"
            >
            </kendo-numerictextbox>
            <button
              kendoButton
              size="small"
              [svgIcon]="undoIcon"
              (click)="onUndo('latitude')"
              title="Reset to initial value"
              type="button"
            ></button>
          </div>
          @if (
            latitudeControl.invalid &&
            (latitudeControl.dirty || latitudeControl.touched)
          ) {
            <div class="k-form-error">
              Latitude is either missing or it's value exceeds -90 or 90 degrees
            </div>
          }
        </div>
      </div>
    </kendo-expansionpanel>
  `,
  styleUrls: ["./geospatial-point-attribute.component.scss"],
})
export class GeospatialPointAttributeComponent {
  @Input() attribute!: AttributeField;

  protected readonly undoIcon: SVGIcon = arrowRotateCcwIcon;

  /**
   * Gets the FormGroup control for geospatial point.
   */
  get formGroup(): FormGroup {
    return this.attribute.control as FormGroup;
  }

  /**
   * Gets the longitude FormControl.
   */
  get longitudeControl(): FormControl {
    return this.formGroup.get("longitude") as FormControl;
  }

  /**
   * Gets the latitude FormControl.
   */
  get latitudeControl(): FormControl {
    return this.formGroup.get("latitude") as FormControl;
  }

  /**
   * Handles undo action for the entire geospatial point.
   */
  onUndo(attributeName: string): void {
    this.formGroup.get(attributeName)?.reset();
  }
}
