import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogRef, DialogService, DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  plusIcon,
  trashIcon,
  pencilIcon,
  checkIcon,
  xIcon,
  gridLayoutIcon,
  downloadIcon,
  uploadIcon
} from '@progress/kendo-svg-icons';
import { AssetRepoService, JobManagementService, TENANT_ID_PROVIDER, TenantIdProvider } from '@meshmakers/octo-services';
import { ImportStrategyDialogService } from '@meshmakers/shared-ui';
import { firstValueFrom } from 'rxjs';

import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { PersistedMeshBoard } from '../../services/meshboard-persistence.service';

/**
 * Dialog for managing multiple MeshBoards.
 * Provides actions to switch, create, rename, and delete MeshBoards.
 */
@Component({
  selector: 'mm-meshboard-manager-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputsModule,
    SVGIconModule
  ],
  templateUrl: './meshboard-manager-dialog.component.html',
  styleUrl: './meshboard-manager-dialog.component.scss'
})
export class MeshBoardManagerDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly dialogService = inject(DialogService);
  private readonly assetRepoService = inject(AssetRepoService);
  private readonly jobManagementService = inject(JobManagementService);
  private readonly importStrategyDialogService = inject(ImportStrategyDialogService);

  // Try to get provider from DI first
  private readonly injectedTenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });

  // Property that can be set by parent when opening dialog dynamically
  public externalTenantIdProvider: TenantIdProvider | null = null;

  // Dashboard CK Type ID for export
  private readonly DASHBOARD_CK_TYPE_ID = 'System.UI/Dashboard';

  // Separator used in description to encode variables (same as in persistence service)
  private readonly VARIABLES_SEPARATOR = '\n---MESHBOARD_VARIABLES---\n';

  /**
   * Gets the tenant ID provider from either external property or DI.
   */
  private get tenantIdProvider(): TenantIdProvider | null {
    return this.externalTenantIdProvider ?? this.injectedTenantIdProvider;
  }

  // Icons
  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly pencilIcon = pencilIcon;
  protected readonly checkIcon = checkIcon;
  protected readonly xIcon = xIcon;
  protected readonly gridLayoutIcon = gridLayoutIcon;
  protected readonly downloadIcon = downloadIcon;
  protected readonly uploadIcon = uploadIcon;

  // Export/Import state
  protected readonly isExporting = signal(false);
  protected readonly isImporting = signal(false);

  // State - use computed to ensure reactivity
  protected readonly meshBoards = computed(() => this.stateService.availableMeshBoards());
  protected readonly currentMeshBoardId = computed(() => this.stateService.persistedMeshBoardId());
  protected readonly isLoading = signal(false);

  // Editing state
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly editingDescription = signal('');

  // Create new state
  protected readonly isCreating = signal(false);
  protected readonly newName = signal('');
  protected readonly newDescription = signal('');

  // Computed
  protected readonly hasMeshBoards = computed(() => this.meshBoards().length > 0);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  /**
   * Refreshes the list of MeshBoards.
   */
  private async refresh(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.stateService.refreshMeshBoardList();
    } catch (err) {
      console.error('Error refreshing MeshBoard list:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Checks if a MeshBoard is the currently active one.
   */
  isActive(meshBoard: PersistedMeshBoard): boolean {
    return meshBoard.rtId === this.currentMeshBoardId();
  }

  /**
   * Gets the display description for a MeshBoard.
   * Strips the encoded variables/timeFilter JSON from the raw description.
   */
  getDisplayDescription(meshBoard: PersistedMeshBoard): string {
    if (!meshBoard.description) {
      return '';
    }
    if (!meshBoard.description.includes(this.VARIABLES_SEPARATOR)) {
      return meshBoard.description;
    }
    return meshBoard.description.split(this.VARIABLES_SEPARATOR)[0];
  }

  /**
   * Checks if a MeshBoard is being edited.
   */
  isEditing(meshBoard: PersistedMeshBoard): boolean {
    return this.editingId() === meshBoard.rtId;
  }

  /**
   * Switches to a different MeshBoard.
   */
  async switchTo(meshBoard: PersistedMeshBoard): Promise<void> {
    if (this.isActive(meshBoard)) {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.stateService.switchToMeshBoard(meshBoard.rtId);
      this.dialogRef.close();
    } catch (err) {
      console.error('Error switching MeshBoard:', err);
      this.isLoading.set(false);
    }
  }

  /**
   * Starts editing a MeshBoard.
   */
  startEdit(meshBoard: PersistedMeshBoard): void {
    this.editingId.set(meshBoard.rtId);
    this.editingName.set(meshBoard.name);
    // Use decoded description without the encoded variables/timeFilter
    this.editingDescription.set(this.getDisplayDescription(meshBoard));
  }

  /**
   * Cancels editing a MeshBoard.
   */
  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editingDescription.set('');
  }

  /**
   * Saves the edited MeshBoard.
   */
  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id || this.editingName().trim().length === 0) {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.stateService.renameMeshBoard(
        id,
        this.editingName().trim(),
        this.editingDescription().trim()
      );
      this.cancelEdit();
    } catch (err) {
      console.error('Error renaming MeshBoard:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Deletes a MeshBoard after confirmation.
   */
  async delete(meshBoard: PersistedMeshBoard): Promise<void> {
    const confirmed = await this.confirmDelete(meshBoard.name);
    if (!confirmed) {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.stateService.deleteMeshBoard(meshBoard.rtId);
    } catch (err) {
      console.error('Error deleting MeshBoard:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Shows a confirmation dialog before deleting.
   */
  private async confirmDelete(meshBoardName: string): Promise<boolean> {
    const dialogRef = this.dialogService.open({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete "${meshBoardName}"? This action cannot be undone.`,
      actions: [
        { text: 'Cancel', fillMode: 'flat' },
        { text: 'Delete', themeColor: 'error', primary: true }
      ],
      width: 450
    });

    try {
      const result = await firstValueFrom(dialogRef.result);
      return result && typeof result === 'object' && 'text' in result && result.text === 'Delete';
    } catch {
      // Dialog was closed without action
      return false;
    }
  }

  /**
   * Starts creating a new MeshBoard.
   */
  startCreate(): void {
    this.isCreating.set(true);
    this.newName.set('');
    this.newDescription.set('');
  }

  /**
   * Cancels creating a new MeshBoard.
   */
  cancelCreate(): void {
    this.isCreating.set(false);
    this.newName.set('');
    this.newDescription.set('');
  }

  /**
   * Creates a new MeshBoard.
   */
  async create(): Promise<void> {
    if (this.newName().trim().length === 0) {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.stateService.createNewMeshBoard(
        this.newName().trim(),
        this.newDescription().trim()
      );
      this.cancelCreate();
      // Close dialog and show the new MeshBoard
      this.dialogRef.close();
    } catch (err) {
      console.error('Error creating MeshBoard:', err);
      this.isLoading.set(false);
    }
  }

  /**
   * Closes the dialog.
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Checks if export is available (requires tenant provider).
   */
  get canExport(): boolean {
    return this.tenantIdProvider !== null;
  }

  /**
   * Exports a MeshBoard as a deep graph.
   */
  async exportMeshBoard(meshBoard: PersistedMeshBoard, event: Event): Promise<void> {
    event.stopPropagation();

    if (!this.tenantIdProvider) {
      console.error('Export not available: MESHBOARD_TENANT_ID_PROVIDER not configured');
      return;
    }

    const tenantId = await this.tenantIdProvider();
    if (!tenantId) {
      console.error('Export failed: Could not get tenant ID');
      return;
    }

    this.isExporting.set(true);
    try {
      // Start the export job
      const jobId = await this.assetRepoService.exportRtModelDeepGraph(
        tenantId,
        [meshBoard.rtId],
        this.DASHBOARD_CK_TYPE_ID
      );

      if (!jobId) {
        throw new Error('Failed to start export job');
      }

      // Wait for job to complete with progress dialog
      const success = await this.jobManagementService.waitForJob(
        jobId,
        'Export MeshBoard',
        `Exporting "${meshBoard.name}"`
      );

      if (success) {
        // Download the result
        const fileName = `${meshBoard.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.zip`;
        await this.jobManagementService.downloadJobResult(tenantId, jobId, fileName);
      }
    } catch (err) {
      console.error('Error exporting MeshBoard:', err);
    } finally {
      this.isExporting.set(false);
    }
  }

  /**
   * Triggers the file input for importing a MeshBoard.
   */
  triggerImport(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.zip';
    fileInput.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        await this.importMeshBoard(file);
      }
    };
    fileInput.click();
  }

  /**
   * Imports a MeshBoard from a ZIP file.
   */
  async importMeshBoard(file: File): Promise<void> {
    if (!this.tenantIdProvider) {
      console.error('Import not available: MESHBOARD_TENANT_ID_PROVIDER not configured');
      return;
    }

    const tenantId = await this.tenantIdProvider();
    if (!tenantId) {
      console.error('Import failed: Could not get tenant ID');
      return;
    }

    const strategy = await this.importStrategyDialogService.showImportStrategyDialog('Import MeshBoard');
    if (strategy === null) return;

    this.isImporting.set(true);
    try {
      // Start the import job
      const jobId = await this.assetRepoService.importRtModel(tenantId, file, strategy);

      if (!jobId) {
        throw new Error('Failed to start import job');
      }

      // Wait for job to complete with progress dialog
      const success = await this.jobManagementService.waitForJob(
        jobId,
        'Import MeshBoard',
        `Importing "${file.name}"`
      );

      if (success) {
        // Refresh the list to show the imported MeshBoard
        await this.refresh();
      }
    } catch (err) {
      console.error('Error importing MeshBoard:', err);
    } finally {
      this.isImporting.set(false);
    }
  }
}
