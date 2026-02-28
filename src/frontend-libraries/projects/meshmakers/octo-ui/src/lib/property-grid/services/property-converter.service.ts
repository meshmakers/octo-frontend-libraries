import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PropertyGridItem, DefaultPropertyCategory, AttributeValueTypeDto } from '../models/property-grid.models';
import { CkTypeAttributeService, CkTypeAttributeInfo } from '@meshmakers/octo-services';

/** Represents an attribute from an RtEntity */
interface RtAttribute {
  attributeName?: string | null;
  value?: unknown;
}

/** Represents an RtRecord with a ckRecordId and attributes */
interface RtRecord {
  ckRecordId?: string;
  attributes?: RtAttribute[];
}

/** Represents an RtEntity with system properties and attributes */
interface RtEntity {
  rtId?: string;
  ckTypeId?: string;
  rtCreationDateTime?: string;
  rtChangedDateTime?: string;
  rtWellKnownName?: string;
  attributes?: { items?: RtAttribute[] };
}

/**
 * Service for converting various data structures to PropertyGridItem format.
 * Uses Construction Kit (CK) type definitions for accurate attribute type resolution.
 */
@Injectable({
  providedIn: 'root'
})
export class PropertyConverterService {
  private readonly ckTypeAttributeService = inject(CkTypeAttributeService);

  /**
   * Convert OctoMesh RtEntity attributes to property grid items using CK type definitions.
   * @param attributes The attributes array from RtEntity
   * @param ckTypeId The fullName of the CK type to look up attribute types
   * @returns Observable of PropertyGridItem array
   */
  convertRtEntityAttributes(attributes: RtAttribute[] | null | undefined, ckTypeId: string): Observable<PropertyGridItem[]> {
    if (!attributes || attributes.length === 0) {
      return of([]);
    }

    return this.ckTypeAttributeService.getCkTypeAttributes(ckTypeId).pipe(
      switchMap(ckAttributes => {
        const ckAttributeMap = this.buildAttributeTypeMap(ckAttributes);
        return this.convertAttributesWithCkTypes(attributes, ckAttributeMap);
      })
    );
  }

  /**
   * Convert any JavaScript object to property grid items using reflection.
   * This method remains synchronous as there is no CK type for generic JS objects.
   */
  convertObjectToProperties(obj: Record<string, unknown> | null | undefined, category?: string): PropertyGridItem[] {
    if (!obj || typeof obj !== 'object') {
      return [];
    }

    return Object.keys(obj).map(key => ({
      id: `obj_${key}`,
      name: key,
      displayName: key,
      value: obj[key],
      type: this.inferAttributeType(obj[key]),
      category: category || DefaultPropertyCategory.General,
      readOnly: false,
      description: `Property: ${key}`
    }));
  }

  /**
   * Convert RtRecord to property grid items using CK type definitions.
   * @param record The record object containing ckRecordId and attributes
   * @returns Observable of PropertyGridItem array
   */
  convertRtRecordToProperties(record: RtRecord | null | undefined): Observable<PropertyGridItem[]> {
    if (!record || typeof record !== 'object' || !record.attributes) {
      return of([]);
    }

    const ckRecordId = record.ckRecordId;
    if (!ckRecordId) {
      return of([]);
    }

    return this.ckTypeAttributeService.getCkRecordAttributes(ckRecordId).pipe(
      switchMap(ckAttributes => {
        const ckAttributeMap = this.buildAttributeTypeMap(ckAttributes);
        const properties: PropertyGridItem[] = [];

        // Add ckRecordId as system property
        properties.push({
          id: 'ckRecordId',
          name: 'ckRecordId',
          displayName: 'Record ID',
          value: ckRecordId,
          type: AttributeValueTypeDto.StringDto,
          category: DefaultPropertyCategory.System,
          readOnly: true,
          description: 'Construction kit record identifier'
        });

        // Convert attributes with CK types (record.attributes is guaranteed non-null by the guard above)
        return this.convertAttributesWithCkTypes(record.attributes!, ckAttributeMap).pipe(
          map(attributeProperties => {
            properties.push(...attributeProperties);
            return properties;
          })
        );
      })
    );
  }

