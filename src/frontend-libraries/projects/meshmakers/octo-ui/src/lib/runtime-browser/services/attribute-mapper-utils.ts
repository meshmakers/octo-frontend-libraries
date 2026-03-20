/**
 * Shared utilities for attribute mapping (FormAttributesServiceMapper, AttributeMapperService).
 * Reduces duplication of convertGeospatialPointToGeoJSON, fileToByteArray, getFileFromValue, base64ToByteArray.
 */

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Converts a GeoJSON-like point control ({ longitude, latitude } or { type, longitude, latitude })
 * to GraphQL-friendly GeoJSON Point shape.
 */
export function convertGeospatialPointToGeoJSON(point: unknown): unknown {
  if (!isRecordValue(point)) {
    return point;
  }
  if ("longitude" in point && "latitude" in point) {
    return {
      type: "Point",
      coordinates: [point["longitude"], point["latitude"]],
    };
  }
  if (point["type"] === "Point" && "longitude" in point && "latitude" in point) {
    return {
      type: "Point",
      coordinates: [point["longitude"], point["latitude"]],
    };
  }
  return point;
}

/**
 * Converts a File into a byte array (number[]).
 */
export async function fileToByteArray(file: File): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(arrayBuffer));
}

/**
 * Normalizes File values from different control shapes (File or [File]).
 */
export function getFileFromValue(value: unknown): File | null {
  if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
    return value[0];
  }
  if (value instanceof File) {
    return value;
  }
  return null;
}

/**
 * Converts a base64 string into a byte array (number[]).
 */
export function base64ToByteArray(base64: string): number[] {
  const binaryString = atob(base64);
  return Array.from(binaryString, (char) => char.charCodeAt(0));
}
