import { InjectionToken } from '@angular/core';

/**
 * Messages for the unsaved changes confirmation dialog.
 * All properties are optional — English defaults are used for any missing values.
 */
export interface UnsavedChangesMessages {
  /** Dialog title (default: "Unsaved Changes") */
  title?: string;
  /** Message when component supports saving (default: "You have unsaved changes. Do you want to save before leaving?") */
  savePrompt?: string;
  /** Message when component does not support saving (default: "You have unsaved changes. Are you sure you want to leave? Your changes will be lost.") */
  discardPrompt?: string;
  /** Label for the "Yes" button (default: "Yes") */
  yesButton?: string;
  /** Label for the "No" button (default: "No") */
  noButton?: string;
  /** Label for the "Cancel" button (default: "Cancel") */
  cancelButton?: string;
}

/**
 * Interface for components that track unsaved changes.
 * Implement this interface in components that need to warn users before navigating away
 * when there are unsaved changes.
 */
export interface HasUnsavedChanges {
  /**
   * Returns true if the component has unsaved changes.
   */
  hasUnsavedChanges(): boolean;

  /**
   * Optional method to save changes before navigating away.
   * If implemented, the guard will offer a "Save" option in the confirmation dialog.
   * @returns Promise resolving to true if save was successful, false otherwise.
   */
  saveChanges?(): Promise<boolean>;

  /**
   * Optional translated messages for the confirmation dialog.
   * If not provided, English defaults are used.
   */
  unsavedChangesMessages?(): UnsavedChangesMessages;
}

/**
 * Injection token for components implementing HasUnsavedChanges.
 *
 * Components should provide themselves using this token:
 * ```typescript
 * @Component({
 *   providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: MyComponent }]
 * })
 * export class MyComponent implements HasUnsavedChanges { ... }
 * ```
 */
export const HAS_UNSAVED_CHANGES = new InjectionToken<HasUnsavedChanges>('HAS_UNSAVED_CHANGES');
