import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AbstractControl, ReactiveFormsModule } from "@angular/forms";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { arrowRotateCcwIcon, SVGIcon } from "@progress/kendo-svg-icons";
import { Attribute } from "../../models/attribute";

/**
 * Wraps a single form control with label, optional UNDO button, and error message.
 * Used by attributes-group for every scalar/geo/binary field. Baseline value for UNDO comes from parent.
 */
@Component({
  selector: "mm-attribute-field",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KENDO_LABEL, KENDO_BUTTONS],
  template: `
    <div class="k-form-field">
      <kendo-label
        [for]="fieldId()"
        [text]="overrideLabelText() || attribute().attributeName"
        [optional]="attribute().isOptional"
      ></kendo-label>

      <div class="k-form-field-wrap">
        <div class="field-input-container">
          <div class="input-wrapper">
            <ng-content></ng-content>
          </div>

          @if (showUndoButton()) {
            <button
              kendoButton
              [size]="undoButtonSize()"
              [svgIcon]="undoIcon"
              (click)="handleUndo()"
              type="button"
              class="undo-button"
            ></button>
          }
        </div>

        @if (hasHint()) {
          <div class="k-form-hint">{{ hintText() }}</div>
        }

        @if (hasError()) {
          <div class="k-form-error">{{ errorMessage() }}</div>
        }
      </div>
    </div>
  `,
  styleUrls: ["./attribute-field.component.scss"],
})
export class AttributeFieldComponent {
  // ─── Required inputs (from parent attributes-group) ───────────────────────────────
  attribute = input.required<Attribute>();
  control = input.required<AbstractControl>();

  // ─── Optional inputs (display & behaviour) ──────────────────────────────────────────
  /** Value to restore on UNDO. If not set, UNDO resets to null. */
  baselineValue = input<any>();
  fieldId = input<string>("");
  overrideLabelText = input<string>();
  showUndoButton = input(true);
  undoButtonSize = input<"small" | "medium" | "large">("medium");
  errorMessage = input<string>("This field is required or invalid.");
  hintText = input<string>();

  undo = output<void>();
  protected readonly undoIcon: SVGIcon = arrowRotateCcwIcon;

  // ─── Template helpers (null-safe for control) ──────────────────────────────────────
  hasError(): boolean {
    const ctrl = this.control();
    if (ctrl == null) return false;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  handleUndo(): void {
    const ctrl = this.control();
    if (ctrl == null) return;
    const baseline = this.baselineValue();
    ctrl.reset(baseline !== undefined ? baseline : null);
    this.undo.emit();
  }

  hasHint(): boolean {
    return this.hintText() != null && this.hintText() !== "";
  }
}
