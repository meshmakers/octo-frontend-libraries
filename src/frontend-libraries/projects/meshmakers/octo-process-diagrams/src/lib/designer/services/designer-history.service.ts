import { Injectable, signal, computed, Signal } from '@angular/core';

/**
 * History entry with state snapshot
 */
interface HistoryEntry<T> {
  state: T;
  timestamp: number;
}

/**
 * Designer History Service
 *
 * Manages undo/redo history for the Process Designer.
 * Follows Single Responsibility Principle - only handles history/state management.
 *
 * Features:
 * - Configurable history limit (default: 50)
 * - State snapshots with timestamps
 * - Reactive canUndo/canRedo signals
 * - Clear history functionality
 *
 * Usage:
 * ```typescript
 * // Inject the service
 * private readonly historyService = inject(DesignerHistoryService);
 *
 * // Initialize with initial state
 * this.historyService.initialize(initialDiagram);
 *
 * // Push state after changes
 * this.historyService.push(currentDiagram);
 *
 * // Undo/Redo
 * const previousState = this.historyService.undo();
 * const nextState = this.historyService.redo();
 * ```
 */
@Injectable()
export class DesignerHistoryService<T = unknown> {
  /** Maximum number of history entries */
  private readonly maxHistorySize = 50;

  /** History stack */
  private readonly _history = signal<HistoryEntry<T>[]>([]);

  /** Current position in history (-1 = empty, 0 = first entry, etc.) */
  private readonly _currentIndex = signal(-1);

  // ============================================================================
  // Public Signals
  // ============================================================================

  /**
   * Whether undo is available
   */
  readonly canUndo: Signal<boolean> = computed(() => {
    return this._currentIndex() > 0;
  });

  /**
   * Whether redo is available
   */
  readonly canRedo: Signal<boolean> = computed(() => {
    const history = this._history();
    const index = this._currentIndex();
    return index >= 0 && index < history.length - 1;
  });

  /**
   * Current history length
   */
  readonly historyLength: Signal<number> = computed(() => {
    return this._history().length;
  });

  /**
   * Current position in history
   */
  readonly currentIndex: Signal<number> = this._currentIndex.asReadonly();

  // ============================================================================
  // History Operations
  // ============================================================================

  /**
   * Initialize history with an initial state.
   * Clears any existing history.
   */
  initialize(state: T): void {
    const entry: HistoryEntry<T> = {
      state: this.deepClone(state),
      timestamp: Date.now()
    };
    this._history.set([entry]);
    this._currentIndex.set(0);
  }

  /**
   * Push a new state to history.
   * Removes any redo history (states after current position).
   */
  push(state: T): void {
    const currentIndex = this._currentIndex();

    this._history.update(history => {
      // Remove any redo history (entries after current position)
      const newHistory = history.slice(0, currentIndex + 1);

      // Add new entry
      const entry: HistoryEntry<T> = {
        state: this.deepClone(state),
        timestamp: Date.now()
      };
      newHistory.push(entry);

      // Enforce max history size
      if (newHistory.length > this.maxHistorySize) {
        newHistory.shift();
        // Don't need to adjust index here as we'll set it after
      }

      return newHistory;
    });

    // Update index to point to the new entry
    this._currentIndex.set(Math.min(this._history().length - 1, this.maxHistorySize - 1));
  }

  /**
   * Undo: Move back in history and return the previous state.
   * Returns null if undo is not available.
   */
  undo(): T | null {
    if (!this.canUndo()) {
      return null;
    }

    this._currentIndex.update(index => index - 1);

    const history = this._history();
    const newIndex = this._currentIndex();
    return this.deepClone(history[newIndex].state);
  }

  /**
   * Redo: Move forward in history and return the next state.
   * Returns null if redo is not available.
   */
  redo(): T | null {
    if (!this.canRedo()) {
      return null;
    }

    this._currentIndex.update(index => index + 1);

    const history = this._history();
    const newIndex = this._currentIndex();
    return this.deepClone(history[newIndex].state);
  }

  /**
   * Get the current state without modifying history.
   * Returns null if history is empty.
   */
  getCurrentState(): T | null {
    const history = this._history();
    const index = this._currentIndex();

    if (index < 0 || index >= history.length) {
      return null;
    }

    return this.deepClone(history[index].state);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this._history.set([]);
    this._currentIndex.set(-1);
  }

  /**
   * Reset history with a new initial state
   */
  reset(state: T): void {
    this.initialize(state);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Deep clone an object using JSON serialization.
   * This ensures complete isolation between history entries.
   */
  private deepClone(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
