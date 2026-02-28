import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
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
  onSymbolSettingsChange(event: { key: string; value: unknown }): void;
}

// Mock SymbolEditorComponent to avoid complex dependencies
@Component({
  selector: 'mm-symbol-editor',
  standalone: true,
  template: '<div>Mock Symbol Editor</div>'
})
class MockSymbolEditorComponent {
  @Input() symbol: SymbolDefinition | null = null;
  @Input() canvasWidth?: number;
  @Input() canvasHeight?: number;
  @Input() gridSize?: number;
  @Input() useDockview = false;
  @Input() symbolSettings: SymbolSettings | null = null;
  @Output() symbolChange = new EventEmitter<SymbolDefinition>();
  @Output() saveRequest = new EventEmitter<SymbolDefinition>();
  @Output() symbolSettingsChange = new EventEmitter<{ key: string; value: unknown }>();

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
  let mockSymbolLibraryService: jasmine.SpyObj<SymbolLibraryService>;
  let mockBreadCrumbService: jasmine.SpyObj<BreadCrumbService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockRouter: jasmine.SpyObj<Router>;

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
    mockSymbolLibraryService = jasmine.createSpyObj('SymbolLibraryService', [
      'loadLibrary',
      'loadSymbol',
      'updateSymbol'
    ]);
    mockBreadCrumbService = jasmine.createSpyObj('BreadCrumbService', ['updateBreadcrumbLabels']);
    mockNotificationService = jasmine.createSpyObj('NotificationService', ['show']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    // Setup default return values
    mockSymbolLibraryService.loadLibrary.and.returnValue(Promise.resolve(mockLibrary));
    mockSymbolLibraryService.loadSymbol.and.returnValue(Promise.resolve(mockSymbol));
    mockSymbolLibraryService.updateSymbol.and.returnValue(Promise.resolve(mockSymbol));
    mockBreadCrumbService.updateBreadcrumbLabels.and.returnValue(Promise.resolve());

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
                  if (key === 'libraryId') return 'lib-1';
                  if (key === 'symbolId') return 'sym-1';
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
      expect(component.hasUnsavedChanges()).toBeFalse();
    });

    it('should mark as changed when onSymbolChange is called after initialization', fakeAsync(() => {
      // Initialize the component
      fixture.detectChanges();
      tick(200); // Wait for initialization to complete (100ms timeout + buffer)

      // Simulate a symbol change
      const updatedSymbol = { ...mockSymbol, name: 'Updated Name' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      expect(component.hasUnsavedChanges()).toBeTrue();
    }));

    it('should NOT mark as changed during initialization phase', fakeAsync(() => {
      // Initialize the component
      fixture.detectChanges();

      // Simulate a symbol change BEFORE initialization completes
      const updatedSymbol = { ...mockSymbol, name: 'Updated Name' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      // Should still be false because we're in initialization phase
      expect(component.hasUnsavedChanges()).toBeFalse();

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
      expect(component.hasUnsavedChanges()).toBeTrue();
    }));

    it('should clear unsaved changes after successful save', fakeAsync(() => {
      // Perform save
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick(); // Process the async save

      expect(component.hasUnsavedChanges()).toBeFalse();
      expect(mockSymbolLibraryService.updateSymbol).toHaveBeenCalled();
    }));

    it('should NOT mark as changed if symbolChange fires during save', fakeAsync(() => {
      // This is the bug scenario:
      // 1. Save is called, hasUnsavedChanges is set to false
      // 2. symbol.set() triggers symbolChange
      // 3. hasUnsavedChanges should remain false (not get set back to true)

      let symbolChangeTriggeredDuringSave = false;

      // Intercept updateSymbol to trigger symbolChange at the right moment
      mockSymbolLibraryService.updateSymbol.and.callFake(async (symbol: SymbolDefinition) => {
        // Verify isSaving is true during the save
        expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeTrue();

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
      expect(symbolChangeTriggeredDuringSave).toBeTrue();

      // The key assertion: hasUnsavedChanges should be false
      // because onSymbolChange was called while isSaving was true
      expect(component.hasUnsavedChanges()).toBeFalse();
    }));

    it('should remain clean after save even if user makes new edits', fakeAsync(() => {
      // After saving, if the user makes a new edit, hasUnsavedChanges should be true
      // This tests that our fix doesn't break normal editing

      // Perform save
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick(); // Complete the save

      // At this point isSaving() is false and hasUnsavedChanges is false
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeFalse();
      expect(component.hasUnsavedChanges()).toBeFalse();

      // Now simulate a real user edit (after save completes)
      const updatedSymbol = { ...mockSymbol, name: 'New Edit After Save' };
      (component as unknown as SymbolEditorPageTestAccess).onSymbolChange(updatedSymbol);

      // This SHOULD mark as changed because it's a real user edit
      expect(component.hasUnsavedChanges()).toBeTrue();
    }));

    it('should show success notification after save', fakeAsync(() => {
      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect(mockNotificationService.show).toHaveBeenCalledWith(
        jasmine.objectContaining({
          content: 'Symbol saved successfully',
          type: jasmine.objectContaining({ style: 'success' })
        })
      );
    }));

    it('should show error notification on save failure', fakeAsync(() => {
      mockSymbolLibraryService.updateSymbol.and.returnValue(Promise.reject(new Error('Save failed')));

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect(mockNotificationService.show).toHaveBeenCalledWith(
        jasmine.objectContaining({
          content: 'Failed to save symbol',
          type: jasmine.objectContaining({ style: 'error' })
        })
      );

      // Should still have unsaved changes after failed save
      expect(component.hasUnsavedChanges()).toBeTrue();
    }));

    it('should set isSaving to false after save completes', fakeAsync(() => {
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeFalse();

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeTrue();

      tick();
      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeFalse();
    }));

    it('should set isSaving to false even after save failure', fakeAsync(() => {
      mockSymbolLibraryService.updateSymbol.and.returnValue(Promise.reject(new Error('Save failed')));

      (component as unknown as SymbolEditorPageTestAccess).saveSymbol();
      tick();

      expect((component as unknown as SymbolEditorPageTestAccess).isSaving()).toBeFalse();
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
      expect(component.hasUnsavedChanges()).toBeTrue();
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
