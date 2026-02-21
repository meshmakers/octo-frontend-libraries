import { Injectable, signal, computed, Signal } from '@angular/core';
import { Position } from '../../process-widget.models';

/**
 * Designer mode for the editor
 */
export type DesignerMode = 'select' | 'pan' | 'connect';

/**
 * Designer State Service
 *
 * Manages the view state for the Process Designer including:
 * - Editor mode (select, pan, connect)
 * - Zoom level and pan offset
 * - Grid settings (visibility, snap, size)
 * - Change tracking
 *
 * Follows Single Responsibility Principle - only handles view state management.
 *
 * Usage:
 * ```typescript
 * private readonly stateService = inject(DesignerStateService);
 *
 * // Read state
 * const currentZoom = this.stateService.zoom();
 * const isSnapEnabled = this.stateService.snapToGrid();
 *
 * // Update state
 * this.stateService.setZoom(1.5);
 * this.stateService.toggleGrid();
 * ```
 */
@Injectable()
export class DesignerStateService {

  // ============================================================================
  // Private Signals
  // ============================================================================

  private readonly _mode = signal<DesignerMode>('select');
  private readonly _zoom = signal(1);
  private readonly _panOffset = signal<Position>({ x: 0, y: 0 });
  private readonly _showGrid = signal(true);
  private readonly _snapToGrid = signal(true);
  private readonly _gridSize = signal(20);
  private readonly _showElementNames = signal(false);
  private readonly _hasChanges = signal(false);

  // ============================================================================
  // Public Readonly Signals
  // ============================================================================

  /** Current editor mode (select, pan, connect) */
  readonly mode: Signal<DesignerMode> = this._mode.asReadonly();

  /** Current zoom level (1 = 100%) */
  readonly zoom: Signal<number> = this._zoom.asReadonly();

  /** Current pan offset */
  readonly panOffset: Signal<Position> = this._panOffset.asReadonly();

  /** Whether grid is visible */
  readonly showGrid: Signal<boolean> = this._showGrid.asReadonly();

  /** Whether snap to grid is enabled */
  readonly snapToGrid: Signal<boolean> = this._snapToGrid.asReadonly();

  /** Grid size in pixels */
  readonly gridSize: Signal<number> = this._gridSize.asReadonly();

  /** Whether element/primitive/symbol names are visible */
  readonly showElementNames: Signal<boolean> = this._showElementNames.asReadonly();

  /** Whether there are unsaved changes */
  readonly hasChanges: Signal<boolean> = this._hasChanges.asReadonly();

  // ============================================================================
  // Computed Signals
  // ============================================================================

  /** Zoom level as percentage (e.g., 100, 150, 200) */
  readonly zoomPercentage = computed(() => Math.round(this._zoom() * 100));

  /** Cursor style based on current mode */
  readonly canvasCursor = computed(() => {
    switch (this._mode()) {
      case 'pan': return 'grab';
      case 'connect': return 'crosshair';
      default: return 'default';
    }
  });

  // ============================================================================
  // Mode Operations
  // ============================================================================

  /**
   * Set the editor mode
   */
  setMode(mode: DesignerMode): void {
    this._mode.set(mode);
  }

  // ============================================================================
  // Zoom Operations
  // ============================================================================

  /**
   * Set the zoom level directly
   */
  setZoom(zoom: number): void {
    this._zoom.set(Math.max(0.1, Math.min(5, zoom)));
  }

  /**
   * Zoom in by 10%
   */
  zoomIn(): void {
    this._zoom.update(z => Math.min(5, z + 0.1));
  }

  /**
   * Zoom out by 10%
   */
  zoomOut(): void {
    this._zoom.update(z => Math.max(0.1, z - 0.1));
  }

  /**
   * Reset zoom to 100%
   */
  resetZoom(): void {
    this._zoom.set(1);
  }

  // ============================================================================
  // Pan Operations
  // ============================================================================

  /**
   * Set the pan offset
   */
  setPanOffset(offset: Position): void {
    this._panOffset.set(offset);
  }

  /**
   * Update pan offset by delta
   */
  pan(deltaX: number, deltaY: number): void {
    this._panOffset.update(offset => ({
      x: offset.x + deltaX,
      y: offset.y + deltaY
    }));
  }

  /**
   * Reset pan to origin
   */
  resetPan(): void {
    this._panOffset.set({ x: 0, y: 0 });
  }

  // ============================================================================
  // Grid Operations
  // ============================================================================

  /**
   * Toggle grid visibility
   */
  toggleGrid(): void {
    this._showGrid.update(v => !v);
  }

  /**
   * Set grid visibility
   */
  setShowGrid(show: boolean): void {
    this._showGrid.set(show);
  }

  /**
   * Toggle snap to grid
   */
  toggleSnapToGrid(): void {
    this._snapToGrid.update(v => !v);
  }

  /**
   * Set snap to grid
   */
  setSnapToGrid(snap: boolean): void {
    this._snapToGrid.set(snap);
  }

  /**
   * Set grid size (1-100 pixels)
   */
  setGridSize(size: number): void {
    this._gridSize.set(Math.max(1, Math.min(100, size)));
  }

  /**
   * Sync grid settings from external config (e.g., from diagram input)
   */
  syncGridSettings(gridSize?: number, showGrid?: boolean): void {
    if (gridSize !== undefined) {
      this._gridSize.set(gridSize);
    }
    if (showGrid !== undefined) {
      this._showGrid.set(showGrid);
    }
  }

  // ============================================================================
  // Element Names Operations
  // ============================================================================

  /**
   * Toggle element names visibility
   */
  toggleElementNames(): void {
    this._showElementNames.update(v => !v);
  }

  /**
   * Set element names visibility
   */
  setShowElementNames(show: boolean): void {
    this._showElementNames.set(show);
  }

  // ============================================================================
  // Change Tracking
  // ============================================================================

  /**
   * Mark that changes have been made
   */
  markChanged(): void {
    this._hasChanges.set(true);
  }

  /**
   * Clear the changed flag (e.g., after save)
   */
  clearChanges(): void {
    this._hasChanges.set(false);
  }

  /**
   * Set the changed flag directly
   */
  setHasChanges(hasChanges: boolean): void {
    this._hasChanges.set(hasChanges);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Snap a position to the grid if snap is enabled
   */
  snapPosition(position: Position): Position {
    if (!this._snapToGrid()) {
      return position;
    }
    const size = this._gridSize();
    return {
      x: Math.round(position.x / size) * size,
      y: Math.round(position.y / size) * size
    };
  }

  /**
   * Reset all state to defaults
   */
  reset(): void {
    this._mode.set('select');
    this._zoom.set(1);
    this._panOffset.set({ x: 0, y: 0 });
    this._showGrid.set(true);
    this._snapToGrid.set(true);
    this._gridSize.set(20);
    this._showElementNames.set(false);
    this._hasChanges.set(false);
  }
}
