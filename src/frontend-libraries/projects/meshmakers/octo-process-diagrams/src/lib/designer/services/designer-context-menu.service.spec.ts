import { TestBed } from '@angular/core/testing';
import {
  DesignerContextMenuService,
  ContextMenuSelectionState
} from './designer-context-menu.service';

describe('DesignerContextMenuService', () => {
  let service: DesignerContextMenuService;

  // Helper to create selection state
  function createSelectionState(overrides: Partial<ContextMenuSelectionState> = {}): ContextMenuSelectionState {
    return {
      hasSelection: false,
      hasClipboard: false,
      canGroup: false,
      canUngroup: false,
      canBringForward: true,
      canSendBackward: true,
      selectedCount: 0,
      ...overrides
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerContextMenuService]
    });
    service = TestBed.inject(DesignerContextMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ============================================================================
  // State Management
  // ============================================================================

  describe('show', () => {
    it('should show context menu at screen position', () => {
      service.show({ x: 100, y: 200 });

      const state = service.state();
      expect(state.visible).toBeTrue();
      expect(state.screenPosition.x).toBe(100);
      expect(state.screenPosition.y).toBe(200);
    });

    it('should store canvas position', () => {
      service.show({ x: 100, y: 200 }, { x: 50, y: 75 });

      const state = service.state();
      expect(state.canvasPosition).toEqual({ x: 50, y: 75 });
    });

    it('should allow null canvas position', () => {
      service.show({ x: 100, y: 200 }, null);

      expect(service.state().canvasPosition).toBeNull();
    });
  });

  describe('hide', () => {
    it('should hide context menu', () => {
      service.show({ x: 100, y: 200 });
      service.hide();

      expect(service.state().visible).toBeFalse();
    });

    it('should reset positions', () => {
      service.show({ x: 100, y: 200 }, { x: 50, y: 75 });
      service.hide();

      const state = service.state();
      expect(state.screenPosition).toEqual({ x: 0, y: 0 });
      expect(state.canvasPosition).toBeNull();
    });
  });

  describe('toggle', () => {
    it('should show when hidden', () => {
      service.toggle({ x: 100, y: 200 });

      expect(service.state().visible).toBeTrue();
    });

    it('should hide when visible', () => {
      service.show({ x: 100, y: 200 });
      service.toggle({ x: 150, y: 250 });

      expect(service.state().visible).toBeFalse();
    });
  });

  describe('isVisible', () => {
    it('should return true when visible', () => {
      service.show({ x: 100, y: 200 });
      expect(service.isVisible()).toBeTrue();
    });

    it('should return false when hidden', () => {
      expect(service.isVisible()).toBeFalse();
    });
  });

  describe('getCanvasPosition', () => {
    it('should return canvas position when set', () => {
      service.show({ x: 100, y: 200 }, { x: 50, y: 75 });

      expect(service.getCanvasPosition()).toEqual({ x: 50, y: 75 });
    });

    it('should return null when not set', () => {
      service.show({ x: 100, y: 200 });

      expect(service.getCanvasPosition()).toBeNull();
    });
  });

  // ============================================================================
  // Selection State
  // ============================================================================

  describe('updateSelectionState', () => {
    it('should update partial selection state', () => {
      service.updateSelectionState({ hasSelection: true });

      expect(service.selectionState().hasSelection).toBeTrue();
      expect(service.selectionState().hasClipboard).toBeFalse();
    });

    it('should preserve existing state', () => {
      service.setSelectionState(createSelectionState({
        hasSelection: true,
        hasClipboard: true
      }));

      service.updateSelectionState({ canGroup: true });

      const state = service.selectionState();
      expect(state.hasSelection).toBeTrue();
      expect(state.hasClipboard).toBeTrue();
      expect(state.canGroup).toBeTrue();
    });
  });

  describe('setSelectionState', () => {
    it('should replace entire selection state', () => {
      const newState = createSelectionState({
        hasSelection: true,
        hasClipboard: true,
        canGroup: true,
        canUngroup: false
      });

      service.setSelectionState(newState);

      expect(service.selectionState()).toEqual(newState);
    });
  });

  // ============================================================================
  // Menu Item Building
  // ============================================================================

  describe('buildMenuItems', () => {
    it('should return menu items array', () => {
      const items = service.buildMenuItems(createSelectionState());

      expect(items.length).toBeGreaterThan(0);
    });

    it('should disable copy when no selection', () => {
      const items = service.buildMenuItems(createSelectionState({ hasSelection: false }));
      const copyItem = items.find(i => i.id === 'copy');

      expect(copyItem?.disabled).toBeTrue();
    });

    it('should enable copy when has selection', () => {
      const items = service.buildMenuItems(createSelectionState({ hasSelection: true }));
      const copyItem = items.find(i => i.id === 'copy');

      expect(copyItem?.disabled).toBeFalse();
    });

    it('should disable paste when no clipboard', () => {
      const items = service.buildMenuItems(createSelectionState({ hasClipboard: false }));
      const pasteItem = items.find(i => i.id === 'paste');

      expect(pasteItem?.disabled).toBeTrue();
    });

    it('should enable paste when has clipboard', () => {
      const items = service.buildMenuItems(createSelectionState({ hasClipboard: true }));
      const pasteItem = items.find(i => i.id === 'paste');

      expect(pasteItem?.disabled).toBeFalse();
    });

    it('should disable group when canGroup is false', () => {
      const items = service.buildMenuItems(createSelectionState({ canGroup: false }));
      const groupItem = items.find(i => i.id === 'group');

      expect(groupItem?.disabled).toBeTrue();
    });

    it('should enable group when canGroup is true', () => {
      const items = service.buildMenuItems(createSelectionState({ canGroup: true }));
      const groupItem = items.find(i => i.id === 'group');

      expect(groupItem?.disabled).toBeFalse();
    });

    it('should disable ungroup when canUngroup is false', () => {
      const items = service.buildMenuItems(createSelectionState({ canUngroup: false }));
      const ungroupItem = items.find(i => i.id === 'ungroup');

      expect(ungroupItem?.disabled).toBeTrue();
    });

    it('should enable ungroup when canUngroup is true', () => {
      const items = service.buildMenuItems(createSelectionState({ canUngroup: true }));
      const ungroupItem = items.find(i => i.id === 'ungroup');

      expect(ungroupItem?.disabled).toBeFalse();
    });

    it('should disable delete when no selection', () => {
      const items = service.buildMenuItems(createSelectionState({ hasSelection: false }));
      const deleteItem = items.find(i => i.id === 'delete');

      expect(deleteItem?.disabled).toBeTrue();
    });

    it('should enable delete when has selection', () => {
      const items = service.buildMenuItems(createSelectionState({ hasSelection: true }));
      const deleteItem = items.find(i => i.id === 'delete');

      expect(deleteItem?.disabled).toBeFalse();
    });

    it('should include separators', () => {
      const items = service.buildMenuItems(createSelectionState());
      const separators = items.filter(i => i.separator);

      expect(separators.length).toBeGreaterThan(0);
    });

    it('should disable z-order items when no selection', () => {
      const items = service.buildMenuItems(createSelectionState({ hasSelection: false }));

      const bringToFront = items.find(i => i.id === 'bringToFront');
      const sendToBack = items.find(i => i.id === 'sendToBack');

      expect(bringToFront?.disabled).toBeTrue();
      expect(sendToBack?.disabled).toBeTrue();
    });

    it('should enable z-order items when has selection and can move', () => {
      const items = service.buildMenuItems(createSelectionState({
        hasSelection: true,
        canBringForward: true,
        canSendBackward: true
      }));

      const bringToFront = items.find(i => i.id === 'bringToFront');
      const sendToBack = items.find(i => i.id === 'sendToBack');

      expect(bringToFront?.disabled).toBeFalse();
      expect(sendToBack?.disabled).toBeFalse();
    });
  });

  describe('items computed', () => {
    it('should update when selection state changes', () => {
      service.setSelectionState(createSelectionState({ hasSelection: false }));
      const itemsBefore = service.items();
      const copyBefore = itemsBefore.find(i => i.id === 'copy');

      service.setSelectionState(createSelectionState({ hasSelection: true }));
      const itemsAfter = service.items();
      const copyAfter = itemsAfter.find(i => i.id === 'copy');

      expect(copyBefore?.disabled).toBeTrue();
      expect(copyAfter?.disabled).toBeFalse();
    });
  });

  describe('getEnabledItems', () => {
    it('should return only enabled non-separator items', () => {
      service.setSelectionState(createSelectionState({
        hasSelection: true,
        hasClipboard: true,
        canGroup: true
      }));

      const enabledItems = service.getEnabledItems();

      expect(enabledItems.every(i => !i.separator)).toBeTrue();
      expect(enabledItems.every(i => !i.disabled)).toBeTrue();
    });

    it('should exclude disabled items', () => {
      service.setSelectionState(createSelectionState({
        hasSelection: false
      }));

      const enabledItems = service.getEnabledItems();
      const copyItem = enabledItems.find(i => i.id === 'copy');

      expect(copyItem).toBeUndefined();
    });
  });

  describe('getActionItems', () => {
    it('should return items without separators', () => {
      const actionItems = service.getActionItems();

      expect(actionItems.every(i => !i.separator)).toBeTrue();
    });

    it('should include disabled items', () => {
      service.setSelectionState(createSelectionState({ hasSelection: false }));

      const actionItems = service.getActionItems();
      const copyItem = actionItems.find(i => i.id === 'copy');

      expect(copyItem).toBeDefined();
      expect(copyItem?.disabled).toBeTrue();
    });
  });

  describe('isActionEnabled', () => {
    it('should return true for enabled action', () => {
      service.setSelectionState(createSelectionState({ hasSelection: true }));

      expect(service.isActionEnabled('copy')).toBeTrue();
    });

    it('should return false for disabled action', () => {
      service.setSelectionState(createSelectionState({ hasSelection: false }));

      expect(service.isActionEnabled('copy')).toBeFalse();
    });

    it('should return false for unknown action', () => {
      expect(service.isActionEnabled('unknown')).toBeFalse();
    });
  });

  // ============================================================================
  // Custom Menu Items
  // ============================================================================

  describe('buildCustomMenuItems', () => {
    it('should return connection-specific items for connection context', () => {
      const items = service.buildCustomMenuItems('connection', createSelectionState());

      const editItem = items.find(i => i.id === 'editConnection');
      const reverseItem = items.find(i => i.id === 'reverseDirection');

      expect(editItem).toBeDefined();
      expect(reverseItem).toBeDefined();
    });

    it('should return canvas-specific items for canvas context', () => {
      const items = service.buildCustomMenuItems('canvas', createSelectionState());

      const selectAllItem = items.find(i => i.id === 'selectAll');
      const fitItem = items.find(i => i.id === 'fitToContent');

      expect(selectAllItem).toBeDefined();
      expect(fitItem).toBeDefined();
    });

    it('should return base items for element context', () => {
      const items = service.buildCustomMenuItems('element', createSelectionState());

      const copyItem = items.find(i => i.id === 'copy');
      const deleteItem = items.find(i => i.id === 'delete');

      expect(copyItem).toBeDefined();
      expect(deleteItem).toBeDefined();
    });

    it('should return base items for primitive context', () => {
      const items = service.buildCustomMenuItems('primitive', createSelectionState());

      const groupItem = items.find(i => i.id === 'group');

      expect(groupItem).toBeDefined();
    });

    it('should return base items for symbol context', () => {
      const items = service.buildCustomMenuItems('symbol', createSelectionState());

      const copyItem = items.find(i => i.id === 'copy');

      expect(copyItem).toBeDefined();
    });

    it('should respect clipboard state in canvas context', () => {
      const itemsNoClipboard = service.buildCustomMenuItems(
        'canvas',
        createSelectionState({ hasClipboard: false })
      );
      const pasteNoClipboard = itemsNoClipboard.find(i => i.id === 'paste');

      const itemsWithClipboard = service.buildCustomMenuItems(
        'canvas',
        createSelectionState({ hasClipboard: true })
      );
      const pasteWithClipboard = itemsWithClipboard.find(i => i.id === 'paste');

      expect(pasteNoClipboard?.disabled).toBeTrue();
      expect(pasteWithClipboard?.disabled).toBeFalse();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle rapid show/hide calls', () => {
      service.show({ x: 100, y: 200 });
      service.hide();
      service.show({ x: 150, y: 250 });
      service.hide();
      service.show({ x: 200, y: 300 });

      const state = service.state();
      expect(state.visible).toBeTrue();
      expect(state.screenPosition).toEqual({ x: 200, y: 300 });
    });

    it('should handle show with same position', () => {
      service.show({ x: 100, y: 200 });
      service.show({ x: 100, y: 200 });

      expect(service.state().visible).toBeTrue();
    });

    it('should handle empty selection state update', () => {
      const initialState = service.selectionState();
      service.updateSelectionState({});

      expect(service.selectionState()).toEqual(initialState);
    });
  });
});
