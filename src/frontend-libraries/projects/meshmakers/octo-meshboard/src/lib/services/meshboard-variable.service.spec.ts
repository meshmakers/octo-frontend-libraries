import { TestBed } from '@angular/core/testing';
import { MeshBoardVariableService } from './meshboard-variable.service';
import { MeshBoardVariable, WidgetFilterConfig } from '../models/meshboard.models';

/**
 * Creates a mock variable for testing.
 */
function createMockVariable(
  name: string,
  value: string,
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' = 'string',
  defaultValue?: string
): MeshBoardVariable {
  return {
    name,
    type,
    source: 'static',
    value,
    defaultValue
  };
}

describe('MeshBoardVariableService', () => {
  let service: MeshBoardVariableService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MeshBoardVariableService]
    });
    service = TestBed.inject(MeshBoardVariableService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('resolveVariables', () => {
    it('should return original value when no variables provided', () => {
      const result = service.resolveVariables('Hello $name', []);
      expect(result).toBe('Hello $name');
    });

    it('should return original value when value is empty', () => {
      const variables = [createMockVariable('name', 'World')];
      expect(service.resolveVariables('', variables)).toBe('');
    });

    it('should return original value when value is null/undefined', () => {
      const variables = [createMockVariable('name', 'World')];
      expect(service.resolveVariables(null as unknown as string, variables)).toBeNull();
      expect(service.resolveVariables(undefined as unknown as string, variables)).toBeUndefined();
    });

    describe('$variableName syntax', () => {
      it('should resolve single variable', () => {
        const variables = [createMockVariable('name', 'World')];
        const result = service.resolveVariables('Hello $name', variables);
        expect(result).toBe('Hello World');
      });

      it('should resolve multiple variables', () => {
        const variables = [
          createMockVariable('firstName', 'John'),
          createMockVariable('lastName', 'Doe')
        ];
        const result = service.resolveVariables('$firstName $lastName', variables);
        expect(result).toBe('John Doe');
      });

      it('should resolve variable at start of string', () => {
        const variables = [createMockVariable('greeting', 'Hello')];
        const result = service.resolveVariables('$greeting World', variables);
        expect(result).toBe('Hello World');
      });

      it('should resolve variable at end of string', () => {
        const variables = [createMockVariable('name', 'World')];
        const result = service.resolveVariables('Hello $name', variables);
        expect(result).toBe('Hello World');
      });

      it('should resolve variable with underscore in name', () => {
        const variables = [createMockVariable('user_name', 'John')];
        const result = service.resolveVariables('User: $user_name', variables);
        expect(result).toBe('User: John');
      });

      it('should resolve variable starting with underscore', () => {
        const variables = [createMockVariable('_private', 'secret')];
        const result = service.resolveVariables('Value: $_private', variables);
        expect(result).toBe('Value: secret');
      });

      it('should keep placeholder when variable not found', () => {
        const variables = [createMockVariable('other', 'value')];
        const result = service.resolveVariables('Hello $unknown', variables);
        expect(result).toBe('Hello $unknown');
      });
    });

    describe('${variableName} syntax', () => {
      it('should resolve single variable', () => {
        const variables = [createMockVariable('name', 'World')];
        const result = service.resolveVariables('Hello ${name}', variables);
        expect(result).toBe('Hello World');
      });

      it('should resolve variable adjacent to text', () => {
        const variables = [createMockVariable('prefix', 'pre')];
        const result = service.resolveVariables('${prefix}fix', variables);
        expect(result).toBe('prefix');
      });

      it('should resolve variable with special characters around it', () => {
        const variables = [createMockVariable('value', '100')];
        const result = service.resolveVariables('[${value}]', variables);
        expect(result).toBe('[100]');
      });

      it('should keep placeholder when variable not found', () => {
        const variables = [createMockVariable('other', 'value')];
        const result = service.resolveVariables('Hello ${unknown}', variables);
        expect(result).toBe('Hello ${unknown}');
      });
    });

    describe('mixed syntax', () => {
      it('should resolve both syntaxes in same string', () => {
        const variables = [
          createMockVariable('a', 'A'),
          createMockVariable('b', 'B')
        ];
        const result = service.resolveVariables('$a and ${b}', variables);
        expect(result).toBe('A and B');
      });
    });

    describe('fallback to defaultValue', () => {
      it('should use defaultValue when value is undefined', () => {
        const variable: MeshBoardVariable = {
          name: 'test',
          type: 'string',
          source: 'static',
          value: undefined as unknown as string,
          defaultValue: 'default'
        };
        const result = service.resolveVariables('Value: $test', [variable]);
        expect(result).toBe('Value: default');
      });

      it('should use defaultValue when value is null', () => {
        const variable: MeshBoardVariable = {
          name: 'test',
          type: 'string',
          source: 'static',
          value: null as unknown as string,
          defaultValue: 'default'
        };
        const result = service.resolveVariables('Value: $test', [variable]);
        expect(result).toBe('Value: default');
      });

      it('should use empty value when provided (not fallback to default)', () => {
        const variable = createMockVariable('test', '', 'string', 'default');
        const result = service.resolveVariables('Value: $test', [variable]);
        expect(result).toBe('Value: ');
      });
    });
  });

  describe('resolveFilters', () => {
    it('should return undefined when filters is undefined', () => {
      const result = service.resolveFilters(undefined, []);
      expect(result).toBeUndefined();
    });

    it('should return empty array when filters is empty', () => {
      const result = service.resolveFilters([], []);
      expect(result).toEqual([]);
    });

    it('should resolve variables in filter comparisonValue', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'status', operator: 'equals', comparisonValue: '$statusFilter' }
      ];
      const variables = [createMockVariable('statusFilter', 'active')];

      const result = service.resolveFilters(filters, variables);

      expect(result).toBeDefined();
      expect(result![0].comparisonValue).toBe('active');
    });

    it('should preserve other filter properties', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'count', operator: 'greaterThan', comparisonValue: '$minCount' }
      ];
      const variables = [createMockVariable('minCount', '10')];

      const result = service.resolveFilters(filters, variables);

      expect(result![0].attributePath).toBe('count');
      expect(result![0].operator).toBe('greaterThan');
    });

    it('should resolve multiple filters', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'status', operator: 'equals', comparisonValue: '$status' },
        { attributePath: 'category', operator: 'equals', comparisonValue: '$category' }
      ];
      const variables = [
        createMockVariable('status', 'active'),
        createMockVariable('category', 'A')
      ];

      const result = service.resolveFilters(filters, variables);

      expect(result![0].comparisonValue).toBe('active');
      expect(result![1].comparisonValue).toBe('A');
    });

    it('should not mutate original filters', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'status', operator: 'equals', comparisonValue: '$status' }
      ];
      const variables = [createMockVariable('status', 'active')];

      service.resolveFilters(filters, variables);

      expect(filters[0].comparisonValue).toBe('$status');
    });
  });

  describe('convertToFieldFilterDto', () => {
    it('should return undefined when filters is undefined', () => {
      const result = service.convertToFieldFilterDto(undefined, []);
      expect(result).toBeUndefined();
    });

    it('should return undefined when filters is empty', () => {
      const result = service.convertToFieldFilterDto([], []);
      expect(result).toBeUndefined();
    });

    it('should convert filters to DTO format', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'name', operator: 'contains', comparisonValue: 'test' }
      ];

      const result = service.convertToFieldFilterDto(filters, []);

      expect(result).toBeDefined();
      expect(result!.length).toBe(1);
      expect(result![0].attributePath).toBe('name');
      expect(result![0].operator).toBe('contains');
      expect(result![0].comparisonValue).toBe('test');
    });

    it('should resolve variables before converting', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'status', operator: 'equals', comparisonValue: '$statusVar' }
      ];
      const variables = [createMockVariable('statusVar', 'completed')];

      const result = service.convertToFieldFilterDto(filters, variables);

      expect(result![0].comparisonValue).toBe('completed');
    });
  });

  describe('parseValue', () => {
    describe('string type', () => {
      it('should return string as-is', () => {
        expect(service.parseValue('hello', 'string')).toBe('hello');
      });

      it('should return empty string', () => {
        expect(service.parseValue('', 'string')).toBe('');
      });

      it('should return numeric string as string', () => {
        expect(service.parseValue('123', 'string')).toBe('123');
      });
    });

    describe('number type', () => {
      it('should parse integer', () => {
        expect(service.parseValue('42', 'number')).toBe(42);
      });

      it('should parse float', () => {
        expect(service.parseValue('3.14', 'number')).toBe(3.14);
      });

      it('should parse negative number', () => {
        expect(service.parseValue('-10', 'number')).toBe(-10);
      });

      it('should return 0 for invalid number', () => {
        expect(service.parseValue('abc', 'number')).toBe(0);
      });

      it('should return 0 for empty string', () => {
        expect(service.parseValue('', 'number')).toBe(0);
      });
    });

    describe('boolean type', () => {
      it('should parse "true" to true', () => {
        expect(service.parseValue('true', 'boolean')).toBe(true);
      });

      it('should parse "false" to false', () => {
        expect(service.parseValue('false', 'boolean')).toBe(false);
      });

      it('should parse any other string to false', () => {
        expect(service.parseValue('yes', 'boolean')).toBe(false);
        expect(service.parseValue('1', 'boolean')).toBe(false);
        expect(service.parseValue('TRUE', 'boolean')).toBe(false);
      });
    });

    describe('date type', () => {
      it('should parse ISO date string', () => {
        const result = service.parseValue('2024-06-15', 'date') as Date;
        expect(result instanceof Date).toBeTrue();
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(5); // 0-indexed
        expect(result.getDate()).toBe(15);
      });

      it('should parse full ISO string', () => {
        const result = service.parseValue('2024-06-15T10:30:00Z', 'date') as Date;
        expect(result instanceof Date).toBeTrue();
      });
    });

    describe('datetime type', () => {
      it('should parse ISO datetime string', () => {
        const result = service.parseValue('2024-06-15T10:30:00Z', 'datetime') as Date;
        expect(result instanceof Date).toBeTrue();
        expect(result.getUTCHours()).toBe(10);
        expect(result.getUTCMinutes()).toBe(30);
      });
    });
  });

  describe('isValidVariableName', () => {
    describe('valid names', () => {
      it('should accept name starting with letter', () => {
        expect(service.isValidVariableName('name')).toBeTrue();
        expect(service.isValidVariableName('Name')).toBeTrue();
        expect(service.isValidVariableName('NAME')).toBeTrue();
      });

      it('should accept name starting with underscore', () => {
        expect(service.isValidVariableName('_name')).toBeTrue();
        expect(service.isValidVariableName('_')).toBeTrue();
      });

      it('should accept name with numbers', () => {
        expect(service.isValidVariableName('name1')).toBeTrue();
        expect(service.isValidVariableName('name123')).toBeTrue();
      });

      it('should accept name with underscores', () => {
        expect(service.isValidVariableName('first_name')).toBeTrue();
        expect(service.isValidVariableName('_first_name_')).toBeTrue();
      });

      it('should accept mixed case with numbers and underscores', () => {
        expect(service.isValidVariableName('myVar_123')).toBeTrue();
        expect(service.isValidVariableName('_myVar123')).toBeTrue();
      });
    });

    describe('invalid names', () => {
      it('should reject name starting with number', () => {
        expect(service.isValidVariableName('1name')).toBeFalse();
        expect(service.isValidVariableName('123')).toBeFalse();
      });

      it('should reject name with spaces', () => {
        expect(service.isValidVariableName('my name')).toBeFalse();
        expect(service.isValidVariableName(' name')).toBeFalse();
      });

      it('should reject name with special characters', () => {
        expect(service.isValidVariableName('my-name')).toBeFalse();
        expect(service.isValidVariableName('my.name')).toBeFalse();
        expect(service.isValidVariableName('my@name')).toBeFalse();
        expect(service.isValidVariableName('my$name')).toBeFalse();
      });

      it('should reject empty string', () => {
        expect(service.isValidVariableName('')).toBeFalse();
      });
    });
  });

  describe('generateUniqueName', () => {
    it('should return base name when no existing variables', () => {
      const result = service.generateUniqueName('myVar', []);
      expect(result).toBe('myVar');
    });

    it('should return base name when not conflicting', () => {
      const existing = [createMockVariable('other', 'value')];
      const result = service.generateUniqueName('myVar', existing);
      expect(result).toBe('myVar');
    });

    it('should append 1 when base name exists', () => {
      const existing = [createMockVariable('myVar', 'value')];
      const result = service.generateUniqueName('myVar', existing);
      expect(result).toBe('myVar1');
    });

    it('should increment counter when numbered names exist', () => {
      const existing = [
        createMockVariable('myVar', 'value'),
        createMockVariable('myVar1', 'value')
      ];
      const result = service.generateUniqueName('myVar', existing);
      expect(result).toBe('myVar2');
    });

    it('should find gap in numbering', () => {
      const existing = [
        createMockVariable('myVar', 'value'),
        createMockVariable('myVar1', 'value'),
        createMockVariable('myVar3', 'value')  // myVar2 is missing
      ];
      const result = service.generateUniqueName('myVar', existing);
      expect(result).toBe('myVar2');
    });

    it('should handle many existing variables', () => {
      const existing = Array.from({ length: 10 }, (_, i) =>
        createMockVariable(i === 0 ? 'var' : `var${i}`, 'value')
      );
      const result = service.generateUniqueName('var', existing);
      expect(result).toBe('var10');
    });
  });

  describe('createDefaultVariable', () => {
    it('should create string variable with empty default', () => {
      const result = service.createDefaultVariable('myString', 'string');

      expect(result.name).toBe('myString');
      expect(result.type).toBe('string');
      expect(result.source).toBe('static');
      expect(result.value).toBe('');
      expect(result.defaultValue).toBe('');
    });

    it('should create number variable with 0 default', () => {
      const result = service.createDefaultVariable('myNumber', 'number');

      expect(result.type).toBe('number');
      expect(result.value).toBe('0');
      expect(result.defaultValue).toBe('0');
    });

    it('should create boolean variable with false default', () => {
      const result = service.createDefaultVariable('myBool', 'boolean');

      expect(result.type).toBe('boolean');
      expect(result.value).toBe('false');
      expect(result.defaultValue).toBe('false');
    });

    it('should create date variable with today as default', () => {
      const result = service.createDefaultVariable('myDate', 'date');
      const today = new Date().toISOString().split('T')[0];

      expect(result.type).toBe('date');
      expect(result.value).toBe(today);
      expect(result.defaultValue).toBe(today);
    });

    it('should create datetime variable with current time as default', () => {
      const before = new Date().toISOString();
      const result = service.createDefaultVariable('myDateTime', 'datetime');
      const after = new Date().toISOString();

      expect(result.type).toBe('datetime');
      // Value should be between before and after
      expect(result.value >= before).toBeTrue();
      expect(result.value <= after).toBeTrue();
    });

    it('should default to string type when not specified', () => {
      const result = service.createDefaultVariable('myVar');

      expect(result.type).toBe('string');
      expect(result.value).toBe('');
    });
  });

  describe('mapAttributeTypeToVariableType', () => {
    it('should map IntegerDto to number', () => {
      expect(service.mapAttributeTypeToVariableType('IntegerDto')).toBe('number');
    });

    it('should map DoubleDto to number', () => {
      expect(service.mapAttributeTypeToVariableType('DoubleDto')).toBe('number');
    });

    it('should map LongDto to number', () => {
      expect(service.mapAttributeTypeToVariableType('LongDto')).toBe('number');
    });

    it('should map INTEGER to number', () => {
      expect(service.mapAttributeTypeToVariableType('INTEGER')).toBe('number');
    });

    it('should map DOUBLE to number', () => {
      expect(service.mapAttributeTypeToVariableType('DOUBLE')).toBe('number');
    });

    it('should map INTEGER_64 to number', () => {
      expect(service.mapAttributeTypeToVariableType('INTEGER_64')).toBe('number');
    });

    it('should map BooleanDto to boolean', () => {
      expect(service.mapAttributeTypeToVariableType('BooleanDto')).toBe('boolean');
    });

    it('should map BOOLEAN to boolean', () => {
      expect(service.mapAttributeTypeToVariableType('BOOLEAN')).toBe('boolean');
    });

    it('should map DateTimeDto to datetime', () => {
      expect(service.mapAttributeTypeToVariableType('DateTimeDto')).toBe('datetime');
    });

    it('should map DateTimeOffsetDto to datetime', () => {
      expect(service.mapAttributeTypeToVariableType('DateTimeOffsetDto')).toBe('datetime');
    });

    it('should map DATE_TIME to datetime', () => {
      expect(service.mapAttributeTypeToVariableType('DATE_TIME')).toBe('datetime');
    });

    it('should map DATE_TIME_OFFSET to datetime', () => {
      expect(service.mapAttributeTypeToVariableType('DATE_TIME_OFFSET')).toBe('datetime');
    });

    it('should map DateDto to date', () => {
      expect(service.mapAttributeTypeToVariableType('DateDto')).toBe('date');
    });

    it('should map DATE to date', () => {
      expect(service.mapAttributeTypeToVariableType('DATE')).toBe('date');
    });

    it('should map StringDto to string', () => {
      expect(service.mapAttributeTypeToVariableType('StringDto')).toBe('string');
    });

    it('should map EnumDto to string', () => {
      expect(service.mapAttributeTypeToVariableType('EnumDto')).toBe('string');
    });

    it('should map unknown type to string', () => {
      expect(service.mapAttributeTypeToVariableType('SomethingUnknown')).toBe('string');
    });
  });

  describe('attributePathToVariableName', () => {
    it('should return single segment unchanged', () => {
      expect(service.attributePathToVariableName('temperature')).toBe('temperature');
    });

    it('should convert two segments to camelCase', () => {
      expect(service.attributePathToVariableName('contact.firstName')).toBe('contactFirstName');
    });

    it('should convert three segments to camelCase', () => {
      expect(service.attributePathToVariableName('contact.address.cityTown')).toBe('contactAddressCityTown');
    });

    it('should preserve already camelCase single segment', () => {
      expect(service.attributePathToVariableName('myValue')).toBe('myValue');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex filter resolution with multiple variables', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'createdAt', operator: 'greaterThanOrEquals', comparisonValue: '$startDate' },
        { attributePath: 'createdAt', operator: 'lessThanOrEquals', comparisonValue: '$endDate' },
        { attributePath: 'status', operator: 'equals', comparisonValue: '$status' }
      ];
      const variables = [
        createMockVariable('startDate', '2024-01-01'),
        createMockVariable('endDate', '2024-12-31'),
        createMockVariable('status', 'active')
      ];

      const result = service.convertToFieldFilterDto(filters, variables);

      expect(result).toBeDefined();
      expect(result!.length).toBe(3);
      expect(result![0].comparisonValue).toBe('2024-01-01');
      expect(result![1].comparisonValue).toBe('2024-12-31');
      expect(result![2].comparisonValue).toBe('active');
    });

    it('should handle variable creation and uniqueness workflow', () => {
      const variables: MeshBoardVariable[] = [];

      // Create first variable
      const name1 = service.generateUniqueName('filter', variables);
      const var1 = service.createDefaultVariable(name1, 'string');
      variables.push(var1);
      expect(var1.name).toBe('filter');

      // Create second variable - should get unique name
      const name2 = service.generateUniqueName('filter', variables);
      const var2 = service.createDefaultVariable(name2, 'number');
      variables.push(var2);
      expect(var2.name).toBe('filter1');

      // Validate both names
      expect(service.isValidVariableName(var1.name)).toBeTrue();
      expect(service.isValidVariableName(var2.name)).toBeTrue();
    });

    it('should resolve embedded variables in filter values', () => {
      const filters: WidgetFilterConfig[] = [
        { attributePath: 'query', operator: 'contains', comparisonValue: 'prefix_${id}_suffix' }
      ];
      const variables = [createMockVariable('id', '12345')];

      const result = service.resolveFilters(filters, variables);

      expect(result![0].comparisonValue).toBe('prefix_12345_suffix');
    });
  });

  describe('hasUnresolvedVariables', () => {
    it('should return false for empty string', () => {
      expect(service.hasUnresolvedVariables('')).toBeFalse();
    });

    it('should return false for null/undefined', () => {
      expect(service.hasUnresolvedVariables(null as unknown as string)).toBeFalse();
      expect(service.hasUnresolvedVariables(undefined as unknown as string)).toBeFalse();
    });

    it('should return false for plain text', () => {
      expect(service.hasUnresolvedVariables('Hello World')).toBeFalse();
      expect(service.hasUnresolvedVariables('42')).toBeFalse();
    });

    it('should detect ${variableName} syntax', () => {
      expect(service.hasUnresolvedVariables('${meteringPointNumber}')).toBeTrue();
      expect(service.hasUnresolvedVariables('Value: ${count}')).toBeTrue();
    });

    it('should detect $variableName syntax', () => {
      expect(service.hasUnresolvedVariables('$meteringPointNumber')).toBeTrue();
      expect(service.hasUnresolvedVariables('Value: $count')).toBeTrue();
    });

    it('should return false for dollar amounts', () => {
      expect(service.hasUnresolvedVariables('$100')).toBeFalse();
      expect(service.hasUnresolvedVariables('Price: $50.00')).toBeFalse();
    });
  });
});
