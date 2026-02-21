import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { SimpleChange } from '@angular/core';
import { PropertyGridComponent } from './property-grid.component';
import {
  PropertyGridItem,
  AttributeValueTypeDto,
  BinaryDownloadEvent
} from '../models/property-grid.models';
import {
  fileIcon,
  folderIcon,
  calendarIcon,
  checkboxCheckedIcon,
  listUnorderedIcon
} from '@progress/kendo-svg-icons';

describe('PropertyGridComponent', () => {
  let component: PropertyGridComponent;
  let fixture: ComponentFixture<PropertyGridComponent>;

  const mockProperties: PropertyGridItem[] = [
    {
      id: '1',
      name: 'name',
      displayName: 'Name',
      value: 'Test Entity',
      type: AttributeValueTypeDto.StringDto,
      description: 'Entity name'
    },
    {
      id: '2',
      name: 'age',
      displayName: 'Age',
      value: 25,
      type: AttributeValueTypeDto.IntDto,
      required: true
    },
    {
      id: '3',
      name: 'isActive',
      displayName: 'Is Active',
      value: true,
      type: AttributeValueTypeDto.BooleanDto
    },
    {
      id: '4',
      name: 'createdAt',
      displayName: 'Created At',
      value: '2024-01-15T10:30:00Z',
      type: AttributeValueTypeDto.DateTimeDto,
      readOnly: true
    },
    {
      id: '5',
      name: 'price',
      displayName: 'Price',
      value: 99.99,
      type: AttributeValueTypeDto.DoubleDto
    },
    {
      id: '6',
      name: 'tags',
      displayName: 'Tags',
      value: ['tag1', 'tag2'],
      type: AttributeValueTypeDto.StringArrayDto
    },
    {
      id: '7',
      name: 'metadata',
      displayName: 'Metadata',
      value: { key: 'value' },
      type: AttributeValueTypeDto.RecordDto
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PropertyGridComponent,
        FormsModule
      ],
      providers: [provideNoopAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyGridComponent);
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
    it('should start with empty data array', () => {
      expect(component.data).toEqual([]);
    });

    it('should start with empty config object', () => {
      expect(component.config).toEqual({});
    });

    it('should start with showTypeColumn as false', () => {
      expect(component.showTypeColumn).toBe(false);
    });

    it('should initialize filteredData on ngOnInit', () => {
      component.data = mockProperties;
      component.ngOnInit();

      expect(component.filteredData.length).toBe(mockProperties.length);
    });

    it('should have hasChanges as false initially', () => {
      expect(component.hasChanges).toBe(false);
    });

    it('should have empty pendingChanges initially', () => {
      expect(component.pendingChanges).toEqual([]);
    });
  });

  // =========================================================================
  // ngOnChanges
  // =========================================================================

  describe('ngOnChanges', () => {
    it('should update filteredData when data changes', () => {
      component.data = mockProperties;
      component.ngOnChanges({
        data: new SimpleChange(null, mockProperties, true)
      });

      expect(component.filteredData.length).toBe(mockProperties.length);
    });

    it('should reset hasChanges when data changes', () => {
      component.hasChanges = true;
      component.pendingChanges = [{ property: mockProperties[0], oldValue: 'old', newValue: 'new' }];

      component.data = mockProperties;
      component.ngOnChanges({
        data: new SimpleChange(null, mockProperties, true)
      });

      expect(component.hasChanges).toBe(false);
      expect(component.pendingChanges).toEqual([]);
    });

    it('should not affect state when other inputs change', () => {
      component.hasChanges = true;
      component.pendingChanges = [{ property: mockProperties[0], oldValue: 'old', newValue: 'new' }];

      component.ngOnChanges({
        showTypeColumn: new SimpleChange(false, true, false)
      });

      expect(component.hasChanges).toBe(true);
      expect(component.pendingChanges.length).toBe(1);
    });
  });

  // =========================================================================
  // Grid Height Calculation
  // =========================================================================

  describe('gridHeight', () => {
    it('should return default height minus toolbar when no config provided', () => {
      component.config = {};
      const height = component.gridHeight;

      // 400 - 50 (toolbar, since readOnlyMode is undefined/falsy) = 350
      expect(height).toBe('350px');
    });

    it('should use config height minus toolbar when height provided', () => {
      component.config = { height: '600px' };
      const height = component.gridHeight;

      // 600 - 50 (toolbar) = 550
      expect(height).toBe('550px');
    });

    it('should subtract search and toolbar heights when showSearch is true', () => {
      component.config = { height: '400px', showSearch: true };
      const height = component.gridHeight;

      // 400 - 40 (search) - 50 (toolbar) = 310
      expect(height).toBe('310px');
    });

    it('should subtract toolbar height when not in readOnlyMode', () => {
      component.config = { height: '400px', readOnlyMode: false };
      const height = component.gridHeight;

      // 400 - 50 (toolbar) = 350
      expect(height).toBe('350px');
    });

    it('should subtract both heights when both are active', () => {
      component.config = { height: '400px', showSearch: true, readOnlyMode: false };
      const height = component.gridHeight;

      // 400 - 40 (search) - 50 (toolbar) = 310
      expect(height).toBe('310px');
    });

    it('should not go below 200px minimum', () => {
      component.config = { height: '100px', showSearch: true, readOnlyMode: false };
      const height = component.gridHeight;

      expect(height).toBe('200px');
    });

    it('should return baseHeight as-is when not in px format', () => {
      component.config = { height: '50%' };
      const height = component.gridHeight;

      expect(height).toBe('50%');
    });

    it('should not subtract toolbar height when in readOnlyMode', () => {
      component.config = { height: '400px', readOnlyMode: true };
      const height = component.gridHeight;

      expect(height).toBe('400px');
    });

    it('should only subtract search height when readOnlyMode is true and showSearch is true', () => {
      component.config = { height: '400px', readOnlyMode: true, showSearch: true };
      const height = component.gridHeight;

      // 400 - 40 (search only) = 360
      expect(height).toBe('360px');
    });
  });

  // =========================================================================
  // Search / Filtering
  // =========================================================================

  describe('Search and Filtering', () => {
    beforeEach(() => {
      component.data = mockProperties;
      component.ngOnInit();
    });

    it('should show all data when search term is empty', () => {
      component.searchTerm = '';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(mockProperties.length);
    });

    it('should show all data when search term is whitespace only', () => {
      component.searchTerm = '   ';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(mockProperties.length);
    });

    it('should filter by property name', () => {
      component.searchTerm = 'name';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
      expect(component.filteredData[0].name).toBe('name');
    });

    it('should filter by displayName', () => {
      component.searchTerm = 'Price';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
      expect(component.filteredData[0].displayName).toBe('Price');
    });

    it('should filter by description', () => {
      component.searchTerm = 'Entity name';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
      expect(component.filteredData[0].id).toBe('1');
    });

    it('should filter by value (string)', () => {
      component.searchTerm = 'Test Entity';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
      expect(component.filteredData[0].value).toBe('Test Entity');
    });

    it('should filter by value (number as string)', () => {
      component.searchTerm = '25';
      component.updateFilteredData();

      expect(component.filteredData.some(item => item.value === 25)).toBe(true);
    });

    it('should be case-insensitive', () => {
      component.searchTerm = 'NAME';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
      expect(component.filteredData[0].name).toBe('name');
    });

    it('should call updateFilteredData on onSearch', () => {
      spyOn(component, 'updateFilteredData');
      component.onSearch();

      expect(component.updateFilteredData).toHaveBeenCalled();
    });

    it('should handle partial matches', () => {
      component.searchTerm = 'act';
      component.updateFilteredData();

      expect(component.filteredData.some(item => item.name === 'isActive')).toBe(true);
    });
  });

  // =========================================================================
  // Type Icons
  // =========================================================================

  describe('Type Icons', () => {
    it('should return checkboxCheckedIcon for BOOLEAN', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.BooleanDto);
      expect(icon).toBe(checkboxCheckedIcon);
    });

    it('should return fileIcon for INT', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.IntDto);
      expect(icon).toBe(fileIcon);
    });

    it('should return fileIcon for INTEGER', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.IntegerDto);
      expect(icon).toBe(fileIcon);
    });

    it('should return fileIcon for DOUBLE', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.DoubleDto);
      expect(icon).toBe(fileIcon);
    });

    it('should return calendarIcon for DATE_TIME', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.DateTimeDto);
      expect(icon).toBe(calendarIcon);
    });

    it('should return calendarIcon for DATE_TIME_OFFSET', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.DateTimeOffsetDto);
      expect(icon).toBe(calendarIcon);
    });

    it('should return listUnorderedIcon for STRING_ARRAY', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.StringArrayDto);
      expect(icon).toBe(listUnorderedIcon);
    });

    it('should return listUnorderedIcon for INTEGER_ARRAY', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.IntegerArrayDto);
      expect(icon).toBe(listUnorderedIcon);
    });

    it('should return folderIcon for RECORD', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.RecordDto);
      expect(icon).toBe(folderIcon);
    });

    it('should return folderIcon for RECORD_ARRAY', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.RecordArrayDto);
      expect(icon).toBe(folderIcon);
    });

    it('should return fileIcon as default for unknown types', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.StringDto);
      expect(icon).toBe(fileIcon);
    });

    it('should return fileIcon for BINARY', () => {
      const icon = component.getTypeIcon(AttributeValueTypeDto.BinaryDto);
      expect(icon).toBe(fileIcon);
    });
  });

  // =========================================================================
  // Format Type Name
  // =========================================================================

  describe('formatTypeName', () => {
    it('should remove _DTO suffix', () => {
      const result = component.formatTypeName('STRING_DTO' as AttributeValueTypeDto);
      expect(result).toBe('STRING');
    });

    it('should remove DTO suffix', () => {
      const result = component.formatTypeName('STRINGDTO' as AttributeValueTypeDto);
      expect(result).toBe('STRING');
    });

    it('should replace underscores with spaces', () => {
      const result = component.formatTypeName('DATE_TIME' as AttributeValueTypeDto);
      expect(result).toBe('DATE TIME');
    });

    it('should handle multiple replacements', () => {
      const result = component.formatTypeName('DATE_TIME_DTO' as AttributeValueTypeDto);
      expect(result).toBe('DATE TIME');
    });

    it('should handle BOOLEAN type', () => {
      const result = component.formatTypeName(AttributeValueTypeDto.BooleanDto);
      expect(result).toBe('BOOLEAN');
    });

    it('should handle STRING type', () => {
      const result = component.formatTypeName(AttributeValueTypeDto.StringDto);
      expect(result).toBe('STRING');
    });
  });

  // =========================================================================
  // Property Change Handling
  // =========================================================================

  describe('onPropertyChange', () => {
    beforeEach(() => {
      component.data = mockProperties;
      component.ngOnInit();
    });

    it('should add change to pendingChanges', () => {
      const property = mockProperties[0];
      component.onPropertyChange(property, 'old', 'new');

      expect(component.pendingChanges.length).toBe(1);
      expect(component.pendingChanges[0].property).toBe(property);
      expect(component.pendingChanges[0].oldValue).toBe('old');
      expect(component.pendingChanges[0].newValue).toBe('new');
    });

    it('should set hasChanges to true', () => {
      component.onPropertyChange(mockProperties[0], 'old', 'new');

      expect(component.hasChanges).toBe(true);
    });

    it('should emit propertyChange event', () => {
      spyOn(component.propertyChange, 'emit');
      const property = mockProperties[0];

      component.onPropertyChange(property, 'old', 'new');

      expect(component.propertyChange.emit).toHaveBeenCalledWith({
        property,
        oldValue: 'old',
        newValue: 'new'
      });
    });

    it('should update existing pending change for same property', () => {
      const property = mockProperties[0];

      component.onPropertyChange(property, 'old1', 'new1');
      component.onPropertyChange(property, 'new1', 'new2');

      expect(component.pendingChanges.length).toBe(1);
      expect(component.pendingChanges[0].newValue).toBe('new2');
    });

    it('should track multiple changes for different properties', () => {
      component.onPropertyChange(mockProperties[0], 'old1', 'new1');
      component.onPropertyChange(mockProperties[1], 'old2', 'new2');

      expect(component.pendingChanges.length).toBe(2);
    });
  });

  // =========================================================================
  // Save Changes
  // =========================================================================

  describe('saveChanges', () => {
    beforeEach(() => {
      component.data = mockProperties;
      component.ngOnInit();
    });

    it('should emit saveRequested with updated data', () => {
      spyOn(component.saveRequested, 'emit');
      const property = mockProperties[0];

      component.onPropertyChange(property, 'Test Entity', 'Updated Entity');
      component.saveChanges();

      expect(component.saveRequested.emit).toHaveBeenCalled();
      const emittedData = (component.saveRequested.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedData.find((p: PropertyGridItem) => p.id === '1')?.value).toBe('Updated Entity');
    });

    it('should reset hasChanges after save', () => {
      component.onPropertyChange(mockProperties[0], 'old', 'new');
      component.saveChanges();

      expect(component.hasChanges).toBe(false);
    });

    it('should clear pendingChanges after save', () => {
      component.onPropertyChange(mockProperties[0], 'old', 'new');
      component.saveChanges();

      expect(component.pendingChanges).toEqual([]);
    });

    it('should not emit saveRequested when no pending changes', () => {
      spyOn(component.saveRequested, 'emit');
      component.saveChanges();

      expect(component.saveRequested.emit).not.toHaveBeenCalled();
    });

    it('should preserve unchanged properties in emitted data', () => {
      spyOn(component.saveRequested, 'emit');
      component.onPropertyChange(mockProperties[0], 'old', 'new');
      component.saveChanges();

      const emittedData = (component.saveRequested.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedData.length).toBe(mockProperties.length);
    });
  });

  // =========================================================================
  // Discard Changes
  // =========================================================================

  describe('discardChanges', () => {
    beforeEach(() => {
      component.data = mockProperties;
      component.ngOnInit();
    });

    it('should reset hasChanges', () => {
      component.onPropertyChange(mockProperties[0], 'old', 'new');
      component.discardChanges();

      expect(component.hasChanges).toBe(false);
    });

    it('should clear pendingChanges', () => {
      component.onPropertyChange(mockProperties[0], 'old', 'new');
      component.discardChanges();

      expect(component.pendingChanges).toEqual([]);
    });

    it('should update filtered data', () => {
      spyOn(component, 'updateFilteredData');
      component.discardChanges();

      expect(component.updateFilteredData).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Binary Download
  // =========================================================================

  describe('onBinaryDownload', () => {
    it('should emit binaryDownload event', () => {
      spyOn(component.binaryDownload, 'emit');
      const event: BinaryDownloadEvent = {
        binaryId: 'binary-123',
        filename: 'document.pdf',
        contentType: 'application/pdf'
      };

      component.onBinaryDownload(event);

      expect(component.binaryDownload.emit).toHaveBeenCalledWith(event);
    });

    it('should emit binaryDownload with minimal data', () => {
      spyOn(component.binaryDownload, 'emit');
      const event: BinaryDownloadEvent = {
        binaryId: 'binary-456'
      };

      component.onBinaryDownload(event);

      expect(component.binaryDownload.emit).toHaveBeenCalledWith(event);
    });

    it('should include downloadUri when provided', () => {
      spyOn(component.binaryDownload, 'emit');
      const event: BinaryDownloadEvent = {
        binaryId: 'binary-789',
        downloadUri: 'https://example.com/download/binary-789'
      };

      component.onBinaryDownload(event);

      expect(component.binaryDownload.emit).toHaveBeenCalledWith(event);
    });
  });

  // =========================================================================
  // Icon References
  // =========================================================================

  describe('Icon References', () => {
    it('should have fileIcon reference', () => {
      expect(component.fileIcon).toBe(fileIcon);
    });

    it('should have folderIcon reference', () => {
      expect(component.folderIcon).toBe(folderIcon);
    });

    it('should have calendarIcon reference', () => {
      expect(component.calendarIcon).toBe(calendarIcon);
    });

    it('should have checkboxCheckedIcon reference', () => {
      expect(component.checkboxCheckedIcon).toBe(checkboxCheckedIcon);
    });

    it('should have listUnorderedIcon reference', () => {
      expect(component.listUnorderedIcon).toBe(listUnorderedIcon);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle empty data array', () => {
      component.data = [];
      component.ngOnInit();

      expect(component.filteredData).toEqual([]);
    });

    it('should handle properties without displayName', () => {
      const propsWithoutDisplayName: PropertyGridItem[] = [
        { id: '1', name: 'test', value: 'value', type: AttributeValueTypeDto.StringDto }
      ];
      component.data = propsWithoutDisplayName;
      component.ngOnInit();

      expect(component.filteredData.length).toBe(1);
    });

    it('should handle properties with null value', () => {
      const propsWithNull: PropertyGridItem[] = [
        { id: '1', name: 'test', value: null, type: AttributeValueTypeDto.StringDto }
      ];
      component.data = propsWithNull;
      component.searchTerm = 'null';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
    });

    it('should handle properties with undefined description', () => {
      const propsWithoutDesc: PropertyGridItem[] = [
        { id: '1', name: 'test', value: 'value', type: AttributeValueTypeDto.StringDto, description: undefined }
      ];
      component.data = propsWithoutDesc;
      component.searchTerm = 'test';
      component.updateFilteredData();

      expect(component.filteredData.length).toBe(1);
    });

    it('should handle multiple property changes then discard', () => {
      component.data = mockProperties;
      component.ngOnInit();

      component.onPropertyChange(mockProperties[0], 'old1', 'new1');
      component.onPropertyChange(mockProperties[1], 'old2', 'new2');
      component.onPropertyChange(mockProperties[2], 'old3', 'new3');

      expect(component.pendingChanges.length).toBe(3);

      component.discardChanges();

      expect(component.pendingChanges.length).toBe(0);
      expect(component.hasChanges).toBe(false);
    });

    it('should handle rapid successive changes to same property', () => {
      component.data = mockProperties;
      component.ngOnInit();

      const property = mockProperties[0];
      component.onPropertyChange(property, 'v1', 'v2');
      component.onPropertyChange(property, 'v2', 'v3');
      component.onPropertyChange(property, 'v3', 'v4');

      expect(component.pendingChanges.length).toBe(1);
      expect(component.pendingChanges[0].newValue).toBe('v4');
    });
  });
});
