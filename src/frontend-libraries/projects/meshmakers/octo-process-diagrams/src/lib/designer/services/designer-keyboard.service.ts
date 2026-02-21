import { Injectable, signal } from '@angular/core';
import { DesignerMode } from './designer-state.service';

/**
 * Modifier keys state
 */
export interface ModifierKeys {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Unique identifier for the action */
  id: string;
  /** Key code (e.g., 'Delete', 'a', 'g') */
  key: string;
  /** Required modifier keys */
  modifiers?: Partial<ModifierKeys>;
  /** Description for help/documentation */
  description?: string;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
}

/**
 * Result of keyboard event processing
 */
export interface KeyboardActionResult {
  /** ID of the triggered action (or null if none) */
  actionId: string | null;
  /** Whether the event was handled */
  handled: boolean;
  /** Whether default should be prevented */
  preventDefault: boolean;
}

/**
 * Designer Keyboard Service
 *
 * Handles keyboard shortcut registration and event processing.
 *
 * Follows Single Responsibility Principle - only handles keyboard logic.
 *
 * Usage:
 * ```typescript
 * private readonly keyboardService = inject(DesignerKeyboardService);
 *
 * // Register custom shortcuts
 * ngOnInit(): void {
 *   this.keyboardService.registerShortcut({
 *     id: 'customAction',
 *     key: 'k',
 *     modifiers: { ctrl: true },
 *     description: 'Custom action'
 *   });
 * }
 *
 * // Process keyboard events
 * onKeyDown(event: KeyboardEvent): void {
 *   const result = this.keyboardService.processKeyEvent(event);
 *   if (result.handled) {
 *     this.executeAction(result.actionId);
 *   }
 * }
 * ```
 */
@Injectable()
export class DesignerKeyboardService {

  // ============================================================================
  // State
  // ============================================================================

  private readonly _shortcuts = signal<Map<string, KeyboardShortcut>>(new Map());
  private readonly _modifierKeys = signal<ModifierKeys>({
    ctrl: false,
    shift: false,
    alt: false,
    meta: false
  });

  /** Current modifier keys state */
  readonly modifierKeys = this._modifierKeys.asReadonly();

  // ============================================================================
  // Initialization
  // ============================================================================

  constructor() {
    this.registerDefaultShortcuts();
  }

  /**
   * Register default keyboard shortcuts.
   */
  private registerDefaultShortcuts(): void {
    const defaults: KeyboardShortcut[] = [
      // Mode shortcuts
      { id: 'mode-select', key: 'v', description: 'Select mode' },
      { id: 'mode-pan', key: 'h', description: 'Pan mode' },
      { id: 'mode-connect', key: 'c', description: 'Connect mode' },

      // Delete
      { id: 'delete', key: 'Delete', description: 'Delete selected', preventDefault: true },
      { id: 'delete-backspace', key: 'Backspace', description: 'Delete selected', preventDefault: true },

      // Undo/Redo
      { id: 'undo', key: 'z', modifiers: { ctrl: true }, description: 'Undo', preventDefault: true },
      { id: 'redo', key: 'z', modifiers: { ctrl: true, shift: true }, description: 'Redo', preventDefault: true },

      // Select all
      { id: 'select-all', key: 'a', modifiers: { ctrl: true }, description: 'Select all', preventDefault: true },

      // Save
      { id: 'save', key: 's', modifiers: { ctrl: true }, description: 'Save', preventDefault: true },

      // Copy/Paste
      { id: 'copy', key: 'c', modifiers: { ctrl: true }, description: 'Copy', preventDefault: true },
      { id: 'paste', key: 'v', modifiers: { ctrl: true }, description: 'Paste', preventDefault: true },

      // Group/Ungroup
      { id: 'group', key: 'g', modifiers: { ctrl: true }, description: 'Group selected', preventDefault: true },
      { id: 'ungroup', key: 'g', modifiers: { ctrl: true, shift: true }, description: 'Ungroup selected', preventDefault: true },

      // Panel toggles (legacy layout)
      { id: 'toggle-left-panel', key: '1', modifiers: { alt: true }, description: 'Toggle left panel', preventDefault: true },
      { id: 'toggle-right-panel', key: '2', modifiers: { alt: true }, description: 'Toggle right panel', preventDefault: true },

      // Panel toggles (dockview layout)
      { id: 'toggle-panel-elements', key: '1', modifiers: { alt: true }, description: 'Toggle Elements panel', preventDefault: true },
      { id: 'toggle-panel-symbols', key: '2', modifiers: { alt: true }, description: 'Toggle Symbols panel', preventDefault: true },
      { id: 'toggle-panel-properties', key: '3', modifiers: { alt: true }, description: 'Toggle Properties panel', preventDefault: true },
      { id: 'toggle-panel-transform', key: '4', modifiers: { alt: true }, description: 'Toggle Exposures panel', preventDefault: true },
      { id: 'toggle-panel-animations', key: '5', modifiers: { alt: true }, description: 'Toggle Animations panel', preventDefault: true },
      { id: 'toggle-panel-simulation', key: '6', modifiers: { alt: true }, description: 'Toggle Simulation panel', preventDefault: true },

      // Reset layout (dockview)
      { id: 'reset-layout', key: '0', modifiers: { alt: true }, description: 'Reset panel layout', preventDefault: true },

      // Escape
      { id: 'escape', key: 'Escape', description: 'Clear selection / Close menu' },

      // Arrow keys for nudging
      { id: 'nudge-up', key: 'ArrowUp', description: 'Move up' },
      { id: 'nudge-down', key: 'ArrowDown', description: 'Move down' },
      { id: 'nudge-left', key: 'ArrowLeft', description: 'Move left' },
      { id: 'nudge-right', key: 'ArrowRight', description: 'Move right' },

      // Arrow keys with shift for larger nudge
      { id: 'nudge-up-large', key: 'ArrowUp', modifiers: { shift: true }, description: 'Move up (large)' },
      { id: 'nudge-down-large', key: 'ArrowDown', modifiers: { shift: true }, description: 'Move down (large)' },
      { id: 'nudge-left-large', key: 'ArrowLeft', modifiers: { shift: true }, description: 'Move left (large)' },
      { id: 'nudge-right-large', key: 'ArrowRight', modifiers: { shift: true }, description: 'Move right (large)' },

      // Z-Order
      { id: 'bring-to-front', key: ']', modifiers: { ctrl: true, shift: true }, description: 'Bring to front', preventDefault: true },
      { id: 'bring-forward', key: ']', modifiers: { ctrl: true }, description: 'Bring forward', preventDefault: true },
      { id: 'send-backward', key: '[', modifiers: { ctrl: true }, description: 'Send backward', preventDefault: true },
      { id: 'send-to-back', key: '[', modifiers: { ctrl: true, shift: true }, description: 'Send to back', preventDefault: true }
    ];

    for (const shortcut of defaults) {
      this.registerShortcut(shortcut);
    }
  }

