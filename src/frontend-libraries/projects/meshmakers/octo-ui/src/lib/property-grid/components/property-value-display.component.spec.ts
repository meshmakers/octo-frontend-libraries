import { SimpleChange } from '@angular/core';
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

  /** Helper: set inputs and run ngOnInit via detectChanges */
  function initComponent(value: unknown, type: AttributeValueTypeDto, displayMode?: PropertyDisplayMode): void {
    component.value = value;
    component.type = type;
    if (displayMode) component.displayMode = displayMode;
    fixture.detectChanges(); // triggers ngOnInit
  }

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
  // formattedValue - Basic Types
  // =========================================================================

  describe('formattedValue - Basic Values', () => {
    it('should return <null> for null value', () => {
      initComponent(null, AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('<null>');
    });

    it('should return <undefined> for undefined value', () => {
      initComponent(undefined, AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('<undefined>');
    });

    it('should return <empty> for empty string', () => {
      initComponent('', AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('<empty>');
    });

    it('should return string value as-is for STRING type', () => {
      initComponent('Hello World', AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('Hello World');
    });
  });

  describe('formattedValue - Boolean', () => {
    it('should return checkmark True for true boolean', () => {
      initComponent(true, AttributeValueTypeDto.BooleanDto);
      expect(component.formattedValue).toBe('✓ True');
    });

    it('should return cross False for false boolean', () => {
      initComponent(false, AttributeValueTypeDto.BooleanDto);
      expect(component.formattedValue).toBe('✗ False');
    });
  });

  describe('formattedValue - Numbers', () => {
    it('should format INT without decimals', () => {
      initComponent(42, AttributeValueTypeDto.IntDto);
      expect(component.formattedValue).toBe('42');
    });

    it('should format INTEGER without decimals', () => {
      initComponent(100, AttributeValueTypeDto.IntegerDto);
      expect(component.formattedValue).toBe('100');
    });

    it('should format INTEGER_64 without decimals', () => {
      initComponent(9999999999, AttributeValueTypeDto.Integer_64Dto);
      expect(component.formattedValue).toBe('9999999999');
    });

    it('should format INT_64 without decimals', () => {
      initComponent(1234567890, AttributeValueTypeDto.Int_64Dto);
      expect(component.formattedValue).toBe('1234567890');
    });

    it('should format DOUBLE with 2 decimals', () => {
      initComponent(3.14159, AttributeValueTypeDto.DoubleDto);
      expect(component.formattedValue).toBe('3.14');
    });

    it('should format DOUBLE rounding correctly', () => {
      initComponent(2.999, AttributeValueTypeDto.DoubleDto);
      expect(component.formattedValue).toBe('3.00');
    });

    it('should return original string for invalid number', () => {
      initComponent('not a number', AttributeValueTypeDto.IntDto);
      expect(component.formattedValue).toBe('not a number');
    });
  });

  describe('formattedValue - DateTime', () => {
    it('should format ISO date string for DATE_TIME', () => {
      initComponent('2024-01-15T10:30:00Z', AttributeValueTypeDto.DateTimeDto);
      expect(component.formattedValue).toContain('2024');
    });

    it('should format DATE_TIME_OFFSET', () => {
      initComponent('2024-06-20T14:45:00+02:00', AttributeValueTypeDto.DateTimeOffsetDto);
      expect(component.formattedValue).toContain('2024');
    });

    it('should format Date object', () => {
      initComponent(new Date('2024-03-01T12:00:00Z'), AttributeValueTypeDto.DateTimeDto);
      expect(component.formattedValue).toContain('2024');
    });

    it('should return original value for invalid date', () => {
      initComponent('invalid-date', AttributeValueTypeDto.DateTimeDto);
      expect(component.formattedValue).toBe('invalid-date');
    });
  });

  describe('formattedValue - Arrays', () => {
    it('should format empty STRING_ARRAY', () => {
      initComponent([], AttributeValueTypeDto.StringArrayDto);
      expect(component.formattedValue).toBe('[]');
    });

    it('should format short STRING_ARRAY', () => {
      initComponent(['a', 'b', 'c'], AttributeValueTypeDto.StringArrayDto);
      expect(component.formattedValue).toBe('[a, b, c]');
    });

    it('should truncate long STRING_ARRAY', () => {
      initComponent(['one', 'two', 'three', 'four', 'five'], AttributeValueTypeDto.StringArrayDto);
      expect(component.formattedValue).toBe('[one, two, three, ... +2 more]');
    });

    it('should format INTEGER_ARRAY', () => {
      initComponent([1, 2, 3], AttributeValueTypeDto.IntegerArrayDto);
      expect(component.formattedValue).toBe('[1, 2, 3]');
    });

    it('should format INT_ARRAY', () => {
      initComponent([10, 20], AttributeValueTypeDto.IntArrayDto);
      expect(component.formattedValue).toBe('[10, 20]');
    });

    it('should return original value if not array', () => {
      initComponent('not an array', AttributeValueTypeDto.StringArrayDto);
      expect(component.formattedValue).toBe('not an array');
    });
  });

  describe('formattedValue - Records', () => {
    it('should format empty RECORD', () => {
      initComponent({}, AttributeValueTypeDto.RecordDto, PropertyDisplayMode.Text);
      expect(component.formattedValue).toBe('{}');
    });

    it('should format RECORD with few properties', () => {
      initComponent({ name: 'Test', age: 25 }, AttributeValueTypeDto.RecordDto, PropertyDisplayMode.Text);
      expect(component.formattedValue).toContain('name:');
      expect(component.formattedValue).toContain('age:');
    });

    it('should truncate RECORD with many properties', () => {
      initComponent({ a: 1, b: 2, c: 3, d: 4, e: 5 }, AttributeValueTypeDto.RecordDto, PropertyDisplayMode.Text);
      expect(component.formattedValue).toContain('... +3 more');
    });

    it('should format RECORD as JSON when displayMode is Json', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto, PropertyDisplayMode.Json);
      expect(component.formattedValue).toContain('"key"');
      expect(component.formattedValue).toContain('"value"');
    });

    it('should format RECORD_ARRAY as JSON', () => {
      initComponent([{ id: 1 }, { id: 2 }], AttributeValueTypeDto.RecordArrayDto, PropertyDisplayMode.Json);
      expect(component.formattedValue).toContain('"id"');
    });
  });

  describe('formattedValue - Binary', () => {
    it('should format ArrayBuffer with byte count', () => {
      initComponent(new ArrayBuffer(1024), AttributeValueTypeDto.BinaryDto);
      expect(component.formattedValue).toBe('<Binary: 1024 bytes>');
    });

    it('should detect base64 data URL', () => {
      initComponent('data:image/png;base64,iVBORw0KGgo...', AttributeValueTypeDto.BinaryDto);
      expect(component.formattedValue).toBe('<Base64 Data>');
    });

    it('should return default binary text for other values', () => {
      initComponent({ binaryId: '123' }, AttributeValueTypeDto.BinaryDto);
      expect(component.formattedValue).toBe('<Binary Data>');
    });
  });

  // =========================================================================
  // expandableRecord
  // =========================================================================

  describe('expandableRecord', () => {
    it('should be true for RECORD with object value', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto);
      expect(component.expandableRecord).toBe(true);
    });

    it('should be true for RECORD_ARRAY with array value', () => {
      initComponent([{ id: 1 }], AttributeValueTypeDto.RecordArrayDto);
      expect(component.expandableRecord).toBe(true);
    });

    it('should be false for RECORD with null value', () => {
      initComponent(null, AttributeValueTypeDto.RecordDto);
      expect(component.expandableRecord).toBe(false);
    });

    it('should be false for STRING type', () => {
      initComponent('text', AttributeValueTypeDto.StringDto);
      expect(component.expandableRecord).toBe(false);
    });

    it('should be false for RECORD with primitive value', () => {
      initComponent('string value', AttributeValueTypeDto.RecordDto);
      expect(component.expandableRecord).toBe(false);
    });
  });

  // =========================================================================
  // complexType
  // =========================================================================

  describe('complexType', () => {
    it('should be true for RECORD with object value', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for RECORD_ARRAY with array value', () => {
      initComponent([{ id: 1 }], AttributeValueTypeDto.RecordArrayDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for STRING_ARRAY with array value', () => {
      initComponent(['a', 'b'], AttributeValueTypeDto.StringArrayDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for INTEGER_ARRAY with array value', () => {
      initComponent([1, 2], AttributeValueTypeDto.IntegerArrayDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for INT_ARRAY with array value', () => {
      initComponent([1, 2], AttributeValueTypeDto.IntArrayDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for BINARY with object value', () => {
      initComponent(new ArrayBuffer(10), AttributeValueTypeDto.BinaryDto);
      expect(component.complexType).toBe(true);
    });

    it('should be true for BINARY_LINKED with object value', () => {
      initComponent({ binaryId: '123' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.complexType).toBe(true);
    });

    it('should be false for STRING', () => {
      initComponent('text', AttributeValueTypeDto.StringDto);
      expect(component.complexType).toBe(false);
    });

    it('should be false for INT', () => {
      initComponent(42, AttributeValueTypeDto.IntDto);
      expect(component.complexType).toBe(false);
    });

    it('should be false for BOOLEAN', () => {
      initComponent(true, AttributeValueTypeDto.BooleanDto);
      expect(component.complexType).toBe(false);
    });

    it('should be false for complex type with simple string value', () => {
      initComponent('8 items', AttributeValueTypeDto.RecordArrayDto);
      expect(component.complexType).toBe(false);
    });
  });

  // =========================================================================
  // typeIndicator
  // =========================================================================

  describe('typeIndicator', () => {
    it('should return RECORD for RecordDto', () => {
      initComponent(null, AttributeValueTypeDto.RecordDto);
      expect(component.typeIndicator).toBe('RECORD');
    });

    it('should return ARR[RECORD] for RecordArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.RecordArrayDto);
      expect(component.typeIndicator).toBe('ARR[RECORD]');
    });

    it('should return ARR[STR] for StringArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.StringArrayDto);
      expect(component.typeIndicator).toBe('ARR[STR]');
    });

    it('should return ARR[INT] for IntegerArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.IntegerArrayDto);
      expect(component.typeIndicator).toBe('ARR[INT]');
    });

    it('should return ARR[INT] for IntArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.IntArrayDto);
      expect(component.typeIndicator).toBe('ARR[INT]');
    });

    it('should return BIN for BinaryDto', () => {
      initComponent(null, AttributeValueTypeDto.BinaryDto);
      expect(component.typeIndicator).toBe('BIN');
    });

    it('should return BIN for BinaryLinkedDto', () => {
      initComponent(null, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.typeIndicator).toBe('BIN');
    });

    it('should return cleaned type name for other types', () => {
      initComponent(null, AttributeValueTypeDto.StringDto);
      expect(component.typeIndicator).toBe('STRING');
    });
  });

  // =========================================================================
  // typeDescription
  // =========================================================================

  describe('typeDescription', () => {
    it('should return Complex object for RecordDto', () => {
      initComponent(null, AttributeValueTypeDto.RecordDto);
      expect(component.typeDescription).toBe('Complex object');
    });

    it('should return Array of complex objects for RecordArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.RecordArrayDto);
      expect(component.typeDescription).toBe('Array of complex objects');
    });

    it('should return Array of strings for StringArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.StringArrayDto);
      expect(component.typeDescription).toBe('Array of strings');
    });

    it('should return Array of numbers for IntegerArrayDto', () => {
      initComponent(null, AttributeValueTypeDto.IntegerArrayDto);
      expect(component.typeDescription).toBe('Array of numbers');
    });

    it('should return Binary data for BinaryDto', () => {
      initComponent(null, AttributeValueTypeDto.BinaryDto);
      expect(component.typeDescription).toBe('Binary data');
    });

    it('should return Type: X for other types', () => {
      initComponent(null, AttributeValueTypeDto.StringDto);
      expect(component.typeDescription).toBe('Type: STRING');
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
  // recordSummary
  // =========================================================================

  describe('recordSummary', () => {
    it('should return Array with X items for RecordArrayDto', () => {
      initComponent([{ id: 1 }, { id: 2 }, { id: 3 }], AttributeValueTypeDto.RecordArrayDto);
      expect(component.recordSummary).toBe('Array with 3 items');
    });

    it('should use singular item for single element array', () => {
      initComponent([{ id: 1 }], AttributeValueTypeDto.RecordArrayDto);
      expect(component.recordSummary).toBe('Array with 1 item');
    });

    it('should return Object with X properties for RecordDto', () => {
      initComponent({ name: 'Test', age: 25 }, AttributeValueTypeDto.RecordDto);
      expect(component.recordSummary).toBe('Object with 2 properties');
    });

    it('should use singular property for single key object', () => {
      initComponent({ name: 'Test' }, AttributeValueTypeDto.RecordDto);
      expect(component.recordSummary).toBe('Object with 1 property');
    });

    it('should return Complex object for non-object values', () => {
      initComponent(null, AttributeValueTypeDto.RecordDto);
      expect(component.recordSummary).toBe('Complex object');
    });
  });

  // =========================================================================
  // getObjectProperties
  // =========================================================================

  describe('getObjectProperties', () => {
    beforeEach(() => fixture.detectChanges());

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
    beforeEach(() => fixture.detectChanges());

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
  // Binary Linked (pre-computed properties)
  // =========================================================================

  describe('binaryLinkedWithDownload', () => {
    it('should be false for non-BINARY_LINKED type', () => {
      initComponent({ binaryId: '123' }, AttributeValueTypeDto.StringDto);
      expect(component.binaryLinkedWithDownload).toBe(false);
    });

    it('should be false for BINARY_LINKED with null value', () => {
      initComponent(null, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryLinkedWithDownload).toBeFalsy();
    });

    it('should be false for BINARY_LINKED without binaryId or downloadUri', () => {
      initComponent({ filename: 'test.pdf' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryLinkedWithDownload).toBe(false);
    });

    it('should be true for BINARY_LINKED with binaryId', () => {
      initComponent({ binaryId: '123' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryLinkedWithDownload).toBe(true);
    });

    it('should be true for BINARY_LINKED with downloadUri', () => {
      initComponent({ downloadUri: 'https://example.com/file.pdf' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryLinkedWithDownload).toBe(true);
    });
  });

  describe('binary properties', () => {
    it('should set binaryFilename from value', () => {
      initComponent({ binaryId: '1', filename: 'document.pdf' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryFilename).toBe('document.pdf');
    });

    it('should set binarySize from value', () => {
      initComponent({ binaryId: '1', size: 1024 }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binarySize).toBe(1024);
    });

    it('should set binaryContentType from value', () => {
      initComponent({ binaryId: '1', contentType: 'application/pdf' }, AttributeValueTypeDto.BinaryLinkedDto);
      expect(component.binaryContentType).toBe('application/pdf');
    });
  });

  // =========================================================================
  // onDownload
  // =========================================================================

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
        'https://example.com/file.pdf', '_blank', 'noopener,noreferrer'
      );
    });

    it('should emit binaryDownload event when only binaryId present', () => {
      spyOn(component.binaryDownload, 'emit');
      component.value = { binaryId: '123', filename: 'test.pdf', contentType: 'application/pdf' };
      component.onDownload();
      expect(component.binaryDownload.emit).toHaveBeenCalledWith({
        binaryId: '123', filename: 'test.pdf', contentType: 'application/pdf'
      });
    });

    it('should prefer downloadUri over binaryId', () => {
      spyOn(component.binaryDownload, 'emit');
      component.value = { binaryId: '123', downloadUri: 'https://example.com/file.pdf' };
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
      initComponent({ level1: { level2: { level3: 'deep' } } }, AttributeValueTypeDto.RecordDto, PropertyDisplayMode.Text);
      expect(component.formattedValue).toContain('level1');
    });

    it('should handle mixed array types', () => {
      initComponent(['string', 123, true], AttributeValueTypeDto.StringArrayDto);
      expect(component.formattedValue).toBe('[string, 123, true]');
    });

    it('should handle special characters in string values', () => {
      initComponent('<script>alert("xss")</script>', AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('<script>alert("xss")</script>');
    });

    it('should handle numeric strings for DATE_TIME', () => {
      initComponent('12345', AttributeValueTypeDto.DateTimeDto);
      expect(component.formattedValue).toBeDefined();
    });
  });

  // =========================================================================
  // Input Change Regression (Kendo Grid cell recycling)
  // =========================================================================

  describe('Input Change Regression', () => {
    it('should recompute formattedValue when value input changes on existing instance', () => {
      initComponent('initial', AttributeValueTypeDto.StringDto);
      expect(component.formattedValue).toBe('initial');

      const previous = component.value;
      component.value = 'updated';
      component.ngOnChanges({ value: new SimpleChange(previous, 'updated', false) });

      expect(component.formattedValue).toBe('updated');
    });

    it('should reset binary metadata when transitioning from BINARY_LINKED to plain STRING', () => {
      initComponent(
        { binaryId: '1', filename: 'doc.pdf', size: 1024, contentType: 'application/pdf' },
        AttributeValueTypeDto.BinaryLinkedDto,
      );
      expect(component.binaryFilename).toBe('doc.pdf');
      expect(component.binarySize).toBe(1024);
      expect(component.binaryContentType).toBe('application/pdf');
      expect(component.formattedBinarySize).not.toBe('');

      const previousValue = component.value;
      const previousType = component.type;
      component.value = 'plain text';
      component.type = AttributeValueTypeDto.StringDto;
      component.ngOnChanges({
        value: new SimpleChange(previousValue, 'plain text', false),
        type: new SimpleChange(previousType, AttributeValueTypeDto.StringDto, false),
      });

      expect(component.binaryFilename).toBeNull();
      expect(component.binarySize).toBeNull();
      expect(component.binaryContentType).toBeNull();
      expect(component.formattedBinarySize).toBe('');
      expect(component.binaryLinkedWithDownload).toBe(false);
    });

    it('should collapse expansion when value input changes', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto);
      component.toggleExpansion();
      expect(component.isExpanded).toBe(true);

      const previous = component.value;
      component.value = { other: 'record' };
      component.ngOnChanges({ value: new SimpleChange(previous, component.value, false) });

      expect(component.isExpanded).toBe(false);
    });

    it('should collapse expansion when type input changes', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto);
      component.toggleExpansion();
      expect(component.isExpanded).toBe(true);

      const previous = component.type;
      component.type = AttributeValueTypeDto.StringDto;
      component.ngOnChanges({ type: new SimpleChange(previous, AttributeValueTypeDto.StringDto, false) });

      expect(component.isExpanded).toBe(false);
    });

    it('should preserve expansion when only displayMode changes', () => {
      initComponent({ key: 'value' }, AttributeValueTypeDto.RecordDto);
      component.toggleExpansion();
      expect(component.isExpanded).toBe(true);

      const previous = component.displayMode;
      component.displayMode = PropertyDisplayMode.Json;
      component.ngOnChanges({ displayMode: new SimpleChange(previous, PropertyDisplayMode.Json, false) });

      expect(component.isExpanded).toBe(true);
    });
  });
});
