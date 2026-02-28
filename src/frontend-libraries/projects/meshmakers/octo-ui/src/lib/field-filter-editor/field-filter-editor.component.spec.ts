import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { FieldFilterEditorComponent, FieldFilterItem, FilterVariable } from './field-filter-editor.component';
import { FieldFilterOperatorsDto, AttributeItem } from '@meshmakers/octo-services';

describe('FieldFilterEditorComponent', () => {
  let component: FieldFilterEditorComponent;
  let fixture: ComponentFixture<FieldFilterEditorComponent>;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING' },
    { attributePath: 'age', attributeValueType: 'INT' },
    { attributePath: 'price', attributeValueType: 'DOUBLE' },
    { attributePath: 'isActive', attributeValueType: 'BOOLEAN' },
    { attributePath: 'createdAt', attributeValueType: 'DATE_TIME' },
    { attributePath: 'count', attributeValueType: 'INTEGER' },
    { attributePath: 'bigNumber', attributeValueType: 'INT_64' }
  ];

  const mockVariables: FilterVariable[] = [
    { name: 'currentUser', label: 'Current User', type: 'string' },
    { name: 'today', label: 'Today', type: 'date' },
    { name: 'threshold', label: 'Threshold Value', type: 'number' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FieldFilterEditorComponent,
        FormsModule
      ],
      providers: [provideNoopAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(FieldFilterEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // =========================================================================
  // Basic Filter Operations
  // =========================================================================

  describe('Filter Operations', () => {
    it('should start with empty filters', () => {
      expect(component.filters).toEqual([]);
    });

    it('should add a new filter with default values', () => {
      component.addFilter();

      expect(component.filters.length).toBe(1);
      expect(component.filters[0].attributePath).toBe('');
      expect(component.filters[0].operator).toBe(FieldFilterOperatorsDto.EqualsDto);
      expect(component.filters[0].comparisonValue).toBe('');
      expect(component.filters[0].id).toBeDefined();
    });

    it('should assign unique ids to each filter', () => {
      component.addFilter();
      component.addFilter();
      component.addFilter();

      const ids = component.filters.map(f => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should emit filtersChange when adding filter', () => {
      spyOn(component.filtersChange, 'emit');

      component.addFilter();

      expect(component.filtersChange.emit).toHaveBeenCalledWith(component.filters);
    });

    it('should remove a specific filter', () => {
      component.addFilter();
      component.addFilter();
      const filterToRemove = component.filters[0];

      component.removeFilter(filterToRemove);

      expect(component.filters.length).toBe(1);
      expect(component.filters.find(f => f.id === filterToRemove.id)).toBeUndefined();
    });

    it('should emit filtersChange when removing filter', () => {
      component.addFilter();
      spyOn(component.filtersChange, 'emit');

      component.removeFilter(component.filters[0]);

      expect(component.filtersChange.emit).toHaveBeenCalled();
    });

    it('should remove selected filters', () => {
      component.addFilter();
      component.addFilter();
      component.addFilter();
      component.selectedKeys = [component.filters[0].id, component.filters[2].id];
      const remainingId = component.filters[1].id;

      component.removeSelected();

      expect(component.filters.length).toBe(1);
      expect(component.filters[0].id).toBe(remainingId);
      expect(component.selectedKeys).toEqual([]);
    });

    it('should clear all filters', () => {
      component.addFilter();
      component.addFilter();
      component.selectedKeys = [component.filters[0].id];

      component.clear();

      expect(component.filters).toEqual([]);
      expect(component.selectedKeys).toEqual([]);
    });

    it('should emit filtersChange when clearing', () => {
      component.addFilter();
      spyOn(component.filtersChange, 'emit');

      component.clear();

      expect(component.filtersChange.emit).toHaveBeenCalledWith([]);
    });
  });

  // =========================================================================
  // Selection Logic
  // =========================================================================

  describe('Selection Logic', () => {
    beforeEach(() => {
      component.addFilter();
      component.addFilter();
      component.addFilter();
    });

    it('should check if filter is selected', () => {
      const filter = component.filters[1];
      component.selectedKeys = [filter.id];

      expect(component.isSelected(filter)).toBe(true);
      expect(component.isSelected(component.filters[0])).toBe(false);
    });

    it('should toggle selection on', () => {
      const filter = component.filters[0];

      component.toggleSelection(filter);

      expect(component.selectedKeys).toContain(filter.id);
    });

    it('should toggle selection off', () => {
      const filter = component.filters[0];
      component.selectedKeys = [filter.id];

      component.toggleSelection(filter);

      expect(component.selectedKeys).not.toContain(filter.id);
    });

    it('should report all selected when all filters are selected', () => {
      component.selectedKeys = component.filters.map(f => f.id);

      expect(component.isAllSelected()).toBe(true);
      expect(component.isIndeterminate()).toBe(false);
    });

    it('should report indeterminate when some filters are selected', () => {
      component.selectedKeys = [component.filters[0].id];

      expect(component.isAllSelected()).toBe(false);
      expect(component.isIndeterminate()).toBe(true);
    });

    it('should report neither when no filters are selected', () => {
      component.selectedKeys = [];

      expect(component.isAllSelected()).toBe(false);
      expect(component.isIndeterminate()).toBe(false);
    });

    it('should select all when toggle all is checked', () => {
      const event = { target: { checked: true } } as unknown as Event;

      component.toggleSelectAll(event);

      expect(component.selectedKeys.length).toBe(3);
    });

    it('should deselect all when toggle all is unchecked', () => {
      component.selectedKeys = component.filters.map(f => f.id);
      const event = { target: { checked: false } } as unknown as Event;

      component.toggleSelectAll(event);

      expect(component.selectedKeys).toEqual([]);
    });

    it('should return false for isAllSelected when no filters exist', () => {
      component.clear();

      expect(component.isAllSelected()).toBe(false);
    });
  });

  // =========================================================================
  // Operator Logic
  // =========================================================================

  describe('Operator Logic', () => {
    it('should have all expected operators', () => {
      const operatorValues = component.operators.map(o => o.value);

      expect(operatorValues).toContain(FieldFilterOperatorsDto.EqualsDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.NotEqualsDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.GreaterThanDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.GreaterEqualThanDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.LessThanDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.LessEqualThanDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.LikeDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.InDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.NotInDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.AnyEqDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.AnyLikeDto);
      expect(operatorValues).toContain(FieldFilterOperatorsDto.MatchRegExDto);
    });

    it('should identify IN as array operator', () => {
      expect(component.isArrayOperator(FieldFilterOperatorsDto.InDto)).toBe(true);
    });

    it('should identify NOT_IN as array operator', () => {
      expect(component.isArrayOperator(FieldFilterOperatorsDto.NotInDto)).toBe(true);
    });

    it('should NOT identify EQUALS as array operator', () => {
      expect(component.isArrayOperator(FieldFilterOperatorsDto.EqualsDto)).toBe(false);
    });

    it('should NOT identify LIKE as array operator', () => {
      expect(component.isArrayOperator(FieldFilterOperatorsDto.LikeDto)).toBe(false);
    });
  });

  // =========================================================================
  // Input Type Detection
  // =========================================================================

  describe('Input Type Detection', () => {
    beforeEach(() => {
      component.availableAttributes = mockAttributes;
      component.ngOnChanges();
    });

    it('should return "text" for unknown attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'unknown',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('text');
    });

    it('should return "text" for STRING attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'name',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('text');
    });

    it('should return "boolean" for BOOLEAN attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'isActive',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('boolean');
    });

    it('should return "number" for INT attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'age',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('number');
    });

    it('should return "number" for INTEGER attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'count',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('number');
    });

    it('should return "number" for DOUBLE attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'price',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('number');
    });

    it('should return "number" for INT_64 attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'bigNumber',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('number');
    });

    it('should return "datetime" for DATE_TIME attribute', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'createdAt',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getInputType(filter)).toBe('datetime');
    });
  });

  // =========================================================================
  // Number Formatting
  // =========================================================================

  describe('Number Formatting', () => {
    beforeEach(() => {
      component.availableAttributes = mockAttributes;
      component.ngOnChanges();
    });

    it('should return 4 decimals for DOUBLE', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'price',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getDecimals(filter)).toBe(4);
    });

    it('should return 0 decimals for INT', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'age',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getDecimals(filter)).toBe(0);
    });

    it('should return "n4" format for DOUBLE', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'price',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getNumberFormat(filter)).toBe('n4');
    });

    it('should return "n0" format for INT', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'age',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getNumberFormat(filter)).toBe('n0');
    });
  });

  // =========================================================================
  // Value Conversion
  // =========================================================================

  describe('Value Conversion', () => {
    describe('getDisplayValue', () => {
      it('should return empty string for null/undefined value', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: null
        };

        expect(component.getDisplayValue(filter)).toBe('');
      });

      it('should return value as-is for non-array operators', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'test value'
        };

        expect(component.getDisplayValue(filter)).toBe('test value');
      });

      it('should extract array content for IN operator', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.InDto,
          comparisonValue: '[a, b, c]'
        };

        expect(component.getDisplayValue(filter)).toBe('a, b, c');
      });
    });

    describe('getBooleanValue', () => {
      it('should return "true" for true string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'isActive',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'true'
        };

        expect(component.getBooleanValue(filter)).toBe('true');
      });

      it('should return "true" for true boolean', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'isActive',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: true
        };

        expect(component.getBooleanValue(filter)).toBe('true');
      });

      it('should return "false" for false string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'isActive',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'false'
        };

        expect(component.getBooleanValue(filter)).toBe('false');
      });

      it('should return empty string for other values', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'isActive',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'maybe'
        };

        expect(component.getBooleanValue(filter)).toBe('');
      });
    });

    describe('getNumericValue', () => {
      it('should return 0 for null value', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'age',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: null
        };

        expect(component.getNumericValue(filter)).toBe(0);
      });

      it('should return 0 for empty string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'age',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: ''
        };

        expect(component.getNumericValue(filter)).toBe(0);
      });

      it('should return parsed number for valid numeric string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'age',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '42'
        };

        expect(component.getNumericValue(filter)).toBe(42);
      });

      it('should return 0 for NaN', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'age',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'not a number'
        };

        expect(component.getNumericValue(filter)).toBe(0);
      });

      it('should handle decimal numbers', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'price',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '3.14'
        };

        expect(component.getNumericValue(filter)).toBe(3.14);
      });
    });

    describe('getDateTimeValue', () => {
      it('should return null for empty value', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'createdAt',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: ''
        };

        expect(component.getDateTimeValue(filter)).toBeNull();
      });

      it('should return Date for valid ISO string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'createdAt',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '2024-01-15T10:30:00Z'
        };

        const result = component.getDateTimeValue(filter);
        expect(result).toBeInstanceOf(Date);
        expect(result?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should return null for invalid date string', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'createdAt',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: 'not a date'
        };

        expect(component.getDateTimeValue(filter)).toBeNull();
      });
    });
  });

  // =========================================================================
  // Value Change Handlers
  // =========================================================================

  describe('Value Change Handlers', () => {
    it('should update boolean value', () => {
      component.addFilter();
      const filter = component.filters[0];
      spyOn(component.filtersChange, 'emit');

      component.onBooleanValueChange(filter, 'true');

      expect(filter.comparisonValue).toBe('true');
      expect(component.filtersChange.emit).toHaveBeenCalled();
    });

    it('should update numeric value', () => {
      component.addFilter();
      const filter = component.filters[0];
      spyOn(component.filtersChange, 'emit');

      component.onNumericValueChange(filter, 42);

      expect(filter.comparisonValue).toBe('42');
      expect(component.filtersChange.emit).toHaveBeenCalled();
    });

    it('should set empty string for null numeric value', () => {
      component.addFilter();
      const filter = component.filters[0];

      component.onNumericValueChange(filter, null);

      expect(filter.comparisonValue).toBe('');
    });

    it('should update datetime value to ISO string', () => {
      component.addFilter();
      const filter = component.filters[0];
      const date = new Date('2024-01-15T10:30:00Z');

      component.onDateTimeValueChange(filter, date);

      expect(filter.comparisonValue).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should set empty string for null datetime value', () => {
      component.addFilter();
      const filter = component.filters[0];

      component.onDateTimeValueChange(filter, null);

      expect(filter.comparisonValue).toBe('');
    });
  });

  // =========================================================================
  // Operator Change with Value Conversion
  // =========================================================================

  describe('Operator Change with Value Conversion', () => {
    it('should wrap values in brackets when switching to IN operator', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.comparisonValue = 'a, b, c';
      filter.operator = FieldFilterOperatorsDto.InDto;

      component.onOperatorChange(filter);

      expect(filter.comparisonValue).toBe('[a, b, c]');
    });

    it('should take first value when switching from IN to EQUALS', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.comparisonValue = '[a, b, c]';
      filter.operator = FieldFilterOperatorsDto.EqualsDto;

      component.onOperatorChange(filter);

      expect(filter.comparisonValue).toBe('a');
    });

    it('should handle empty value on operator change', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.comparisonValue = '';
      filter.operator = FieldFilterOperatorsDto.InDto;
      spyOn(component.filtersChange, 'emit');

      component.onOperatorChange(filter);

      expect(component.filtersChange.emit).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Comparison Value Change
  // =========================================================================

  describe('Comparison Value Change', () => {
    it('should wrap in brackets for array operator', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.operator = FieldFilterOperatorsDto.InDto;

      component.onComparisonValueChange(filter, 'a, b, c');

      expect(filter.comparisonValue).toBe('[a, b, c]');
    });

    it('should not wrap for non-array operator', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.operator = FieldFilterOperatorsDto.EqualsDto;

      component.onComparisonValueChange(filter, 'test value');

      expect(filter.comparisonValue).toBe('test value');
    });

    it('should handle null input', () => {
      component.addFilter();
      const filter = component.filters[0];

      component.onComparisonValueChange(filter, null);

      expect(filter.comparisonValue).toBe('');
    });

    it('should strip brackets from input', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.operator = FieldFilterOperatorsDto.EqualsDto;

      component.onComparisonValueChange(filter, '[value]');

      expect(filter.comparisonValue).toBe('value');
    });
  });

  // =========================================================================
  // Attribute Change
  // =========================================================================

  describe('Attribute Change', () => {
    it('should update attribute path and reset value', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.comparisonValue = 'old value';
      spyOn(component.filtersChange, 'emit');

      component.onAttributeChange(filter, 'newAttribute');

      expect(filter.attributePath).toBe('newAttribute');
      expect(filter.comparisonValue).toBe('');
      expect(component.filtersChange.emit).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Attribute Filtering
  // =========================================================================

  describe('Attribute Filtering', () => {
    beforeEach(() => {
      component.availableAttributes = mockAttributes;
      component.ngOnChanges();
    });

    it('should initialize filtered list with all attributes', () => {
      expect(component.filteredAttributeList.length).toBe(mockAttributes.length);
    });

    it('should filter attributes by search term', () => {
      component.onAttributeFilterChange('name');

      expect(component.filteredAttributeList.length).toBe(1);
      expect(component.filteredAttributeList[0].attributePath).toBe('name');
    });

    it('should filter case-insensitively', () => {
      component.onAttributeFilterChange('NAME');

      expect(component.filteredAttributeList.length).toBe(1);
    });

    it('should return all attributes for empty filter', () => {
      component.onAttributeFilterChange('');

      expect(component.filteredAttributeList.length).toBe(mockAttributes.length);
    });
  });

  // =========================================================================
  // getFieldFilters / setFieldFilters
  // =========================================================================

  describe('getFieldFilters / setFieldFilters', () => {
    it('should return empty array when no filters', () => {
      expect(component.getFieldFilters()).toEqual([]);
    });

    it('should exclude filters with empty attributePath', () => {
      component.addFilter();
      component.addFilter();
      component.filters[0].attributePath = 'validPath';
      component.filters[0].comparisonValue = 'value';
      component.filters[1].attributePath = '';

      const result = component.getFieldFilters();

      expect(result.length).toBe(1);
      expect(result[0].attributePath).toBe('validPath');
    });

    it('should return filters without internal id', () => {
      component.addFilter();
      component.filters[0].attributePath = 'name';
      component.filters[0].operator = FieldFilterOperatorsDto.LikeDto;
      component.filters[0].comparisonValue = 'test';

      const result = component.getFieldFilters();

      expect(result[0]).toEqual({
        attributePath: 'name',
        operator: FieldFilterOperatorsDto.LikeDto,
        comparisonValue: 'test'
      });
      expect((result[0] as unknown as Record<string, unknown>)['id']).toBeUndefined();
    });

    it('should set filters from DTO array', () => {
      const dtos = [
        { attributePath: 'name', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: 'John' },
        { attributePath: 'age', operator: FieldFilterOperatorsDto.GreaterThanDto, comparisonValue: '18' }
      ];
      spyOn(component.filtersChange, 'emit');

      component.setFieldFilters(dtos);

      expect(component.filters.length).toBe(2);
      expect(component.filters[0].attributePath).toBe('name');
      expect(component.filters[0].id).toBeDefined();
      expect(component.filters[1].attributePath).toBe('age');
      expect(component.filtersChange.emit).toHaveBeenCalled();
    });

    it('should detect variable values when setting filters', () => {
      const dtos = [
        { attributePath: 'name', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: '${currentUser}' }
      ];

      component.setFieldFilters(dtos);

      expect(component.filters[0].useVariable).toBe(true);
    });
  });

  // =========================================================================
  // Variable Mode
  // =========================================================================

  describe('Variable Mode', () => {
    beforeEach(() => {
      component.enableVariables = true;
      component.availableVariables = mockVariables;
    });

    it('should toggle variable mode on filter', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.comparisonValue = 'literal value';

      component.toggleVariableMode(filter);

      expect(filter.useVariable).toBe(true);
      expect(filter.comparisonValue).toBe('');
    });

    it('should toggle variable mode off', () => {
      component.addFilter();
      const filter = component.filters[0];
      filter.useVariable = true;
      filter.comparisonValue = '${myVar}';

      component.toggleVariableMode(filter);

      expect(filter.useVariable).toBe(false);
      expect(filter.comparisonValue).toBe('');
    });

    describe('isVariableValue', () => {
      it('should return true for ${varName} format', () => {
        expect(component.isVariableValue('${myVariable}')).toBe(true);
      });

      it('should return true for $varName format', () => {
        expect(component.isVariableValue('$myVariable')).toBe(true);
      });

      it('should return false for regular string', () => {
        expect(component.isVariableValue('regular value')).toBe(false);
      });

      it('should return false for null', () => {
        expect(component.isVariableValue(null)).toBe(false);
      });

      it('should return false for number', () => {
        expect(component.isVariableValue(42)).toBe(false);
      });

      it('should return false for string with $ in middle', () => {
        expect(component.isVariableValue('price$100')).toBe(false);
      });
    });

    describe('formatVariableDisplay', () => {
      it('should format variable name with ${} wrapper', () => {
        expect(component.formatVariableDisplay('myVar')).toBe('${myVar}');
      });
    });

    describe('getSelectedVariable', () => {
      it('should return null for empty value', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: ''
        };

        expect(component.getSelectedVariable(filter)).toBeNull();
      });

      it('should return variable for ${varName} format', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '${currentUser}'
        };

        const result = component.getSelectedVariable(filter);
        expect(result?.name).toBe('currentUser');
      });

      it('should return variable for $varName format', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '$currentUser'
        };

        const result = component.getSelectedVariable(filter);
        expect(result?.name).toBe('currentUser');
      });

      it('should return null for unknown variable', () => {
        const filter: FieldFilterItem = {
          id: 1,
          attributePath: 'name',
          operator: FieldFilterOperatorsDto.EqualsDto,
          comparisonValue: '${unknownVar}'
        };

        expect(component.getSelectedVariable(filter)).toBeNull();
      });
    });

    describe('onVariableSelected', () => {
      it('should set value in ${varName} format', () => {
        component.addFilter();
        const filter = component.filters[0];
        const variable = mockVariables[0];
        spyOn(component.filtersChange, 'emit');

        component.onVariableSelected(filter, variable);

        expect(filter.comparisonValue).toBe('${currentUser}');
        expect(component.filtersChange.emit).toHaveBeenCalled();
      });

      it('should set empty string for null variable', () => {
        component.addFilter();
        const filter = component.filters[0];
        filter.comparisonValue = '${oldVar}';

        component.onVariableSelected(filter, null);

        expect(filter.comparisonValue).toBe('');
      });
    });
  });

  // =========================================================================
  // Value Placeholder
  // =========================================================================

  describe('Value Placeholder', () => {
    it('should return array hint for IN operator', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'name',
        operator: FieldFilterOperatorsDto.InDto,
        comparisonValue: ''
      };

      expect(component.getValuePlaceholder(filter)).toContain('Values');
    });

    it('should return simple hint for non-array operator', () => {
      const filter: FieldFilterItem = {
        id: 1,
        attributePath: 'name',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: ''
      };

      expect(component.getValuePlaceholder(filter)).toBe('Enter value');
    });
  });

  // =========================================================================
  // ngOnChanges
  // =========================================================================

  describe('ngOnChanges', () => {
    it('should update filtered attribute list', () => {
      component.availableAttributes = mockAttributes;

      component.ngOnChanges();

      expect(component.filteredAttributeList).toEqual(mockAttributes);
    });

    it('should detect variable values in existing filters', () => {
      component.addFilter();
      component.filters[0].comparisonValue = '${testVar}';
      component.filters[0].useVariable = false;

      component.ngOnChanges();

      expect(component.filters[0].useVariable).toBe(true);
    });
  });
});
