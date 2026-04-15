import { TestBed } from '@angular/core/testing';
import {
  RuntimeBrowserStateService,
  BrowserState,
  BrowserItem,
} from './runtime-browser-state.service';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { CkModelDto, CkTypeDto, RtEntityDto } from '../../graphQL/globalTypes';
import { fileIcon } from '@progress/kendo-svg-icons';

describe('RuntimeBrowserStateService', () => {
  let service: RuntimeBrowserStateService;

  const createTreeItem = (
    id: string,
    text: string,
    item: BrowserItem,
  ): TreeItemDataTyped<BrowserItem> => {
    return new TreeItemDataTyped<BrowserItem>(id, text, '', item, fileIcon, false);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [RuntimeBrowserStateService],
    }).compileComponents();

    service = TestBed.inject(RuntimeBrowserStateService);
  });

  afterEach(() => {
    service.clearState();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveState (deprecated)', () => {
    it('should save state with selected item', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);
      const state = service.getState();

      expect(state).toBeTruthy();
      expect(state?.selectedItemId).toBe('Test/Entity@entity-1');
      expect(state?.selectedItemText).toBe('Test Entity');
    });

    it('should save state with parent path', () => {
      const rtEntity = {
        rtId: 'child-1',
        ckTypeId: 'Test/Child',
      } as RtEntityDto;
      const parentEntity = {
        rtId: 'parent-1',
        ckTypeId: 'Test/Parent',
      } as RtEntityDto;

      const childItem = createTreeItem('Test/Child@child-1', 'Child', rtEntity);
      const parentItem = createTreeItem(
        'Test/Parent@parent-1',
        'Parent',
        parentEntity,
      );

      service.saveState(childItem, [parentItem]);
      const state = service.getState();

      expect(state?.parentPath).toBeTruthy();
      expect(state?.parentPath.length).toBe(1);
    });

    it('should clear state when null item is passed', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);
      expect(service.getState()).toBeTruthy();

      service.saveState(null);
      expect(service.getState()).toBeNull();
    });
  });

  describe('saveStateWithKeys', () => {
    it('should save state with expanded keys', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );
      const expandedKeys = ['root-1', 'parent-1', 'child-1'];

      service.saveStateWithKeys(item, expandedKeys);
      const state = service.getState();

      expect(state).toBeTruthy();
      expect(state?.expandedKeys).toEqual(expandedKeys);
      expect(state?.selectedItemId).toBe('Test/Entity@entity-1');
    });

    it('should clear state when null item is passed', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveStateWithKeys(item, ['key-1']);
      expect(service.getState()).toBeTruthy();

      service.saveStateWithKeys(null, []);
      expect(service.getState()).toBeNull();
    });
  });

  describe('getState', () => {
    it('should return null when no state is saved', () => {
      expect(service.getState()).toBeNull();
    });

    it('should return saved state when valid', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);

      expect(service.getState()).toBeTruthy();
      expect(service.getState()?.selectedItemText).toBe('Test Entity');
    });

    it('should return null for expired state (>5 minutes old)', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);

      // Modify timestamp to be older than 5 minutes
      const state = (service as unknown as { currentState: BrowserState }).currentState;
      state.timestamp = Date.now() - 300001; // 5 minutes + 1 ms

      expect(service.getState()).toBeNull();
    });

    it('should clear expired state on access', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);
      const state = (service as unknown as { currentState: BrowserState }).currentState;
      state.timestamp = Date.now() - 400000; // Expired

      service.getState(); // Should clear state
      expect(
        (service as unknown as { currentState: BrowserState | null }).currentState,
      ).toBeNull();
    });
  });

  describe('clearState', () => {
    it('should clear the saved state', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);
      expect(service.getState()).toBeTruthy();

      service.clearState();
      expect(service.getState()).toBeNull();
    });
  });

  describe('isItemMatching', () => {
    it('should return true when item matches saved state', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      service.saveState(item);

      const sameItem = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );
      expect(service.isItemMatching(sameItem)).toBeTrue();
    });

    it('should return false when item does not match', () => {
      const rtEntity1 = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const rtEntity2 = {
        rtId: 'entity-2',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;

      const item1 = createTreeItem(
        'Test/Entity@entity-1',
        'Entity 1',
        rtEntity1,
      );
      const item2 = createTreeItem(
        'Test/Entity@entity-2',
        'Entity 2',
        rtEntity2,
      );

      service.saveState(item1);
      expect(service.isItemMatching(item2)).toBeFalse();
    });

    it('should return false when no state is saved', () => {
      const rtEntity = {
        rtId: 'entity-1',
        ckTypeId: 'Test/Entity',
      } as RtEntityDto;
      const item = createTreeItem(
        'Test/Entity@entity-1',
        'Test Entity',
        rtEntity,
      );

      expect(service.isItemMatching(item)).toBeFalse();
    });
  });

  describe('item ID generation', () => {
    it('should generate correct ID for runtime entity', () => {
      const rtEntity = {
        rtId: 'rt-123',
        ckTypeId: 'Custom/Type',
      } as RtEntityDto;
      const item = createTreeItem('ignored', 'Entity', rtEntity);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('Custom/Type@rt-123');
    });

    it('should generate correct ID for CK model', () => {
      const ckModel: CkModelDto = {
        id: { fullName: 'Basic', name: 'Basic', semanticVersionedFullName: 'Basic', version: '1.0.0' },
        dependencies: [],
      };
      const item = createTreeItem('ignored', 'Basic Model', ckModel);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('ck-model:Basic');
    });

    it('should generate correct ID for CK type', () => {
      const ckType: CkTypeDto = {
        ckTypeId: { fullName: 'Basic/Entity', semanticVersionedFullName: 'Basic/Entity' },
        isAbstract: false,
        isFinal: false,
        rtCkTypeId: 'Basic/Entity',
      };
      const item = createTreeItem('ignored', 'Entity Type', ckType);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('ck-type:Basic/Entity');
    });

    it('should generate correct ID for CK models root', () => {
      const rootNode: BrowserItem = { isCkModelsRoot: true };
      const item = createTreeItem('ignored', 'CK Models', rootNode);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('ck-models-root');
    });

    it('should use text as fallback for unknown item types', () => {
      const unknownItem: BrowserItem = { ckModelId: 'some-value' };
      const item = createTreeItem('ignored', 'Unknown Item', unknownItem);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('Unknown Item');
    });

    it('should return "unknown" when text is empty', () => {
      const unknownItem: BrowserItem = { ckModelId: 'some-value' };
      const item = createTreeItem('id', '', unknownItem);

      service.saveState(item);
      expect(service.getState()?.selectedItemId).toBe('unknown');
    });
  });
});
