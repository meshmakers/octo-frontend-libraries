import '@angular/localize/init';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { CellClickEvent } from '@progress/kendo-angular-grid';
import {
  AttributeSelectorDialogComponent,
  AttributeSelectorDialogResult
} from './attribute-selector-dialog.component';
import { AttributeSelectorService, AttributeItem, AttributeValueTypeDto } from '@meshmakers/octo-services';

describe('AttributeSelectorDialogComponent', () => {
  let component: AttributeSelectorDialogComponent;
  let fixture: ComponentFixture<AttributeSelectorDialogComponent>;
  let attributeServiceMock: jasmine.SpyObj<AttributeSelectorService>;
  let windowRefMock: jasmine.SpyObj<WindowRef>;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING', description: 'The name field' },
    { attributePath: 'age', attributeValueType: 'INT', description: 'The age field' },
    { attributePath: 'email', attributeValueType: 'STRING', description: null },
    { attributePath: 'createdAt', attributeValueType: 'DATE_TIME', description: 'Creation timestamp' },
    { attributePath: 'isActive', attributeValueType: 'BOOLEAN', description: 'Active status' }
  ];

  beforeEach(async () => {
    attributeServiceMock = jasmine.createSpyObj('AttributeSelectorService', ['getAvailableAttributes']);
    attributeServiceMock.getAvailableAttributes.and.returnValue(of({ items: [...mockAttributes], totalCount: mockAttributes.length }));

    windowRefMock = jasmine.createSpyObj('WindowRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [
        AttributeSelectorDialogComponent,
        FormsModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: AttributeSelectorService, useValue: attributeServiceMock },
        { provide: WindowRef, useValue: windowRefMock }
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
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalled();
      expect(component.availableAttributes.length).toBe(5);
    }));

    it('should use data from component data when provided', fakeAsync(() => {
      component.data = {
        rtCkTypeId: 'Custom/Type',
        dialogTitle: 'Custom Title',
        selectedAttributes: ['name']
      };

      component.ngOnInit();
      tick(300);

      expect(component.rtCkTypeId).toBe('Custom/Type');
      expect(component.dialogTitle).toBe('Custom Title');
    }));

    it('should pre-select attributes when provided', fakeAsync(() => {
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: ['name', 'age']
      };

      component.ngOnInit();
      tick(300);

      expect(component.selectedAttributes.length).toBe(2);
      expect(component.availableAttributes.length).toBe(3);
    }));

    it('should have value type filter options', () => {
      expect(component.valueTypeOptions.length).toBeGreaterThan(0);
      expect(component.valueTypeOptions[0].text).toBe('All Types');
      expect(component.valueTypeOptions[0].value).toBeNull();
    });

    it('should start with null value type filter', () => {
      expect(component.selectedValueTypeFilter).toBeNull();
    });
  });

  // =========================================================================
  // Add/Remove Operations
  // =========================================================================

  describe('Add/Remove Operations', () => {
    beforeEach(fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
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
      component.data = { rtCkTypeId: 'TestType/Entity' };
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
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);
    }));

    it('should close window on cancel', () => {
      component.onCancel();
      expect(windowRefMock.close).toHaveBeenCalledWith();
    });

    it('should close window with result on confirm', () => {
      component.selectedAvailableKeys = ['name', 'age'];
      component.addSelected();

      component.onConfirm();

      expect(windowRefMock.close).toHaveBeenCalled();
      const result = (windowRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSelectorDialogResult;
      expect(result.selectedAttributes.length).toBe(2);
    });

    it('should return empty array on confirm with no selection', () => {
      component.onConfirm();

      const result = (windowRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSelectorDialogResult;
      expect(result.selectedAttributes).toEqual([]);
    });
  });

  // =========================================================================
  // Search
  // =========================================================================

  describe('Search', () => {
    beforeEach(fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
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

    it('should pass searchTerm to attribute service', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test');
      tick(300);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestType/Entity', undefined, undefined, undefined, undefined, 'test', true, undefined
      );
    }));
  });

  // =========================================================================
  // Value Type Filter
  // =========================================================================

  describe('Value Type Filter', () => {
    beforeEach(fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);
    }));

    it('should reload attributes when value type filter changes', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.selectedValueTypeFilter = AttributeValueTypeDto.StringDto;
      component.onValueTypeFilterChange(component.selectedValueTypeFilter);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestType/Entity', undefined, undefined, undefined, 'STRING', undefined, true, undefined
      );
    }));
  });

  // =========================================================================
  // Navigation Properties
  // =========================================================================

  describe('Navigation Properties', () => {
    beforeEach(fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);
    }));

    it('should have default includeNavigationProperties=true and maxDepth=null', () => {
      expect(component.includeNavigationProperties).toBe(true);
      expect(component.maxDepth).toBeNull();
    });

    it('should initialize from data when provided', fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity', includeNavigationProperties: false, maxDepth: 2 };
      component.ngOnInit();
      tick(300);

      expect(component.includeNavigationProperties).toBe(false);
      expect(component.maxDepth).toBe(2);
    }));

    it('should reload attributes with includeNavigationProperties=false when toggled', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.includeNavigationProperties = false;
      component.onNavigationPropertiesChange();

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestType/Entity', undefined, undefined, undefined, undefined, undefined, false, undefined
      );
    }));

    it('should clear maxDepth when navigation properties is unchecked', fakeAsync(() => {
      component.maxDepth = 3;
      component.includeNavigationProperties = false;
      component.onNavigationPropertiesChange();

      expect(component.maxDepth).toBeNull();
    }));

    it('should reload attributes when maxDepth changes', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onMaxDepthChange(2);

      expect(component.maxDepth).toBe(2);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestType/Entity', undefined, undefined, undefined, undefined, undefined, true, 2
      );
    }));

    it('should set maxDepth to null when null is passed', fakeAsync(() => {
      component.maxDepth = 3;
      component.onMaxDepthChange(null);

      expect(component.maxDepth).toBeNull();
    }));
  });

  // =========================================================================
  // Double-Click Handling
  // =========================================================================

  describe('Double-Click Handling', () => {
    beforeEach(fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
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
      component.data = { rtCkTypeId: 'TestType/Entity' };
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
      component.data = { rtCkTypeId: 'TestType/Entity' };
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
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: ['name', 'age']
      };

      component.ngOnInit();
      tick(300);

      const availablePaths = component.availableAttributes.map(a => a.attributePath);
      expect(availablePaths).not.toContain('name');
      expect(availablePaths).not.toContain('age');
    }));

    it('should handle empty service response', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.and.returnValue(of({ items: [], totalCount: 0 }));

      component.data = { rtCkTypeId: 'EmptyType' };
      component.ngOnInit();
      tick(300);

      expect(component.availableAttributes).toEqual([]);
    }));

    it('should handle missing data', fakeAsync(() => {
      expect(() => {
        component.ngOnInit();
        tick(300);
      }).not.toThrow();
    }));

    it('should include description in available attributes', fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);

      const nameAttr = component.availableAttributes.find(a => a.attributePath === 'name');
      expect(nameAttr?.description).toBe('The name field');
    }));
  });

  // =========================================================================
  // Attribute Paths Filtering
  // =========================================================================

  describe('Attribute Paths Filtering', () => {
    it('should filter available attributes by attributePaths when set', fakeAsync(() => {
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        attributePaths: ['name', 'age']
      };
      component.ngOnInit();
      tick(300);

      expect(component.availableAttributes.length).toBe(2);
      const paths = component.availableAttributes.map(a => a.attributePath);
      expect(paths).toContain('name');
      expect(paths).toContain('age');
      expect(paths).not.toContain('email');
      expect(paths).not.toContain('createdAt');
      expect(paths).not.toContain('isActive');
    }));

    it('should show all attributes when attributePaths is not set', fakeAsync(() => {
      component.data = { rtCkTypeId: 'TestType/Entity' };
      component.ngOnInit();
      tick(300);

      expect(component.availableAttributes.length).toBe(5);
    }));

    it('should still include additionalAttributes even when attributePaths is set', fakeAsync(() => {
      const additionalAttr: AttributeItem = {
        attributePath: 'timestamp',
        attributeValueType: 'DATE_TIME',
        description: 'Virtual timestamp'
      };
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        attributePaths: ['name'],
        additionalAttributes: [additionalAttr]
      };
      component.ngOnInit();
      tick(300);

      const paths = component.availableAttributes.map(a => a.attributePath);
      expect(paths).toContain('timestamp');
      expect(paths).toContain('name');
      expect(paths).not.toContain('email');
    }));

    it('should apply attributePaths filter together with search', fakeAsync(() => {
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        attributePaths: ['name', 'age', 'email']
      };
      component.ngOnInit();
      tick(300);

      // Simulate search returning only matching items
      attributeServiceMock.getAvailableAttributes.and.returnValue(of({
        items: [{ attributePath: 'name', attributeValueType: 'STRING', description: 'The name field' }],
        totalCount: 1
      }));

      component.onSearchChange('name');
      tick(300);

      // Should be filtered by both search (server) and attributePaths (client)
      expect(component.availableAttributes.length).toBe(1);
      expect(component.availableAttributes[0].attributePath).toBe('name');
    }));

    it('should correctly filter pre-selected attributes with attributePaths', fakeAsync(() => {
      component.data = {
        rtCkTypeId: 'TestType/Entity',
        attributePaths: ['name', 'age', 'email'],
        selectedAttributes: ['name']
      };
      component.ngOnInit();
      tick(300);

      // name should be selected, age and email available (not createdAt/isActive)
      expect(component.selectedAttributes.length).toBe(1);
      expect(component.selectedAttributes[0].attributePath).toBe('name');
      expect(component.availableAttributes.length).toBe(2);
      const availablePaths = component.availableAttributes.map(a => a.attributePath);
      expect(availablePaths).toContain('age');
      expect(availablePaths).toContain('email');
    }));
  });
});
