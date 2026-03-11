import { inject, Injectable } from "@angular/core";
import { defer, from, Observable } from "rxjs";
import { Attribute } from "../models/attribute";
import { AttributeRecognitionService } from "./attribute-recognition.service";

export interface RtEntityAttributeInput {
  attributeName: string;
  value: any;
}

/** Property set on synthetic BINARY_LINKED File objects (reference/mockup without content). Used by UI to show a preview indicator. */
export const BINARY_LINKED_REFERENCE_FLAG = "__isBinaryLinkedReference";

/** Property set on BINARY File objects restored from base64 (content is real; filename is a placeholder). Used by UI to show a reference hint. */
export const BINARY_REFERENCE_FLAG = "__isBinaryFromBase64";

/**
 * Maps between form model and GraphQL API: builds form attribute definitions from CK metadata and initial/default
 * values, and maps form values to create/update mutation payloads (including RECORD, BINARY, GEOSPATIAL_POINT, etc.).
 */
@Injectable({
  providedIn: "root",
})
export class AttributeMapperService {
  private recognition = inject(AttributeRecognitionService);

  // ─── Form ← API: attribute definition + initial/default value ─────────────────────

  /**
   * Builds a form attribute definition with a configured control.
   * Value priority: 1. Initial (entity data), 2. Default (CK defaultValues), 3. Empty (placeholder).
   */
  mapToFormAttribute(attr: any, rawInitialValue?: any): Attribute {
    const attributeName = attr?.attributeName ?? "";
    const type = attr?.attributeValueType ?? "";

    let parsedValue: any;
    const hasInitial = rawInitialValue !== undefined && rawInitialValue !== null;
    if (hasInitial) {
      parsedValue = this.parseInitialValue(type, rawInitialValue, attr);
    } else {
      const rawDefault = attr?.attribute?.defaultValues?.[0];
      if (rawDefault !== undefined && rawDefault !== null) {
        parsedValue = this.parseDefaultValue(type, rawDefault, attr);
      } else {
        parsedValue = this.getDefaultPlaceholder(type);
      }
    }

    const attribute: Attribute = {
      id: this.getId(attr),
      attributeName: attributeName,
      attributeValueType: type,
      isOptional: attr?.isOptional ?? false,
      enumOptions: this.getEnumOptions(attr),
      value: parsedValue,
    };

    return attribute;
  }

  /**
   * Converts a raw initial value (from entity) to form value for an existing attribute definition.
   * Use this when attributes were already mapped (e.g. from data service) and only the value needs to be parsed.
   * Avoids rebuilding the full attribute and duplicate mapping overhead.
   */
  getFormValueFromRawInitial(attrMetadata: Attribute, rawInitialValue: any): any {
    return this.parseInitialValue(
      attrMetadata.attributeValueType,
      rawInitialValue,
      attrMetadata,
    );
  }

  // ─── Form → GraphQL: mutation payload (create / update) ────────────────────────────

  /**
   * Maps form values to GraphQL format (Observable). Use this in editors for better composition,
   * cancellation and optional retry/timeout. Emits once with the mapped attributes array.
   */
  mapFormValueToGraphQLAttributes$(
    formValue: any,
    attributesMetadata?: Attribute[],
  ): Observable<RtEntityAttributeInput[]> {
    return defer(() =>
      from(this.mapFormValueToGraphQLAttributes(formValue, attributesMetadata)),
    );
  }

