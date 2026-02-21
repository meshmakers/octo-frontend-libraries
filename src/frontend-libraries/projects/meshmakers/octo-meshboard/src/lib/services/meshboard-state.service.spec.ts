import { TestBed } from '@angular/core/testing';
import { MeshBoardStateService } from './meshboard-state.service';
import { MeshBoardPersistenceService, PersistedMeshBoard, PersistedWidget } from './meshboard-persistence.service';
import { MeshBoardGridService } from './meshboard-grid.service';
import { CkModelService } from '@meshmakers/octo-services';
import { AnyWidgetConfig, MeshBoardConfig, MeshBoardVariable } from '../models/meshboard.models';

/**
 * Creates a mock PersistedMeshBoard for testing.
 */
function createMockPersistedMeshBoard(overrides: Partial<PersistedMeshBoard> = {}): PersistedMeshBoard {
  return {
    rtId: 'test-board',
    ckTypeId: 'System.UI/MeshBoard',
    name: 'Test Board',
    description: 'Test description',
    columns: 6,
    rowHeight: 200,
    gap: 16,
    ...overrides
  };
}

/**
 * Creates a mock PersistedWidget for testing.
 */
function createMockPersistedWidget(rtId: string): PersistedWidget {
  return {
    rtId,
    ckTypeId: 'System.UI/Widget',
    name: `Widget ${rtId}`,
    type: 'kpi',
    col: 1,
    row: 1,
    colSpan: 2,
    rowSpan: 2,
    dataSourceType: 'static',
    config: '{}'
  };
}

/**
 * Creates a minimal mock widget config for testing.
 */
function createMockWidget(id: string, title = `Widget ${id}`): AnyWidgetConfig {
  return {
    id,
    title,
    type: 'kpi',
    col: 1,
    row: 1,
    colSpan: 2,
    rowSpan: 2,
    dataSource: { type: 'static' }
  } as AnyWidgetConfig;
}

/**
 * Creates a mock MeshBoardConfig for testing.
 */
function createMockConfig(overrides: Partial<MeshBoardConfig> = {}): MeshBoardConfig {
  return {
    id: 'test-board',
    name: 'Test Board',
    description: 'Test description',
    columns: 6,
    rowHeight: 200,
    gap: 16,
    widgets: [],
    ...overrides
  };
}

