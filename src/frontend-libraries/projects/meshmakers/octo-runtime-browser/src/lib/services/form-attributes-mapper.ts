import { Injectable } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { AttributeField } from '../models/attribute-field';

export interface RtEntityAttributeInput {
  attributeName: string;
  value: any;
}

@Injectable({
  providedIn: 'root',
})
export class FormAttributesServiceMapper {
  /**
   * Builds a form attribute definition with a configured control.
   */
  mapToFormAttribute(attr: any, initialValue?: any): AttributeField {
    const attribute: AttributeField = {
      id: this.getId(attr),
      attributeName: attr?.attributeName ?? '',
      attributeValueType: attr?.attributeValueType ?? '',
      graphqlPath: attr?.graphqlPath ?? '',
      isOptional: attr?.isOptional ?? false,
      enumOptions: this.getEnumOptions(attr),
      control: null as any,
    };

    attribute.control = this.createControl(attribute);

    if (initialValue !== undefined) {
      attribute.control.patchValue(initialValue);
    }

    return attribute;
  }

  /**
   * Maps CK metadata to a stable identifier.
   */
  private getId(attr: any): any {
    if (this.isEnum(attr)) {
      return {
        ckId: attr?.attribute?.ckEnum?.ckEnumId?.fullName,
        rtId: null,
      };
    } else if (this.isRecord(attr) || this.isRecordArray(attr)) {
      return {
        ckId: attr?.attribute?.ckRecord?.ckRecordId?.fullName,
        rtId: null,
      };
    } else {
      return {
        ckId: attr?.ckAttributeId?.fullName,
        rtId: null,
      };
    }
  }

  /**
   * Builds enum options for select inputs.
   */
  private getEnumOptions(attr: any): any[] {
    if (this.isEnum(attr)) {
      const result = attr?.attribute?.ckEnum?.values?.map((value: any) => ({
        key: value.key,
        name: value.name,
      }));
      return result ?? [];
    }
    return [];
  }

  /**
   * Creates a form control suitable for the given attribute type.
   */
  private createControl(attr: AttributeField): AbstractControl {
    const validators = attr.isOptional ? [] : [Validators.required];

    if (this.isRecordArray(attr)) {
      return new FormArray([], validators);
    }

    if (this.isRecord(attr)) {
      return new FormGroup({}, validators);
    }

    if (this.isGeospatialPoint(attr)) {
      return new FormGroup({
        type: new FormControl('Point'),
        longitude: new FormControl(null, validators),
        latitude: new FormControl(null, validators),
      });
    }

    return new FormControl(null, validators);
  }

  /**
   * Maps form values to GraphQL format for createEntities mutation.
   * According to OctoMesh documentation: Record and RecordArray are passed as nested objects/arrays.
   */
  async mapFormValueToGraphQLAttributes(
    formValue: any,
    attributesMetadata?: AttributeField[],
  ): Promise<RtEntityAttributeInput[]> {
    const result: RtEntityAttributeInput[] = [];

    if (
      !formValue ||
      typeof formValue !== 'object' ||
      Array.isArray(formValue)
    ) {
      return result;
    }

    const metadataMap = new Map<string, AttributeField>();
    if (attributesMetadata) {
      attributesMetadata.forEach((attr) => {
        metadataMap.set(attr.attributeName, attr);
      });
    }

    for (const [key, value] of Object.entries(formValue)) {
      if (!key) {
        continue;
      }
      const metadata = metadataMap.get(key);

      if (metadata?.attributeValueType === 'BINARY_LINKED') {
        const processedValue = await this.processAttributeValue(
          value,
          metadata?.attributeValueType,
        );
        result.push({
          attributeName: key,
          value: processedValue,
        });
        continue;
      }

      if (value === null || value === undefined) {
        continue;
      }

      // Skip empty RECORD (empty object) and RECORD_ARRAY (empty array)
      if (
        metadata?.attributeValueType === 'RECORD' &&
        this.isValueEmpty(value)
      ) {
        continue;
      }
      if (
        metadata?.attributeValueType === 'RECORD_ARRAY' &&
        Array.isArray(value) &&
        value.length === 0
      ) {
        continue;
      }

      const processedValue = await this.processAttributeValue(
        value,
        metadata?.attributeValueType,
      );

      result.push({
        attributeName: key,
        value: processedValue,
      });
    }

    return result;
  }