  // ============================================================================
  // Shortcut Registration
  // ============================================================================

  /**
   * Register a keyboard shortcut.
   *
   * @param shortcut Shortcut definition
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    this._shortcuts.update(map => {
      const newMap = new Map(map);
      newMap.set(shortcut.id, {
        ...shortcut,
        enabled: shortcut.enabled ?? true,
        preventDefault: shortcut.preventDefault ?? false
      });
      return newMap;
    });
  }

  /**
   * Unregister a keyboard shortcut.
   *
   * @param id Shortcut ID to remove
   */
  unregisterShortcut(id: string): void {
    this._shortcuts.update(map => {
      const newMap = new Map(map);
      newMap.delete(id);
      return newMap;
    });
  }

  /**
   * Enable or disable a shortcut.
   *
   * @param id Shortcut ID
   * @param enabled Whether to enable
   */
  setShortcutEnabled(id: string, enabled: boolean): void {
    this._shortcuts.update(map => {
      const shortcut = map.get(id);
      if (shortcut) {
        const newMap = new Map(map);
        newMap.set(id, { ...shortcut, enabled });
        return newMap;
      }
      return map;
    });
  }

  /**
   * Get a registered shortcut by ID.
   *
   * @param id Shortcut ID
   * @returns Shortcut or undefined
   */
  getShortcut(id: string): KeyboardShortcut | undefined {
    return this._shortcuts().get(id);
  }

