import { Directive, HostListener, inject } from '@angular/core';
import { HasUnsavedChanges, HAS_UNSAVED_CHANGES } from './unsaved-changes.interface';

/**
 * Directive that handles browser beforeunload events for components with unsaved changes.
 *
 * This directive should be used together with the UnsavedChangesGuard on routes.
 * While the guard handles in-app navigation, this directive handles browser events
 * like back/forward buttons, refresh, and tab close.
 *
 * Usage:
 * 1. The host component must implement HasUnsavedChanges interface
 * 2. The component must provide itself via the HAS_UNSAVED_CHANGES token
 * 3. Add the directive to the component's hostDirectives
 *
 * ```typescript
 * @Component({
 *   selector: 'my-editor',
 *   hostDirectives: [UnsavedChangesDirective],
 *   providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: MyEditorComponent }],
 *   ...
 * })
 * export class MyEditorComponent implements HasUnsavedChanges {
 *   hasUnsavedChanges(): boolean {
 *     return this.form.dirty;
 *   }
 * }
 * ```
 */
@Directive({
  selector: '[mmUnsavedChanges]',
  standalone: true
})
export class UnsavedChangesDirective {
  private readonly host = inject<HasUnsavedChanges>(HAS_UNSAVED_CHANGES, { optional: true });

  /**
   * Handles browser beforeunload event (back button, refresh, close tab).
   * Shows browser's native confirmation dialog when there are unsaved changes.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hostHasUnsavedChanges()) {
      // Standard way to trigger browser's "Leave site?" dialog
      event.preventDefault();
      // For older browsers
      event.returnValue = '';
    }
  }

  private hostHasUnsavedChanges(): boolean {
    if (this.host && typeof this.host.hasUnsavedChanges === 'function') {
      return this.host.hasUnsavedChanges();
    }
    return false;
  }
}
