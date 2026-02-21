import { TestBed } from '@angular/core/testing';
import {
  DesignerKeyboardService,
  KeyboardShortcut
} from './designer-keyboard.service';

describe('DesignerKeyboardService', () => {
  let service: DesignerKeyboardService;

  // Helper to create mock keyboard event
  function createKeyEvent(
    key: string,
    options: {
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
      target?: Partial<HTMLElement>;
    } = {}
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
      altKey: options.altKey ?? false,
      metaKey: options.metaKey ?? false
    });

    // Mock target if provided
    if (options.target) {
      Object.defineProperty(event, 'target', {
        value: options.target,
        writable: false
      });
    }

    return event;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerKeyboardService]
    });
    service = TestBed.inject(DesignerKeyboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // Default Shortcuts
  // ============================================================================

  describe('default shortcuts', () => {
    it('should register default shortcuts on creation', () => {
      const shortcuts = service.getAllShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('should include delete shortcut', () => {
      const shortcut = service.getShortcut('delete');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('Delete');
    });

    it('should include undo shortcut', () => {
      const shortcut = service.getShortcut('undo');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('z');
      expect(shortcut?.modifiers?.ctrl).toBeTrue();
    });

    it('should include redo shortcut', () => {
      const shortcut = service.getShortcut('redo');
      expect(shortcut).toBeDefined();
      expect(shortcut?.modifiers?.ctrl).toBeTrue();
      expect(shortcut?.modifiers?.shift).toBeTrue();
    });

    it('should include mode shortcuts', () => {
      expect(service.getShortcut('mode-select')).toBeDefined();
      expect(service.getShortcut('mode-pan')).toBeDefined();
      expect(service.getShortcut('mode-connect')).toBeDefined();
    });

    it('should include group/ungroup shortcuts', () => {
      expect(service.getShortcut('group')).toBeDefined();
      expect(service.getShortcut('ungroup')).toBeDefined();
    });
  });

  // ============================================================================
  // Shortcut Registration
  // ============================================================================

  describe('registerShortcut', () => {
    it('should register a new shortcut', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x',
        description: 'Custom action'
      });

      const shortcut = service.getShortcut('custom');
      expect(shortcut).toBeDefined();
      expect(shortcut?.key).toBe('x');
    });

    it('should override existing shortcut with same id', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x'
      });

      service.registerShortcut({
        id: 'custom',
        key: 'y'
      });

      const shortcut = service.getShortcut('custom');
      expect(shortcut?.key).toBe('y');
    });

    it('should default enabled to true', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x'
      });

      const shortcut = service.getShortcut('custom');
      expect(shortcut?.enabled).toBeTrue();
    });
  });

  describe('unregisterShortcut', () => {
    it('should remove a shortcut', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x'
      });

      service.unregisterShortcut('custom');

      expect(service.getShortcut('custom')).toBeUndefined();
    });

    it('should handle non-existent shortcut', () => {
      expect(() => service.unregisterShortcut('nonexistent')).not.toThrow();
    });
  });

  describe('setShortcutEnabled', () => {
    it('should enable a shortcut', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x',
        enabled: false
      });

      service.setShortcutEnabled('custom', true);

      expect(service.getShortcut('custom')?.enabled).toBeTrue();
    });

    it('should disable a shortcut', () => {
      service.registerShortcut({
        id: 'custom',
        key: 'x',
        enabled: true
      });

      service.setShortcutEnabled('custom', false);

      expect(service.getShortcut('custom')?.enabled).toBeFalse();
    });

    it('should handle non-existent shortcut', () => {
      expect(() => service.setShortcutEnabled('nonexistent', true)).not.toThrow();
    });
  });

  describe('getAllShortcuts', () => {
    it('should return all shortcuts as array', () => {
      const shortcuts = service.getAllShortcuts();
      expect(Array.isArray(shortcuts)).toBeTrue();
      expect(shortcuts.length).toBeGreaterThan(0);
    });
  });

  describe('getShortcutsByCategory', () => {
    it('should group shortcuts by category', () => {
      const categories = service.getShortcutsByCategory();

      expect(categories.has('mode')).toBeTrue();
      expect(categories.get('mode')?.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Event Processing
  // ============================================================================

  describe('processKeyEvent', () => {
    it('should return action for matching shortcut', () => {
      const event = createKeyEvent('Delete');
      const result = service.processKeyEvent(event);

      expect(result.handled).toBeTrue();
      expect(result.actionId).toBe('delete');
    });

    it('should return no action for non-matching key', () => {
      const event = createKeyEvent('q');
      const result = service.processKeyEvent(event);

      expect(result.handled).toBeFalse();
      expect(result.actionId).toBeNull();
    });

    it('should match Ctrl+Z to undo', () => {
      const event = createKeyEvent('z', { ctrlKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('undo');
    });

    it('should match Ctrl+Shift+Z to redo', () => {
      const event = createKeyEvent('z', { ctrlKey: true, shiftKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('redo');
    });

    it('should match Ctrl+G to group', () => {
      const event = createKeyEvent('g', { ctrlKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('group');
    });

    it('should match Ctrl+Shift+G to ungroup', () => {
      const event = createKeyEvent('g', { ctrlKey: true, shiftKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('ungroup');
    });

    it('should match Alt+1 to toggle left panel', () => {
      const event = createKeyEvent('1', { altKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('toggle-left-panel');
    });

    it('should return preventDefault from shortcut', () => {
      const event = createKeyEvent('z', { ctrlKey: true });
      const result = service.processKeyEvent(event);

      expect(result.preventDefault).toBeTrue();
    });

    it('should not match disabled shortcuts', () => {
      service.setShortcutEnabled('delete', false);

      const event = createKeyEvent('Delete');
      const result = service.processKeyEvent(event);

      expect(result.handled).toBeFalse();
    });

    it('should prefer more specific shortcuts', () => {
      // Ctrl+Shift+Z (redo) should match before Ctrl+Z (undo)
      const event = createKeyEvent('z', { ctrlKey: true, shiftKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('redo');
    });
  });

  describe('findMatchingShortcut', () => {
    it('should find matching shortcut', () => {
      const event = createKeyEvent('Delete');
      const shortcut = service.findMatchingShortcut(event);

      expect(shortcut).toBeDefined();
      expect(shortcut?.id).toBe('delete');
    });

    it('should return undefined for no match', () => {
      const event = createKeyEvent('q');
      const shortcut = service.findMatchingShortcut(event);

      expect(shortcut).toBeUndefined();
    });

    it('should match case-insensitively', () => {
      const eventLower = createKeyEvent('g', { ctrlKey: true });
      const eventUpper = createKeyEvent('G', { ctrlKey: true });

      expect(service.findMatchingShortcut(eventLower)?.id).toBe('group');
      expect(service.findMatchingShortcut(eventUpper)?.id).toBe('group');
    });
  });

  // ============================================================================
  // Mode Detection
  // ============================================================================

  describe('getModeFromKey', () => {
    it('should return select mode for V key', () => {
      const event = createKeyEvent('v');
      expect(service.getModeFromKey(event)).toBe('select');
    });

    it('should return pan mode for H key', () => {
      const event = createKeyEvent('h');
      expect(service.getModeFromKey(event)).toBe('pan');
    });

    it('should return connect mode for C key', () => {
      const event = createKeyEvent('c');
      expect(service.getModeFromKey(event)).toBe('connect');
    });

    it('should return null for other keys', () => {
      const event = createKeyEvent('x');
      expect(service.getModeFromKey(event)).toBeNull();
    });

    it('should return null when Ctrl is pressed', () => {
      const event = createKeyEvent('c', { ctrlKey: true });
      expect(service.getModeFromKey(event)).toBeNull();
    });

    it('should be case-insensitive', () => {
      const eventLower = createKeyEvent('v');
      const eventUpper = createKeyEvent('V');

      expect(service.getModeFromKey(eventLower)).toBe('select');
      expect(service.getModeFromKey(eventUpper)).toBe('select');
    });
  });

  // ============================================================================
  // Nudge Detection
  // ============================================================================

  describe('getNudgeDirection', () => {
    it('should return up for ArrowUp', () => {
      const event = createKeyEvent('ArrowUp');
      expect(service.getNudgeDirection(event)).toBe('up');
    });

    it('should return down for ArrowDown', () => {
      const event = createKeyEvent('ArrowDown');
      expect(service.getNudgeDirection(event)).toBe('down');
    });

    it('should return left for ArrowLeft', () => {
      const event = createKeyEvent('ArrowLeft');
      expect(service.getNudgeDirection(event)).toBe('left');
    });

    it('should return right for ArrowRight', () => {
      const event = createKeyEvent('ArrowRight');
      expect(service.getNudgeDirection(event)).toBe('right');
    });

    it('should return null for non-arrow keys', () => {
      const event = createKeyEvent('a');
      expect(service.getNudgeDirection(event)).toBeNull();
    });

    it('should return null when Ctrl is pressed', () => {
      const event = createKeyEvent('ArrowUp', { ctrlKey: true });
      expect(service.getNudgeDirection(event)).toBeNull();
    });
  });

  describe('getNudgeAmount', () => {
    it('should return small amount without shift', () => {
      const event = createKeyEvent('ArrowUp');
      expect(service.getNudgeAmount(event, 10)).toBe(1);
    });

    it('should return large amount with shift', () => {
      const event = createKeyEvent('ArrowUp', { shiftKey: true });
      expect(service.getNudgeAmount(event, 10)).toBe(10);
    });

    it('should use minimum of 10 for large nudge', () => {
      const event = createKeyEvent('ArrowUp', { shiftKey: true });
      expect(service.getNudgeAmount(event, 5)).toBe(10);
    });

    it('should use grid size for large nudge when larger than 10', () => {
      const event = createKeyEvent('ArrowUp', { shiftKey: true });
      expect(service.getNudgeAmount(event, 20)).toBe(20);
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('formatShortcut', () => {
    it('should format simple key', () => {
      const shortcut: KeyboardShortcut = { id: 'test', key: 'Delete' };
      expect(service.formatShortcut(shortcut)).toBe('Delete');
    });

    it('should format single letter as uppercase', () => {
      const shortcut: KeyboardShortcut = { id: 'test', key: 'a' };
      expect(service.formatShortcut(shortcut)).toBe('A');
    });

    it('should format Ctrl modifier', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test',
        key: 'c',
        modifiers: { ctrl: true }
      };
      expect(service.formatShortcut(shortcut)).toBe('Ctrl+C');
    });

    it('should format multiple modifiers', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test',
        key: 'g',
        modifiers: { ctrl: true, shift: true }
      };
      expect(service.formatShortcut(shortcut)).toBe('Ctrl+Shift+G');
    });

    it('should format arrow keys', () => {
      const shortcut: KeyboardShortcut = { id: 'test', key: 'ArrowUp' };
      expect(service.formatShortcut(shortcut)).toBe('Up');
    });
  });

  describe('shouldIgnoreEvent', () => {
    it('should ignore events from input elements', () => {
      const event = createKeyEvent('a', {
        target: { tagName: 'INPUT' }
      });

      expect(service.shouldIgnoreEvent(event)).toBeTrue();
    });

    it('should ignore events from textarea elements', () => {
      const event = createKeyEvent('a', {
        target: { tagName: 'TEXTAREA' }
      });

      expect(service.shouldIgnoreEvent(event)).toBeTrue();
    });

    it('should ignore events from contenteditable elements', () => {
      const event = createKeyEvent('a', {
        target: { tagName: 'DIV', isContentEditable: true }
      });

      expect(service.shouldIgnoreEvent(event)).toBeTrue();
    });

    it('should not ignore events from regular elements', () => {
      const event = createKeyEvent('a', {
        target: { tagName: 'DIV', isContentEditable: false }
      });

      expect(service.shouldIgnoreEvent(event)).toBeFalse();
    });

    it('should not ignore Escape in input', () => {
      const event = createKeyEvent('Escape', {
        target: { tagName: 'INPUT' }
      });

      expect(service.shouldIgnoreEvent(event)).toBeFalse();
    });

    it('should not ignore Ctrl+S in input', () => {
      const event = createKeyEvent('s', {
        ctrlKey: true,
        target: { tagName: 'INPUT' }
      });

      expect(service.shouldIgnoreEvent(event)).toBeFalse();
    });

    it('should not ignore Ctrl+Z in input', () => {
      const event = createKeyEvent('z', {
        ctrlKey: true,
        target: { tagName: 'INPUT' }
      });

      expect(service.shouldIgnoreEvent(event)).toBeFalse();
    });
  });

  describe('getHelpText', () => {
    it('should return formatted help text', () => {
      const help = service.getHelpText();

      expect(help).toContain('Keyboard Shortcuts:');
      expect(help.length).toBeGreaterThan(100);
    });

    it('should include category headers', () => {
      const help = service.getHelpText();

      expect(help).toContain('Mode:');
    });
  });

  // ============================================================================
  // Modifier Keys
  // ============================================================================

  describe('modifierKeys', () => {
    it('should track modifier keys from event', () => {
      const event = createKeyEvent('a', {
        ctrlKey: true,
        shiftKey: true
      });

      service.processKeyEvent(event);
      const modifiers = service.modifierKeys();

      expect(modifiers.ctrl).toBeTrue();
      expect(modifiers.shift).toBeTrue();
      expect(modifiers.alt).toBeFalse();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle special keys', () => {
      const escapeEvent = createKeyEvent('Escape');
      const result = service.processKeyEvent(escapeEvent);

      expect(result.actionId).toBe('escape');
    });

    it('should handle meta key as ctrl on Mac', () => {
      const event = createKeyEvent('c', { metaKey: true });
      const result = service.processKeyEvent(event);

      expect(result.actionId).toBe('copy');
    });

    it('should handle both backspace and delete', () => {
      const deleteEvent = createKeyEvent('Delete');
      const backspaceEvent = createKeyEvent('Backspace');

      expect(service.processKeyEvent(deleteEvent).actionId).toBe('delete');
      expect(service.processKeyEvent(backspaceEvent).actionId).toBe('delete-backspace');
    });
  });
});
