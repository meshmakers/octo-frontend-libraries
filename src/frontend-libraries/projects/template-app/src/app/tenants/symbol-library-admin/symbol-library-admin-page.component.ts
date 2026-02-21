import { Component, ViewChild } from '@angular/core';
import { SymbolLibraryAdminComponent } from '@meshmakers/octo-process-diagrams';
import { HasUnsavedChanges } from '@meshmakers/shared-ui';

/**
 * Symbol Library Admin Page Component
 *
 * Full-page wrapper for the SymbolLibraryAdminComponent.
 * Provides symbol library and symbol definition management.
 * Implements HasUnsavedChanges to protect against accidental navigation.
 */
@Component({
  selector: 'app-symbol-library-admin-page',
  standalone: true,
  imports: [SymbolLibraryAdminComponent],
  template: `
    <div class="admin-page">
      <mm-symbol-library-admin #symbolAdmin></mm-symbol-library-admin>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .admin-page {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
  `]
})
export class SymbolLibraryAdminPageComponent implements HasUnsavedChanges {
  @ViewChild('symbolAdmin') symbolAdmin?: SymbolLibraryAdminComponent;

  hasUnsavedChanges(): boolean {
    return this.symbolAdmin?.hasUnsavedChanges() ?? false;
  }

  async saveChanges(): Promise<boolean> {
    if (!this.symbolAdmin) {
      return true;
    }
    return this.symbolAdmin.saveChangesAsync();
  }
}