  /**
   * Maps form values to GraphQL format for createEntities / updateRuntimeEntities.
   * Record and RecordArray are passed as nested objects/arrays. BINARY_LINKED is included only when value is a File.
   */
  async mapFormValueToGraphQLAttributes(
    formValue: any,
    attributesMetadata?: Attribute[],
  ): Promise<RtEntityAttributeInput[]> {
    const result: RtEntityAttributeInput[] = [];

    if (
      !formValue ||
      typeof formValue !== "object" ||
      Array.isArray(formValue)
    ) {
      return result;
    }

    const metadataMap = new Map<string, Attribute>();
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

      if (metadata?.attributeValueType === "BINARY_LINKED") {
        const processedValue = await this.processAttributeValue(
          value,
          metadata?.attributeValueType,
        );
        if (processedValue instanceof File) {
          // Skip synthetic reference/preview files — they are placeholders created by
          // parseBinaryLinkedForForm and must not be re-uploaded (would overwrite real data with zeros).
          if (
            (processedValue as unknown as Record<string, unknown>)[
              BINARY_LINKED_REFERENCE_FLAG
            ]
          ) {
            continue;
          }
          result.push({ attributeName: key, value: processedValue });
        } else {
          // Value was cleared (null / empty array) — send null so the backend removes the linked binary.
          result.push({ attributeName: key, value: null });
        }
        continue;
      }

      if (value === null || value === undefined) {
        if (metadata?.isOptional) {
          result.push({ attributeName: key, value: null });
        }
        continue;
      }

      if (
        metadata?.attributeValueType === "BINARY" &&
        this.isOptionalEmptyBinary(metadata, value)
      ) {
        result.push({ attributeName: key, value: null });
        continue;
      }

      // Skip empty RECORD (empty object) and RECORD_ARRAY (empty array) unless optional (then send null)
      if (
        metadata?.attributeValueType === "RECORD" &&
        this.isValueEmpty(value)
      ) {
        if (metadata?.isOptional) {
          result.push({ attributeName: key, value: null });
        }
        continue;
      }
      if (
        metadata?.attributeValueType === "RECORD_ARRAY" &&
        Array.isArray(value) &&
        value.length === 0
      ) {
        if (metadata?.isOptional) {
          result.push({ attributeName: key, value: null });
        }
        continue;
      }

      if (metadata?.isOptional && this.isOptionalEmptyScalarOrArray(value, metadata)) {
        result.push({ attributeName: key, value: null });
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

  /** Processes a single attribute value for mutation payload (type-specific conversion). */
  private async processAttributeValue(
    value: any,
    attributeType?: string,
  ): Promise<any> {
    switch (attributeType) {
      case "RECORD":
        return value;

      case "RECORD_ARRAY":
        return value;

      case "GEOSPATIAL_POINT":
        return this.convertGeospatialPointToGeoJSON(value);

      case "TIME_SPAN":
        return this.convertTimeSpanToSeconds(value);

      case "BINARY": {
        // MeshMakers expects byte[] (array of numbers). Accept File, ArrayBuffer, base64 string, or byte[].
        return await this.convertBinaryToByteArray(value);
      }

      case "BINARY_LINKED": {
        // MeshMakers: prefer File for multipart, but also accept base64 or byte[]
        if (value instanceof File) {
          return value;
        }
        if (Array.isArray(value) && value[0] instanceof File) {
          return value[0];
        }
        if (typeof value === "string") {
          // base64 string
          return this.base64ToByteArray(value);
        }
        if (value instanceof ArrayBuffer) {
          return this.arrayBufferToByteArray(value);
        }
        if (Array.isArray(value) && typeof value[0] === "number") {
          return value;
        }
        return null;
      }
      case "INTEGER_ARRAY":
        return this.normalizePrimitiveArray(value, "number");
      case "STRING_ARRAY":
        return this.normalizePrimitiveArray(value, "string");
      case "DATE_TIME":
      case "DATE_TIME_OFFSET":
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

  // ─── Scalar / array normalization ────────────────────────────────────────────────

  /** Normalizes form value for INTEGER_ARRAY/STRING_ARRAY: primitives[] or { key }[] → primitive[] for GraphQL. */
  private normalizePrimitiveArray(
    value: any,
    mode: "number" | "string",
  ): number[] | string[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const normalized = value.map((v: any) => {
      if (typeof v === "object" && v != null && "key" in v) {
        return mode === "number" ? Number(v.key) : String(v.key);
      }
      return mode === "number" ? Number(v) : String(v);
    });
    return normalized as number[] | string[];
  }

  private arrayBufferToByteArray(buffer: ArrayBuffer): number[] {
    return Array.from(new Uint8Array(buffer));
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

  // ─── Geo / time / binary helpers ──────────────────────────────────────────────────

  /** Normalizes API/GeoJSON value to form shape { longitude, latitude } for edit mode. */
  private normalizeGeospatialPointForForm(value: any): {
    longitude: number | null;
    latitude: number | null;
  } {
    if (value == null) return { longitude: null, latitude: null };
    if (typeof value === "string") {
      try {
        value = JSON.parse(value) as any;
      } catch {
        return { longitude: null, latitude: null };
      }
    }
    if (typeof value !== "object") {
      return { longitude: null, latitude: null };
    }
    if ("longitude" in value && "latitude" in value) {
      return {
        longitude: value.longitude != null ? Number(value.longitude) : null,
        latitude: value.latitude != null ? Number(value.latitude) : null,
      };
    }
    if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
      return {
        longitude: Number(value.coordinates[0]),
        latitude: Number(value.coordinates[1]),
      };
    }
    return { longitude: null, latitude: null };
  }

  /**
   * Converts a GeoJSON-like point control to GraphQL-friendly shape.
   */
  private convertGeospatialPointToGeoJSON(coordinates: any): any {
    if (
      coordinates &&
      typeof coordinates === "object" &&
      "longitude" in coordinates &&
      "latitude" in coordinates
    ) {
      return {
        type: "Point",
        coordinates: [coordinates.longitude, coordinates.latitude],
      };
    }
    return coordinates;
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
    if (typeof value === "number") {
      return value;
    }
    return 0;
  }

  // --- BINARY helpers for MeshMakers ---

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
   * Decodes a base64 string into a File with real content, size and optional name/type.
   * Returns null if decoding fails (e.g. invalid base64).
   * Note: A base64 string carries only the raw bytes; it does not contain filename or other metadata.
   * The filename (and contentType) must be supplied by the caller when known (e.g. from a BINARY_LINKED payload); for plain BINARY we use a default name.
   */
  private base64ToFile(
    base64: string,
    filename = "file.bin",
    contentType = "application/octet-stream",
  ): File | null {
    try {
      const bytes = this.base64ToByteArray(base64);
      const uint8 = new Uint8Array(bytes);
      const blob = new Blob([uint8], { type: contentType });
      return new File([blob], filename, { type: contentType });
    } catch {
      return null;
    }
  }

  /**
   * Converts supported binary representations into byte arrays.
   */
  private async convertBinaryToByteArray(value: any): Promise<number[] | any> {
    if (
      Array.isArray(value) &&
      (value.length === 0 || typeof value[0] === "number")
    ) {
      return value;
    }

    const fileValue = this.getFileFromValue(value);
    if (fileValue) {
      try {
        return await this.fileToByteArray(fileValue);
      } catch (e) {
        console.error("Error converting File to byte array:", e);
        return value;
      }
    }

    if (typeof value === "string") {
      try {
        return this.base64ToByteArray(value);
      } catch (e) {
        console.error("Error converting Base64 to byte array:", e);
        return value;
      }
    }

    return value;
  }

  // ─── Type recognition (single responsibility: attribute type checks) ─────────────

  private isEnum(attr: Attribute): boolean {
    return attr.attributeValueType === "ENUM";
  }

  /**
   * Checks whether the attribute is a record type.
   */
  private isRecord(attr: Attribute): boolean {
    return attr.attributeValueType === "RECORD";
  }

  /**
   * Checks whether the attribute is a record array type.
   */
  private isRecordArray(attr: Attribute): boolean {
    return attr.attributeValueType === "RECORD_ARRAY";
  }

  /**
   * Checks whether the attribute is a geospatial point type.
   */
  private isGeospatialPoint(attr: Attribute): boolean {
    return attr.attributeValueType === "GEOSPATIAL_POINT";
  }

  /** True when optional scalar/array is "cleared" (send null to remove value). */
  private isOptionalEmptyScalarOrArray(value: any, metadata: Attribute): boolean {
    if (value === "" || value == null) return true;
    const t = metadata?.attributeValueType;
    if (this.recognition.isArray(t) && Array.isArray(value) && value.length === 0)
      return true;
    return false;
  }

  private isOptionalEmptyBinary(metadata: Attribute, value: any): boolean {
    if (!metadata?.isOptional) return false;
    if (value == null) return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (Array.isArray(value) && value.length === 1 && value[0] instanceof File)
      return false;
    return false;
  }

  /**
   * Checks if a RECORD value is empty (empty object or object with all empty values).
   */
  private isValueEmpty(value: any): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
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
        val === "" ||
        (typeof val === "object" &&
          !Array.isArray(val) &&
          Object.keys(val).length === 0) ||
        (Array.isArray(val) && val.length === 0)
      );
    });
  }

