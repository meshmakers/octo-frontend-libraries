import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIcon, saveIcon, cancelIcon } from '@progress/kendo-svg-icons';
import { HasUnsavedChanges, HAS_UNSAVED_CHANGES } from '../guards/unsaved-changes.interface';
import { UnsavedChangesDirective } from '../guards/unsaved-changes.directive';

// ResponsiveFormBreakPoint type for colSpan responsive behavior
export interface ResponsiveFormBreakPoint {
  maxWidth: number;
  value: number;
}

export interface BaseFormConfig {
  title?: string;
  cardWidth?: string;
  showCard?: boolean;
  saveButtonText?: string;
  cancelButtonText?: string;
  isEditMode?: boolean;
  isViewMode?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  showCancelButton?: boolean;
  showLoadingOverlay?: boolean;
  /**
   * Indicates whether the form has unsaved changes.
   * When true, displays a "Modified" indicator in the header and footer.
   */
  hasChanges?: boolean;
}

// Default responsive breakpoint for 2-column to 1-column
export const DEFAULT_RESPONSIVE_COLSPAN: ResponsiveFormBreakPoint[] = [
  { maxWidth: 768, value: 2 }  // Full width on mobile
];

@Component({
  selector: 'mm-base-form',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule
  ],
  hostDirectives: [UnsavedChangesDirective],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: BaseFormComponent }],
  templateUrl: './base-form.component.html',
  styleUrl: './base-form.component.scss'
})
export class BaseFormComponent implements HasUnsavedChanges {
  @Input() form!: FormGroup;
  @Input() config: BaseFormConfig = {
    showCard: true,
    cardWidth: '800px',
    saveButtonText: 'Save',
    cancelButtonText: 'Cancel',
    showLoadingOverlay: true
  };

  @Output() saveForm = new EventEmitter<void>();
  @Output() cancelForm = new EventEmitter<void>();

  protected readonly saveIcon: SVGIcon = saveIcon;
  protected readonly cancelIcon: SVGIcon = cancelIcon;

  protected get title(): string {
    if (this.config.title) return this.config.title;
    if (this.config.isViewMode) return 'View Details';
    return this.config.isEditMode ? 'Edit' : 'New';
  }

  protected get saveButtonText(): string {
    if (this.config.saveButtonText) return this.config.saveButtonText;
    if (this.config.isSaving) return 'Saving...';
    return this.config.isEditMode ? 'Update' : 'Create';
  }

  protected get cancelButtonText(): string {
    if (this.config.cancelButtonText) return this.config.cancelButtonText;
    return this.config.isViewMode ? 'Back' : 'Cancel';
  }

  protected get showSaveButton(): boolean {
    return !this.config.isViewMode && !this.config.isLoading;
  }

  protected get showCancelButton(): boolean {
    return this.config.showCancelButton !== false;
  }

  protected get saveButtonDisabled(): boolean {
    return !!this.config.isSaving || !!this.config.isLoading;
  }

  protected onSave(): void {
    if (this.form?.valid) {
      this.saveForm.emit();
    } else {
      // Mark all fields as touched to show validation errors
      this.form?.markAllAsTouched();
    }
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }

  // === HasUnsavedChanges interface implementation ===

  /**
   * Checks if there are unsaved changes.
   * Uses config.hasChanges if provided, otherwise falls back to form.dirty.
   */
  hasUnsavedChanges(): boolean {
    // Prefer explicit hasChanges from config if set
    if (this.config.hasChanges !== undefined) {
      return this.config.hasChanges;
    }
    // Fall back to form dirty state
    return this.form?.dirty ?? false;
  }
}
