import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { arrowRotateCcwIcon, SVGIcon } from "@progress/kendo-svg-icons";
import { AttributeField } from "../../models/attribute-field";

/**
 * Reusable form field component that wraps label, input, undo button, and error handling.
 * Uses custom structure instead of kendo-formfield to support ng-content projection.
 */
@Component({
  selector: "mm-attribute-form-field",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KENDO_LABEL, KENDO_BUTTONS],
  template: `
    <div class="k-form-field">
      <kendo-label
        [for]="fieldId"
        [text]="attribute.attributeName"
        [optional]="attribute.isOptional"
      ></kendo-label>

      <div class="k-form-field-wrap">
        <div class="field-input-container">
          <div class="input-wrapper">
            <ng-content></ng-content>
          </div>

          @if (showUndoButton) {
            <button
              kendoButton
              [size]="undoButtonSize"
              [svgIcon]="undoIcon"
              (click)="onUndo()"
              title="Reset to initial value"
              type="button"
              class="undo-button"
            ></button>
          }
        </div>

        @if (hintMessage) {
          <div class="k-form-hint">{{ hintMessage }}</div>
        }

        @if (errorMessage && hasError) {
          <div class="k-form-error">{{ errorMessage }}</div>
        }
      </div>
    </div>
  `,
  styleUrls: ["./attribute-form-field.component.scss"],
})
export class AttributeFormFieldComponent {
  @Input() attribute!: AttributeField;
  @Input() fieldId!: string;
  @Input() showUndoButton = true;
  @Input() undoButtonSize: "small" | "medium" | "large" = "small";
  @Input() errorMessage?: string;
  @Input() hintMessage?: string;
  @Input() onUndoClick?: () => void;

  protected readonly undoIcon: SVGIcon = arrowRotateCcwIcon;

  /**
   * Checks if the control has an error and has been touched.
   */
  get hasError(): boolean {
    const ctrl = this.attribute.control;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  /**
   * Handles undo button click.
   */
  onUndo(): void {
    if (this.onUndoClick) {
      this.onUndoClick();
    } else {
      this.attribute.control.reset();
    }
  }

  /**
   * Gets the form control for this attribute.
   */
  get control(): FormControl {
    return this.attribute.control as FormControl;
  }
}
