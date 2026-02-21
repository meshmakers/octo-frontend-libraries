import { Injectable, signal, computed } from '@angular/core';
import { Position } from '../../process-widget.models';

/**
 * Context menu item definition
 */
export interface ContextMenuItem {
  /** Unique identifier for the action */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (emoji or icon class) */
  icon?: string;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether this is a separator */
  separator?: boolean;
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  /** Whether the menu is visible */
  visible: boolean;
  /** Screen position (for CSS positioning) */
  screenPosition: Position;
  /** Canvas position (for paste operations) */
  canvasPosition: Position | null;
}

/**
 * Selection state for building menu items
 * (Named differently to avoid conflict with SelectionState from designer-selection.service)
 */
export interface ContextMenuSelectionState {
  hasSelection: boolean;
  hasClipboard: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  canBringForward: boolean;
  canSendBackward: boolean;
  /** Number of selected items (for alignment/distribution) */
  selectedCount: number;
}

/**
 * Designer Context Menu Service
 *
 * Manages context menu state and generates menu items based on selection.
 *
 * Follows Single Responsibility Principle - only handles context menu logic.
 *
 * Usage:
 * ```typescript
 * private readonly contextMenuService = inject(DesignerContextMenuService);
 *
 * // Show context menu
 * onRightClick(event: MouseEvent): void {
 *   const canvasPos = this.getCanvasPosition(event);
 *   this.contextMenuService.show(
 *     { x: event.clientX, y: event.clientY },
 *     canvasPos
 *   );
 * }
 *
 * // In template
 * @if (contextMenuService.state().visible) {
 *   <context-menu
 *     [items]="contextMenuService.items()"
 *     [position]="contextMenuService.state().screenPosition"
 *     (action)="onAction($event)"
 *   />
 * }
 * ```
 */
@Injectable()
export class DesignerContextMenuService {

  // ============================================================================
  // State
  // ============================================================================

  private readonly _state = signal<ContextMenuState>({
    visible: false,
    screenPosition: { x: 0, y: 0 },
    canvasPosition: null
  });

  private readonly _selectionState = signal<ContextMenuSelectionState>({
    hasSelection: false,
    hasClipboard: false,
    canGroup: false,
    canUngroup: false,
    canBringForward: false,
    canSendBackward: false,
    selectedCount: 0
  });

  /** Current context menu state */
  readonly state = this._state.asReadonly();

  /** Current selection state */
  readonly selectionState = this._selectionState.asReadonly();

  /** Computed menu items based on selection state */
  readonly items = computed<ContextMenuItem[]>(() => {
    return this.buildMenuItems(this._selectionState());
  });

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Show the context menu at the specified position.
   *
   * @param screenPosition Position on screen (for CSS)
   * @param canvasPosition Position on canvas (for paste)
   */
  show(screenPosition: Position, canvasPosition: Position | null = null): void {
    this._state.set({
      visible: true,
      screenPosition,
      canvasPosition
    });
  }

  /**
   * Hide the context menu.
   */
  hide(): void {
    this._state.set({
      visible: false,
      screenPosition: { x: 0, y: 0 },
      canvasPosition: null
    });
  }

  /**
   * Toggle context menu visibility.
   *
   * @param screenPosition Position on screen
   * @param canvasPosition Position on canvas
   */
  toggle(screenPosition: Position, canvasPosition: Position | null = null): void {
    if (this._state().visible) {
      this.hide();
    } else {
      this.show(screenPosition, canvasPosition);
    }
  }

  /**
   * Check if context menu is visible.
   */
  isVisible(): boolean {
    return this._state().visible;
  }

  /**
   * Get the canvas position where the menu was opened.
   * Useful for paste operations.
   */
  getCanvasPosition(): Position | null {
    return this._state().canvasPosition;
  }

  // ============================================================================
  // Selection State
  // ============================================================================

  /**
   * Update the selection state for menu item generation.
   *
   * @param state Current selection state
   */
  updateSelectionState(state: Partial<ContextMenuSelectionState>): void {
    this._selectionState.update(current => ({
      ...current,
      ...state
    }));
  }

  /**
   * Set the complete selection state.
   *
   * @param state New selection state
   */
  setSelectionState(state: ContextMenuSelectionState): void {
    this._selectionState.set(state);
  }

  // ============================================================================
  // Menu Item Building
  // ============================================================================

