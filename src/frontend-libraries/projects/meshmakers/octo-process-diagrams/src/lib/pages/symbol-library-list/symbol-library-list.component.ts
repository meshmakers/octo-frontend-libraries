import { Component, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ConfirmationService, InputService, ListViewComponent, MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import { CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import { SymbolLibraryService, SymbolLibrarySummary } from '../../services/symbol-library.service';
import { SymbolLibraryDataSourceDirective } from '../data-sources/symbol-library-data-source.directive';

/**
 * Symbol Library List Page Component.
 * Displays a list of available symbol libraries with CRUD operations.
 *
 * This component uses relative navigation, so it can be used in any app
 * by defining appropriate routes.
 *
 * Expected route structure:
 * - Current: Symbol library list
 * - :libraryId: Navigate to library detail
 */
@Component({
  selector: 'mm-symbol-library-list',
  standalone: true,
  imports: [
    SymbolLibraryDataSourceDirective,
    ListViewComponent
  ],
  templateUrl: './symbol-library-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './symbol-library-list.component.scss'
})
export class SymbolLibraryListComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly inputService = inject(InputService);
  private readonly symbolLibraryService = inject(SymbolLibraryService);

  protected readonly plusIcon = MM_ACTION_ICONS.add;
  protected readonly editIcon = MM_ACTION_ICONS.edit;
  protected readonly deleteIcon = MM_ACTION_ICONS.delete;
  protected readonly viewIcon = MM_ACTION_ICONS.view;

  @ViewChild('dir', { static: false }) dataSource!: SymbolLibraryDataSourceDirective;

  protected onRowClick(event: unknown): void {
    const library = event as SymbolLibrarySummary;
    if (library?.rtId) {
      // Use relative navigation
      this.router.navigate([library.rtId], { relativeTo: this.route });
    }
  }

  protected onViewClick = async (eventArgs: CommandItemExecuteEventArgs): Promise<void> => {
    const library = eventArgs.data as SymbolLibrarySummary;
    if (library?.rtId) {
      // Use relative navigation
      await this.router.navigate([library.rtId], { relativeTo: this.route });
    }
  }

  protected onNewLibrary = async (): Promise<void> => {
    const name = await this.inputService.showInputDialog(
      'New Symbol Library',
      'Enter the name for the new symbol library:',
      'Library name',
      'Create'
    );

    if (!name || name.trim().length === 0) {
      return;
    }

    try {
      const library = await this.symbolLibraryService.createLibrary({
        name: name.trim(),
        version: '1.0.0',
        isBuiltIn: false,
        isReadOnly: false
      });

      this.notificationService.show({
        content: `Library "${library.name}" created successfully`,
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'success', icon: true }
      });

      // Refresh the list
      this.dataSource.refresh();

      // Navigate to the new library using relative navigation
      if (library.id) {
        await this.router.navigate([library.id], { relativeTo: this.route });
      }
    } catch (error) {
      console.error('Error creating library:', error);
      this.notificationService.show({
        content: 'Failed to create library',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    }
  }

  protected onDeleteClick = async (eventArgs: CommandItemExecuteEventArgs): Promise<void> => {
    const itemsToDelete: SymbolLibrarySummary[] = eventArgs.data instanceof Array ? eventArgs.data : [eventArgs.data];

    if (itemsToDelete.length === 0) return;

    // Check for read-only libraries
    const readOnlyItems = itemsToDelete.filter(item => item.isReadOnly);
    if (readOnlyItems.length > 0) {
      this.notificationService.show({
        content: 'Cannot delete read-only libraries',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'warning', icon: true }
      });
      return;
    }

    const single = itemsToDelete.length === 1;
    const targetName = single
      ? (itemsToDelete[0].name || itemsToDelete[0].rtId)
      : `${itemsToDelete.length} symbol libraries`;

    // AB#5580: danger confirmation naming the target (Studio action guideline §2.4).
    const confirmed = await this.confirmationService.showDangerConfirm({
      title: single ? `Delete symbol library ${targetName}?` : `Delete ${targetName}?`,
      targetName,
      consequence: single
        ? 'The library and all its symbols are deleted. Diagrams using them lose these symbols. This cannot be undone.'
        : 'The libraries and all their symbols are deleted. Diagrams using them lose these symbols. This cannot be undone.',
      confirmText: single ? 'Delete symbol library' : 'Delete symbol libraries',
    });

    if (confirmed) {
      try {
        // TODO: Implement delete via SymbolLibraryService
        this.notificationService.show({
          content: 'Delete library functionality coming soon',
          hideAfter: 3000,
          position: { horizontal: 'right', vertical: 'top' },
          animation: { type: 'fade', duration: 400 },
          type: { style: 'info', icon: true }
        });
      } catch (error) {
        console.error('Error deleting library:', error);
        this.notificationService.show({
          content: 'Failed to delete library',
          hideAfter: 3000,
          position: { horizontal: 'right', vertical: 'top' },
          animation: { type: 'fade', duration: 400 },
          type: { style: 'error', icon: true }
        });
      }
    }
  }
}