  /**
   * Processes attribute value according to its type.
   * According to OctoMesh documentation: Record and RecordArray are passed as nested objects/arrays.
   */
  private async processAttributeValue(
    value: any,
    attributeType?: string,
  ): Promise<any> {
    switch (attributeType) {
      case 'RECORD':
        return value;

      case 'RECORD_ARRAY':
        return value;

      case 'GEOSPATIAL_POINT':
        return this.convertGeospatialPointToGeoJSON(value);

      case 'TIME_SPAN':
        return this.convertTimeSpanToSeconds(value);

      case 'BINARY': {
        const binaryFile = this.getFileFromValue(value);
        if (binaryFile) {
          return await this.fileToByteArray(binaryFile);
        }
        return await this.convertBinaryToByteArray(value);
      }

      case 'BINARY_LINKED':
        return this.getFileFromValue(value);

      case 'DATE_TIME':
      case 'DATE_TIME_OFFSET':
        if (value instanceof Date) {
          if (isNaN(value.getTime())) {
            return null;
          }
          return value.toISOString();
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Normalizes File values from different control shapes.
   */
  private getFileFromValue(value: any): File | null {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
      return value[0];
    }
    if (value instanceof File) {
      return value;
    }
    return null;
  }

  /**
   * Converts a GeoJSON-like point control to GraphQL-friendly shape.
   */
  private convertGeospatialPointToGeoJSON(point: any): any {
    if (point && typeof point === 'object' && point.type === 'Point') {
      return {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      };
    }
    return point;
  }

  /**
   * Converts a TimeSpan control value to seconds.
   */
  private convertTimeSpanToSeconds(value: any): number {
    if (value instanceof Date) {
      const hours = value.getHours();
      const minutes = value.getMinutes();
      const seconds = value.getSeconds();
      return hours * 3600 + minutes * 60 + seconds;
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }

  /**
   * Converts a File into a byte array.
   */
  private async fileToByteArray(file: File): Promise<number[]> {
    const arrayBuffer = await file.arrayBuffer();
    return Array.from(new Uint8Array(arrayBuffer));
  }

  /**
   * Converts a base64 string into a byte array.
   */
  private base64ToByteArray(base64: string): number[] {
    const binaryString = atob(base64);
    return Array.from(binaryString, (char) => char.charCodeAt(0));
  }

  /**
   * Converts supported binary representations into byte arrays.
   */
  private async convertBinaryToByteArray(value: any): Promise<number[] | any> {
    if (
      Array.isArray(value) &&
      (value.length === 0 || typeof value[0] === 'number')
    ) {
      return value;
    }

    const fileValue = this.getFileFromValue(value);
    if (fileValue) {
      try {
        return await this.fileToByteArray(fileValue);
      } catch (e) {
        console.error('Error converting File to byte array:', e);
        return value;
      }
    }

    if (typeof value === 'string') {
      try {
        return this.base64ToByteArray(value);
      } catch (e) {
        console.error('Error converting Base64 to byte array:', e);
        return value;
      }
    }

    return value;
  }

  /**
   * Checks whether the attribute is an enum type.
   */
  private isEnum(attr: AttributeField): boolean {
    return attr.attributeValueType === 'ENUM';
  }

  /**
   * Checks whether the attribute is a record type.
   */
  private isRecord(attr: AttributeField): boolean {
    return attr.attributeValueType === 'RECORD';
  }

  /**
   * Checks whether the attribute is a record array type.
   */
  private isRecordArray(attr: AttributeField): boolean {
    return attr.attributeValueType === 'RECORD_ARRAY';
  }

  /**
   * Checks whether the attribute is a geospatial point type.
   */
  private isGeospatialPoint(attr: AttributeField): boolean {
    return attr.attributeValueType === 'GEOSPATIAL_POINT';
  }

  /**
   * Checks if a RECORD value is empty (empty object or object with all empty values).
   */
  private isValueEmpty(value: any): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return true;
    }

    const keys = Object.keys(value);
    if (keys.length === 0) {
      return true;
    }

    // Check if all values are empty
    return keys.every((key) => {
      const val = value[key];
      return (
        val === null ||
        val === undefined ||
        val === '' ||
        (typeof val === 'object' &&
          !Array.isArray(val) &&
          Object.keys(val).length === 0) ||
        (Array.isArray(val) && val.length === 0)
      );
    });
  }
}
