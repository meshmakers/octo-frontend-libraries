import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PropertyConverterService } from './property-converter.service';
import { CkTypeAttributeService, CkTypeAttributeInfo } from '@meshmakers/octo-services';
import { AttributeValueTypeDto, DefaultPropertyCategory } from '../models/property-grid.models';

describe('PropertyConverterService', () => {
  let service: PropertyConverterService;
  let ckTypeAttributeServiceMock: jasmine.SpyObj<CkTypeAttributeService>;

  const mockCkTypeAttributes: CkTypeAttributeInfo[] = [
    { attributeName: 'name', attributeValueType: 'STRING' },
    { attributeName: 'age', attributeValueType: 'INT' },
    { attributeName: 'isActive', attributeValueType: 'BOOLEAN' },
    { attributeName: 'createdAt', attributeValueType: 'DATE_TIME' },
    { attributeName: 'price', attributeValueType: 'DOUBLE' },
    { attributeName: 'tags', attributeValueType: 'STRING_ARRAY' },
    { attributeName: 'data', attributeValueType: 'BINARY' }
  ];

  const mockCkRecordAttributes: CkTypeAttributeInfo[] = [
    { attributeName: 'recordField1', attributeValueType: 'STRING' },
    { attributeName: 'recordField2', attributeValueType: 'INT' }
  ];

  beforeEach(() => {
    ckTypeAttributeServiceMock = jasmine.createSpyObj('CkTypeAttributeService', [
      'getCkTypeAttributes',
      'getCkRecordAttributes'
    ]);

    ckTypeAttributeServiceMock.getCkTypeAttributes.and.returnValue(of(mockCkTypeAttributes));
    ckTypeAttributeServiceMock.getCkRecordAttributes.and.returnValue(of(mockCkRecordAttributes));

    TestBed.configureTestingModule({
      providers: [
        PropertyConverterService,
        { provide: CkTypeAttributeService, useValue: ckTypeAttributeServiceMock }
      ]
    });

    service = TestBed.inject(PropertyConverterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // =========================================================================
  // convertRtEntityAttributes Tests
  // =========================================================================

  describe('convertRtEntityAttributes', () => {
    it('should return empty array for null attributes', (done) => {
      service.convertRtEntityAttributes(null as any, 'TestType').subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should return empty array for empty attributes array', (done) => {
      service.convertRtEntityAttributes([], 'TestType').subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should convert attributes with CK type mapping', (done) => {
      const attributes = [
        { attributeName: 'name', value: 'Test Entity' },
        { attributeName: 'age', value: 25 }
      ];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('name');
        expect(result[0].value).toBe('Test Entity');
        expect(result[0].type).toBe(AttributeValueTypeDto.StringDto);
        expect(result[0].category).toBe(DefaultPropertyCategory.Attributes);
        expect(result[1].name).toBe('age');
        expect(result[1].value).toBe(25);
        expect(result[1].type).toBe(AttributeValueTypeDto.IntDto);
        done();
      });
    });

    it('should call CkTypeAttributeService with correct ckTypeId', (done) => {
      const attributes = [{ attributeName: 'name', value: 'Test' }];

      service.convertRtEntityAttributes(attributes, 'OctoSdkDemo/Customer').subscribe(() => {
        expect(ckTypeAttributeServiceMock.getCkTypeAttributes).toHaveBeenCalledWith('OctoSdkDemo/Customer');
        done();
      });
    });

    it('should fallback to StringDto for unknown attributes', (done) => {
      const attributes = [{ attributeName: 'unknownField', value: 'some value' }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].type).toBe(AttributeValueTypeDto.StringDto);
        done();
      });
    });

    it('should handle null attribute name', (done) => {
      const attributes = [{ attributeName: null, value: 'Test' }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].name).toBe('attribute_0');
        expect(result[0].displayName).toBe('attribute_0');
        done();
      });
    });

    it('should handle null values', (done) => {
      const attributes = [{ attributeName: 'name', value: null }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].value).toBeNull();
        done();
      });
    });

    it('should handle array values', (done) => {
      const attributes = [{ attributeName: 'tags', value: ['tag1', 'tag2', 'tag3'] }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].value).toEqual(['tag1', 'tag2', 'tag3']);
        expect(result[0].type).toBe(AttributeValueTypeDto.StringArrayDto);
        done();
      });
    });
  });

  // =========================================================================
  // convertObjectToProperties Tests
  // =========================================================================

  describe('convertObjectToProperties', () => {
    it('should return empty array for null object', () => {
      const result = service.convertObjectToProperties(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined object', () => {
      const result = service.convertObjectToProperties(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-object types', () => {
      expect(service.convertObjectToProperties('string')).toEqual([]);
      expect(service.convertObjectToProperties(123)).toEqual([]);
      expect(service.convertObjectToProperties(true)).toEqual([]);
    });

    it('should convert simple object properties', () => {
      const obj = { name: 'Test', count: 42, active: true };
      const result = service.convertObjectToProperties(obj);

      expect(result.length).toBe(3);
      expect(result.find(p => p.name === 'name')?.value).toBe('Test');
      expect(result.find(p => p.name === 'count')?.value).toBe(42);
      expect(result.find(p => p.name === 'active')?.value).toBe(true);
    });

    it('should infer correct types for values', () => {
      const obj = {
        stringVal: 'hello',
        intVal: 42,
        doubleVal: 3.14,
        boolVal: true,
        nullVal: null
      };

      const result = service.convertObjectToProperties(obj);

      expect(result.find(p => p.name === 'stringVal')?.type).toBe(AttributeValueTypeDto.StringDto);
      expect(result.find(p => p.name === 'intVal')?.type).toBe(AttributeValueTypeDto.IntDto);
      expect(result.find(p => p.name === 'doubleVal')?.type).toBe(AttributeValueTypeDto.DoubleDto);
      expect(result.find(p => p.name === 'boolVal')?.type).toBe(AttributeValueTypeDto.BooleanDto);
      expect(result.find(p => p.name === 'nullVal')?.type).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should detect ISO date strings', () => {
      const obj = {
        dateWithZ: '2024-01-15T10:30:00.000Z',
        dateWithoutZ: '2024-01-15T10:30:00',
        notADate: '2024-01-15'
      };

      const result = service.convertObjectToProperties(obj);

      expect(result.find(p => p.name === 'dateWithZ')?.type).toBe(AttributeValueTypeDto.DateTimeDto);
      expect(result.find(p => p.name === 'dateWithoutZ')?.type).toBe(AttributeValueTypeDto.DateTimeDto);
      expect(result.find(p => p.name === 'notADate')?.type).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should detect Date objects', () => {
      const obj = { dateObj: new Date('2024-01-15') };
      const result = service.convertObjectToProperties(obj);
      expect(result.find(p => p.name === 'dateObj')?.type).toBe(AttributeValueTypeDto.DateTimeDto);
    });

    it('should detect arrays and infer array types', () => {
      const obj = {
        stringArray: ['a', 'b', 'c'],
        intArray: [1, 2, 3],
        emptyArray: [],
        objectArray: [{ id: 1 }, { id: 2 }]
      };

      const result = service.convertObjectToProperties(obj);

      expect(result.find(p => p.name === 'stringArray')?.type).toBe(AttributeValueTypeDto.StringArrayDto);
      expect(result.find(p => p.name === 'intArray')?.type).toBe(AttributeValueTypeDto.IntegerArrayDto);
      expect(result.find(p => p.name === 'emptyArray')?.type).toBe(AttributeValueTypeDto.StringArrayDto);
      expect(result.find(p => p.name === 'objectArray')?.type).toBe(AttributeValueTypeDto.RecordArrayDto);
    });

    it('should detect nested objects as RecordDto', () => {
      const obj = { nested: { field1: 'value1', field2: 'value2' } };
      const result = service.convertObjectToProperties(obj);
      expect(result.find(p => p.name === 'nested')?.type).toBe(AttributeValueTypeDto.RecordDto);
    });

    it('should use provided category', () => {
      const obj = { name: 'Test' };
      const result = service.convertObjectToProperties(obj, 'CustomCategory');
      expect(result[0].category).toBe('CustomCategory');
    });

    it('should use General category as default', () => {
      const obj = { name: 'Test' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].category).toBe(DefaultPropertyCategory.General);
    });

    it('should set readOnly to false', () => {
      const obj = { name: 'Test' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].readOnly).toBe(false);
    });

    it('should generate correct id format', () => {
      const obj = { myField: 'value' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].id).toBe('obj_myField');
    });

    it('should set description with property name', () => {
      const obj = { myField: 'value' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].description).toBe('Property: myField');
    });
  });

  // =========================================================================
  // convertRtRecordToProperties Tests
  // =========================================================================

  describe('convertRtRecordToProperties', () => {
    it('should return empty array for null record', (done) => {
      service.convertRtRecordToProperties(null).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should return empty array for undefined record', (done) => {
      service.convertRtRecordToProperties(undefined).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should return empty array for non-object record', (done) => {
      service.convertRtRecordToProperties('string' as any).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should return empty array for record without attributes', (done) => {
      service.convertRtRecordToProperties({ ckRecordId: 'Test/Record' }).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should return empty array for record without ckRecordId', (done) => {
      service.convertRtRecordToProperties({ attributes: [] }).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should include ckRecordId as system property', (done) => {
      const record = { ckRecordId: 'OctoSdkDemo/TestRecord', attributes: [] };

      service.convertRtRecordToProperties(record).subscribe(result => {
        const recordIdProp = result.find(p => p.name === 'ckRecordId');

        expect(recordIdProp).toBeTruthy();
        expect(recordIdProp?.value).toBe('OctoSdkDemo/TestRecord');
        expect(recordIdProp?.type).toBe(AttributeValueTypeDto.StringDto);
        expect(recordIdProp?.category).toBe(DefaultPropertyCategory.System);
        expect(recordIdProp?.readOnly).toBe(true);
        expect(recordIdProp?.displayName).toBe('Record ID');
        done();
      });
    });

    it('should convert record attributes with CK type mapping', (done) => {
      const record = {
        ckRecordId: 'OctoSdkDemo/TestRecord',
        attributes: [
          { attributeName: 'recordField1', value: 'Value 1' },
          { attributeName: 'recordField2', value: 100 }
        ]
      };

      service.convertRtRecordToProperties(record).subscribe(result => {
        expect(ckTypeAttributeServiceMock.getCkRecordAttributes).toHaveBeenCalledWith('OctoSdkDemo/TestRecord');
        expect(result.length).toBe(3); // System property + 2 attributes

        const field1 = result.find(p => p.name === 'recordField1');
        expect(field1?.value).toBe('Value 1');
        expect(field1?.type).toBe(AttributeValueTypeDto.StringDto);

        const field2 = result.find(p => p.name === 'recordField2');
        expect(field2?.value).toBe(100);
        expect(field2?.type).toBe(AttributeValueTypeDto.IntDto);

        done();
      });
    });
  });

  // =========================================================================
  // convertRtEntityToProperties Tests
  // =========================================================================

  describe('convertRtEntityToProperties', () => {
    it('should convert rtId as system property', (done) => {
      const entity = { rtId: 'entity-123' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        const rtIdProp = result.find(p => p.name === 'rtId');

        expect(rtIdProp).toBeTruthy();
        expect(rtIdProp?.value).toBe('entity-123');
        expect(rtIdProp?.type).toBe(AttributeValueTypeDto.StringDto);
        expect(rtIdProp?.category).toBe(DefaultPropertyCategory.System);
        expect(rtIdProp?.readOnly).toBe(true);
        expect(rtIdProp?.displayName).toBe('Runtime ID');
        done();
      });
    });

    it('should convert ckTypeId as system property', (done) => {
      const entity = { ckTypeId: 'OctoSdkDemo/Customer' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        const ckTypeIdProp = result.find(p => p.name === 'ckTypeId');

        expect(ckTypeIdProp).toBeTruthy();
        expect(ckTypeIdProp?.value).toBe('OctoSdkDemo/Customer');
        expect(ckTypeIdProp?.type).toBe(AttributeValueTypeDto.StringDto);
        expect(ckTypeIdProp?.category).toBe(DefaultPropertyCategory.System);
        expect(ckTypeIdProp?.readOnly).toBe(true);
        expect(ckTypeIdProp?.displayName).toBe('Type ID');
        done();
      });
    });

    it('should convert rtCreationDateTime as system property', (done) => {
      const entity = { rtCreationDateTime: '2024-01-15T10:30:00Z' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        const createdProp = result.find(p => p.name === 'rtCreationDateTime');

        expect(createdProp).toBeTruthy();
        expect(createdProp?.value).toBe('2024-01-15T10:30:00Z');
        expect(createdProp?.type).toBe(AttributeValueTypeDto.DateTimeDto);
        expect(createdProp?.category).toBe(DefaultPropertyCategory.System);
        expect(createdProp?.readOnly).toBe(true);
        expect(createdProp?.displayName).toBe('Created');
        done();
      });
    });

    it('should convert rtChangedDateTime as system property', (done) => {
      const entity = { rtChangedDateTime: '2024-01-16T14:00:00Z' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        const modifiedProp = result.find(p => p.name === 'rtChangedDateTime');

        expect(modifiedProp).toBeTruthy();
        expect(modifiedProp?.value).toBe('2024-01-16T14:00:00Z');
        expect(modifiedProp?.type).toBe(AttributeValueTypeDto.DateTimeDto);
        expect(modifiedProp?.category).toBe(DefaultPropertyCategory.System);
        expect(modifiedProp?.readOnly).toBe(true);
        expect(modifiedProp?.displayName).toBe('Modified');
        done();
      });
    });

    it('should convert rtWellKnownName as general property', (done) => {
      const entity = { rtWellKnownName: 'my-entity' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        const wknProp = result.find(p => p.name === 'rtWellKnownName');

        expect(wknProp).toBeTruthy();
        expect(wknProp?.value).toBe('my-entity');
        expect(wknProp?.type).toBe(AttributeValueTypeDto.StringDto);
        expect(wknProp?.category).toBe(DefaultPropertyCategory.General);
        expect(wknProp?.readOnly).toBe(false);
        expect(wknProp?.displayName).toBe('Well Known Name');
        done();
      });
    });

    it('should return only system properties if no ckTypeId', (done) => {
      const entity = {
        rtId: 'entity-123',
        attributes: { items: [{ attributeName: 'name', value: 'Test' }] }
      };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('rtId');
        expect(ckTypeAttributeServiceMock.getCkTypeAttributes).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return only system properties if no attributes', (done) => {
      const entity = { rtId: 'entity-123', ckTypeId: 'OctoSdkDemo/Customer' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        expect(result.length).toBe(2);
        expect(result.find(p => p.name === 'rtId')).toBeTruthy();
        expect(result.find(p => p.name === 'ckTypeId')).toBeTruthy();
        expect(ckTypeAttributeServiceMock.getCkTypeAttributes).not.toHaveBeenCalled();
        done();
      });
    });

    it('should convert full entity with all properties and attributes', (done) => {
      const entity = {
        rtId: 'entity-123',
        ckTypeId: 'OctoSdkDemo/Customer',
        rtCreationDateTime: '2024-01-15T10:30:00Z',
        rtChangedDateTime: '2024-01-16T14:00:00Z',
        rtWellKnownName: 'customer-1',
        attributes: {
          items: [
            { attributeName: 'name', value: 'John Doe' },
            { attributeName: 'age', value: 30 },
            { attributeName: 'isActive', value: true }
          ]
        }
      };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        expect(result.length).toBe(8); // 5 system + 3 attributes

        expect(result.find(p => p.name === 'rtId')).toBeTruthy();
        expect(result.find(p => p.name === 'ckTypeId')).toBeTruthy();
        expect(result.find(p => p.name === 'rtCreationDateTime')).toBeTruthy();
        expect(result.find(p => p.name === 'rtChangedDateTime')).toBeTruthy();
        expect(result.find(p => p.name === 'rtWellKnownName')).toBeTruthy();

        const nameProp = result.find(p => p.name === 'name');
        expect(nameProp?.value).toBe('John Doe');
        expect(nameProp?.type).toBe(AttributeValueTypeDto.StringDto);

        const ageProp = result.find(p => p.name === 'age');
        expect(ageProp?.value).toBe(30);
        expect(ageProp?.type).toBe(AttributeValueTypeDto.IntDto);

        const activeProp = result.find(p => p.name === 'isActive');
        expect(activeProp?.value).toBe(true);
        expect(activeProp?.type).toBe(AttributeValueTypeDto.BooleanDto);

        done();
      });
    });

    it('should handle entity with only some system properties', (done) => {
      const entity = { rtId: 'entity-123' };

      service.convertRtEntityToProperties(entity).subscribe(result => {
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('rtId');
        done();
      });
    });
  });

  // =========================================================================
  // CK Type Mapping Tests
  // =========================================================================

  describe('CK Type Mapping', () => {
    const testCases: { ckType: string; expectedDto: AttributeValueTypeDto }[] = [
      { ckType: 'BINARY', expectedDto: AttributeValueTypeDto.BinaryDto },
      { ckType: 'BINARY_LINKED', expectedDto: AttributeValueTypeDto.BinaryLinkedDto },
      { ckType: 'BOOLEAN', expectedDto: AttributeValueTypeDto.BooleanDto },
      { ckType: 'DATE_TIME', expectedDto: AttributeValueTypeDto.DateTimeDto },
      { ckType: 'DATE_TIME_OFFSET', expectedDto: AttributeValueTypeDto.DateTimeOffsetDto },
      { ckType: 'DOUBLE', expectedDto: AttributeValueTypeDto.DoubleDto },
      { ckType: 'ENUM', expectedDto: AttributeValueTypeDto.EnumDto },
      { ckType: 'GEOSPATIAL_POINT', expectedDto: AttributeValueTypeDto.GeospatialPointDto },
      { ckType: 'INT', expectedDto: AttributeValueTypeDto.IntDto },
      { ckType: 'INTEGER', expectedDto: AttributeValueTypeDto.IntegerDto },
      { ckType: 'INTEGER_64', expectedDto: AttributeValueTypeDto.Integer_64Dto },
      { ckType: 'INTEGER_ARRAY', expectedDto: AttributeValueTypeDto.IntegerArrayDto },
      { ckType: 'INT_64', expectedDto: AttributeValueTypeDto.Int_64Dto },
      { ckType: 'INT_ARRAY', expectedDto: AttributeValueTypeDto.IntArrayDto },
      { ckType: 'RECORD', expectedDto: AttributeValueTypeDto.RecordDto },
      { ckType: 'RECORD_ARRAY', expectedDto: AttributeValueTypeDto.RecordArrayDto },
      { ckType: 'STRING', expectedDto: AttributeValueTypeDto.StringDto },
      { ckType: 'STRING_ARRAY', expectedDto: AttributeValueTypeDto.StringArrayDto },
      { ckType: 'TIME_SPAN', expectedDto: AttributeValueTypeDto.TimeSpanDto }
    ];

    testCases.forEach(({ ckType, expectedDto }) => {
      it(`should map CK type ${ckType} to ${expectedDto}`, (done) => {
        ckTypeAttributeServiceMock.getCkTypeAttributes.and.returnValue(
          of([{ attributeName: 'testAttr', attributeValueType: ckType }])
        );

        const attributes = [{ attributeName: 'testAttr', value: 'test' }];

        service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
          expect(result[0].type).toBe(expectedDto);
          done();
        });
      });
    });

    it('should fallback to StringDto for unknown CK type', (done) => {
      ckTypeAttributeServiceMock.getCkTypeAttributes.and.returnValue(
        of([{ attributeName: 'testAttr', attributeValueType: 'UNKNOWN_TYPE' }])
      );

      const attributes = [{ attributeName: 'testAttr', value: 'test' }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].type).toBe(AttributeValueTypeDto.StringDto);
        done();
      });
    });
  });

  // =========================================================================
  // Nested Record Tests
  // =========================================================================

  describe('Nested Record Handling', () => {
    it('should convert nested record with async CK type lookup', (done) => {
      const attributes = [
        { attributeName: 'name', value: 'Parent' },
        {
          attributeName: 'nestedRecord',
          value: {
            ckRecordId: 'OctoSdkDemo/NestedRecord',
            attributes: [{ attributeName: 'recordField1', value: 'Nested Value' }]
          }
        }
      ];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result.length).toBe(2);

        const nestedProp = result.find(p => p.name === 'nestedRecord');
        expect(nestedProp).toBeTruthy();
        expect(Array.isArray(nestedProp?.value)).toBe(true);

        expect(ckTypeAttributeServiceMock.getCkRecordAttributes).toHaveBeenCalledWith('OctoSdkDemo/NestedRecord');

        done();
      });
    });

    it('should handle deeply nested arrays', (done) => {
      const attributes = [
        {
          attributeName: 'items',
          value: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }]
        }
      ];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].value).toEqual([{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }]);
        done();
      });
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle empty entity', (done) => {
      service.convertRtEntityToProperties({}).subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should handle attributes with undefined name', (done) => {
      const attributes = [{ attributeName: undefined, value: 'test' }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].name).toBe('attribute_0');
        done();
      });
    });

    it('should handle attributes with undefined value', (done) => {
      const attributes = [{ attributeName: 'field', value: undefined }];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].value).toBeNull();
        done();
      });
    });

    it('should handle completely empty attribute object', (done) => {
      const attributes = [{}];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].name).toBe('attribute_0');
        expect(result[0].value).toBeNull();
        done();
      });
    });

    it('should preserve array order', (done) => {
      const attributes = [
        { attributeName: 'first', value: 1 },
        { attributeName: 'second', value: 2 },
        { attributeName: 'third', value: 3 }
      ];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].name).toBe('first');
        expect(result[1].name).toBe('second');
        expect(result[2].name).toBe('third');
        done();
      });
    });

    it('should generate unique ids with index', (done) => {
      const attributes = [
        { attributeName: 'field', value: 'a' },
        { attributeName: 'field', value: 'b' }
      ];

      service.convertRtEntityAttributes(attributes, 'TestType').subscribe(result => {
        expect(result[0].id).toBe('attr_0_field');
        expect(result[1].id).toBe('attr_1_field');
        done();
      });
    });
  });

  // =========================================================================
  // ISO Date String Detection Tests
  // =========================================================================

  describe('ISO Date String Detection', () => {
    it('should detect valid ISO date with milliseconds and Z', () => {
      const obj = { date: '2024-01-15T10:30:00.000Z' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].type).toBe(AttributeValueTypeDto.DateTimeDto);
    });

    it('should detect valid ISO date without milliseconds', () => {
      const obj = { date: '2024-01-15T10:30:00' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].type).toBe(AttributeValueTypeDto.DateTimeDto);
    });

    it('should detect valid ISO date with milliseconds without Z', () => {
      const obj = { date: '2024-01-15T10:30:00.123' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].type).toBe(AttributeValueTypeDto.DateTimeDto);
    });

    it('should NOT detect date-only strings as DateTime', () => {
      const obj = { date: '2024-01-15' };
      const result = service.convertObjectToProperties(obj);
      expect(result[0].type).toBe(AttributeValueTypeDto.StringDto);
    });

    it('should NOT detect invalid date strings', () => {
      const obj = {
        invalid1: '2024-13-45T99:99:99Z',
        invalid2: 'not-a-date',
        invalid3: '2024/01/15T10:30:00Z'
      };
      const result = service.convertObjectToProperties(obj);
      expect(result.every(p => p.type === AttributeValueTypeDto.StringDto)).toBe(true);
    });
  });
});