  // ─── API → Form: parsing initial / default values ──────────────────────────────────

  /** Parses raw API value into form-friendly value for a given attribute type. */
  private parseInitialValue(type: string, value: any, attrMetadata: any): any {
    // If value is null/undefined, return a safe placeholder for the type
    // 1. If no value, provide a safe default (Empty State)
    if (value === undefined || value === null) {
      return this.getDefaultPlaceholder(type);
    }

    // 2. Handle RECORD (single attribute group)
    if (this.recognition.isRecord(type)) {
      // OctoMesh typically returns this in the 'attributes' field
      // If value is already an array, return it. If object with attributes field, extract it.
      if (Array.isArray(value)) return value;
      return value?.attributes ?? [];
    }

    // 3. Handle RECORD_ARRAY (list of attribute groups)
    if (this.recognition.isRecordArray(type)) {
      // Expect an array of records. Map each record to its list of attributes.
      if (Array.isArray(value)) {
        return value.map((item: any) => {
          if (Array.isArray(item)) return item; // Already parsed
          return item?.attributes ?? []; // Extract attributes from record
        });
      }
      return [];
    }

    // 4. Handle ENUM (key for displaying names)
    if (this.recognition.isEnum(type)) {
      const options = this.getEnumOptions(attrMetadata);
      const found = options.find(
        (opt) => opt.name === value || opt.key === value,
      );
      return found ? found.key : value;
    }

    if (this.recognition.isArray(type)) {
      return this.parseArrayType(type, value);
    }

    if (this.recognition.isTime(type)) {
      return this.parseTimeSpanForForm(value);
    }
    if (this.recognition.isDate(type)) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    if (this.recognition.isGeoSpatialPoint(type)) {
      return this.normalizeGeospatialPointForForm(value);
    }

    if (type === "BINARY") {
      return this.parseBinaryForForm(value);
    }
    if (type === "BINARY_LINKED") {
      return this.parseBinaryLinkedForForm(value);
    }

    return value;
  }

