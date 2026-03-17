import '@angular/localize/init';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { GridComponent, CellClickEvent } from '@progress/kendo-angular-grid';
import { AttributeSelectorService, AttributeItem, AttributeValueTypeDto } from '@meshmakers/octo-services';
import {
  AttributeSortSelectorDialogComponent,
  AttributeSortItem,
  AttributeSortSelectorDialogData,
  AttributeSortSelectorDialogResult
} from './attribute-sort-selector-dialog.component';

describe('AttributeSortSelectorDialogComponent', () => {
  let component: AttributeSortSelectorDialogComponent;
  let fixture: ComponentFixture<AttributeSortSelectorDialogComponent>;
  let attributeServiceMock: jasmine.SpyObj<AttributeSelectorService>;
  let windowRefMock: jasmine.SpyObj<WindowRef>;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'String', description: 'The name' },
    { attributePath: 'age', attributeValueType: 'Integer', description: null },
    { attributePath: 'email', attributeValueType: 'String', description: 'Email address' },
    { attributePath: 'createdAt', attributeValueType: 'DateTime', description: 'Creation date' },
    { attributePath: 'isActive', attributeValueType: 'Boolean', description: 'Active status' }
  ];

  const mockDialogData: AttributeSortSelectorDialogData = {
    ckTypeId: 'TestCkType',
    dialogTitle: 'Test Dialog Title'
  };

  beforeEach(async () => {
    attributeServiceMock = jasmine.createSpyObj('AttributeSelectorService', ['getAvailableAttributes']);
    attributeServiceMock.getAvailableAttributes.and.returnValue(of({ items: [...mockAttributes], totalCount: mockAttributes.length }));

    windowRefMock = jasmine.createSpyObj('WindowRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [
        AttributeSortSelectorDialogComponent,
        FormsModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: AttributeSelectorService, useValue: attributeServiceMock },
        { provide: WindowRef, useValue: windowRefMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AttributeSortSelectorDialogComponent);
    component = fixture.componentInstance;
    component.data = { ...mockDialogData };
  });

  describe('Component creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have data-component attribute', () => {
      const hostElement = fixture.nativeElement;
      expect(hostElement.getAttribute('data-component')).toBe('attribute-sort-selector');
    });

    it('should initialize with default values', () => {
      expect(component.searchText).toBe('');
      expect(component.currentSortOrder).toBe('standard');
      expect(component.availableAttributes).toEqual([]);
      expect(component.selectedAttributes).toEqual([]);
      expect(component.selectedAvailableKeys).toEqual([]);
      expect(component.selectedChosenKeys).toEqual([]);
    });

    it('should have sort options defined', () => {
      expect(component.sortOptions).toEqual([
        { text: 'Standard', value: 'standard' },
        { text: 'Ascending', value: 'ascending' },
        { text: 'Descending', value: 'descending' }
      ]);
    });

    it('should have value type filter options', () => {
      expect(component.valueTypeOptions.length).toBeGreaterThan(0);
      expect(component.valueTypeOptions[0].text).toBe('All Types');
      expect(component.valueTypeOptions[0].value).toBeNull();
    });

    it('should start with null value type filter', () => {
      expect(component.selectedValueTypeFilter).toBeNull();
    });
  });

  describe('ngOnInit', () => {
    it('should set ckTypeId from dialog data', () => {
      fixture.detectChanges();
      expect(component.ckTypeId).toBe('TestCkType');
    });

    it('should set dialogTitle from dialog data', () => {
      fixture.detectChanges();
      expect(component.dialogTitle).toBe('Test Dialog Title');
    });

    it('should use default dialogTitle when not provided', () => {
      component.data = { ckTypeId: 'TestCkType' };
      fixture.detectChanges();
      expect(component.dialogTitle).toBe('Select Attributes with Sort Order');
    });

    it('should load available attributes on init', () => {
      fixture.detectChanges();
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalled();
      expect(component.availableAttributes.length).toBe(5);
    });

    it('should pre-populate selected attributes from dialog data', () => {
      const preSelected: AttributeSortItem[] = [
        { attributePath: 'name', attributeValueType: 'String', sortOrder: 'ascending' }
      ];
      component.data = {
        ckTypeId: 'TestCkType',
        selectedAttributes: preSelected
      };
      fixture.detectChanges();

      expect(component.selectedAttributes).toEqual(preSelected);
      // Pre-selected should be filtered from available
      expect(component.availableAttributes.find(a => a.attributePath === 'name')).toBeUndefined();
    });

    it('should filter out pre-selected attributes from available list', () => {
      const preSelected: AttributeSortItem[] = [
        { attributePath: 'name', attributeValueType: 'String', sortOrder: 'ascending' },
        { attributePath: 'email', attributeValueType: 'String', sortOrder: 'descending' }
      ];
      component.data = {
        ckTypeId: 'TestCkType',
        selectedAttributes: preSelected
      };
      fixture.detectChanges();

      expect(component.availableAttributes.length).toBe(3);
      expect(component.availableAttributes.map(a => a.attributePath)).not.toContain('name');
      expect(component.availableAttributes.map(a => a.attributePath)).not.toContain('email');
    });

    it('should handle empty dialog data gracefully', () => {
      component.data = null as unknown as AttributeSortSelectorDialogData;
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('should update available grid data', () => {
      fixture.detectChanges();
      expect(component.availableGridData.data.length).toBe(5);
      expect(component.availableGridData.total).toBe(5);
    });

    it('should update selected grid data with pre-populated items', () => {
      const preSelected: AttributeSortItem[] = [
        { attributePath: 'name', attributeValueType: 'String', sortOrder: 'ascending' }
      ];
      component.data = {
        ckTypeId: 'TestCkType',
        selectedAttributes: preSelected
      };
      fixture.detectChanges();

      expect(component.selectedGridData.data.length).toBe(1);
      expect(component.selectedGridData.total).toBe(1);
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should trigger search after debounce delay', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test');
      expect(attributeServiceMock.getAvailableAttributes).not.toHaveBeenCalled();

      tick(300);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestCkType', undefined, undefined, undefined, undefined, 'test', undefined, undefined
      );
    }));

    it('should not trigger search for same value (distinctUntilChanged)', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test');
      tick(300);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(1);

      component.onSearchChange('test');
      tick(300);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(1);
    }));

    it('should trigger search for different values', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test1');
      tick(300);
      component.onSearchChange('test2');
      tick(300);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(2);
    }));

    it('should cancel pending search when new value entered', fakeAsync(() => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.onSearchChange('test1');
      tick(150);
      component.onSearchChange('test2');
      tick(300);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledTimes(1);
      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestCkType', undefined, undefined, undefined, undefined, 'test2', undefined, undefined
      );
    }));
  });

  describe('Value Type Filter', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should reload attributes when value type filter changes', () => {
      attributeServiceMock.getAvailableAttributes.calls.reset();

      component.selectedValueTypeFilter = AttributeValueTypeDto.StringDto;
      component.onValueTypeFilterChange(component.selectedValueTypeFilter);

      expect(attributeServiceMock.getAvailableAttributes).toHaveBeenCalledWith(
        'TestCkType', undefined, undefined, undefined, 'STRING', undefined, undefined, undefined
      );
    });
  });

  describe('setSortOrder', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set sort order to standard', () => {
      component.setSortOrder('standard');
      expect(component.currentSortOrder).toBe('standard');
    });

    it('should set sort order to ascending', () => {
      component.setSortOrder('ascending');
      expect(component.currentSortOrder).toBe('ascending');
    });

    it('should set sort order to descending', () => {
      component.setSortOrder('descending');
      expect(component.currentSortOrder).toBe('descending');
    });

    it('should change sort order from one value to another', () => {
      component.setSortOrder('ascending');
      expect(component.currentSortOrder).toBe('ascending');

      component.setSortOrder('descending');
      expect(component.currentSortOrder).toBe('descending');
    });
  });

  describe('addAttributeWithSort', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should not add attribute when no selection', () => {
      component.selectedAvailableKeys = [];
      component.addAttributeWithSort();
      expect(component.selectedAttributes.length).toBe(0);
    });

    it('should add attribute with standard sort order', () => {
      component.selectedAvailableKeys = ['name'];
      component.currentSortOrder = 'standard';
      component.addAttributeWithSort();

      expect(component.selectedAttributes.length).toBe(1);
      expect(component.selectedAttributes[0]).toEqual({
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      });
    });

    it('should add attribute with ascending sort order', () => {
      component.selectedAvailableKeys = ['age'];
      component.currentSortOrder = 'ascending';
      component.addAttributeWithSort();

      expect(component.selectedAttributes[0].sortOrder).toBe('ascending');
    });

    it('should add attribute with descending sort order', () => {
      component.selectedAvailableKeys = ['email'];
      component.currentSortOrder = 'descending';
      component.addAttributeWithSort();

      expect(component.selectedAttributes[0].sortOrder).toBe('descending');
    });

    it('should remove attribute from available list after adding', () => {
      const initialCount = component.availableAttributes.length;
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();

      expect(component.availableAttributes.length).toBe(initialCount - 1);
      expect(component.availableAttributes.find(a => a.attributePath === 'name')).toBeUndefined();
    });

    it('should clear selection after adding', () => {
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();
      expect(component.selectedAvailableKeys).toEqual([]);
    });

    it('should update both grids after adding', () => {
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();

      expect(component.availableGridData.data.length).toBe(4);
      expect(component.selectedGridData.data.length).toBe(1);
    });

    it('should not add attribute that does not exist in available list', () => {
      component.selectedAvailableKeys = ['nonexistent'];
      component.addAttributeWithSort();
      expect(component.selectedAttributes.length).toBe(0);
    });
  });

  describe('onAvailableCellClick - single click', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should record click for potential double-click detection', () => {
      const event = createCellClickEvent({ attributePath: 'name', attributeValueType: 'String' });
      component.onAvailableCellClick(event);

      // Should not add attribute on single click
      expect(component.selectedAttributes.length).toBe(0);
    });

    it('should handle null dataItem', () => {
      const event = createCellClickEvent(null);
      expect(() => component.onAvailableCellClick(event)).not.toThrow();
    });
  });

  describe('onAvailableCellClick - double click', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should add attribute on double-click with current sort order', fakeAsync(() => {
      component.currentSortOrder = 'ascending';
      const event = createCellClickEvent({ attributePath: 'name', attributeValueType: 'String' });

      component.onAvailableCellClick(event);
      tick(100);
      component.onAvailableCellClick(event);

      expect(component.selectedAttributes.length).toBe(1);
      expect(component.selectedAttributes[0].sortOrder).toBe('ascending');
    }));

    it('should not trigger double-click if delay exceeded', fakeAsync(() => {
      const event = createCellClickEvent({ attributePath: 'name', attributeValueType: 'String' });

      component.onAvailableCellClick(event);
      tick(400);
      component.onAvailableCellClick(event);

      expect(component.selectedAttributes.length).toBe(0);
    }));

    it('should not trigger double-click on different items', fakeAsync(() => {
      const event1 = createCellClickEvent({ attributePath: 'name', attributeValueType: 'String' });
      const event2 = createCellClickEvent({ attributePath: 'age', attributeValueType: 'Integer' });

      component.onAvailableCellClick(event1);
      tick(100);
      component.onAvailableCellClick(event2);

      expect(component.selectedAttributes.length).toBe(0);
    }));
  });

  describe('onSelectedCellClick - double click to remove', () => {
    beforeEach(() => {
      fixture.detectChanges();
      // Add an attribute first
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();
    });

    it('should remove attribute on double-click', fakeAsync(() => {
      const sortItem: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      const event = createCellClickEvent(sortItem);

      component.onSelectedCellClick(event);
      tick(100);
      component.onSelectedCellClick(event);

      expect(component.selectedAttributes.length).toBe(0);
    }));

    it('should not remove on single click', () => {
      const sortItem: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      const event = createCellClickEvent(sortItem);

      component.onSelectedCellClick(event);
      expect(component.selectedAttributes.length).toBe(1);
    });

    it('should handle null dataItem', () => {
      const event = createCellClickEvent(null);
      expect(() => component.onSelectedCellClick(event)).not.toThrow();
    });
  });

  describe('removeAttribute', () => {
    beforeEach(() => {
      fixture.detectChanges();
      // Add attributes
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();
      component.selectedAvailableKeys = ['age'];
      component.addAttributeWithSort();
    });

    it('should remove attribute from selected list', () => {
      const toRemove: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      component.removeAttribute(toRemove);

      expect(component.selectedAttributes.length).toBe(1);
      expect(component.selectedAttributes.find(a => a.attributePath === 'name')).toBeUndefined();
    });

    it('should add removed attribute back to available list', () => {
      const toRemove: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      component.removeAttribute(toRemove);

      expect(component.availableAttributes.find(a => a.attributePath === 'name')).toBeDefined();
    });

    it('should sort available list after adding back', () => {
      // Remove 'age' which should be added back in alphabetical order
      const toRemove: AttributeSortItem = {
        attributePath: 'age',
        attributeValueType: 'Integer',
        sortOrder: 'standard'
      };
      component.removeAttribute(toRemove);

      const paths = component.availableAttributes.map(a => a.attributePath);
      const sortedPaths = [...paths].sort();
      expect(paths).toEqual(sortedPaths);
    });

    it('should clear selection keys for removed item', () => {
      component.selectedChosenKeys = ['name', 'age'];
      const toRemove: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      component.removeAttribute(toRemove);

      expect(component.selectedChosenKeys).not.toContain('name');
    });

    it('should update both grids after removing', () => {
      const toRemove: AttributeSortItem = {
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      };
      component.removeAttribute(toRemove);

      expect(component.selectedGridData.data.length).toBe(1);
      expect(component.availableGridData.total).toBe(4);
    });
  });

  describe('getSortIndicator', () => {
    it('should return ↑ for ascending', () => {
      expect(component.getSortIndicator('ascending')).toBe('↑');
    });

    it('should return ↓ for descending', () => {
      expect(component.getSortIndicator('descending')).toBe('↓');
    });

    it('should return empty string for standard', () => {
      expect(component.getSortIndicator('standard')).toBe('');
    });

    it('should return empty string for unknown sort order', () => {
      expect(component.getSortIndicator('unknown')).toBe('');
    });
  });

  describe('getSortText', () => {
    it('should return Standard for standard', () => {
      expect(component.getSortText('standard')).toBe('Standard');
    });

    it('should return Ascending for ascending', () => {
      expect(component.getSortText('ascending')).toBe('Ascending');
    });

    it('should return Descending for descending', () => {
      expect(component.getSortText('descending')).toBe('Descending');
    });

    it('should return raw value for unknown sort order', () => {
      expect(component.getSortText('unknown')).toBe('unknown');
    });
  });

  describe('onOk', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should close window with empty result when no selection', () => {
      component.onOk();

      expect(windowRefMock.close).toHaveBeenCalled();
      const result = (windowRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSortSelectorDialogResult;
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should close window with selected attributes', () => {
      component.selectedAvailableKeys = ['name'];
      component.currentSortOrder = 'ascending';
      component.addAttributeWithSort();

      component.selectedAvailableKeys = ['age'];
      component.currentSortOrder = 'descending';
      component.addAttributeWithSort();

      component.onOk();

      expect(windowRefMock.close).toHaveBeenCalled();
      const result = (windowRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSortSelectorDialogResult;
      expect(result.selectedAttributes.length).toBe(2);
      expect(result.selectedAttributes[0]).toEqual({
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'ascending'
      });
      expect(result.selectedAttributes[1]).toEqual({
        attributePath: 'age',
        attributeValueType: 'Integer',
        sortOrder: 'descending'
      });
    });
  });

  describe('onCancel', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should close window without result', () => {
      component.onCancel();
      expect(windowRefMock.close).toHaveBeenCalledWith();
    });

    it('should close window without result even with selections', () => {
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();

      component.onCancel();
      expect(windowRefMock.close).toHaveBeenCalledWith();
    });
  });

  describe('Grid data updates', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should update availableGridData correctly', () => {
      expect(component.availableGridData.data).toEqual(component.availableAttributes);
      expect(component.availableGridData.total).toBe(component.availableAttributes.length);
    });

    it('should update selectedGridData correctly', () => {
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();

      expect(component.selectedGridData.data).toEqual(component.selectedAttributes);
      expect(component.selectedGridData.total).toBe(1);
    });

    it('should keep grids in sync with data arrays', () => {
      // Add
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();
      expect(component.availableGridData.total).toBe(4);
      expect(component.selectedGridData.total).toBe(1);

      // Remove
      component.removeAttribute(component.selectedAttributes[0]);
      expect(component.availableGridData.total).toBe(5);
      expect(component.selectedGridData.total).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should allow adding multiple attributes with different sort orders', () => {
      component.selectedAvailableKeys = ['name'];
      component.currentSortOrder = 'ascending';
      component.addAttributeWithSort();

      component.selectedAvailableKeys = ['age'];
      component.currentSortOrder = 'descending';
      component.addAttributeWithSort();

      component.selectedAvailableKeys = ['email'];
      component.currentSortOrder = 'standard';
      component.addAttributeWithSort();

      expect(component.selectedAttributes.length).toBe(3);
      expect(component.selectedAttributes[0].sortOrder).toBe('ascending');
      expect(component.selectedAttributes[1].sortOrder).toBe('descending');
      expect(component.selectedAttributes[2].sortOrder).toBe('standard');
    });

    it('should preserve selection order', () => {
      component.selectedAvailableKeys = ['email'];
      component.addAttributeWithSort();
      component.selectedAvailableKeys = ['age'];
      component.addAttributeWithSort();
      component.selectedAvailableKeys = ['name'];
      component.addAttributeWithSort();

      const paths = component.selectedAttributes.map(a => a.attributePath);
      expect(paths).toEqual(['email', 'age', 'name']);
    });

    it('should handle complete workflow: add, modify sort, add more, remove, confirm', () => {
      // Add first attribute
      component.selectedAvailableKeys = ['name'];
      component.currentSortOrder = 'ascending';
      component.addAttributeWithSort();

      // Change sort order and add another
      component.currentSortOrder = 'descending';
      component.selectedAvailableKeys = ['age'];
      component.addAttributeWithSort();

      // Remove first
      component.removeAttribute(component.selectedAttributes[0]);

      // Add it back with different sort
      component.selectedAvailableKeys = ['name'];
      component.currentSortOrder = 'standard';
      component.addAttributeWithSort();

      // Confirm
      component.onOk();

      const result = (windowRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as AttributeSortSelectorDialogResult;
      expect(result.selectedAttributes.length).toBe(2);
      expect(result.selectedAttributes[0]).toEqual({
        attributePath: 'age',
        attributeValueType: 'Integer',
        sortOrder: 'descending'
      });
      expect(result.selectedAttributes[1]).toEqual({
        attributePath: 'name',
        attributeValueType: 'String',
        sortOrder: 'standard'
      });
    });
  });

  // Helper function to create mock CellClickEvent
  function createCellClickEvent(dataItem: AttributeItem | AttributeSortItem | null): CellClickEvent {
    return {
      dataItem,
      column: {},
      columnIndex: 0,
      rowIndex: 0,
      type: 'click',
      sender: {} as unknown as GridComponent,
      originalEvent: new Event('click'),
      isEdited: false,
      isEditedColumn: () => false
    } as CellClickEvent;
  }

  // =========================================================================
  // Attribute Paths Filtering
  // =========================================================================

  describe('Attribute Paths Filtering', () => {
    it('should filter available attributes by attributePaths when set', () => {
      component.data = {
        ckTypeId: 'TestCkType',
        attributePaths: ['name', 'age']
      };
      fixture.detectChanges();

      expect(component.availableAttributes.length).toBe(2);
      const paths = component.availableAttributes.map(a => a.attributePath);
      expect(paths).toContain('name');
      expect(paths).toContain('age');
      expect(paths).not.toContain('email');
    });

    it('should show all attributes when attributePaths is not set', () => {
      component.data = { ckTypeId: 'TestCkType' };
      fixture.detectChanges();

      expect(component.availableAttributes.length).toBe(5);
    });

    it('should apply attributePaths filter when searching', fakeAsync(() => {
      component.data = {
        ckTypeId: 'TestCkType',
        attributePaths: ['name', 'age']
      };
      fixture.detectChanges();

      attributeServiceMock.getAvailableAttributes.calls.reset();
      attributeServiceMock.getAvailableAttributes.and.returnValue(of({
        items: [...mockAttributes],
        totalCount: mockAttributes.length
      }));

      component.onSearchChange('na');
      tick(300);

      // Backend returns all, client filters to allowed paths only
      const paths = component.availableAttributes.map(a => a.attributePath);
      expect(paths).not.toContain('email');
      expect(paths).not.toContain('createdAt');
    }));
  });
});
