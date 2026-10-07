import { Component, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ConfirmationService, InputService, ListViewComponent, MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import { CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import { ProcessDiagramDataService, ProcessDiagramSummary } from '../../services/process-diagram-data.service';
import { ProcessDiagramDataSourceDirective } from '../data-sources/process-diagram-data-source.directive';

/**
 * Process Diagram List Page Component.
 * Displays a list of available process diagrams with CRUD operations.
 *
 * This component uses relative navigation, so it can be used in any app
 * by defining appropriate routes.
 *
 * Expected route structure:
 * - Current: Process diagram list
 * - :diagramRtId: Navigate to diagram editor
 */
@Component({
  selector: 'mm-process-diagram-list',
  standalone: true,
  imports: [
    ProcessDiagramDataSourceDirective,
    ListViewComponent
  ],
  templateUrl: './process-diagram-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./process-diagram-list.component.scss']
})
export class ProcessDiagramListComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly inputService = inject(InputService);
  private readonly dataService = inject(ProcessDiagramDataService);

  protected readonly plusIcon = MM_ACTION_ICONS.add;
  protected readonly editIcon = MM_ACTION_ICONS.edit;
  protected readonly deleteIcon = MM_ACTION_ICONS.delete;

  @ViewChild('dir', { static: false }) dataSource!: ProcessDiagramDataSourceDirective;

  protected onRowClick(event: unknown): void {
    const diagram = event as ProcessDiagramSummary;
    if (diagram?.rtId) {
      // Use relative navigation
      this.router.navigate([diagram.rtId], { relativeTo: this.route });
    }
  }

  protected onEditClick = async (eventArgs: CommandItemExecuteEventArgs): Promise<void> => {
    const diagram = eventArgs.data as ProcessDiagramSummary;
    if (diagram?.rtId) {
      // Use relative navigation
      await this.router.navigate([diagram.rtId], { relativeTo: this.route });
    }
  }

  protected onNewDiagram = async (): Promise<void> => {
    const name = await this.inputService.showInputDialog(
      'New Process Diagram',
      'Enter the name for the new diagram:',
      'Diagram name',
      'Create'
    );

    if (!name || name.trim().length === 0) {
      return;
    }

    try {
      const diagram = await this.dataService.createDiagram({
        id: '',
        name: name.trim(),
        version: '1.0',
        canvas: {
          width: 1200,
          height: 800,
          backgroundColor: '#fafafa'
        },
        elements: [],
        connections: []
      });

      this.notificationService.show({
        content: `Diagram "${diagram.name}" created successfully`,
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'success', icon: true }
      });

      // Refresh the list
      this.dataSource.refresh();

      // Navigate to the new diagram using relative navigation
      if (diagram.id) {
        await this.router.navigate([diagram.id], { relativeTo: this.route });
      }
    } catch (error) {
      console.error('Error creating diagram:', error);
      this.notificationService.show({
        content: 'Failed to create diagram',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    }
  }

  protected onDeleteClick = async (eventArgs: CommandItemExecuteEventArgs): Promise<void> => {
    const itemsToDelete: ProcessDiagramSummary[] = eventArgs.data instanceof Array ? eventArgs.data : [eventArgs.data];

    if (itemsToDelete.length === 0) return;

    const single = itemsToDelete.length === 1;
    const targetName = single
      ? (itemsToDelete[0].name || itemsToDelete[0].rtId)
      : `${itemsToDelete.length} process diagrams`;

    // AB#5580: danger confirmation naming the target (Studio action guideline §2.4).
    const confirmed = await this.confirmationService.showDangerConfirm({
      title: single ? `Delete process diagram ${targetName}?` : `Delete ${targetName}?`,
      targetName,
      consequence: single
        ? 'The diagram and its layout are deleted. This cannot be undone.'
        : 'The diagrams and their layouts are deleted. This cannot be undone.',
      confirmText: single ? 'Delete process diagram' : 'Delete process diagrams',
    });

    if (confirmed) {
      try {
        for (const item of itemsToDelete) {
          await this.dataService.deleteDiagram(item.rtId);
        }

        this.notificationService.show({
          content: itemsToDelete.length === 1
            ? 'Diagram deleted successfully'
            : `${itemsToDelete.length} diagrams deleted successfully`,
          hideAfter: 3000,
          position: { horizontal: 'right', vertical: 'top' },
          animation: { type: 'fade', duration: 400 },
          type: { style: 'success', icon: true }
        });

        // Refresh the list
        this.dataSource.refresh();
      } catch (error) {
        console.error('Error deleting diagram:', error);
        this.notificationService.show({
          content: 'Failed to delete diagram',
          hideAfter: 3000,
          position: { horizontal: 'right', vertical: 'top' },
          animation: { type: 'fade', duration: 400 },
          type: { style: 'error', icon: true }
        });
      }
    }
  }
}