  /**
   * Convert OctoMesh RtEntity to comprehensive property list using CK type definitions.
   * @param entity The RtEntity object
   * @returns Observable of PropertyGridItem array
   */
  convertRtEntityToProperties(entity: RtEntity): Observable<PropertyGridItem[]> {
    const properties: PropertyGridItem[] = [];

    // System properties
    if (entity.rtId) {
      properties.push({
        id: 'rtId',
        name: 'rtId',
        displayName: 'Runtime ID',
        value: entity.rtId,
        type: AttributeValueTypeDto.StringDto,
        category: DefaultPropertyCategory.System,
        readOnly: true,
        description: 'Unique runtime identifier'
      });
    }

    if (entity.ckTypeId) {
      properties.push({
        id: 'ckTypeId',
        name: 'ckTypeId',
        displayName: 'Type ID',
        value: entity.ckTypeId,
        type: AttributeValueTypeDto.StringDto,
        category: DefaultPropertyCategory.System,
        readOnly: true,
        description: 'Construction kit type identifier'
      });
    }

    if (entity.rtCreationDateTime) {
      properties.push({
        id: 'rtCreationDateTime',
        name: 'rtCreationDateTime',
        displayName: 'Created',
        value: entity.rtCreationDateTime,
        type: AttributeValueTypeDto.DateTimeDto,
        category: DefaultPropertyCategory.System,
        readOnly: true,
        description: 'Creation date and time'
      });
    }

    if (entity.rtChangedDateTime) {
      properties.push({
        id: 'rtChangedDateTime',
        name: 'rtChangedDateTime',
        displayName: 'Modified',
        value: entity.rtChangedDateTime,
        type: AttributeValueTypeDto.DateTimeDto,
        category: DefaultPropertyCategory.System,
        readOnly: true,
        description: 'Last modification date and time'
      });
    }

    if (entity.rtWellKnownName) {
      properties.push({
        id: 'rtWellKnownName',
        name: 'rtWellKnownName',
        displayName: 'Well Known Name',
        value: entity.rtWellKnownName,
        type: AttributeValueTypeDto.StringDto,
        category: DefaultPropertyCategory.General,
        readOnly: false,
        description: 'Well-known name for the entity'
      });
    }

    // If no ckTypeId or no attributes, return system properties only
    if (!entity.ckTypeId || !entity.attributes?.items) {
      return of(properties);
    }

    // Load CK type attributes and convert entity attributes
    return this.convertRtEntityAttributes(entity.attributes.items, entity.ckTypeId).pipe(
      map(attributeProperties => {
        properties.push(...attributeProperties);
        return properties;
      })
    );
  }

  /**
   * Build a map from attribute name to attribute value type from CK definitions
   */
  private buildAttributeTypeMap(ckAttributes: CkTypeAttributeInfo[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const attr of ckAttributes) {
      map.set(attr.attributeName, attr.attributeValueType);
    }
    return map;
  }

  /**
   * Convert attributes using CK type map for type resolution
   */
  private convertAttributesWithCkTypes(
    attributes: RtAttribute[],
    ckAttributeMap: Map<string, string>
  ): Observable<PropertyGridItem[]> {
    if (!attributes || attributes.length === 0) {
      return of([]);
    }

    // Check if any attributes have nested records that need async conversion
    const hasNestedRecords = attributes.some(attr =>
      attr?.value && typeof attr.value === 'object' && attr.value !== null && 'attributes' in attr.value
    );

    if (!hasNestedRecords) {
      // No nested records - convert synchronously
      const items = attributes.map((attr, index) => this.convertSingleAttribute(attr, index, ckAttributeMap));
      return of(items);
    }

    // Has nested records - need to handle async conversion
    const conversionObservables = attributes.map((attr, index) => {
      if (attr?.value && typeof attr.value === 'object' && attr.value !== null && 'attributes' in attr.value) {
        // Nested record - convert async
        return this.convertRtRecordToProperties(attr.value as RtRecord).pipe(
          map(nestedProperties => ({
            id: `attr_${index}_${attr?.attributeName || 'unknown'}`,
            name: attr?.attributeName || `attribute_${index}`,
            displayName: attr?.attributeName || `attribute_${index}`,
            value: nestedProperties,
            type: this.getAttributeType(attr?.attributeName, ckAttributeMap),
            category: DefaultPropertyCategory.Attributes,
            readOnly: false,
            description: `Attribute: ${attr?.attributeName}`
          }))
        );
      } else {
        // Regular attribute - return as observable
        return of(this.convertSingleAttribute(attr, index, ckAttributeMap));
      }
    });

    return forkJoin(conversionObservables);
  }

  /**
   * Convert a single attribute to PropertyGridItem
   */
  private convertSingleAttribute(
    attr: RtAttribute,
    index: number,
    ckAttributeMap: Map<string, string>
  ): PropertyGridItem {
    const value = this.convertRtEntityAttributeValueSync(attr?.value);

    return {
      id: `attr_${index}_${attr?.attributeName || 'unknown'}`,
      name: attr?.attributeName || `attribute_${index}`,
      displayName: attr?.attributeName || `attribute_${index}`,
      value: value,
      type: this.getAttributeType(attr?.attributeName, ckAttributeMap),
      category: DefaultPropertyCategory.Attributes,
      readOnly: false,
      description: `Attribute: ${attr?.attributeName}`
    };
  }