  /**
   * Parses API TimeSpan string (e.g. "44682.00:00:00" = days.hh:mm:ss) to a Date for Kendo TimePicker.
   * TimePicker shows time of day; we use totalSeconds % 86400 so duration is shown as time.
   */
  private parseTimeSpanForForm(value: any): Date | null {
    if (value == null) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") {
      const d = new Date(0);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCSeconds(value % 86400);
      return d;
    }
    const str = String(value).trim();
    if (!str) return null;
    const totalSeconds = this.parseTimeSpanStringToSeconds(str);
    if (totalSeconds === null) return null;
    const d = new Date(0);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCSeconds(totalSeconds % 86400);
    return d;
  }

  /**
   * Parses .NET-style TimeSpan string "days.hh:mm:ss" or "hh:mm:ss" to total seconds.
   * When a dot is present, the segment before the dot is always days (e.g. "44682.00:00:00" = 44682 days).
   */
  private parseTimeSpanStringToSeconds(s: string): number | null {
    const parts = s.split(".");
    let timePart = parts[0] ?? "";
    let days = 0;
    if (parts.length >= 2) {
      const firstNum = parseInt(parts[0], 10);
      if (!Number.isNaN(firstNum)) {
        days = firstNum;
      }
      timePart = parts[1] ?? "00:00:00";
    }
    const timeMatch = timePart.match(
      /^(\d+):(\d+):(\d+)(?:\.(\d+))?$/,
    );
    if (!timeMatch) {
      const asNumber = parseFloat(s);
      if (!Number.isNaN(asNumber)) return Math.floor(asNumber);
      return null;
    }
    const hours = parseInt(timeMatch[1], 10) || 0;
    const minutes = parseInt(timeMatch[2], 10) || 0;
    const seconds = parseInt(timeMatch[3], 10) || 0;
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * For edit mode: BINARY value is base64 string; decode to a real File with content and size for kendo-fileselect.
   * Base64 alone does not carry filename metadata, so we use a default name "file.bin".
   * Returns File[] because FileSelect expects a collection of File instances (see Kendo model binding).
   */
  private parseBinaryForForm(value: any): File[] {
    if (value == null) return [];
    if (value instanceof File) return [value];
    if (Array.isArray(value) && value[0] instanceof File) return value;
    if (typeof value === "string") {
      const file = this.base64ToFile(
        value,
        "file.bin",
        "application/octet-stream",
      );
      if (file) {
        (file as unknown as Record<string, unknown>)[BINARY_REFERENCE_FLAG] =
          true;
        return [file];
      }
      return [];
    }
    return [];
  }

  /**
   * For edit mode: BINARY_LINKED value is { contentType, binaryId, filename, size } and optionally base64 content.
   * If content is provided (contentBase64 / data / base64), decode to a real File with name, size and content for kendo-fileselect.
   * Otherwise create a synthetic File with correct name, size and type so the UI can display metadata (reference to existing file).
   * Returns File[] because FileSelect expects a collection of File instances (see Kendo model binding).
   */
  private parseBinaryLinkedForForm(value: any): File[] {
    if (value == null || typeof value !== "object") return [];
    if (value instanceof File) return [value];
    const filename = value.filename ?? value.fileName ?? "document.bin";
    const contentType = value.contentType ?? "application/octet-stream";
    const base64 =
      typeof value.contentBase64 === "string"
        ? value.contentBase64
        : typeof value.data === "string"
          ? value.data
          : typeof value.base64 === "string"
            ? value.base64
            : null;
    if (base64) {
      const file = this.base64ToFile(base64, filename, contentType);
      if (file) return [file];
    }
    const size = typeof value.size === "number" ? Math.max(0, value.size) : 0;
    const blob =
      size > 0
        ? new Blob([new ArrayBuffer(size)], { type: contentType })
        : new Blob([], { type: contentType });
    const file = new File([blob], filename, { type: contentType });
    (file as unknown as Record<string, unknown>)[
      BINARY_LINKED_REFERENCE_FLAG
    ] = true;
    return [file];
  }

  private getDefaultPlaceholder(type: string): any {
    if (this.recognition.isRecordArray(type)) return [];
    if (this.recognition.isRecord(type)) return []; // Empty attribute array for new record
    if (this.recognition.isArray(type)) return [];
    if (this.recognition.isGeoSpatialPoint(type))
      return { longitude: null, latitude: null };
    if (type === "BINARY" || type === "BINARY_LINKED") return []; // FileSelect expects File[]
    return null;
  }

  /**
   * Parses CK attribute defaultValues[0] into form-friendly shape. Used when no initial value exists.
   */
  private parseDefaultValue(type: string, rawDefault: any, attrMetadata: any): any {
    if (rawDefault === undefined || rawDefault === null) {
      return this.getDefaultPlaceholder(type);
    }
    if (this.recognition.isEnum(type)) {
      const options = this.getEnumOptions(attrMetadata);
      const key =
        typeof rawDefault === "number" ? rawDefault : Number(rawDefault);
      const found = options.find((opt) => opt.key === key);
      return found ? found.key : key;
    }
    if (this.recognition.isNumber(type)) {
      return typeof rawDefault === "number" ? rawDefault : Number(rawDefault);
    }
    if (this.recognition.isString(type)) {
      return String(rawDefault);
    }
    if (this.recognition.isBoolean(type)) {
      return rawDefault === true || rawDefault === "true" || rawDefault === 1;
    }
    if (this.recognition.isDate(type)) {
      const date = new Date(rawDefault);
      return isNaN(date.getTime()) ? null : date;
    }
    if (this.recognition.isTime(type)) {
      if (typeof rawDefault === "number") {
        const d = new Date(0);
        d.setUTCHours(0, 0, 0, 0);
        d.setSeconds(rawDefault);
        return d;
      }
      const date = new Date(rawDefault);
      return isNaN(date.getTime()) ? null : date;
    }
    if (this.recognition.isArray(type)) {
      const arr = Array.isArray(rawDefault) ? rawDefault : [rawDefault];
      if (this.recognition.isStringArray(type)) {
        return arr.map((v: any) => String(v));
      }
      if (this.recognition.isIntArray(type)) {
        return arr.map((v: any) => Number(v));
      }
      return arr;
    }
    if (this.recognition.isGeoSpatialPoint(type)) {
      return this.normalizeGeospatialPointForForm(rawDefault);
    }
    return rawDefault;
  }

  /** Returns primitive arrays for Kendo MultiSelect (valuePrimitive: true). */
  private parseArrayType(type: string, value: any): string[] | number[] {
    if (this.recognition.isStringArray(type)) {
      const source = value?._v ?? value;
      if (!Array.isArray(source)) return [];
      return source.map((v: any) =>
        typeof v === "object" && v != null && "key" in v
          ? String(v.key)
          : String(v),
      );
    }
    if (this.recognition.isIntArray(type)) {
      const source = value?._v ?? value; // Handle _v wrapper format from upstream
      if (!Array.isArray(source)) return [];
      return source.map((v: any) =>
        typeof v === "object" && v != null && "key" in v
          ? Number(v.key)
          : Number(v),
      );
    }
    return [];
  }

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
  private getEnumOptions(attr: any): any[] {
    if (attr?.enumOptions) {
      return attr.enumOptions;
    }
    if (attr?.attribute?.ckEnum) {
      return (
        attr.attribute.ckEnum.values?.map((v: any) => ({
          key: v.key,
          name: v.name,
        })) ?? []
      );
    }
    return [];
  }
}