  /**
   * Build menu items based on selection state.
   *
   * @param state Current selection state
   * @returns Array of menu items
   */
  buildMenuItems(state: ContextMenuSelectionState): ContextMenuItem[] {
    return [
      // Edit operations
      {
        id: 'copy',
        label: 'Copy',
        icon: '📋',
        shortcut: 'Ctrl+C',
        disabled: !state.hasSelection
      },
      {
        id: 'paste',
        label: 'Paste',
        icon: '📄',
        shortcut: 'Ctrl+V',
        disabled: !state.hasClipboard
      },
      {
        id: 'separator1',
        label: '',
        separator: true
      },

      // Grouping
      {
        id: 'group',
        label: 'Group',
        icon: '⊞',
        shortcut: 'Ctrl+G',
        disabled: !state.canGroup
      },
      {
        id: 'ungroup',
        label: 'Ungroup',
        icon: '⊟',
        shortcut: 'Ctrl+Shift+G',
        disabled: !state.canUngroup
      },
      {
        id: 'separator2',
        label: '',
        separator: true
      },

      // Z-Order
      {
        id: 'bringToFront',
        label: 'Bring to Front',
        icon: '⬆️',
        disabled: !state.hasSelection || !state.canBringForward
      },
      {
        id: 'bringForward',
        label: 'Bring Forward',
        icon: '↑',
        disabled: !state.hasSelection || !state.canBringForward
      },
      {
        id: 'sendBackward',
        label: 'Send Backward',
        icon: '↓',
        disabled: !state.hasSelection || !state.canSendBackward
      },
      {
        id: 'sendToBack',
        label: 'Send to Back',
        icon: '⬇️',
        disabled: !state.hasSelection || !state.canSendBackward
      },
      {
        id: 'separator3',
        label: '',
        separator: true
      },

      // Alignment (requires 2+ items)
      {
        id: 'alignLeft',
        label: 'Align Left',
        icon: '⫷',
        disabled: state.selectedCount < 2
      },
      {
        id: 'alignRight',
        label: 'Align Right',
        icon: '⫸',
        disabled: state.selectedCount < 2
      },
      {
        id: 'alignTop',
        label: 'Align Top',
        icon: '⊤',
        disabled: state.selectedCount < 2
      },
      {
        id: 'alignBottom',
        label: 'Align Bottom',
        icon: '⊥',
        disabled: state.selectedCount < 2
      },
      {
        id: 'alignHorizontalCenter',
        label: 'Align Horizontal Center',
        icon: '⫿',
        disabled: state.selectedCount < 2
      },
      {
        id: 'alignVerticalCenter',
        label: 'Align Vertical Center',
        icon: '⫾',
        disabled: state.selectedCount < 2
      },
      {
        id: 'separator4',
        label: '',
        separator: true
      },

      // Distribution (requires 3+ items)
      {
        id: 'distributeHorizontally',
        label: 'Distribute Horizontally',
        icon: '⇿',
        disabled: state.selectedCount < 3
      },
      {
        id: 'distributeVertically',
        label: 'Distribute Vertically',
        icon: '⇵',
        disabled: state.selectedCount < 3
      },
      {
        id: 'separator5',
        label: '',
        separator: true
      },

      // Delete
      {
        id: 'delete',
        label: 'Delete',
        icon: '🗑️',
        shortcut: 'Del',
        disabled: !state.hasSelection
      }
    ];
  }

  /**
   * Get only enabled menu items (excluding separators).
   */
  getEnabledItems(): ContextMenuItem[] {
    return this.items().filter(item => !item.separator && !item.disabled);
  }

  /**
   * Get menu items without separators.
   */
  getActionItems(): ContextMenuItem[] {
    return this.items().filter(item => !item.separator);
  }

  /**
   * Check if an action is currently enabled.
   *
   * @param actionId Action ID to check
   * @returns True if the action is enabled
   */
  isActionEnabled(actionId: string): boolean {
    const item = this.items().find(i => i.id === actionId);
    return item ? !item.disabled : false;
  }

  // ============================================================================
  // Custom Menu Items
  // ============================================================================

  /**
   * Build custom menu items for specific contexts.
   *
   * @param context Context type
   * @param state Selection state
   * @returns Array of context-specific menu items
   */
  buildCustomMenuItems(
    context: 'element' | 'primitive' | 'symbol' | 'connection' | 'canvas',
    state: ContextMenuSelectionState
  ): ContextMenuItem[] {
    const baseItems = this.buildMenuItems(state);

    // Add context-specific items
    switch (context) {
      case 'connection':
        return [
          {
            id: 'editConnection',
            label: 'Edit Connection',
            icon: '✏️'
          },
          {
            id: 'reverseDirection',
            label: 'Reverse Direction',
            icon: '🔄'
          },
          { id: 'separator', label: '', separator: true },
          {
            id: 'delete',
            label: 'Delete Connection',
            icon: '🗑️',
            shortcut: 'Del'
          }
        ];

      case 'canvas':
        return [
          {
            id: 'paste',
            label: 'Paste',
            icon: '📄',
            shortcut: 'Ctrl+V',
            disabled: !state.hasClipboard
          },
          { id: 'separator', label: '', separator: true },
          {
            id: 'selectAll',
            label: 'Select All',
            icon: '⬜',
            shortcut: 'Ctrl+A'
          },
          { id: 'separator2', label: '', separator: true },
          {
            id: 'fitToContent',
            label: 'Fit to Content',
            icon: '🔍'
          },
          {
            id: 'resetZoom',
            label: 'Reset Zoom',
            icon: '🔎'
          }
        ];

      default:
        return baseItems;
    }
  }
}