  /**
   * Get attribute type from CK map
   */
  private getAttributeType(attributeName: string | null | undefined, ckAttributeMap: Map<string, string>): AttributeValueTypeDto {
    if (!attributeName) {
      return AttributeValueTypeDto.StringDto;
    }

    const ckType = ckAttributeMap.get(attributeName);
    if (ckType) {
      return this.mapCkTypeToAttributeValueType(ckType);
    }

    // Fallback for attributes not found in CK (should not happen in normal cases)
    return AttributeValueTypeDto.StringDto;
  }

  /**
   * Map CK type string to AttributeValueTypeDto enum
   */
  private mapCkTypeToAttributeValueType(ckType: string): AttributeValueTypeDto {
    // The ckType from GraphQL should match the enum values
    const typeMap: Record<string, AttributeValueTypeDto> = {
      'BINARY': AttributeValueTypeDto.BinaryDto,
      'BINARY_LINKED': AttributeValueTypeDto.BinaryLinkedDto,
      'BOOLEAN': AttributeValueTypeDto.BooleanDto,
      'DATE_TIME': AttributeValueTypeDto.DateTimeDto,
      'DATE_TIME_OFFSET': AttributeValueTypeDto.DateTimeOffsetDto,
      'DOUBLE': AttributeValueTypeDto.DoubleDto,
      'ENUM': AttributeValueTypeDto.EnumDto,
      'GEOSPATIAL_POINT': AttributeValueTypeDto.GeospatialPointDto,
      'INT': AttributeValueTypeDto.IntDto,
      'INTEGER': AttributeValueTypeDto.IntegerDto,
      'INTEGER_64': AttributeValueTypeDto.Integer_64Dto,
      'INTEGER_ARRAY': AttributeValueTypeDto.IntegerArrayDto,
      'INT_64': AttributeValueTypeDto.Int_64Dto,
      'INT_ARRAY': AttributeValueTypeDto.IntArrayDto,
      'RECORD': AttributeValueTypeDto.RecordDto,
      'RECORD_ARRAY': AttributeValueTypeDto.RecordArrayDto,
      'STRING': AttributeValueTypeDto.StringDto,
      'STRING_ARRAY': AttributeValueTypeDto.StringArrayDto,
      'TIME_SPAN': AttributeValueTypeDto.TimeSpanDto
    };

    return typeMap[ckType] || AttributeValueTypeDto.StringDto;
  }

  /**
   * Convert attribute value synchronously (for non-record values)
   */
  private convertRtEntityAttributeValueSync(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map(v => this.convertRtEntityAttributeValueSync(v));
    }

    // For nested records, return as-is (will be handled by async conversion if needed)
    if (typeof value === 'object' && 'attributes' in value) {
      return value;
    }

    return value;
  }

  /**
   * Infer attribute type from JavaScript value.
   * Used only for convertObjectToProperties where no CK type is available.
   */
  private inferAttributeType(value: unknown): AttributeValueTypeDto {
    if (value === null || value === undefined) {
      return AttributeValueTypeDto.StringDto;
    }

    if (typeof value === 'boolean') {
      return AttributeValueTypeDto.BooleanDto;
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? AttributeValueTypeDto.IntDto : AttributeValueTypeDto.DoubleDto;
    }

    if (typeof value === 'string') {
      if (this.isIsoDateString(value)) {
        return AttributeValueTypeDto.DateTimeDto;
      }
      return AttributeValueTypeDto.StringDto;
    }

    if (value instanceof Date) {
      return AttributeValueTypeDto.DateTimeDto;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        const firstType = this.inferAttributeType(value[0]);
        switch (firstType) {
          case AttributeValueTypeDto.StringDto:
            return AttributeValueTypeDto.StringArrayDto;
          case AttributeValueTypeDto.IntDto:
          case AttributeValueTypeDto.DoubleDto:
            return AttributeValueTypeDto.IntegerArrayDto;
          case AttributeValueTypeDto.RecordDto:
            return AttributeValueTypeDto.RecordArrayDto;
          default:
            return AttributeValueTypeDto.StringArrayDto;
        }
      }
      return AttributeValueTypeDto.StringArrayDto;
    }

    if (typeof value === 'object') {
      return AttributeValueTypeDto.RecordDto;
    }

    return AttributeValueTypeDto.StringDto;
  }

  /**
   * Check if string is ISO date format
   */
  private isIsoDateString(value: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDateRegex.test(value) && !isNaN(Date.parse(value));
  }
}
