import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { SymbolEditorPageComponent } from './symbol-editor-page.component';
import { SymbolLibraryService } from '../../services/symbol-library.service';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { NotificationService } from '@progress/kendo-angular-notification';
import { ActivatedRoute, Router } from '@angular/router';
import { SymbolDefinition } from '../../primitives/models/symbol.model';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SymbolSettings } from '../../designer/process-designer.component';

/**
 * Test helper interface to access protected/private members of SymbolEditorPageComponent
 */
interface SymbolEditorPageTestAccess {
    onSymbolChange(symbol: SymbolDefinition): void;
    saveSymbol(): Promise<void>;
    isSaving: WritableSignal<boolean>;
    _currentSymbol: SymbolDefinition | null;
    onSymbolSettingsChange(event: {
        key: string;
        value: unknown;
    }): void;
}

// Mock SymbolEditorComponent to avoid complex dependencies
@Component({
  selector: 'mm-symbol-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '<div>Mock Symbol Editor</div>'
})
class MockSymbolEditorComponent {
    @Input()
      symbol: SymbolDefinition | null = null;
    @Input()
      canvasWidth?: number;
    @Input()
      canvasHeight?: number;
    @Input()
      gridSize?: number;
    @Input()
      useDockview = false;
    @Input()
      symbolSettings: SymbolSettings | null = null;
    @Output()
      symbolChange = new EventEmitter<SymbolDefinition>();
    @Output()
      saveRequest = new EventEmitter<SymbolDefinition>();
    @Output()
      symbolSettingsChange = new EventEmitter<{
        key: string;
        value: unknown;
    }>();

    private _clearChangesCalled = false;

    clearChanges(): void {
      this._clearChangesCalled = true;
    }

    get clearChangesCalled(): boolean {
      return this._clearChangesCalled;
    }

    resetClearChangesCalled(): void {
      this._clearChangesCalled = false;
    }
}

