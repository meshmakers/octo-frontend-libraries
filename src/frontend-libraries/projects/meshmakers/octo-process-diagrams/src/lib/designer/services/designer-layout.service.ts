import { Injectable } from '@angular/core';
import { SerializedDockview } from 'dockview-core';

/**
 * Configuration for a dockable panel in the Process Designer
 */
export interface DesignerPanelConfig {
  /** Unique panel identifier */
  id: string;
  /** Display title shown in tab header */
  title: string;
  /** Component identifier for dockview */
  component: string;
  /** Whether panel is visible by default */
  visible: boolean;
  /** Floating window configuration (if floating) */
  floating?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Available panel types in the Process Designer
 */
export type DesignerPanelType =
  | 'elements'
  | 'symbols'
  | 'properties'
  | 'transform'
  | 'animations'
  | 'simulation'
  | 'canvas';

/**
 * Service for managing Process Designer dockview layouts.
 *
 * Handles:
 * - Default panel configuration
 * - Layout persistence per user (localStorage)
 * - Layout reset functionality
 *
 * @example
 * ```typescript
 * const layoutService = inject(DesignerLayoutService);
 *
 * // Save current layout
 * const layout = dockviewApi.toJSON();
 * layoutService.saveLayout(layout, userId);
 *
 * // Load saved layout
 * const savedLayout = layoutService.loadLayout(userId);
 * if (savedLayout) {
 *   dockviewApi.fromJSON(savedLayout);
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DesignerLayoutService {
  private readonly LAYOUT_STORAGE_KEY = 'process-designer-layout-v1';
  private readonly SYMBOL_EDITOR_LAYOUT_STORAGE_KEY = 'symbol-editor-layout-v1';

  /**
   * Default panel configuration for the Process Designer
   */
  readonly defaultPanels: DesignerPanelConfig[] = [
    { id: 'elements', title: 'Elements', component: 'elements', visible: true },
    { id: 'symbols', title: 'Symbols', component: 'symbols', visible: true },
    { id: 'properties', title: 'Properties', component: 'properties', visible: true },
    { id: 'transform', title: 'Exposures', component: 'transform', visible: true },
    { id: 'animations', title: 'Animations', component: 'animations', visible: true },
    { id: 'simulation', title: 'Simulation', component: 'simulation', visible: false }
  ];

  /**
   * Default panel configuration for the Symbol Editor
   */
  readonly symbolEditorDefaultPanels: DesignerPanelConfig[] = [
    { id: 'primitives', title: 'Primitives', component: 'elements', visible: true },
    { id: 'properties', title: 'Properties', component: 'properties', visible: true },
    { id: 'animations', title: 'Animations', component: 'animations', visible: true }
  ];

  /**
   * Get the storage key for a specific user and editor mode
   */
  private getStorageKey(userId: string, isSymbolEditor = false): string {
    const baseKey = isSymbolEditor
      ? this.SYMBOL_EDITOR_LAYOUT_STORAGE_KEY
      : this.LAYOUT_STORAGE_KEY;
    return `${baseKey}-${userId}`;
  }

  /**
   * Save the current dockview layout to localStorage
   *
   * @param layout - Serialized dockview layout from api.toJSON()
   * @param userId - User identifier for per-user persistence
   * @param isSymbolEditor - Whether this is the symbol editor layout
   */
  saveLayout(layout: SerializedDockview, userId: string, isSymbolEditor = false): void {
    const key = this.getStorageKey(userId, isSymbolEditor);
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch (error) {
      console.warn('Failed to save layout to localStorage:', error);
    }
  }

  /**
   * Load a saved dockview layout from localStorage
   *
   * @param userId - User identifier
   * @param isSymbolEditor - Whether to load symbol editor layout
   * @returns Saved layout or null if not found/invalid
   */
  loadLayout(userId: string, isSymbolEditor = false): SerializedDockview | null {
    const key = this.getStorageKey(userId, isSymbolEditor);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved) as SerializedDockview;
      }
    } catch (error) {
      console.warn('Failed to load layout from localStorage:', error);
    }
    return null;
  }

  /**
   * Clear saved layout from localStorage
   *
   * @param userId - User identifier
   * @param isSymbolEditor - Whether to clear symbol editor layout
   */
  clearLayout(userId: string, isSymbolEditor = false): void {
    const key = this.getStorageKey(userId, isSymbolEditor);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear layout from localStorage:', error);
    }
  }

  /**
   * Check if a saved layout exists for the user
   *
   * @param userId - User identifier
   * @param isSymbolEditor - Whether to check symbol editor layout
   */
  hasLayout(userId: string, isSymbolEditor = false): boolean {
    const key = this.getStorageKey(userId, isSymbolEditor);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get panel configuration by ID
   *
   * @param panelId - Panel identifier
   * @param isSymbolEditor - Whether to use symbol editor panels
   */
  getPanelConfig(panelId: string, isSymbolEditor = false): DesignerPanelConfig | undefined {
    const panels = isSymbolEditor ? this.symbolEditorDefaultPanels : this.defaultPanels;
    return panels.find(p => p.id === panelId);
  }
}
