import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class AttributeRecognitionService {
  isString(attributeValueType: string): boolean {
    return attributeValueType === "STRING";
  }

  isNumber(attributeValueType: string): boolean {
    return ["INT", "INTEGER", "INTEGER_64", "DOUBLE", "NUMBER", "LONG"].includes(
      attributeValueType,
    );
  }

  isEnum(attributeValueType: string): boolean {
    return attributeValueType === "ENUM";
  }

  isRecord(attributeValueType: string): boolean {
    return attributeValueType === "RECORD";
  }

  isArray(attributeValueType: string): boolean {
    return (
      attributeValueType.endsWith("_ARRAY") &&
      attributeValueType !== "RECORD_ARRAY"
    );
  }

  isDate(attributeValueType: string): boolean {
    return ["DATE", "DATE_TIME", "DATE_TIME_OFFSET"].includes(
      attributeValueType,
    );
  }

  isTime(attributeValueType: string): boolean {
    return ["TIME_SPAN"].includes(attributeValueType);
  }

  isGeoSpatialPoint(attributeValueType: string): boolean {
    return ["GEOSPATIAL_POINT"].includes(attributeValueType);
  }

  isBinary(attributeValueType: string): boolean {
    return ["BINARY", "BINARY_LINKED"].includes(attributeValueType);
  }

  isRecordArray(attributeValueType: string): boolean {
    return attributeValueType === "RECORD_ARRAY";
  }

  isBoolean(attributeValueType: string): boolean {
    return attributeValueType === "BOOLEAN";
  }

  isIntArray(attributeValueType: string): boolean {
    return ["INT_ARRAY", "INTEGER_ARRAY"].includes(attributeValueType);
  }

  isStringArray(attributeValueType: string): boolean {
    return attributeValueType === "STRING_ARRAY";
  }
}
