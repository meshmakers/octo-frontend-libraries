import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { NotificationService } from '@progress/kendo-angular-notification';
import { HasUnsavedChanges } from '@meshmakers/shared-ui';
import { BreadCrumbService } from '@meshmakers/shared-services';

import {
  ProcessDesignerComponent,
  ProcessDiagramConfig,
  ProcessDiagramDataService
} from '@meshmakers/octo-process-diagrams';

/**
 * Process Designer Page Component
 *
 * Provides a full-page wrapper for the ProcessDesignerComponent with:
 * - Load diagram from route parameter
 * - Save to backend
 * - Breadcrumb integration
 */
@Component({
  selector: 'app-process-designer-page',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    ProcessDesignerComponent
  ],
  providers: [ProcessDiagramDataService],
  template: `
    <div class="designer-page">
      <!-- Designer Component -->
      <div class="designer-wrapper">
        @if (currentDiagram()) {
          <mm-process-designer
            [diagramConfig]="currentDiagram()!"
            [useDockview]="true"
            (saveRequest)="onSave($event)">
          </mm-process-designer>
        } @else if (isLoading()) {
          <div class="loading-state">
            <p>Loading diagram...</p>
          </div>
        } @else {
          <div class="error-state">
            <h2>Diagram Not Found</h2>
            <p>The requested diagram could not be loaded.</p>
            <button kendoButton (click)="navigateToList()" themeColor="primary">
              Back to List
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .designer-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f5f5f5;
    }

    .designer-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: #fafafa;
    }

    .error-state h2 {
      margin: 0 0 0.5rem;
      color: #333;
    }

    .error-state p {
      margin: 0 0 1.5rem;
      color: #666;
    }
  `]
})
export class ProcessDesignerPageComponent implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(ProcessDiagramDataService);
  private readonly notificationService = inject(NotificationService);
  private readonly breadCrumbService = inject(BreadCrumbService);

  @ViewChild(ProcessDesignerComponent) designerComponent?: ProcessDesignerComponent;

  readonly currentDiagram = signal<ProcessDiagramConfig | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  // ============================================================================
  // HasUnsavedChanges Implementation
  // ============================================================================

  hasUnsavedChanges(): boolean {
    return this.designerComponent?.hasChanges() ?? false;
  }

  async saveChanges(): Promise<boolean> {
    const diagram = this.currentDiagram();
    if (!diagram) {
      return true;
    }

    try {
      await this.performSave(diagram);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Internal save method that can be awaited
   */
  private async performSave(diagram: ProcessDiagramConfig): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);

    try {
      const savedDiagram = await this.dataService.saveDiagram(diagram, !diagram.id);

      // Update local state
      this.currentDiagram.set(savedDiagram);

      // Reset hasChanges in the designer
      if (this.designerComponent) {
        this.designerComponent.clearChanges();
      }

      this.showNotification('Diagram saved successfully', 'success');
    } finally {
      this.isSaving.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    // Load diagram from route parameter
    const diagramRtId = this.route.snapshot.paramMap.get('diagramRtId');
    if (diagramRtId) {
      await this.loadDiagram(diagramRtId);
    } else {
      this.isLoading.set(false);
    }
  }

  async loadDiagram(rtId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const diagram = await this.dataService.loadDiagram(rtId);
      this.currentDiagram.set(diagram);

      // Update breadcrumb with diagram name
      await this.breadCrumbService.updateBreadcrumbLabels({
        diagramName: diagram.name
      });
    } catch (error) {
      console.error('Error loading diagram:', error);
      this.showNotification('Failed to load diagram', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToList(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  async onSave(diagram: ProcessDiagramConfig): Promise<void> {
    try {
      await this.performSave(diagram);
    } catch (error) {
      console.error('Error saving diagram:', error);
      this.showNotification('Failed to save diagram', 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    this.notificationService.show({
      content: message,
      type: { style: type, icon: true },
      position: { horizontal: 'right', vertical: 'top' },
      animation: { type: 'fade', duration: 400 },
      hideAfter: 3000
    });
  }
}
