import { TestBed } from '@angular/core/testing';
import { DesignerLayoutService } from './designer-layout.service';
import { SerializedDockview, Orientation } from 'dockview-core';

describe('DesignerLayoutService', () => {
  let service: DesignerLayoutService;
  const testUserId = 'test-user-123';

  // Mock SerializedDockview layout
  // Note: activeGroup is omitted because undefined values are stripped by JSON.stringify
  const mockLayout: SerializedDockview = {
    grid: {
      root: { type: 'branch', data: [] },
      width: 1000,
      height: 600,
      orientation: Orientation.HORIZONTAL
    },
    panels: {}
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerLayoutService]
    });
    service = TestBed.inject(DesignerLayoutService);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have default panels defined', () => {
      expect(service.defaultPanels).toBeDefined();
      expect(service.defaultPanels.length).toBeGreaterThan(0);
    });

    it('should have symbol editor default panels defined', () => {
      expect(service.symbolEditorDefaultPanels).toBeDefined();
      expect(service.symbolEditorDefaultPanels.length).toBeGreaterThan(0);
    });
  });

  describe('defaultPanels', () => {
    it('should include elements panel', () => {
      const elementsPanel = service.defaultPanels.find(p => p.id === 'elements');
      expect(elementsPanel).toBeDefined();
      expect(elementsPanel?.title).toBe('Elements');
      expect(elementsPanel?.visible).toBe(true);
    });

    it('should include symbols panel', () => {
      const symbolsPanel = service.defaultPanels.find(p => p.id === 'symbols');
      expect(symbolsPanel).toBeDefined();
      expect(symbolsPanel?.title).toBe('Symbols');
    });

    it('should include properties panel', () => {
      const propertiesPanel = service.defaultPanels.find(p => p.id === 'properties');
      expect(propertiesPanel).toBeDefined();
      expect(propertiesPanel?.title).toBe('Properties');
    });

    it('should include simulation panel as hidden by default', () => {
      const simulationPanel = service.defaultPanels.find(p => p.id === 'simulation');
      expect(simulationPanel).toBeDefined();
      expect(simulationPanel?.visible).toBe(false);
    });
  });

  describe('saveLayout', () => {
    it('should save layout to localStorage', () => {
      service.saveLayout(mockLayout, testUserId);

      const saved = localStorage.getItem(`process-designer-layout-v1-${testUserId}`);
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(mockLayout);
    });

    it('should save symbol editor layout with different key', () => {
      service.saveLayout(mockLayout, testUserId, true);

      const saved = localStorage.getItem(`symbol-editor-layout-v1-${testUserId}`);
      expect(saved).toBeTruthy();
    });

    it('should overwrite existing layout', () => {
      const updatedLayout: SerializedDockview = {
        ...mockLayout,
        panels: { panel1: {} as any }
      };

      service.saveLayout(mockLayout, testUserId);
      service.saveLayout(updatedLayout, testUserId);

      const saved = localStorage.getItem(`process-designer-layout-v1-${testUserId}`);
      expect(JSON.parse(saved!)).toEqual(updatedLayout);
    });
  });

  describe('loadLayout', () => {
    it('should load saved layout', () => {
      service.saveLayout(mockLayout, testUserId);

      const loaded = service.loadLayout(testUserId);
      expect(loaded).toEqual(mockLayout);
    });

    it('should return null if no layout saved', () => {
      const loaded = service.loadLayout('non-existent-user');
      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem(`process-designer-layout-v1-${testUserId}`, 'invalid-json');

      const loaded = service.loadLayout(testUserId);
      expect(loaded).toBeNull();
    });

    it('should load symbol editor layout when specified', () => {
      service.saveLayout(mockLayout, testUserId, true);

      const loaded = service.loadLayout(testUserId, true);
      expect(loaded).toEqual(mockLayout);
    });
  });

  describe('clearLayout', () => {
    it('should remove saved layout', () => {
      service.saveLayout(mockLayout, testUserId);
      expect(service.hasLayout(testUserId)).toBe(true);

      service.clearLayout(testUserId);
      expect(service.hasLayout(testUserId)).toBe(false);
    });

    it('should clear symbol editor layout separately', () => {
      service.saveLayout(mockLayout, testUserId);
      service.saveLayout(mockLayout, testUserId, true);

      service.clearLayout(testUserId, true);

      expect(service.hasLayout(testUserId)).toBe(true);
      expect(service.hasLayout(testUserId, true)).toBe(false);
    });
  });

  describe('hasLayout', () => {
    it('should return false when no layout exists', () => {
      expect(service.hasLayout(testUserId)).toBe(false);
    });

    it('should return true when layout exists', () => {
      service.saveLayout(mockLayout, testUserId);
      expect(service.hasLayout(testUserId)).toBe(true);
    });
  });

  describe('getPanelConfig', () => {
    it('should return panel config by id', () => {
      const config = service.getPanelConfig('elements');
      expect(config).toBeDefined();
      expect(config?.id).toBe('elements');
      expect(config?.title).toBe('Elements');
    });

    it('should return undefined for unknown panel', () => {
      const config = service.getPanelConfig('unknown-panel');
      expect(config).toBeUndefined();
    });

    it('should return symbol editor panel config when specified', () => {
      const config = service.getPanelConfig('primitives', true);
      expect(config).toBeDefined();
      expect(config?.id).toBe('primitives');
    });
  });
});
