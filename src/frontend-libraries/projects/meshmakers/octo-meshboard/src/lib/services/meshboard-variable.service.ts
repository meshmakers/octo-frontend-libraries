import { Injectable } from '@angular/core';
import { FieldFilterDto, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { MeshBoardVariable, MeshBoardVariableType, WidgetFilterConfig } from '../models/meshboard.models';

/**
 * Service for resolving MeshBoard variables in filter values.
 * Variables use the syntax $variableName and are replaced at query execution time.
 */
@Injectable({
  providedIn: 'root'
})
export class MeshBoardVariableService {

  /**
   * Resolves all variable placeholders in a string.
   * Supports both ${variableName} and $variableName syntax.
   * @param value The string containing variable placeholders
   * @param variables The variables to resolve from
   * @returns The string with all resolved variable values
   */
  resolveVariables(value: string, variables: MeshBoardVariable[]): string {
    if (!value || !variables?.length) {
      return value;
    }

    // Match both ${variableName} and $variableName formats
    return value.replace(/\$\{([^}]+)\}|\$([a-zA-Z_]\w*)/g, (match, bracketName, simpleName) => {
      const varName = bracketName || simpleName;
      const variable = variables.find(v => v.name === varName);
      if (variable) {
        return variable.value ?? variable.defaultValue ?? match;
      }
      return match; // Keep placeholder if variable not found
    });
  }

  /**
   * Resolves variables in filter comparison values.
   * @param filters The filters with potential variable placeholders
   * @param variables The variables to resolve from
   * @returns New filter array with resolved values
   */
  resolveFilters(
    filters: WidgetFilterConfig[] | undefined,
    variables: MeshBoardVariable[]
  ): WidgetFilterConfig[] | undefined {
    if (!filters?.length) {
      return filters;
    }

    return filters.map(f => ({
      ...f,
      comparisonValue: this.resolveVariables(f.comparisonValue, variables)
    }));
  }

  /**
   * Converts filters to DTO format for GraphQL, resolving variables first.
   * @param filters The widget filters
   * @param variables The variables to resolve from
   * @returns FieldFilterDto array for GraphQL queries
   */
  convertToFieldFilterDto(
    filters: WidgetFilterConfig[] | undefined,
    variables: MeshBoardVariable[]
  ): FieldFilterDto[] | undefined {
    const resolved = this.resolveFilters(filters, variables);
    if (!resolved?.length) {
      return undefined;
    }

    return resolved.map(f => ({
      attributePath: f.attributePath,
      operator: f.operator as FieldFilterOperatorsDto,
      comparisonValue: f.comparisonValue
    }));
  }

  /**
   * Parses a value string to the correct JavaScript type.
   * @param value The string value to parse
   * @param type The target type
   * @returns The parsed value
   */
  parseValue(value: string, type: MeshBoardVariableType): unknown {
    switch (type) {
      case 'number':
        return parseFloat(value) || 0;
      case 'boolean':
        return value === 'true';
      case 'date':
      case 'datetime':
        return new Date(value);
      default:
        return value;
    }
  }

  /**
   * Validates a variable name.
   * Valid names: start with letter or underscore, followed by alphanumeric or underscore.
   * @param name The variable name to validate
   * @returns true if the name is valid
   */
  isValidVariableName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Generates a unique variable name based on a base name.
   * Appends a number if the name already exists.
   * @param baseName The desired base name
   * @param existingVariables Existing variables to check against
   * @returns A unique variable name
   */
  generateUniqueName(baseName: string, existingVariables: MeshBoardVariable[]): string {
    const existingNames = new Set(existingVariables.map(v => v.name));
    let name = baseName;
    let counter = 1;

    while (existingNames.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }

    return name;
  }

  /**
   * Creates a default variable with the given type.
   * @param name Variable name
   * @param type Variable type
   * @returns A new MeshBoardVariable
   */
  createDefaultVariable(name: string, type: MeshBoardVariableType = 'string'): MeshBoardVariable {
    let defaultValue = '';

    switch (type) {
      case 'number':
        defaultValue = '0';
        break;
      case 'boolean':
        defaultValue = 'false';
        break;
      case 'date':
        defaultValue = new Date().toISOString().split('T')[0];
        break;
      case 'datetime':
        defaultValue = new Date().toISOString();
        break;
    }

    return {
      name,
      type,
      source: 'static',
      value: defaultValue,
      defaultValue
    };
  }
}
