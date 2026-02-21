import { Injectable, signal, computed } from '@angular/core';

/**
 * Service that manages edit mode state and snapshot/restore functionality.
 * Provides a clean abstraction for entering/exiting edit mode with undo capability.
 */
@Injectable({
  providedIn: 'root'
})
export class EditModeStateService {
  // Reactive signals for state
  private readonly _isEditMode = signal(false);
  private readonly _isSaving = signal(false);
  private snapshot: string | null = null;

  // Public computed signals
  readonly isEditMode = computed(() => this._isEditMode());
  readonly isSaving = computed(() => this._isSaving());

  /**
   * Enters edit mode and creates a snapshot of the provided data.
   * @param data The data to snapshot for potential restoration
   */
  enterEditMode<T>(data: T): void {
    if (!this._isEditMode()) {
      this.snapshot = JSON.stringify(data);
      this._isEditMode.set(true);
    }
  }

  /**
   * Toggles edit mode. When entering, creates a snapshot of the provided data.
   * @param data The data to snapshot when entering edit mode
   * @returns true if now in edit mode, false if exited
   */
  toggleEditMode<T>(data: T): boolean {
    if (this._isEditMode()) {
      // Just exit without restoring - use cancelEdit for that
      this._isEditMode.set(false);
      this.snapshot = null;
      return false;
    } else {
      this.enterEditMode(data);
      return true;
    }
  }

  /**
   * Cancels edit mode and restores the original data from the snapshot.
   * @returns The restored data, or null if no snapshot exists
   */
  cancelEdit<T>(): T | null {
    if (this.snapshot) {
      const restored = JSON.parse(this.snapshot) as T;
      this.snapshot = null;
      this._isEditMode.set(false);
      return restored;
    }
    this._isEditMode.set(false);
    return null;
  }

  /**
   * Begins a save operation.
   */
  beginSave(): void {
    this._isSaving.set(true);
  }

  /**
   * Completes a save operation successfully, clearing the snapshot and exiting edit mode.
   */
  completeSave(): void {
    this._isSaving.set(false);
    this._isEditMode.set(false);
    this.snapshot = null;
  }

  /**
   * Handles a failed save operation, staying in edit mode.
   */
  failSave(): void {
    this._isSaving.set(false);
    // Stay in edit mode so user can retry or cancel
  }

  /**
   * Checks if there are unsaved changes (snapshot exists).
   */
  hasUnsavedChanges(): boolean {
    return this.snapshot !== null;
  }

  /**
   * Gets the current snapshot without modifying state.
   * Useful for comparing current state with original.
   */
  getSnapshot<T>(): T | null {
    return this.snapshot ? JSON.parse(this.snapshot) as T : null;
  }

  /**
   * Updates the snapshot with new data while staying in edit mode.
   * Useful when you want to update the "base" state during editing.
   */
  updateSnapshot<T>(data: T): void {
    if (this._isEditMode()) {
      this.snapshot = JSON.stringify(data);
    }
  }

  /**
   * Resets all state (useful for cleanup).
   */
  reset(): void {
    this._isEditMode.set(false);
    this._isSaving.set(false);
    this.snapshot = null;
  }
}