describe('SymbolEditorPageComponent', () => {
  let component: SymbolEditorPageComponent;
  let fixture: ComponentFixture<SymbolEditorPageComponent>;
  let mockSymbolLibraryService: MockedObject<SymbolLibraryService>;
  let mockBreadCrumbService: MockedObject<BreadCrumbService>;
  let mockNotificationService: MockedObject<NotificationService>;
  let mockRouter: MockedObject<Router>;

  const mockLibrary = {
    id: 'lib-1',
    name: 'Test Library',
    description: 'Test library description',
    version: '1.0.0',
    symbols: []
  };

  const mockSymbol: SymbolDefinition = {
    rtId: 'sym-1',
    name: 'Test Symbol',
    description: 'Test symbol description',
    version: '1.0.0',
    bounds: { width: 100, height: 100 },
    primitives: [],
    libraryRtId: 'lib-1'
  };

  beforeEach(async () => {
    mockSymbolLibraryService = {
      loadLibrary: vi.fn().mockName('SymbolLibraryService.loadLibrary'),
      loadSymbol: vi.fn().mockName('SymbolLibraryService.loadSymbol'),
      updateSymbol: vi.fn().mockName('SymbolLibraryService.updateSymbol')
    } as unknown as MockedObject<SymbolLibraryService>;
    mockBreadCrumbService = {
      updateBreadcrumbLabels: vi.fn().mockName('BreadCrumbService.updateBreadcrumbLabels')
    } as unknown as MockedObject<BreadCrumbService>;
    mockNotificationService = {
      show: vi.fn().mockName('NotificationService.show')
    } as unknown as MockedObject<NotificationService>;
    mockRouter = {
      navigate: vi.fn().mockName('Router.navigate')
    } as unknown as MockedObject<Router>;

    // Setup default return values
    mockSymbolLibraryService.loadLibrary.mockResolvedValue(mockLibrary);
    mockSymbolLibraryService.loadSymbol.mockResolvedValue(mockSymbol);
    mockSymbolLibraryService.updateSymbol.mockResolvedValue(mockSymbol);
    mockBreadCrumbService.updateBreadcrumbLabels.mockResolvedValue();

    await TestBed.configureTestingModule({
      imports: [
        SymbolEditorPageComponent,
        MockSymbolEditorComponent
      ],
      providers: [
        { provide: SymbolLibraryService, useValue: mockSymbolLibraryService },
        { provide: BreadCrumbService, useValue: mockBreadCrumbService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => {
                  if (key === 'libraryId')
                    return 'lib-1';
                  if (key === 'symbolId')
                    return 'sym-1';
                  return null;
                }
              }
            }
          }
        }
      ]
    })
      .overrideComponent(SymbolEditorPageComponent, {
        remove: {
          imports: []
        },
        add: {
          imports: [MockSymbolEditorComponent]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(SymbolEditorPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasUnsavedChanges', () => {
    it('should initially have no unsaved changes', () => {
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('should mark as changed when onSymbolChange is called after initialization', fakeAsync(() => {
      // Initialize the component
      fixture.detectChanges();
      tick(200); // Wait for initialization to complete (100ms timeout + buffer)

      // Simulate a symbol change
      const updatedSymbol = { ...mockSymbol, name: 'Updated Name' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      expect(component.hasUnsavedChanges()).toBe(true);
    }));

    it('should NOT mark as changed during initialization phase', fakeAsync(() => {
      // Initialize the component
      fixture.detectChanges();

      // Simulate a symbol change BEFORE initialization completes
      const updatedSymbol = { ...mockSymbol, name: 'Updated Name' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      // Should still be false because we're in initialization phase
      expect(component.hasUnsavedChanges()).toBe(false);

      tick(200); // Complete initialization
    }));
  });

  describe('save behavior', () => {
    beforeEach(fakeAsync(() => {
      // Initialize the component fully
      fixture.detectChanges();
      tick(200);

      // Mark as changed
      const updatedSymbol = { ...mockSymbol, name: 'Updated Name' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);
      expect(component.hasUnsavedChanges()).toBe(true);
    }));

    it('should clear unsaved changes after successful save', fakeAsync(() => {
      // Perform save
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick(); // Process the async save

      expect(component.hasUnsavedChanges()).toBe(false);
      expect(mockSymbolLibraryService.updateSymbol).toHaveBeenCalled();
    }));

    it('should NOT mark as changed if symbolChange fires during save', fakeAsync(() => {
      // This is the bug scenario:
      // 1. Save is called, hasUnsavedChanges is set to false
      // 2. symbol.set() triggers symbolChange
      // 3. hasUnsavedChanges should remain false (not get set back to true)

      let symbolChangeTriggeredDuringSave = false;

      // Intercept updateSymbol to trigger symbolChange at the right moment
      mockSymbolLibraryService.updateSymbol.mockImplementation(async (symbol: SymbolDefinition) => {
        // Verify isSaving is true during the save
        expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(true);

        // Simulate what happens in saveSymbol AFTER updateSymbol returns:
        // 1. symbol.set() is called which triggers symbolChange
        // We simulate this by calling onSymbolChange directly
        // At this point isSaving is still true
        const updatedSymbol = { ...mockSymbol, name: 'Triggered During Save' };
        (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);
        symbolChangeTriggeredDuringSave = true;

        return symbol;
      });

      // Perform save
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick(); // Complete the save

      // Verify our simulation ran
      expect(symbolChangeTriggeredDuringSave).toBe(true);

      // The key assertion: hasUnsavedChanges should be false
      // because onSymbolChange was called while isSaving was true
      expect(component.hasUnsavedChanges()).toBe(false);
    }));

    it('should remain clean after save even if user makes new edits', fakeAsync(() => {
      // After saving, if the user makes a new edit, hasUnsavedChanges should be true
      // This tests that our fix doesn't break normal editing

      // Perform save
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick(); // Complete the save

      // At this point isSaving() is false and hasUnsavedChanges is false
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(false);
      expect(component.hasUnsavedChanges()).toBe(false);

      // Now simulate a real user edit (after save completes)
      const updatedSymbol = { ...mockSymbol, name: 'New Edit After Save' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      // This SHOULD mark as changed because it's a real user edit
      expect(component.hasUnsavedChanges()).toBe(true);
    }));

    it('should show success notification after save', fakeAsync(() => {
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect(mockNotificationService.show).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Symbol saved successfully',
        type: expect.objectContaining({ style: 'success' })
      }));
    }));

    it('should show error notification on save failure', fakeAsync(() => {
      mockSymbolLibraryService.updateSymbol.mockRejectedValue(new Error('Save failed'));

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect(mockNotificationService.show).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Failed to save symbol',
        type: expect.objectContaining({ style: 'error' })
      }));

      // Should still have unsaved changes after failed save
      expect(component.hasUnsavedChanges()).toBe(true);
    }));

    it('should set isSaving to false after save completes', fakeAsync(() => {
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(false);

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(true);

      tick();
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(false);
    }));

    it('should set isSaving to false even after save failure', fakeAsync(() => {
      mockSymbolLibraryService.updateSymbol.mockRejectedValue(new Error('Save failed'));

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBe(false);
    }));
  });

  describe('symbolSettingsChange', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(200);

      // Set initial symbol
      (component as unknown as SymbolEditorPageTestAccess)._currentSymbol = { ...mockSymbol };
    }));

    it('should mark as changed when settings change', () => {
      (component as unknown as SymbolEditorPageTestAccess).onSymbolSettingsChange({ key: 'name', value: 'New Name' });
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should update canvas size when canvasWidth changes', () => {
      (component as unknown as SymbolEditorPageTestAccess).onSymbolSettingsChange({ key: 'canvasWidth', value: 500 });
      expect((component as unknown as SymbolEditorPageTestAccess)._currentSymbol!.canvasSize?.width).toBe(500);
    });

    it('should update grid size', () => {
      (component as unknown as SymbolEditorPageTestAccess).onSymbolSettingsChange({ key: 'gridSize', value: 20 });
      expect((component as unknown as SymbolEditorPageTestAccess)._currentSymbol!.gridSize).toBe(20);
    });
  });
});
