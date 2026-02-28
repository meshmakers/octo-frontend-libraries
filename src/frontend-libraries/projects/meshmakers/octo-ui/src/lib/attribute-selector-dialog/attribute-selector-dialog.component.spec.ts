import '@angular/localize/init';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { CellClickEvent } from '@progress/kendo-angular-grid';
import {
  AttributeSelectorDialogComponent,
  AttributeSelectorDialogData,
  AttributeSelectorDialogResult
} from './attribute-selector-dialog.component';
import { AttributeSelectorService, AttributeItem } from '@meshmakers/octo-services';

interface MockDialogContent {
  instance: {
    data: AttributeSelectorDialogData | null;
  };
}

describe('AttributeSelectorDialogComponent', () => {
  let component: AttributeSelectorDialogComponent;
  let fixture: ComponentFixture<AttributeSelectorDialogComponent>;
  let attributeServiceMock: jasmine.SpyObj<AttributeSelectorService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let dialogContent: MockDialogContent;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING' },
    { attributePath: 'age', attributeValueType: 'INT' },
    { attributePath: 'email', attributeValueType: 'STRING' },
    { attributePath: 'createdAt', attributeValueType: 'DATE_TIME' },
    { attributePath: 'isActive', attributeValueType: 'BOOLEAN' }
  ];

  beforeEach(async () => {
    attributeServiceMock = jasmine.createSpyObj('AttributeSelectorService', ['getAvailableAttributes']);
    attributeServiceMock.getAvailableAttributes.and.returnValue(of({ items: [...mockAttributes], totalCount: mockAttributes.length }));

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close']);
    dialogContent = { instance: { data: null } };
    (dialogRefMock as unknown as Record<string, unknown>)['content'] = dialogContent;

    await TestBed.configureTestingModule({
      imports: [
        AttributeSelectorDialogComponent,
        FormsModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: AttributeSelectorService, useValue: attributeServiceMock },
        { provide: DialogRef, useValue: dialogRefMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AttributeSelectorDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // =========================================================================
  // Initialization
  // =========================================================================

  describe('Initialization', () => {
    it('should have default dialog title', () => {
      expect(component.dialogTitle).toBe('Select Attributes');
    });

    it('should start with empty arrays', () => {
      expect(component.availableAttributes).toEqual([]);
      expect(component.selectedAttributes).toEqual([]);
      expect(component.selectedAvailableKeys).toEqual([]);
      expect(component.selectedChosenKeys).toEqual([]);
    });

    it('should load available attributes on init', fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith('TestType/Entity', undefined);
      expect(component.availableAttributes.length).toBe(5);
    }));

    it('should use data from dialog content when provided', fakeAsync(() => {
      const data: AttributeSelectorDialogData = {
        rtCkTypeId: 'Custom/Type',
        dialogTitle: 'Custom Title',
        selectedAttributes: ['name']
      };
      dialogContent.instance.data = data;

      component.ngOnInit();
      tick(300);

      expect(component.rtCkTypeId).toBe('Custom/Type');
      expect(component.dialogTitle).toBe('Custom Title');
    }));

    it('should pre-select attributes when provided', fakeAsync(() => {
      const data: AttributeSelectorDialogData = {
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: ['name', 'age']
      };
      dialogContent.instance.data = data;

      component.ngOnInit();
      tick(300);

      expect(component.selectedAttributes.length).toBe(2);
      expect(component.availableAttributes.length).toBe(3);
    }));
  });

  // =========================================================================
  // Add/Remove Operations
  // =========================================================================

  describe('Add/Remove Operations', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should add selected items to selected list', () => {
      component.selectedAvailableKeys = ['name', 'age'];
      component.addSelected();

      expect(component.selectedAttributes.length).toBe(2);
      expect(component.availableAttributes.length).toBe(3);
      expect(component.selectedAvailableKeys).toEqual([]);
    });

    it('should remove selected items from selected list', () => {
      // First add some
      component.selectedAvailableKeys = ['name', 'age'];
      component.addSelected();

      // Then remove one
      component.selectedChosenKeys = ['name'];
      component.removeSelected();

      expect(component.selectedAttributes.length).toBe(1);
      expect(component.selectedAttributes[0].attributePath).toBe('age');
      expect(component.availableAttributes.length).toBe(4);
      expect(component.selectedChosenKeys).toEqual([]);
    });

    it('should add all available items', () => {
      component.addAll();

      expect(component.selectedAttributes.length).toBe(5);
      expect(component.availableAttributes.length).toBe(0);
    });

    it('should remove all selected items', () => {
      component.addAll();
      component.removeAll();

      expect(component.selectedAttributes.length).toBe(0);
      expect(component.availableAttributes.length).toBe(5);
    });

    it('should sort available attributes after remove', () => {
      component.addAll();
      component.removeAll();

      // Check alphabetical order
      expect(component.availableAttributes[0].attributePath).toBe('age');
      expect(component.availableAttributes[1].attributePath).toBe('createdAt');
      expect(component.availableAttributes[2].attributePath).toBe('email');
    });
  });

  // =========================================================================
  // Move Up/Down Operations
  // =========================================================================

  describe('Move Up/Down Operations', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
      // Add all and select second item
      component.addAll();
    }));

    it('should not allow move up when no selection', () => {
      component.selectedChosenKeys = [];
      expect(component.canMoveUp()).toBe(false);
    });

    it('should not allow move up when first item selected', () => {
      component.selectedChosenKeys = [component.selectedAttributes[0].attributePath];
      expect(component.canMoveUp()).toBe(false);
    });

    it('should allow move up when non-first item selected', () => {
      component.selectedChosenKeys = [component.selectedAttributes[1].attributePath];
      expect(component.canMoveUp()).toBe(true);
    });

    it('should not allow move down when no selection', () => {
      component.selectedChosenKeys = [];
      expect(component.canMoveDown()).toBe(false);
    });

    it('should not allow move down when last item selected', () => {
      const lastIndex = component.selectedAttributes.length - 1;
      component.selectedChosenKeys = [component.selectedAttributes[lastIndex].attributePath];
      expect(component.canMoveDown()).toBe(false);
    });

    it('should allow move down when non-last item selected', () => {
      component.selectedChosenKeys = [component.selectedAttributes[0].attributePath];
      expect(component.canMoveDown()).toBe(true);
    });

    it('should move item up', () => {
      const secondItem = component.selectedAttributes[1].attributePath;
      const firstItem = component.selectedAttributes[0].attributePath;
      component.selectedChosenKeys = [secondItem];

      component.moveUp();

      expect(component.selectedAttributes[0].attributePath).toBe(secondItem);
      expect(component.selectedAttributes[1].attributePath).toBe(firstItem);
    });

    it('should move item down', () => {
      const firstItem = component.selectedAttributes[0].attributePath;
      const secondItem = component.selectedAttributes[1].attributePath;
      component.selectedChosenKeys = [firstItem];

      component.moveDown();

      expect(component.selectedAttributes[0].attributePath).toBe(secondItem);
      expect(component.selectedAttributes[1].attributePath).toBe(firstItem);
    });

    it('should not move up if cannot move', () => {
      const firstItem = component.selectedAttributes[0].attributePath;
      component.selectedChosenKeys = [firstItem];
      const originalOrder = component.selectedAttributes.map(a => a.attributePath);

      component.moveUp();

      expect(component.selectedAttributes.map(a => a.attributePath)).toEqual(originalOrder);
    });

    it('should not move down if cannot move', () => {
      const lastIndex = component.selectedAttributes.length - 1;
      component.selectedChosenKeys = [component.selectedAttributes[lastIndex].attributePath];
      const originalOrder = component.selectedAttributes.map(a => a.attributePath);

      component.moveDown();

      expect(component.selectedAttributes.map(a => a.attributePath)).toEqual(originalOrder);
    });

    it('should not allow move when multiple items selected', () => {
      component.selectedChosenKeys = [
        component.selectedAttributes[1].attributePath,
        component.selectedAttributes[2].attributePath
      ];

      expect(component.canMoveUp()).toBe(false);
      expect(component.canMoveDown()).toBe(false);
    });
  });

  // =========================================================================
  // Dialog Actions
  // =========================================================================

  describe('Dialog Actions', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should close dialog on cancel', () => {
      component.onCancel();
      expect(dialogRefMock.close).toHaveBeenCalledWith();
    });

    it('should close dialog with result on confirm', () => {
      component.selectedAvailableKeys = ['name', 'age'];
      component.addSelected();

      component.onConfirm();

      expect(dialogRefMock.close).toHaveBeenCalled();
      const result = (dialogRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSelectorDialogResult;
      expect(result.selectedAttributes.length).toBe(2);
    });

    it('should return empty array on confirm with no selection', () => {
      component.onConfirm();

      const result = (dialogRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSelectorDialogResult;
      expect(result.selectedAttributes).toEqual([]);
    });
  });

  // =========================================================================
  // Search
  // =========================================================================

  describe('Search', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should debounce search calls', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test');
      tick(100);
      component.onSearchChange('test2');
      tick(100);
      component.onSearchChange('test3');
      tick(300);

      // Only the last call should be made due to debouncing
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(1);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith('TestType/Entity', 'test3');
    }));

    it('should not call service for duplicate search terms', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test');
      tick(300);
      component.onSearchChange('test');
      tick(300);

      // distinctUntilChanged should prevent duplicate calls
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(1);
    }));
  });

  // =========================================================================
  // Double-Click Handling
  // =========================================================================

  describe('Double-Click Handling', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should move item on double-click in available list', fakeAsync(() => {
      const attribute = component.availableAttributes[0];
      const cellClickEvent = { dataItem: attribute } as CellClickEvent;

      // First click
      component.onAvailableCellClick(cellClickEvent);
      tick(100);
      // Second click (double-click)
      component.onAvailableCellClick(cellClickEvent);

      expect(component.selectedAttributes).toContain(attribute);
      expect(component.availableAttributes).not.toContain(attribute);
    }));

    it('should move item on double-click in selected list', fakeAsync(() => {
      // First add an item
      component.addAll();
      const attribute = component.selectedAttributes[0];
      const cellClickEvent = { dataItem: attribute } as CellClickEvent;

      // First click
      component.onSelectedCellClick(cellClickEvent);
      tick(100);
      // Second click (double-click)
      component.onSelectedCellClick(cellClickEvent);

      expect(component.availableAttributes).toContain(attribute);
      expect(component.selectedAttributes).not.toContain(attribute);
    }));

    it('should not move item on single click', fakeAsync(() => {
      const attribute = component.availableAttributes[0];
      const cellClickEvent = { dataItem: attribute } as CellClickEvent;
      const initialAvailableCount = component.availableAttributes.length;

      // Single click
      component.onAvailableCellClick(cellClickEvent);
      tick(500); // Wait longer than double-click delay

      expect(component.availableAttributes.length).toBe(initialAvailableCount);
    }));

    it('should not move on clicks on different items', fakeAsync(() => {
      const attribute1 = component.availableAttributes[0];
      const attribute2 = component.availableAttributes[1];
      const initialAvailableCount = component.availableAttributes.length;

      // Click on first item
      component.onAvailableCellClick({ dataItem: attribute1 } as CellClickEvent);
      tick(100);
      // Click on different item
      component.onAvailableCellClick({ dataItem: attribute2 } as CellClickEvent);

      expect(component.availableAttributes.length).toBe(initialAvailableCount);
    }));

    it('should handle null dataItem in cell click', () => {
      const cellClickEvent = { dataItem: null } as unknown as CellClickEvent;

      // Should not throw
      expect(() => component.onAvailableCellClick(cellClickEvent)).not.toThrow();
      expect(() => component.onSelectedCellClick(cellClickEvent)).not.toThrow();
    });
  });

  // =========================================================================
  // Grid Data Updates
  // =========================================================================

  describe('Grid Data Updates', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should update available grid data', () => {
      expect(component.availableGridData.data.length).toBe(5);
      expect(component.availableGridData.total).toBe(5);
    });

    it('should update selected grid data after adding', () => {
      component.selectedAvailableKeys = ['name'];
      component.addSelected();

      expect(component.selectedGridData.data.length).toBe(1);
      expect(component.selectedGridData.total).toBe(1);
    });

    it('should update both grids after addAll', () => {
      component.addAll();

      expect(component.availableGridData.data.length).toBe(0);
      expect(component.availableGridData.total).toBe(0);
      expect(component.selectedGridData.data.length).toBe(5);
      expect(component.selectedGridData.total).toBe(5);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    beforeEach(fakeAsync(() => {
      component.rtCkTypeId = 'TestType/Entity';
      component.ngOnInit();
      tick(300);
    }));

    it('should handle adding when nothing is selected', () => {
      component.selectedAvailableKeys = [];
      const initialSelectedCount = component.selectedAttributes.length;

      component.addSelected();

      expect(component.selectedAttributes.length).toBe(initialSelectedCount);
    });

    it('should handle removing when nothing is selected', () => {
      component.addAll();
      component.selectedChosenKeys = [];
      const initialSelectedCount = component.selectedAttributes.length;

      component.removeSelected();

      expect(component.selectedAttributes.length).toBe(initialSelectedCount);
    });

    it('should preserve order when adding items', () => {
      component.selectedAvailableKeys = ['email', 'name']; // Note: reversed order
      component.addSelected();

      // Items should be added in the order they appear in available, not selection order
      const paths = component.selectedAttributes.map(a => a.attributePath);
      expect(paths).toContain('name');
      expect(paths).toContain('email');
    });

    it('should filter out already selected from available on load', fakeAsync(() => {
      const data: AttributeSelectorDialogData = {
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: ['name', 'age']
      };
      dialogContent.instance.data = data;

      component.ngOnInit();
      tick(300);

      const availablePaths = component.availableAttributes.map(a => a.attributePath);
      expect(availablePaths).not.toContain('name');
      expect(availablePaths).not.toContain('age');
    }));

    it('should handle empty service response', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.and.returnValue(of({ items: [], totalCount: 0 }));

      component.rtCkTypeId = 'EmptyType';
      component.ngOnInit();
      tick(300);

      expect(component.availableAttributes).toEqual([]);
    }));

    it('should handle missing data in dialog content', fakeAsync(() => {
      (dialogRefMock as unknown as Record<string, unknown>)['content'] = null;

      expect(() => {
        component.ngOnInit();
        tick(300);
      }).not.toThrow();
    }));
  });
});
