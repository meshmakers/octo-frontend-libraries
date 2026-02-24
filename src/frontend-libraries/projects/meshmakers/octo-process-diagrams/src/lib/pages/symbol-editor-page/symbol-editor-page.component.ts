import { Component, OnInit, inject, signal, computed, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { arrowLeftIcon, saveIcon } from '@progress/kendo-svg-icons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { HAS_UNSAVED_CHANGES, HasUnsavedChanges } from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { SymbolLibraryService } from '../../services/symbol-library.service';
import { SymbolLibrary, SymbolDefinition } from '../../primitives/models/symbol.model';
import { SymbolEditorComponent } from '../../admin/symbol-editor.component';
import { SymbolSettings } from '../../designer';

/**
 * Symbol Editor Page Component.
 * Wraps the SymbolEditorComponent with page chrome (header, save button).
 *
 * This component uses relative navigation, so it can be used in any app
 * by defining appropriate routes.
 *
 * Expected route structure:
 * - Parent: :libraryId (library detail)
 * - Current: :libraryId/:symbolId/edit
 */
@Component({
  selector: 'mm-symbol-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    SVGIconModule,
    SymbolEditorComponent
  ],
  providers: [
    { provide: HAS_UNSAVED_CHANGES, useExisting: SymbolEditorPageComponent }
  ],
  templateUrl: './symbol-editor-page.component.html',
  styleUrl: './symbol-editor-page.component.scss'
})
export class SymbolEditorPageComponent implements OnInit, HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly breadCrumbService = inject(BreadCrumbService);
  private readonly notificationService = inject(NotificationService);
  private readonly symbolLibraryService = inject(SymbolLibraryService);

  @ViewChild(SymbolEditorComponent) private symbolEditor?: SymbolEditorComponent;

  protected readonly backIcon = arrowLeftIcon;
  protected readonly saveIcon = saveIcon;

  protected readonly library = signal<SymbolLibrary | null>(null);
  protected readonly symbol = signal<SymbolDefinition | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  private _hasUnsavedChanges = false;
  private _currentSymbol: SymbolDefinition | null = null;
  /**
   * Flag to track initialization phase.
   * During initialization, we ignore symbolChange events to avoid
   * marking the symbol as dirty when no user edits have occurred.
   */
  private _isInitializing = true;

  /**
   * Computed symbol settings derived from the current symbol.
   * Used to populate the settings panel in the dockview.
   */
  protected readonly symbolSettings = computed<SymbolSettings | null>(() => {
    const sym = this.symbol();
    if (!sym) return null;

    return {
      name: sym.name,
      description: sym.description ?? '',
      version: sym.version ?? '1.0.0',
      category: sym.category ?? '',
      tags: sym.tags?.join(', ') ?? '',
      canvasWidth: sym.canvasSize?.width ?? sym.bounds?.width ?? 400,
      canvasHeight: sym.canvasSize?.height ?? sym.bounds?.height ?? 300,
      gridSize: sym.gridSize ?? 10
    };
  });

  // Implementation of HasUnsavedChanges interface
  hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }

  async ngOnInit(): Promise<void> {
    const libraryId = this.activatedRoute.snapshot.paramMap.get('libraryId');
    const symbolId = this.activatedRoute.snapshot.paramMap.get('symbolId');

    if (libraryId && symbolId) {
      await this.loadSymbol(libraryId, symbolId);
    }
  }

  private async loadSymbol(libraryId: string, symbolId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      // Load library for context (name for breadcrumb)
      const lib = await this.symbolLibraryService.loadLibrary(libraryId);
      this.library.set(lib);

      // Load symbol
      const sym = await this.symbolLibraryService.loadSymbol(symbolId, false);
      this.symbol.set(sym);
      this._currentSymbol = sym;

      // Update breadcrumbs
      await this.breadCrumbService.updateBreadcrumbLabels({
        libraryName: lib.name,
        symbolName: sym.name
      });
    } catch (error) {
      console.error('Error loading symbol:', error);
      this.notificationService.show({
        content: 'Failed to load symbol',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    } finally {
      this.isLoading.set(false);

      // Clear initialization flag after a short delay to allow the ProcessDesigner
      // to fully initialize and emit its initial diagramChange event.
      // This ensures we don't mark the symbol as dirty during startup.
      setTimeout(() => {
        this._isInitializing = false;
      }, 100);
    }
  }

  protected onSymbolChange(updatedSymbol: SymbolDefinition): void {
    // Store the current symbol for saving - don't use signals to avoid feedback loop
    this._currentSymbol = updatedSymbol;

    // Skip marking as dirty during initialization or saving phase.
    // - During initialization: ProcessDesigner emits diagramChange after init
    // - During saving: symbol.set() triggers symbolChange but it's not a user edit
    if (!this._isInitializing && !this.isSaving()) {
      this._hasUnsavedChanges = true;
    }
  }

  protected async onSaveRequest(_symbolToSave: SymbolDefinition): Promise<void> {
    await this.saveSymbol();
  }

  /**
   * Handle symbol settings changes from the settings panel.
   */
  protected onSymbolSettingsChange(event: { key: string; value: unknown }): void {
    if (!this._currentSymbol) return;

    const { key, value } = event;

    switch (key) {
      case 'name':
        this._currentSymbol = { ...this._currentSymbol, name: value as string };
        break;
      case 'description':
        this._currentSymbol = { ...this._currentSymbol, description: value as string };
        break;
      case 'version':
        this._currentSymbol = { ...this._currentSymbol, version: value as string };
        break;
      case 'category':
        this._currentSymbol = { ...this._currentSymbol, category: value as string };
        break;
      case 'tags': {
        // Convert comma-separated string to array
        const tagsString = value as string;
        const tagsArray = tagsString ? tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        this._currentSymbol = { ...this._currentSymbol, tags: tagsArray };
        break;
      }
      case 'canvasWidth':
        this._currentSymbol = {
          ...this._currentSymbol,
          canvasSize: {
            ...(this._currentSymbol.canvasSize ?? { width: 400, height: 300 }),
            width: value as number
          }
        };
        break;
      case 'canvasHeight':
        this._currentSymbol = {
          ...this._currentSymbol,
          canvasSize: {
            ...(this._currentSymbol.canvasSize ?? { width: 400, height: 300 }),
            height: value as number
          }
        };
        break;
      case 'gridSize':
        this._currentSymbol = { ...this._currentSymbol, gridSize: value as number };
        break;
    }

    this._hasUnsavedChanges = true;
    // Update the symbol signal to trigger UI refresh
    this.symbol.set({ ...this._currentSymbol });
  }

  protected async saveSymbol(): Promise<void> {
    const symbolToSave = this._currentSymbol;
    if (!symbolToSave) return;

    this.isSaving.set(true);
    try {
      // Ensure libraryRtId is set
      const libraryId = this.library()?.id;
      if (libraryId && !symbolToSave.libraryRtId) {
        symbolToSave.libraryRtId = libraryId;
      }

      await this.symbolLibraryService.updateSymbol(symbolToSave);

      // Note: We intentionally do NOT call symbol.set() here.
      // Calling symbol.set() triggers Angular change detection, which causes
      // SymbolEditorComponent to emit symbolChange. By the time that event fires,
      // isSaving is already false (from the finally block), so it would
      // incorrectly mark the symbol as having unsaved changes.
      // The template only needs symbol()?.name which doesn't change during save.

      this._hasUnsavedChanges = false;
      // Also clear the ProcessDesigner's hasChanges flag
      this.symbolEditor?.clearChanges();

      this.notificationService.show({
        content: 'Symbol saved successfully',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'success', icon: true }
      });
    } catch (error) {
      console.error('Error saving symbol:', error);
      this.notificationService.show({
        content: 'Failed to save symbol',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  protected navigateBack(): void {
    // Navigate to parent (library detail) using relative navigation
    // From :libraryId/:symbolId/edit, go up two levels to :libraryId
    this.router.navigate(['../..'], { relativeTo: this.activatedRoute });
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this._hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