  /**
   * Get all registered shortcuts.
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this._shortcuts().values());
  }

  /**
   * Get shortcuts grouped by category (based on ID prefix).
   */
  getShortcutsByCategory(): Map<string, KeyboardShortcut[]> {
    const categories = new Map<string, KeyboardShortcut[]>();

    for (const shortcut of this._shortcuts().values()) {
      const category = shortcut.id.split('-')[0];
      const list = categories.get(category) ?? [];
      list.push(shortcut);
      categories.set(category, list);
    }

    return categories;
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  /**
   * Process a keyboard event and return the matching action.
   *
   * @param event Keyboard event
   * @returns Action result
   */
  processKeyEvent(event: KeyboardEvent): KeyboardActionResult {
    // Update modifier state
    this.updateModifierKeys(event);

    // Find matching shortcut
    const shortcut = this.findMatchingShortcut(event);

    if (shortcut && shortcut.enabled) {
      return {
        actionId: shortcut.id,
        handled: true,
        preventDefault: shortcut.preventDefault ?? false
      };
    }

    return {
      actionId: null,
      handled: false,
      preventDefault: false
    };
  }

  /**
   * Find a shortcut matching the keyboard event.
   *
   * @param event Keyboard event
   * @returns Matching shortcut or undefined
   */
  findMatchingShortcut(event: KeyboardEvent): KeyboardShortcut | undefined {
    const modifiers = this.getModifiersFromEvent(event);

    // Sort shortcuts by specificity (more modifiers = more specific)
    const shortcuts = Array.from(this._shortcuts().values())
      .filter(s => s.enabled !== false)
      .sort((a, b) => {
        const aModCount = this.countModifiers(a.modifiers);
        const bModCount = this.countModifiers(b.modifiers);
        return bModCount - aModCount; // More modifiers first
      });

    for (const shortcut of shortcuts) {
      if (this.matchesShortcut(event, shortcut, modifiers)) {
        return shortcut;
      }
    }

    return undefined;
  }

  /**
   * Check if a keyboard event matches a shortcut.
   *
   * @param event Keyboard event
   * @param shortcut Shortcut to check
   * @param modifiers Current modifier state
   * @returns True if matches
   */
  private matchesShortcut(
    event: KeyboardEvent,
    shortcut: KeyboardShortcut,
    modifiers: ModifierKeys
  ): boolean {
    // Check key match (case-insensitive for letters)
    const eventKey = event.key.toLowerCase();
    const shortcutKey = shortcut.key.toLowerCase();

    if (eventKey !== shortcutKey && event.key !== shortcut.key) {
      return false;
    }

    // Check modifiers
    const requiredMods = shortcut.modifiers ?? {};

    const ctrlMatch = (requiredMods.ctrl ?? false) === (modifiers.ctrl || modifiers.meta);
    const shiftMatch = (requiredMods.shift ?? false) === modifiers.shift;
    const altMatch = (requiredMods.alt ?? false) === modifiers.alt;

    return ctrlMatch && shiftMatch && altMatch;
  }

  /**
   * Get modifier keys from event.
   */
  private getModifiersFromEvent(event: KeyboardEvent): ModifierKeys {
    return {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey
    };
  }

  /**
   * Count the number of required modifiers.
   */
  private countModifiers(modifiers?: Partial<ModifierKeys>): number {
    if (!modifiers) return 0;
    let count = 0;
    if (modifiers.ctrl) count++;
    if (modifiers.shift) count++;
    if (modifiers.alt) count++;
    if (modifiers.meta) count++;
    return count;
  }

  /**
   * Update modifier keys state from event.
   */
  private updateModifierKeys(event: KeyboardEvent): void {
    this._modifierKeys.set(this.getModifiersFromEvent(event));
  }

  // ============================================================================
  // Mode Detection
  // ============================================================================

  /**
   * Get the mode that should be activated based on key.
   *
   * @param event Keyboard event
   * @returns Mode or null if not a mode key
   */
  getModeFromKey(event: KeyboardEvent): DesignerMode | null {
    // Only process mode keys without modifiers
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return null;
    }

    const key = event.key.toLowerCase();

    switch (key) {
      case 'v': return 'select';
      case 'h': return 'pan';
      case 'c': return 'connect';
      default: return null;
    }
  }

  /**
   * Check if the event is a nudge action.
   *
   * @param event Keyboard event
   * @returns Nudge direction or null
   */
  getNudgeDirection(event: KeyboardEvent): 'up' | 'down' | 'left' | 'right' | null {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return null;
    }

    switch (event.key) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      default: return null;
    }
  }

  /**
   * Get nudge amount based on shift key.
   *
   * @param event Keyboard event
   * @param gridSize Current grid size
   * @returns Nudge amount in pixels
   */
  getNudgeAmount(event: KeyboardEvent, gridSize = 1): number {
    // Large nudge with shift (10x or grid size)
    if (event.shiftKey) {
      return Math.max(gridSize, 10);
    }
    // Small nudge (1px or 1 grid unit)
    return Math.max(1, gridSize / 10);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format a shortcut for display.
   *
   * @param shortcut Shortcut to format
   * @returns Formatted string (e.g., "Ctrl+G")
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];

    if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
    if (shortcut.modifiers?.shift) parts.push('Shift');
    if (shortcut.modifiers?.alt) parts.push('Alt');
    if (shortcut.modifiers?.meta) parts.push('⌘');

    // Format key name
    let keyName = shortcut.key;
    if (keyName.length === 1) {
      keyName = keyName.toUpperCase();
    } else if (keyName.startsWith('Arrow')) {
      keyName = keyName.replace('Arrow', '');
    }

    parts.push(keyName);

    return parts.join('+');
  }

  /**
   * Check if an event should be ignored (e.g., when typing in input).
   *
   * @param event Keyboard event
   * @returns True if event should be ignored
   */
  shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;

    // Ignore events from input elements
    if (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable) {
      // Allow escape and some Ctrl shortcuts in inputs
      if (event.key === 'Escape') return false;
      if ((event.ctrlKey || event.metaKey) && ['s', 'z'].includes(event.key.toLowerCase())) {
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Get help text for all shortcuts.
   */
  getHelpText(): string {
    const lines: string[] = ['Keyboard Shortcuts:', ''];

    const categories = this.getShortcutsByCategory();
    for (const [category, shortcuts] of categories) {
      lines.push(`${category.charAt(0).toUpperCase() + category.slice(1)}:`);
      for (const shortcut of shortcuts) {
        if (shortcut.enabled !== false) {
          lines.push(`  ${this.formatShortcut(shortcut).padEnd(20)} ${shortcut.description ?? ''}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
