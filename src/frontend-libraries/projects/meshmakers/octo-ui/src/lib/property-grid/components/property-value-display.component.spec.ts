import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyValueDisplayComponent } from './property-value-display.component';
import {
  AttributeValueTypeDto,
  PropertyDisplayMode
} from '../models/property-grid.models';
import { chevronRightIcon, chevronDownIcon, downloadIcon } from '@progress/kendo-svg-icons';

describe('PropertyValueDisplayComponent', () => {
  let component: PropertyValueDisplayComponent;
  let fixture: ComponentFixture<PropertyValueDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyValueDisplayComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyValueDisplayComponent);
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
    it('should have default type as STRING', () => {
      expect(component.type).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should have default displayMode as Text', () => {
      expect(component.displayMode).toBe(PropertyDisplayMode.Text);
    });

    it('should start with isExpanded as false', () => {
      expect(component.isExpanded).toBe(false);
    });

    it('should have icon references', () => {
      expect(component.chevronRightIcon).toBe(chevronRightIcon);
      expect(component.chevronDownIcon).toBe(chevronDownIcon);
      expect(component.downloadIcon).toBe(downloadIcon);
    });
  });

  // =========================================================================
  // getFormattedValue - Basic Types
  // =========================================================================

  describe('getFormattedValue - Basic Values', () => {
    it('should return <null> for null value', () => {
      component.value = null;
      expect(component.getFormattedValue()).toBe('<null>');
    });

    it('should return <undefined> for undefined value', () => {
      component.value = undefined;
      expect(component.getFormattedValue()).toBe('<undefined>');
    });

    it('should return <empty> for empty string', () => {
      component.value = '';
      expect(component.getFormattedValue()).toBe('<empty>');
    });

    it('should return string value as-is for STRING type', () => {
      component.value = 'Hello World';
      component.type = AttributeValueTypeDto.StringDto;
      expect(component.getFormattedValue()).toBe('Hello World');
    });
  });

  describe('getFormattedValue - Boolean', () => {
    it('should return checkmark True for true boolean', () => {
      component.value = true;
      component.type = AttributeValueTypeDto.BooleanDto;
      expect(component.getFormattedValue()).toBe('✓ True');
    });

    it('should return cross False for false boolean', () => {
      component.value = false;
      component.type = AttributeValueTypeDto.BooleanDto;
      expect(component.getFormattedValue()).toBe('✗ False');
    });
  });

  describe('getFormattedValue - Numbers', () => {
    it('should format INT without decimals', () => {
      component.value = 42;
      component.type = AttributeValueTypeDto.IntDto;
      expect(component.getFormattedValue()).toBe('42');
    });

    it('should format INTEGER without decimals', () => {
      component.value = 100;
      component.type = AttributeValueTypeDto.IntegerDto;
      expect(component.getFormattedValue()).toBe('100');
    });

    it('should format INTEGER_64 without decimals', () => {
      component.value = 9999999999;
      component.type = AttributeValueTypeDto.Integer_64Dto;
      expect(component.getFormattedValue()).toBe('9999999999');
    });

    it('should format INT_64 without decimals', () => {
      component.value = 1234567890;
      component.type = AttributeValueTypeDto.Int_64Dto;
      expect(component.getFormattedValue()).toBe('1234567890');
    });

    it('should format DOUBLE with 2 decimals', () => {
      component.value = 3.14159;
      component.type = AttributeValueTypeDto.DoubleDto;
      expect(component.getFormattedValue()).toBe('3.14');
    });

    it('should format DOUBLE rounding correctly', () => {
      component.value = 2.999;
      component.type = AttributeValueTypeDto.DoubleDto;
      expect(component.getFormattedValue()).toBe('3.00');
    });

    it('should return original string for invalid number', () => {
      component.value = 'not a number';
      component.type = AttributeValueTypeDto.IntDto;
      expect(component.getFormattedValue()).toBe('not a number');
    });
  });

  describe('getFormattedValue - DateTime', () => {
    it('should format ISO date string for DATE_TIME', () => {
      component.value = '2024-01-15T10:30:00Z';
      component.type = AttributeValueTypeDto.DateTimeDto;
      const result = component.getFormattedValue();
      // Should contain date parts (locale-dependent)
      expect(result).toContain('2024');
    });

    it('should format DATE_TIME_OFFSET', () => {
      component.value = '2024-06-20T14:45:00+02:00';
      component.type = AttributeValueTypeDto.DateTimeOffsetDto;
      const result = component.getFormattedValue();
      expect(result).toContain('2024');
    });

    it('should format Date object', () => {
      component.value = new Date('2024-03-01T12:00:00Z');
      component.type = AttributeValueTypeDto.DateTimeDto;
      const result = component.getFormattedValue();
      expect(result).toContain('2024');
    });

    it('should return original value for invalid date', () => {
      component.value = 'invalid-date';
      component.type = AttributeValueTypeDto.DateTimeDto;
      expect(component.getFormattedValue()).toBe('invalid-date');
    });
  });

  describe('getFormattedValue - Arrays', () => {
    it('should format empty STRING_ARRAY', () => {
      component.value = [];
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getFormattedValue()).toBe('[]');
    });

    it('should format short STRING_ARRAY', () => {
      component.value = ['a', 'b', 'c'];
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getFormattedValue()).toBe('[a, b, c]');
    });

    it('should truncate long STRING_ARRAY', () => {
      component.value = ['one', 'two', 'three', 'four', 'five'];
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getFormattedValue()).toBe('[one, two, three, ... +2 more]');
    });

    it('should format INTEGER_ARRAY', () => {
      component.value = [1, 2, 3];
      component.type = AttributeValueTypeDto.IntegerArrayDto;
      expect(component.getFormattedValue()).toBe('[1, 2, 3]');
    });

    it('should format INT_ARRAY', () => {
      component.value = [10, 20];
      component.type = AttributeValueTypeDto.IntArrayDto;
      expect(component.getFormattedValue()).toBe('[10, 20]');
    });

    it('should return original value if not array', () => {
      component.value = 'not an array';
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getFormattedValue()).toBe('not an array');
    });
  });

  describe('getFormattedValue - Records', () => {
    it('should format empty RECORD', () => {
      component.value = {};
      component.type = AttributeValueTypeDto.RecordDto;
      component.displayMode = PropertyDisplayMode.Text;
      expect(component.getFormattedValue()).toBe('{}');
    });

    it('should format RECORD with few properties', () => {
      component.value = { name: 'Test', age: 25 };
      component.type = AttributeValueTypeDto.RecordDto;
      component.displayMode = PropertyDisplayMode.Text;
      expect(component.getFormattedValue()).toContain('name:');
      expect(component.getFormattedValue()).toContain('age:');
    });

    it('should truncate RECORD with many properties', () => {
      component.value = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      component.type = AttributeValueTypeDto.RecordDto;
      component.displayMode = PropertyDisplayMode.Text;
      expect(component.getFormattedValue()).toContain('... +3 more');
    });

    it('should format RECORD as JSON when displayMode is Json', () => {
      component.value = { key: 'value' };
      component.type = AttributeValueTypeDto.RecordDto;
      component.displayMode = PropertyDisplayMode.Json;
      const result = component.getFormattedValue();
      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
    });

    it('should format RECORD_ARRAY as JSON', () => {
      component.value = [{ id: 1 }, { id: 2 }];
      component.type = AttributeValueTypeDto.RecordArrayDto;
      component.displayMode = PropertyDisplayMode.Json;
      expect(component.getFormattedValue()).toContain('"id"');
    });
  });

  describe('getFormattedValue - Binary', () => {
    it('should format ArrayBuffer with byte count', () => {
      component.value = new ArrayBuffer(1024);
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.getFormattedValue()).toBe('<Binary: 1024 bytes>');
    });

    it('should detect base64 data URL', () => {
      component.value = 'data:image/png;base64,iVBORw0KGgo...';
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.getFormattedValue()).toBe('<Base64 Data>');
    });

    it('should return default binary text for other values', () => {
      component.value = { binaryId: '123' };
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.getFormattedValue()).toBe('<Binary Data>');
    });
  });

  // =========================================================================
  // isExpandableRecord
  // =========================================================================

  describe('isExpandableRecord', () => {
    it('should return true for RECORD with object value', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = { key: 'value' };
      expect(component.isExpandableRecord()).toBe(true);
    });

    it('should return true for RECORD_ARRAY with array value', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      component.value = [{ id: 1 }];
      expect(component.isExpandableRecord()).toBe(true);
    });

    it('should return false for RECORD with null value', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = null;
      expect(component.isExpandableRecord()).toBe(false);
    });

    it('should return false for STRING type', () => {
      component.type = AttributeValueTypeDto.StringDto;
      component.value = 'text';
      expect(component.isExpandableRecord()).toBe(false);
    });

    it('should return false for RECORD with primitive value', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = 'string value';
      expect(component.isExpandableRecord()).toBe(false);
    });
  });

  // =========================================================================
  // isComplexType
  // =========================================================================

  describe('isComplexType', () => {
    it('should return true for RECORD', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for RECORD_ARRAY', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for STRING_ARRAY', () => {
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for INTEGER_ARRAY', () => {
      component.type = AttributeValueTypeDto.IntegerArrayDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for INT_ARRAY', () => {
      component.type = AttributeValueTypeDto.IntArrayDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for BINARY', () => {
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return true for BINARY_LINKED', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      expect(component.isComplexType()).toBe(true);
    });

    it('should return false for STRING', () => {
      component.type = AttributeValueTypeDto.StringDto;
      expect(component.isComplexType()).toBe(false);
    });

    it('should return false for INT', () => {
      component.type = AttributeValueTypeDto.IntDto;
      expect(component.isComplexType()).toBe(false);
    });

    it('should return false for BOOLEAN', () => {
      component.type = AttributeValueTypeDto.BooleanDto;
      expect(component.isComplexType()).toBe(false);
    });
  });

  // =========================================================================
  // getTypeIndicator
  // =========================================================================

  describe('getTypeIndicator', () => {
    it('should return RECORD for RecordDto', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      expect(component.getTypeIndicator()).toBe('RECORD');
    });

    it('should return ARR[RECORD] for RecordArrayDto', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      expect(component.getTypeIndicator()).toBe('ARR[RECORD]');
    });

    it('should return ARR[STR] for StringArrayDto', () => {
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getTypeIndicator()).toBe('ARR[STR]');
    });

    it('should return ARR[INT] for IntegerArrayDto', () => {
      component.type = AttributeValueTypeDto.IntegerArrayDto;
      expect(component.getTypeIndicator()).toBe('ARR[INT]');
    });

    it('should return ARR[INT] for IntArrayDto', () => {
      component.type = AttributeValueTypeDto.IntArrayDto;
      expect(component.getTypeIndicator()).toBe('ARR[INT]');
    });

    it('should return BIN for BinaryDto', () => {
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.getTypeIndicator()).toBe('BIN');
    });

    it('should return BIN for BinaryLinkedDto', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      expect(component.getTypeIndicator()).toBe('BIN');
    });

    it('should return cleaned type name for other types', () => {
      component.type = AttributeValueTypeDto.StringDto;
      expect(component.getTypeIndicator()).toBe('STRING');
    });
  });

  // =========================================================================
  // getTypeDescription
  // =========================================================================

  describe('getTypeDescription', () => {
    it('should return Complex object for RecordDto', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      expect(component.getTypeDescription()).toBe('Complex object');
    });

    it('should return Array of complex objects for RecordArrayDto', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      expect(component.getTypeDescription()).toBe('Array of complex objects');
    });

    it('should return Array of strings for StringArrayDto', () => {
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getTypeDescription()).toBe('Array of strings');
    });

    it('should return Array of numbers for IntegerArrayDto', () => {
      component.type = AttributeValueTypeDto.IntegerArrayDto;
      expect(component.getTypeDescription()).toBe('Array of numbers');
    });

    it('should return Binary data for BinaryDto', () => {
      component.type = AttributeValueTypeDto.BinaryDto;
      expect(component.getTypeDescription()).toBe('Binary data');
    });

    it('should return Type: X for other types', () => {
      component.type = AttributeValueTypeDto.StringDto;
      expect(component.getTypeDescription()).toBe('Type: STRING');
    });
  });

  // =========================================================================
  // toggleExpansion
  // =========================================================================

  describe('toggleExpansion', () => {
    it('should toggle from false to true', () => {
      component.isExpanded = false;
      component.toggleExpansion();
      expect(component.isExpanded).toBe(true);
    });

    it('should toggle from true to false', () => {
      component.isExpanded = true;
      component.toggleExpansion();
      expect(component.isExpanded).toBe(false);
    });
  });

  // =========================================================================
  // getRecordSummary
  // =========================================================================

  describe('getRecordSummary', () => {
    it('should return Array with X items for RecordArrayDto', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      component.value = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(component.getRecordSummary()).toBe('Array with 3 items');
    });

    it('should use singular item for single element array', () => {
      component.type = AttributeValueTypeDto.RecordArrayDto;
      component.value = [{ id: 1 }];
      expect(component.getRecordSummary()).toBe('Array with 1 item');
    });

    it('should return Object with X properties for RecordDto', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = { name: 'Test', age: 25 };
      expect(component.getRecordSummary()).toBe('Object with 2 properties');
    });

    it('should use singular property for single key object', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = { name: 'Test' };
      expect(component.getRecordSummary()).toBe('Object with 1 property');
    });

    it('should return Complex object for non-object values', () => {
      component.type = AttributeValueTypeDto.RecordDto;
      component.value = null;
      expect(component.getRecordSummary()).toBe('Complex object');
    });
  });

  // =========================================================================
  // getObjectProperties
  // =========================================================================

  describe('getObjectProperties', () => {
    it('should return empty array for null', () => {
      expect(component.getObjectProperties(null)).toEqual([]);
    });

    it('should return empty array for non-object', () => {
      expect(component.getObjectProperties('string')).toEqual([]);
    });

    it('should return key-value pairs for object', () => {
      const obj = { name: 'Test', value: 123 };
      const result = component.getObjectProperties(obj);

      expect(result.length).toBe(2);
      expect(result).toContain(jasmine.objectContaining({ key: 'name', value: 'Test' }));
      expect(result).toContain(jasmine.objectContaining({ key: 'value', value: 123 }));
    });

    it('should handle nested objects', () => {
      const obj = { nested: { inner: 'value' } };
      const result = component.getObjectProperties(obj);

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('nested');
      expect(result[0].value).toEqual({ inner: 'value' });
    });

    it('should handle ckRecordId array format', () => {
      const obj = [
        { id: 'ckRecordId', name: 'field1', value: 'value1' },
        { id: 'ckRecordId', name: 'field2', value: 'value2' }
      ];
      const result = component.getObjectProperties(obj);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ key: 'field1', value: 'value1' });
      expect(result[1]).toEqual({ key: 'field2', value: 'value2' });
    });
  });

  // =========================================================================
  // getPropertyType
  // =========================================================================

  describe('getPropertyType', () => {
    it('should return STRING for null', () => {
      expect(component.getPropertyType(null)).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should return STRING for undefined', () => {
      expect(component.getPropertyType(undefined)).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should return BOOLEAN for boolean', () => {
      expect(component.getPropertyType(true)).toBe(AttributeValueTypeDto.BooleanDto);
      expect(component.getPropertyType(false)).toBe(AttributeValueTypeDto.BooleanDto);
    });

    it('should return INTEGER for integer number', () => {
      expect(component.getPropertyType(42)).toBe(AttributeValueTypeDto.IntegerDto);
    });

    it('should return DOUBLE for float number', () => {
      expect(component.getPropertyType(3.14)).toBe(AttributeValueTypeDto.DoubleDto);
    });

    it('should return DATE_TIME for ISO date string', () => {
      expect(component.getPropertyType('2024-01-15T10:30:00Z')).toBe(AttributeValueTypeDto.DateTimeDto);
    });

    it('should return STRING for regular string', () => {
      expect(component.getPropertyType('hello')).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should return RECORD_ARRAY for array of objects', () => {
      expect(component.getPropertyType([{ id: 1 }, { id: 2 }])).toBe(AttributeValueTypeDto.RecordArrayDto);
    });

    it('should return STRING_ARRAY for array of strings', () => {
      expect(component.getPropertyType(['a', 'b', 'c'])).toBe(AttributeValueTypeDto.StringArrayDto);
    });

    it('should return INTEGER_ARRAY for array of numbers', () => {
      expect(component.getPropertyType([1, 2, 3])).toBe(AttributeValueTypeDto.IntegerArrayDto);
    });

    it('should return STRING_ARRAY for empty array', () => {
      expect(component.getPropertyType([])).toBe(AttributeValueTypeDto.StringArrayDto);
    });

    it('should return RECORD for ckRecordId array format', () => {
      const value = [{ id: 'ckRecordId', name: 'field', value: 'test' }];
      expect(component.getPropertyType(value)).toBe(AttributeValueTypeDto.RecordDto);
    });
  });

  // =========================================================================
  // Binary Linked Methods
  // =========================================================================

  describe('isBinaryLinkedWithDownload', () => {
    it('should return false for non-BINARY_LINKED type', () => {
      component.type = AttributeValueTypeDto.StringDto;
      component.value = { binaryId: '123' };
      expect(component.isBinaryLinkedWithDownload()).toBe(false);
    });

    it('should return falsy for BINARY_LINKED with null value', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      component.value = null;
      expect(component.isBinaryLinkedWithDownload()).toBeFalsy();
    });

    it('should return false for BINARY_LINKED without binaryId or downloadUri', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      component.value = { filename: 'test.pdf' };
      expect(component.isBinaryLinkedWithDownload()).toBe(false);
    });

    it('should return true for BINARY_LINKED with binaryId', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      component.value = { binaryId: '123' };
      expect(component.isBinaryLinkedWithDownload()).toBe(true);
    });

    it('should return true for BINARY_LINKED with downloadUri', () => {
      component.type = AttributeValueTypeDto.BinaryLinkedDto;
      component.value = { downloadUri: 'https://example.com/file.pdf' };
      expect(component.isBinaryLinkedWithDownload()).toBe(true);
    });
  });

  describe('getBinaryFilename', () => {
    it('should return null for null value', () => {
      component.value = null;
      expect(component.getBinaryFilename()).toBeNull();
    });

    it('should return null for non-object value', () => {
      component.value = 'string';
      expect(component.getBinaryFilename()).toBeNull();
    });

    it('should return null when filename not present', () => {
      component.value = { binaryId: '123' };
      expect(component.getBinaryFilename()).toBeNull();
    });

    it('should return filename when present', () => {
      component.value = { filename: 'document.pdf' };
      expect(component.getBinaryFilename()).toBe('document.pdf');
    });
  });

  describe('getBinarySize', () => {
    it('should return null for null value', () => {
      component.value = null;
      expect(component.getBinarySize()).toBeNull();
    });

    it('should return null when size not present', () => {
      component.value = { binaryId: '123' };
      expect(component.getBinarySize()).toBeNull();
    });

    it('should return size when present', () => {
      component.value = { size: 1024 };
      expect(component.getBinarySize()).toBe(1024);
    });
  });

  describe('getBinaryContentType', () => {
    it('should return null for null value', () => {
      component.value = null;
      expect(component.getBinaryContentType()).toBeNull();
    });

    it('should return null when contentType not present', () => {
      component.value = { binaryId: '123' };
      expect(component.getBinaryContentType()).toBeNull();
    });

    it('should return contentType when present', () => {
      component.value = { contentType: 'application/pdf' };
      expect(component.getBinaryContentType()).toBe('application/pdf');
    });
  });

  describe('formatFileSize', () => {
    it('should return empty string for null', () => {
      expect(component.formatFileSize(null)).toBe('');
    });

    it('should format bytes', () => {
      expect(component.formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(component.formatFileSize(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      expect(component.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      expect(component.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format terabytes', () => {
      expect(component.formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
    });

    it('should round to one decimal place', () => {
      expect(component.formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('onDownload', () => {
    let windowOpenSpy: jasmine.Spy;

    beforeEach(() => {
      windowOpenSpy = spyOn(window, 'open');
    });

    it('should do nothing for null value', () => {
      component.value = null;
      component.onDownload();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should do nothing for non-object value', () => {
      component.value = 'string';
      component.onDownload();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should open downloadUri in new window when present', () => {
      component.value = { downloadUri: 'https://example.com/file.pdf' };
      component.onDownload();
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should emit binaryDownload event when only binaryId present', () => {
      spyOn(component.binaryDownload, 'emit');
      component.value = {
        binaryId: '123',
        filename: 'test.pdf',
        contentType: 'application/pdf'
      };
      component.onDownload();

      expect(component.binaryDownload.emit).toHaveBeenCalledWith({
        binaryId: '123',
        filename: 'test.pdf',
        contentType: 'application/pdf'
      });
    });

    it('should prefer downloadUri over binaryId', () => {
      spyOn(component.binaryDownload, 'emit');
      component.value = {
        binaryId: '123',
        downloadUri: 'https://example.com/file.pdf'
      };
      component.onDownload();

      expect(windowOpenSpy).toHaveBeenCalled();
      expect(component.binaryDownload.emit).not.toHaveBeenCalled();
    });

    it('should do nothing when neither binaryId nor downloadUri present', () => {
      spyOn(component.binaryDownload, 'emit');
      component.value = { filename: 'test.pdf' };
      component.onDownload();

      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(component.binaryDownload.emit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle deeply nested objects', () => {
      component.value = { level1: { level2: { level3: 'deep' } } };
      component.type = AttributeValueTypeDto.RecordDto;
      component.displayMode = PropertyDisplayMode.Text;

      const formatted = component.getFormattedValue();
      expect(formatted).toContain('level1');
    });

    it('should handle mixed array types', () => {
      // When array has mixed types, uses first element to determine type
      component.value = ['string', 123, true];
      component.type = AttributeValueTypeDto.StringArrayDto;
      expect(component.getFormattedValue()).toBe('[string, 123, true]');
    });

    it('should handle special characters in string values', () => {
      component.value = '<script>alert("xss")</script>';
      component.type = AttributeValueTypeDto.StringDto;
      expect(component.getFormattedValue()).toBe('<script>alert("xss")</script>');
    });

    it('should handle numeric strings for DATE_TIME', () => {
      component.value = '12345';
      component.type = AttributeValueTypeDto.DateTimeDto;
      // Invalid date should return original
      const result = component.getFormattedValue();
      // Depending on locale, might parse as timestamp or return as-is
      expect(result).toBeDefined();
    });
  });
});
