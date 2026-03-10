import {inject, Injectable} from '@angular/core';
import {CanDeactivate} from '@angular/router';
import {HasUnsavedChanges} from './unsaved-changes.interface';
import {ConfirmationService} from '../services/confirmation.service';
import {ButtonTypes, ConfirmationButtonLabels} from '../models/confirmation';

/**
 * Guard that prevents navigation when a component has unsaved changes.
 * The component must implement the HasUnsavedChanges interface.
 *
 * Usage in routes:
 * ```typescript
 * {
 *   path: 'edit/:id',
 *   component: MyEditorComponent,
 *   canDeactivate: [UnsavedChangesGuard]
 * }
 * ```
 *
 * The component must implement HasUnsavedChanges:
 * ```typescript
 * export class MyEditorComponent implements HasUnsavedChanges {
 *   hasUnsavedChanges(): boolean {
 *     return this.form.dirty;
 *   }
 *
 *   async saveChanges(): Promise<boolean> {
 *     // Save logic here
 *     return true;
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class UnsavedChangesGuard implements CanDeactivate<HasUnsavedChanges> {
  private readonly confirmationService = inject(ConfirmationService);

  async canDeactivate(component: HasUnsavedChanges): Promise<boolean> {
    // If component doesn't implement the interface or has no changes, allow navigation
    if (!component || typeof component.hasUnsavedChanges !== 'function') {
      return true;
    }

    if (!component.hasUnsavedChanges()) {
      return true;
    }

    // Get optional translated messages from the component
    const msgs = typeof component.unsavedChangesMessages === 'function'
      ? component.unsavedChangesMessages()
      : undefined;
    const title = msgs?.title ?? 'Unsaved Changes';
    const buttonLabels: ConfirmationButtonLabels | undefined = (msgs?.yesButton || msgs?.noButton || msgs?.cancelButton)
      ? { yes: msgs?.yesButton, no: msgs?.noButton, cancel: msgs?.cancelButton }
      : undefined;

    // Component has unsaved changes - ask user what to do
    if (typeof component.saveChanges === 'function') {
      // Component supports saving - show Yes/No/Cancel dialog
      const message = msgs?.savePrompt ?? 'You have unsaved changes. Do you want to save before leaving?';
      const result = await this.confirmationService.showYesNoCancelConfirmationDialog(title, message, buttonLabels);

      if (result === undefined) {
        // Dialog was closed without selection - cancel navigation
        return false;
      }

      switch (result.result) {
        case ButtonTypes.Yes: {
          // Try to save
          const saved = await component.saveChanges();
          return saved; // Allow navigation only if save succeeded
        }

        case ButtonTypes.No:
          // Discard changes and navigate
          return true;

        case ButtonTypes.Cancel:
          // Cancel navigation
          return false;

        default:
          return false;
      }
    } else {
      // Component doesn't support saving - show simple Yes/No dialog
      const message = msgs?.discardPrompt ?? 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.';
      const confirmed = await this.confirmationService.showYesNoConfirmationDialog(title, message, undefined, buttonLabels);

      return confirmed;
    }
  }
}
