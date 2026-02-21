import { InjectionToken } from '@angular/core';

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