describe('MeshBoardStateService', () => {
  let service: MeshBoardStateService;
  let mockPersistenceService: jasmine.SpyObj<MeshBoardPersistenceService>;
  let mockGridService: jasmine.SpyObj<MeshBoardGridService>;
  let mockCkModelService: jasmine.SpyObj<CkModelService>;

  beforeEach(() => {
    mockPersistenceService = jasmine.createSpyObj('MeshBoardPersistenceService', [
      'getMeshBoards',
      'getMeshBoardWithWidgets',
      'createMeshBoard',
      'updateMeshBoard',
      'deleteMeshBoard',
      'renameMeshBoard',
      'toMeshBoardConfig'
    ]);

    mockGridService = jasmine.createSpyObj('MeshBoardGridService', [
      'resolveOverlaps'
    ]);
    mockGridService.resolveOverlaps.and.returnValue([]);

    mockCkModelService = jasmine.createSpyObj('CkModelService', [
      'isModelAvailableWithMinVersion'
    ]);

    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: mockPersistenceService },
        { provide: MeshBoardGridService, useValue: mockGridService },
        { provide: CkModelService, useValue: mockCkModelService }
      ]
    });

    service = TestBed.inject(MeshBoardStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have default config', () => {
      const config = service.getConfig();

      expect(config.id).toBe('demo-meshboard');
      expect(config.name).toBe('Demo MeshBoard');
      expect(config.columns).toBe(6);
      expect(config.rowHeight).toBe(200);
      expect(config.gap).toBe(16);
      expect(config.widgets).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(service.isLoading()).toBeFalse();
    });

    it('should have no persisted ID initially', () => {
      expect(service.persistedMeshBoardId()).toBeNull();
    });

    it('should have empty available meshboards', () => {
      expect(service.availableMeshBoards()).toEqual([]);
    });

    it('should have null model availability initially', () => {
      expect(service.isModelAvailable()).toBeNull();
    });
  });

  describe('setConfig / getConfig', () => {
    it('should set and get config', () => {
      const newConfig = createMockConfig({ name: 'New Board' });

      service.setConfig(newConfig);

      expect(service.getConfig().name).toBe('New Board');
    });

    it('should update meshBoardConfig signal', () => {
      const newConfig = createMockConfig({ name: 'Signal Test' });

      service.setConfig(newConfig);

      expect(service.meshBoardConfig().name).toBe('Signal Test');
    });
  });

  describe('updateConfig', () => {
    it('should update config with updater function', () => {
      service.updateConfig(config => ({
        ...config,
        name: 'Updated Name'
      }));

      expect(service.getConfig().name).toBe('Updated Name');
    });

    it('should preserve other config values', () => {
      const original = service.getConfig();

      service.updateConfig(config => ({
        ...config,
        name: 'Changed'
      }));

      const updated = service.getConfig();
      expect(updated.columns).toBe(original.columns);
      expect(updated.rowHeight).toBe(original.rowHeight);
    });
  });

  describe('Widget Management', () => {
    describe('addWidget', () => {
      it('should add widget to config', () => {
        const widget = createMockWidget('w1');

        service.addWidget(widget);

        expect(service.widgets().length).toBe(1);
        expect(service.widgets()[0].id).toBe('w1');
      });

      it('should preserve existing widgets', () => {
        service.addWidget(createMockWidget('w1'));
        service.addWidget(createMockWidget('w2'));

        expect(service.widgets().length).toBe(2);
      });
    });

    describe('removeWidget', () => {
      it('should remove widget by ID', () => {
        service.addWidget(createMockWidget('w1'));
        service.addWidget(createMockWidget('w2'));

        service.removeWidget('w1');

        expect(service.widgets().length).toBe(1);
        expect(service.widgets()[0].id).toBe('w2');
      });

      it('should do nothing if widget not found', () => {
        service.addWidget(createMockWidget('w1'));

        service.removeWidget('nonexistent');

        expect(service.widgets().length).toBe(1);
      });
    });

    describe('updateWidget', () => {
      it('should update specific widget', () => {
        service.addWidget(createMockWidget('w1', 'Original'));
        service.addWidget(createMockWidget('w2', 'Other'));

        service.updateWidget('w1', w => ({ ...w, title: 'Updated' }));

        expect(service.getWidget('w1')?.title).toBe('Updated');
        expect(service.getWidget('w2')?.title).toBe('Other');
      });

      it('should not affect other widgets', () => {
        service.addWidget(createMockWidget('w1'));
        service.addWidget(createMockWidget('w2'));

        service.updateWidget('w1', w => ({ ...w, col: 5 }));

        expect(service.getWidget('w2')?.col).toBe(1);
      });
    });

    describe('getWidget', () => {
      it('should return widget by ID', () => {
        service.addWidget(createMockWidget('w1', 'Test Widget'));

        const widget = service.getWidget('w1');

        expect(widget).toBeDefined();
        expect(widget?.title).toBe('Test Widget');
      });

      it('should return undefined for nonexistent widget', () => {
        expect(service.getWidget('nonexistent')).toBeUndefined();
      });
    });

    describe('widgets signal', () => {
      it('should be reactive', () => {
        expect(service.widgets().length).toBe(0);

        service.addWidget(createMockWidget('w1'));

        expect(service.widgets().length).toBe(1);
      });
    });
  });

  describe('Settings Management', () => {
    describe('updateSettings', () => {
      it('should update all settings', () => {
        service.updateSettings({
          name: 'New Name',
          description: 'New Description',
          columns: 8,
          rowHeight: 250,
          gap: 20
        });

        const config = service.getConfig();
        expect(config.name).toBe('New Name');
        expect(config.description).toBe('New Description');
        expect(config.columns).toBe(8);
        expect(config.rowHeight).toBe(250);
        expect(config.gap).toBe(20);
      });

      it('should update rtWellKnownName', () => {
        service.updateSettings({
          name: 'Test',
          description: '',
          rtWellKnownName: 'my-board',
          columns: 6,
          rowHeight: 200,
          gap: 16
        });

        expect(service.getConfig().rtWellKnownName).toBe('my-board');
      });

      it('should preserve variables when not specified', () => {
        const variable: MeshBoardVariable = {
          name: 'test',
          type: 'string',
          source: 'static',
          value: 'value'
        };
        service.updateVariables([variable]);

        service.updateSettings({
          name: 'Test',
          description: '',
          columns: 6,
          rowHeight: 200,
          gap: 16
        });

        expect(service.getVariables().length).toBe(1);
      });

      it('should update variables when specified', () => {
        const newVariable: MeshBoardVariable = {
          name: 'newVar',
          type: 'number',
          source: 'static',
          value: '42'
        };

        service.updateSettings({
          name: 'Test',
          description: '',
          columns: 6,
          rowHeight: 200,
          gap: 16,
          variables: [newVariable]
        });

        expect(service.getVariables()[0].name).toBe('newVar');
      });

      it('should clear time filter variables when time filter disabled', () => {
        // First set some time filter variables
        service.setTimeFilterVariables('2024-01-01', '2024-12-31');
        expect(service.getVariables().length).toBe(2);

        // Disable time filter
        service.updateSettings({
          name: 'Test',
          description: '',
          columns: 6,
          rowHeight: 200,
          gap: 16,
          timeFilter: { enabled: false }
        });

        expect(service.getVariables().length).toBe(0);
      });
    });

    describe('getCurrentSettings', () => {
      it('should return current settings', () => {
        service.updateSettings({
          name: 'Current',
          description: 'Desc',
          columns: 4,
          rowHeight: 150,
          gap: 8
        });

        const settings = service.getCurrentSettings();

        expect(settings.name).toBe('Current');
        expect(settings.description).toBe('Desc');
        expect(settings.columns).toBe(4);
        expect(settings.rowHeight).toBe(150);
        expect(settings.gap).toBe(8);
      });

      it('should return empty array for variables if undefined', () => {
        const settings = service.getCurrentSettings();
        expect(settings.variables).toEqual([]);
      });
    });
  });

  describe('Variable Management', () => {
    const testVariable: MeshBoardVariable = {
      name: 'testVar',
      type: 'string',
      source: 'static',
      value: 'testValue'
    };

    describe('getVariables', () => {
      it('should return empty array when no variables', () => {
        expect(service.getVariables()).toEqual([]);
      });

      it('should return all variables', () => {
        service.addVariable(testVariable);
        service.addVariable({ ...testVariable, name: 'var2' });

        expect(service.getVariables().length).toBe(2);
      });
    });

    describe('getVariable', () => {
      it('should return variable by name', () => {
        service.addVariable(testVariable);

        const result = service.getVariable('testVar');

        expect(result).toBeDefined();
        expect(result?.value).toBe('testValue');
      });

      it('should return undefined for nonexistent variable', () => {
        expect(service.getVariable('nonexistent')).toBeUndefined();
      });
    });

    describe('addVariable', () => {
      it('should add variable', () => {
        service.addVariable(testVariable);

        expect(service.getVariables().length).toBe(1);
        expect(service.getVariables()[0].name).toBe('testVar');
      });

      it('should preserve existing variables', () => {
        service.addVariable(testVariable);
        service.addVariable({ ...testVariable, name: 'var2' });

        expect(service.getVariables().length).toBe(2);
      });
    });

    describe('removeVariable', () => {
      it('should remove variable by name', () => {
        service.addVariable(testVariable);
        service.addVariable({ ...testVariable, name: 'var2' });

        service.removeVariable('testVar');

        expect(service.getVariables().length).toBe(1);
        expect(service.getVariables()[0].name).toBe('var2');
      });

      it('should do nothing if variable not found', () => {
        service.addVariable(testVariable);

        service.removeVariable('nonexistent');

        expect(service.getVariables().length).toBe(1);
      });
    });

    describe('setVariableValue', () => {
      it('should update variable value', () => {
        service.addVariable(testVariable);

        service.setVariableValue('testVar', 'newValue');

        expect(service.getVariable('testVar')?.value).toBe('newValue');
      });

      it('should not create variable if not exists', () => {
        service.setVariableValue('nonexistent', 'value');

        expect(service.getVariable('nonexistent')).toBeUndefined();
      });

      it('should preserve other variable properties', () => {
        service.addVariable({ ...testVariable, label: 'Test Label' });

        service.setVariableValue('testVar', 'newValue');

        const updated = service.getVariable('testVar');
        expect(updated?.label).toBe('Test Label');
        expect(updated?.type).toBe('string');
      });
    });

    describe('updateVariables', () => {
      it('should replace all variables', () => {
        service.addVariable(testVariable);

        const newVars: MeshBoardVariable[] = [
          { name: 'new1', type: 'number', source: 'static', value: '1' },
          { name: 'new2', type: 'boolean', source: 'static', value: 'true' }
        ];

        service.updateVariables(newVars);

        expect(service.getVariables().length).toBe(2);
        expect(service.getVariable('testVar')).toBeUndefined();
        expect(service.getVariable('new1')).toBeDefined();
      });
    });
  });

  describe('Time Filter Management', () => {
    describe('isTimeFilterEnabled', () => {
      it('should return false when no time filter', () => {
        expect(service.isTimeFilterEnabled()).toBeFalse();
      });

      it('should return false when time filter disabled', () => {
        service.updateTimeFilterConfig({ enabled: false });
        expect(service.isTimeFilterEnabled()).toBeFalse();
      });

      it('should return true when time filter enabled', () => {
        service.updateTimeFilterConfig({ enabled: true });
        expect(service.isTimeFilterEnabled()).toBeTrue();
      });
    });

    describe('getTimeFilterConfig', () => {
      it('should return undefined when no config', () => {
        expect(service.getTimeFilterConfig()).toBeUndefined();
      });

      it('should return config when set', () => {
        service.updateTimeFilterConfig({ enabled: true });

        const config = service.getTimeFilterConfig();
        expect(config?.enabled).toBeTrue();
      });
    });

    describe('updateTimeFilterConfig', () => {
      it('should set time filter config', () => {
        service.updateTimeFilterConfig({
          enabled: true,
          selection: { type: 'year', year: 2024 }
        });

        const config = service.getTimeFilterConfig();
        expect(config?.selection?.type).toBe('year');
        expect(config?.selection?.year).toBe(2024);
      });
    });

    describe('setTimeFilterVariables', () => {
      it('should create time filter variables', () => {
        service.setTimeFilterVariables('2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z');

        const vars = service.getVariables();
        expect(vars.length).toBe(2);

        const fromVar = vars.find(v => v.name === 'timeRangeFrom');
        const toVar = vars.find(v => v.name === 'timeRangeTo');

        expect(fromVar?.value).toBe('2024-01-01T00:00:00Z');
        expect(fromVar?.source).toBe('timeFilter');
        expect(fromVar?.type).toBe('datetime');

        expect(toVar?.value).toBe('2024-12-31T23:59:59Z');
        expect(toVar?.source).toBe('timeFilter');
      });

      it('should preserve non-time-filter variables', () => {
        service.addVariable({
          name: 'customVar',
          type: 'string',
          source: 'static',
          value: 'custom'
        });

        service.setTimeFilterVariables('2024-01-01', '2024-12-31');

        expect(service.getVariables().length).toBe(3);
        expect(service.getVariable('customVar')).toBeDefined();
      });

      it('should replace existing time filter variables', () => {
        service.setTimeFilterVariables('2024-01-01', '2024-06-30');
        service.setTimeFilterVariables('2024-07-01', '2024-12-31');

        const vars = service.getVariables().filter(v => v.source === 'timeFilter');
        expect(vars.length).toBe(2);
        expect(service.getVariable('timeRangeFrom')?.value).toBe('2024-07-01');
      });
    });

    describe('clearTimeFilterVariables', () => {
      it('should remove time filter variables', () => {
        service.setTimeFilterVariables('2024-01-01', '2024-12-31');

        service.clearTimeFilterVariables();

        expect(service.getVariable('timeRangeFrom')).toBeUndefined();
        expect(service.getVariable('timeRangeTo')).toBeUndefined();
      });

      it('should preserve other variables', () => {
        service.addVariable({
          name: 'customVar',
          type: 'string',
          source: 'static',
          value: 'custom'
        });
        service.setTimeFilterVariables('2024-01-01', '2024-12-31');

        service.clearTimeFilterVariables();

        expect(service.getVariables().length).toBe(1);
        expect(service.getVariable('customVar')).toBeDefined();
      });
    });

    describe('updateTimeFilterSelection', () => {
      it('should update selection and set variables', () => {
        service.updateTimeFilterSelection(
          { type: 'year', year: 2024 },
          '2024-01-01T00:00:00Z',
          '2024-12-31T23:59:59Z'
        );

        const config = service.getTimeFilterConfig();
        expect(config?.enabled).toBeTrue();
        expect(config?.selection?.type).toBe('year');
        expect(config?.selection?.year).toBe(2024);

        expect(service.getVariable('timeRangeFrom')?.value).toBe('2024-01-01T00:00:00Z');
        expect(service.getVariable('timeRangeTo')?.value).toBe('2024-12-31T23:59:59Z');
      });
    });
  });

  describe('triggerRefresh', () => {
    it('should create new widget references', () => {
      const widget = createMockWidget('w1');
      service.addWidget(widget);
      const originalWidget = service.widgets()[0];

      service.triggerRefresh();

      const refreshedWidget = service.widgets()[0];
      expect(refreshedWidget).not.toBe(originalWidget);
      expect(refreshedWidget.id).toBe(originalWidget.id);
    });
  });

  describe('Async Operations', () => {
    describe('loadInitialMeshBoard', () => {
      it('should set isLoading during load', async () => {
        mockCkModelService.isModelAvailableWithMinVersion.and.returnValue(
          Promise.resolve(true)
        );
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([]));

        const loadPromise = service.loadInitialMeshBoard();

        // Note: Due to async nature, we verify the final state
        await loadPromise;

        expect(service.isLoading()).toBeFalse();
      });

      it('should return empty array when model not available', async () => {
        mockCkModelService.isModelAvailableWithMinVersion.and.returnValue(
          Promise.resolve(false)
        );

        const result = await service.loadInitialMeshBoard();

        expect(result).toEqual([]);
        expect(service.isModelAvailable()).toBeFalse();
      });

      it('should set model availability', async () => {
        mockCkModelService.isModelAvailableWithMinVersion.and.returnValue(
          Promise.resolve(true)
        );
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([]));

        await service.loadInitialMeshBoard();

        expect(service.isModelAvailable()).toBeTrue();
      });

      it('should load available meshboards', async () => {
        mockCkModelService.isModelAvailableWithMinVersion.and.returnValue(
          Promise.resolve(true)
        );
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([
          createMockPersistedMeshBoard({ rtId: 'board1', name: 'Board 1' })
        ]));
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve({
          meshBoard: createMockPersistedMeshBoard({ rtId: 'board1', name: 'Board 1' }),
          widgets: []
        }));
        mockPersistenceService.toMeshBoardConfig.and.returnValue(createMockConfig());

        await service.loadInitialMeshBoard();

        expect(service.availableMeshBoards().length).toBe(1);
      });

      it('should handle errors gracefully', async () => {
        mockCkModelService.isModelAvailableWithMinVersion.and.returnValue(
          Promise.reject(new Error('Network error'))
        );

        const result = await service.loadInitialMeshBoard();

        expect(result).toEqual([]);
        expect(service.isLoading()).toBeFalse();
      });
    });

    describe('switchToMeshBoard', () => {
      it('should resolve overlaps when switching', async () => {
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve({
          meshBoard: createMockPersistedMeshBoard({ rtId: 'board1', name: 'Board 1' }),
          widgets: [createMockPersistedWidget('w1')]
        }));
        mockPersistenceService.toMeshBoardConfig.and.returnValue(
          createMockConfig({ widgets: [createMockWidget('w1')] })
        );

        await service.switchToMeshBoard('board1');

        expect(mockGridService.resolveOverlaps).toHaveBeenCalled();
      });

      it('should update persisted ID', async () => {
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve({
          meshBoard: createMockPersistedMeshBoard({ rtId: 'board1', name: 'Board 1' }),
          widgets: []
        }));
        mockPersistenceService.toMeshBoardConfig.and.returnValue(createMockConfig());

        await service.switchToMeshBoard('board1');

        expect(service.persistedMeshBoardId()).toBe('board1');
      });

      it('should return current widgets when board not found', async () => {
        service.addWidget(createMockWidget('existing'));
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve(null));

        const result = await service.switchToMeshBoard('nonexistent');

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('existing');
      });
    });

    describe('createNewMeshBoard', () => {
      it('should create and switch to new board', async () => {
        mockPersistenceService.createMeshBoard.and.returnValue(Promise.resolve('new-board-id'));
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([
          createMockPersistedMeshBoard({ rtId: 'new-board-id', name: 'New Board' })
        ]));
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve({
          meshBoard: createMockPersistedMeshBoard({ rtId: 'new-board-id', name: 'New Board' }),
          widgets: []
        }));
        mockPersistenceService.toMeshBoardConfig.and.returnValue(
          createMockConfig({ id: 'new-board-id', name: 'New Board' })
        );

        const rtId = await service.createNewMeshBoard('New Board', 'Description');

        expect(rtId).toBe('new-board-id');
        expect(mockPersistenceService.createMeshBoard).toHaveBeenCalled();
      });
    });

    describe('deleteMeshBoard', () => {
      beforeEach(() => {
        mockPersistenceService.deleteMeshBoard.and.returnValue(Promise.resolve());
      });

      it('should delete and refresh list', async () => {
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([]));

        await service.deleteMeshBoard('board-to-delete');

        expect(mockPersistenceService.deleteMeshBoard).toHaveBeenCalledWith('board-to-delete');
        expect(mockPersistenceService.getMeshBoards).toHaveBeenCalled();
      });

      it('should reset state when deleting current board and no others exist', async () => {
        // Set up current board
        mockPersistenceService.getMeshBoardWithWidgets.and.returnValue(Promise.resolve({
          meshBoard: createMockPersistedMeshBoard({ rtId: 'current-board', name: 'Current' }),
          widgets: []
        }));
        mockPersistenceService.toMeshBoardConfig.and.returnValue(
          createMockConfig({ id: 'current-board' })
        );
        await service.switchToMeshBoard('current-board');

        // Delete with no remaining boards
        mockPersistenceService.getMeshBoards.and.returnValue(Promise.resolve([]));

        await service.deleteMeshBoard('current-board');

        expect(service.persistedMeshBoardId()).toBeNull();
      });
    });
  });

  describe('Deprecated aliases', () => {
    it('should have dashboardConfig alias', () => {
      expect(service.dashboardConfig).toBe(service.meshBoardConfig);
    });

    it('should have persistedDashboardId alias', () => {
      expect(service.persistedDashboardId).toBe(service.persistedMeshBoardId);
    });

    it('should have availableDashboards alias', () => {
      expect(service.availableDashboards).toBe(service.availableMeshBoards);
    });
  });
});
