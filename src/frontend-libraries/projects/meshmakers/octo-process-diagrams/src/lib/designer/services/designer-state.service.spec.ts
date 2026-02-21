import { TestBed } from '@angular/core/testing';
import { DesignerStateService } from './designer-state.service';

describe('DesignerStateService', () => {
  let service: DesignerStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerStateService]
    });
    service = TestBed.inject(DesignerStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(service.mode()).toBe('select');
      expect(service.zoom()).toBe(1);
      expect(service.panOffset()).toEqual({ x: 0, y: 0 });
      expect(service.showGrid()).toBeTrue();
      expect(service.snapToGrid()).toBeTrue();
      expect(service.gridSize()).toBe(20);
      expect(service.hasChanges()).toBeFalse();
    });

    it('should compute zoomPercentage correctly', () => {
      expect(service.zoomPercentage()).toBe(100);
    });

    it('should compute canvasCursor for select mode', () => {
      expect(service.canvasCursor()).toBe('default');
    });
  });

  describe('mode operations', () => {
    it('should set mode to pan', () => {
      service.setMode('pan');
      expect(service.mode()).toBe('pan');
    });

    it('should set mode to connect', () => {
      service.setMode('connect');
      expect(service.mode()).toBe('connect');
    });

    it('should update canvasCursor when mode changes', () => {
      service.setMode('pan');
      expect(service.canvasCursor()).toBe('grab');

      service.setMode('connect');
      expect(service.canvasCursor()).toBe('crosshair');

      service.setMode('select');
      expect(service.canvasCursor()).toBe('default');
    });
  });

  describe('zoom operations', () => {
    it('should set zoom directly', () => {
      service.setZoom(1.5);
      expect(service.zoom()).toBe(1.5);
      expect(service.zoomPercentage()).toBe(150);
    });

    it('should clamp zoom to minimum 0.1', () => {
      service.setZoom(0);
      expect(service.zoom()).toBe(0.1);
    });

    it('should clamp zoom to maximum 5', () => {
      service.setZoom(10);
      expect(service.zoom()).toBe(5);
    });

    it('should zoom in by 10%', () => {
      service.zoomIn();
      expect(service.zoom()).toBeCloseTo(1.1, 1);
    });

    it('should zoom out by 10%', () => {
      service.zoomOut();
      expect(service.zoom()).toBeCloseTo(0.9, 1);
    });

    it('should not zoom in beyond maximum', () => {
      service.setZoom(5);
      service.zoomIn();
      expect(service.zoom()).toBe(5);
    });

    it('should not zoom out beyond minimum', () => {
      service.setZoom(0.1);
      service.zoomOut();
      expect(service.zoom()).toBe(0.1);
    });

    it('should reset zoom to 100%', () => {
      service.setZoom(2);
      service.resetZoom();
      expect(service.zoom()).toBe(1);
    });
  });

  describe('pan operations', () => {
    it('should set pan offset directly', () => {
      service.setPanOffset({ x: 100, y: 200 });
      expect(service.panOffset()).toEqual({ x: 100, y: 200 });
    });

    it('should pan by delta', () => {
      service.setPanOffset({ x: 50, y: 50 });
      service.pan(10, -20);
      expect(service.panOffset()).toEqual({ x: 60, y: 30 });
    });

    it('should reset pan to origin', () => {
      service.setPanOffset({ x: 100, y: 200 });
      service.resetPan();
      expect(service.panOffset()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('grid operations', () => {
    it('should toggle grid visibility', () => {
      expect(service.showGrid()).toBeTrue();
      service.toggleGrid();
      expect(service.showGrid()).toBeFalse();
      service.toggleGrid();
      expect(service.showGrid()).toBeTrue();
    });

    it('should set grid visibility', () => {
      service.setShowGrid(false);
      expect(service.showGrid()).toBeFalse();
    });

    it('should toggle snap to grid', () => {
      expect(service.snapToGrid()).toBeTrue();
      service.toggleSnapToGrid();
      expect(service.snapToGrid()).toBeFalse();
      service.toggleSnapToGrid();
      expect(service.snapToGrid()).toBeTrue();
    });

    it('should set snap to grid', () => {
      service.setSnapToGrid(false);
      expect(service.snapToGrid()).toBeFalse();
    });

    it('should set grid size', () => {
      service.setGridSize(10);
      expect(service.gridSize()).toBe(10);
    });

    it('should clamp grid size to minimum 1', () => {
      service.setGridSize(0);
      expect(service.gridSize()).toBe(1);
    });

    it('should clamp grid size to maximum 100', () => {
      service.setGridSize(200);
      expect(service.gridSize()).toBe(100);
    });

    it('should sync grid settings', () => {
      service.syncGridSettings(15, false);
      expect(service.gridSize()).toBe(15);
      expect(service.showGrid()).toBeFalse();
    });

    it('should sync only provided settings', () => {
      service.syncGridSettings(25);
      expect(service.gridSize()).toBe(25);
      expect(service.showGrid()).toBeTrue(); // unchanged
    });
  });

  describe('change tracking', () => {
    it('should mark as changed', () => {
      service.markChanged();
      expect(service.hasChanges()).toBeTrue();
    });

    it('should clear changes', () => {
      service.markChanged();
      service.clearChanges();
      expect(service.hasChanges()).toBeFalse();
    });

    it('should set hasChanges directly', () => {
      service.setHasChanges(true);
      expect(service.hasChanges()).toBeTrue();
      service.setHasChanges(false);
      expect(service.hasChanges()).toBeFalse();
    });
  });

  describe('snapPosition', () => {
    it('should snap position to grid when enabled', () => {
      service.setGridSize(20);
      service.setSnapToGrid(true);

      const result = service.snapPosition({ x: 25, y: 33 });
      expect(result).toEqual({ x: 20, y: 40 });
    });

    it('should not snap position when disabled', () => {
      service.setGridSize(20);
      service.setSnapToGrid(false);

      const result = service.snapPosition({ x: 25, y: 33 });
      expect(result).toEqual({ x: 25, y: 33 });
    });

    it('should snap to nearest grid point', () => {
      service.setGridSize(10);
      service.setSnapToGrid(true);

      expect(service.snapPosition({ x: 14, y: 16 })).toEqual({ x: 10, y: 20 });
      expect(service.snapPosition({ x: 15, y: 15 })).toEqual({ x: 20, y: 20 });
      expect(service.snapPosition({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // Change all values
      service.setMode('pan');
      service.setZoom(2);
      service.setPanOffset({ x: 100, y: 100 });
      service.setShowGrid(false);
      service.setSnapToGrid(false);
      service.setGridSize(50);
      service.markChanged();

      // Reset
      service.reset();

      // Verify defaults
      expect(service.mode()).toBe('select');
      expect(service.zoom()).toBe(1);
      expect(service.panOffset()).toEqual({ x: 0, y: 0 });
      expect(service.showGrid()).toBeTrue();
      expect(service.snapToGrid()).toBeTrue();
      expect(service.gridSize()).toBe(20);
      expect(service.hasChanges()).toBeFalse();
    });
  });
});
