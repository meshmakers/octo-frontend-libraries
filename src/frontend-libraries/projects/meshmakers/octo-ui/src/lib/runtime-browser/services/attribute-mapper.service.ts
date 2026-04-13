import { inject, Injectable } from "@angular/core";
import { defer, firstValueFrom, from, Observable } from "rxjs";
import { Attribute } from "../models/attribute";
import {
  AttributeEnumOption,
  CkAttributeMetadata,
} from "../models/attribute-metadata";
import { AttributeMetadataResolverService } from "./attribute-metadata-resolver.service";
import { AttributeRecognitionService } from "./attribute-recognition.service";
import {
  base64ToByteArray,
  convertGeospatialPointToGeoJSON,
  fileToByteArray,
  getFileFromValue,
} from "./attribute-mapper-utils";

export interface RtEntityAttributeInput {
  attributeName: string;
  value: unknown;
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
  private metadataResolver = inject(AttributeMetadataResolverService);
  private isRecordValue(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  private isCkAttributeMetadata(
    attr: CkAttributeMetadata | Attribute,
  ): attr is CkAttributeMetadata {
    return "attribute" in attr || "ckAttributeId" in attr;
  }

  // ─── Form ← API: attribute definition + initial/default value ─────────────────────

  /**
   * Builds a form attribute definition with a configured control.
   * Value priority: 1. Initial (entity data), 2. Default (CK defaultValues), 3. Empty (placeholder).
   */
  mapToFormAttribute(
    attr: CkAttributeMetadata,
    rawInitialValue?: unknown,
  ): Attribute {
    const attributeName = attr?.attributeName ?? "";
    const type = attr?.attributeValueType ?? "";

    let parsedValue: unknown;
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
  getFormValueFromRawInitial(
    attrMetadata: Attribute,
    rawInitialValue: unknown,
  ): unknown {
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
    formValue: unknown,
    attributesMetadata?: Attribute[],
  ): Observable<RtEntityAttributeInput[]> {
    return defer(() =>
      from(this.mapFormValueToGraphQLAttributes(formValue, attributesMetadata)),
    );
  }

  /**
   * Maps form values to GraphQL format for createEntities / updateRuntimeEntities. Top-level RECORD and
   * RECORD_ARRAY attribute values are recursively mapped via the same per-attribute logic so nested
   * scalars (BINARY, GEO, TIME_SPAN, …) get type conversion identical to their top-level siblings.
   */
  async mapFormValueToGraphQLAttributes(
    formValue: unknown,
    attributesMetadata?: Attribute[],
  ): Promise<RtEntityAttributeInput[]> {
    if (!this.isRecordValue(formValue)) {
      return [];
    }

    const metadataMap = new Map<string, Attribute>(
      (attributesMetadata ?? []).map((attr) => [attr.attributeName, attr]),
    );

    const result: RtEntityAttributeInput[] = [];
    for (const [key, value] of Object.entries(formValue)) {
      if (!key) continue;
      const mapped = await this.mapSingleAttributeToInput(
        key,
        value,
        metadataMap.get(key),
      );
      if (mapped !== null) {
        result.push(mapped);
      }
    }
    return result;
  }

  /**
   * Maps a single (key, value, metadata) triple into a GraphQL RtEntityAttributeInput, or null when the
   * attribute should be omitted from the payload entirely (typically: required scalar with no value).
   *
   * Single source of truth for empty / null / optional / type-conversion rules. Used by both the top-level
   * mapping and the recursive RECORD / RECORD_ARRAY mapping so nested attributes follow the exact same
   * contract. Branch order matters: BINARY_LINKED handling must come before the generic null/undefined
   * skip because cleared linked binaries are sent as explicit null (to detach the link on the backend).
   */
  private async mapSingleAttributeToInput(
    key: string,
    value: unknown,
    metadata: Attribute | undefined,
  ): Promise<RtEntityAttributeInput | null> {
    const type = metadata?.attributeValueType;

    // type is set only when metadata exists, so the non-null assertion is safe inside these branches.
    if (type === "BINARY_LINKED") {
      return this.mapBinaryLinkedAttribute(key, value, metadata!);
    }

    if (value === null || value === undefined) {
      return metadata?.isOptional ? { attributeName: key, value: null } : null;
    }

    if (type === "BINARY" && this.isOptionalEmptyBinary(metadata!, value)) {
      return { attributeName: key, value: null };
    }

    // Empty RECORD (empty object) and RECORD_ARRAY (empty array): send null when optional, skip otherwise.
    if (type === "RECORD" && this.isValueEmpty(value)) {
      return metadata?.isOptional ? { attributeName: key, value: null } : null;
    }
    if (type === "RECORD_ARRAY" && Array.isArray(value) && value.length === 0) {
      return metadata?.isOptional ? { attributeName: key, value: null } : null;
    }

    if (
      metadata?.isOptional &&
      this.isOptionalEmptyScalarOrArray(value, metadata)
    ) {
      return { attributeName: key, value: null };
    }

    const processedValue = await this.processAttributeValue(value, metadata);
    return { attributeName: key, value: processedValue };
  }

  /**
   * BINARY_LINKED has its own decision tree because synthetic reference Files (created by
   * parseBinaryLinkedForForm to display existing-file metadata) must NOT be re-uploaded — re-uploading
   * a synthetic File would overwrite the real binary with zero-filled placeholder content.
   * Cleared values (null / empty array) emit explicit null so the backend detaches the linked binary.
   */
  private async mapBinaryLinkedAttribute(
    key: string,
    value: unknown,
    metadata: Attribute,
  ): Promise<RtEntityAttributeInput | null> {
    const processedValue = await this.processAttributeValue(value, metadata);
    if (processedValue instanceof File) {
      const isReference =
        (processedValue as unknown as Record<string, unknown>)[
          BINARY_LINKED_REFERENCE_FLAG
        ] === true;
      if (isReference) {
        return null;
      }
      return { attributeName: key, value: processedValue };
    }
    return { attributeName: key, value: null };
  }

  /**
   * Recursively maps a RECORD form value (flat object { subAttr: subVal, ... }) to the wire shape expected
   * by the backend mutation: a flat object { subAttr: processedSubVal, ... }.
   *
   * Important asymmetry between query response and mutation input: queries return RECORD as
   * { attributes: [{ attributeName, value }, ...] } (the GraphQL RtRecord type wraps it), but the mutation
   * input field RtEntityAttributeInput.value is SimpleScalar — opaque to GraphQL — so the backend reads
   * the raw dictionary directly and matches keys against CK sub-attribute names. Sending the wrapped
   * { attributes: [...] } shape resulted in ASSET1004 (mandatory attribute missing) because the backend
   * never iterated the wrapper.
   *
   * Fetches sub-attribute definitions for the given recordCkId via AttributeMetadataResolverService and
   * routes each entry through mapSingleAttributeToInput so type conversion (BINARY → byte[], GEO → GeoJSON,
   * TIME_SPAN → seconds, …) and empty/null/optional rules apply identically to nested attributes.
   * Sub-attribute keys are kept in their form-side camelCase form (matches the previously working code path).
   */
  private async mapRecordValueToGraphQL(
    value: unknown,
    recordCkId: string | undefined,
  ): Promise<Record<string, unknown>> {
    if (!this.isRecordValue(value) || !recordCkId) {
      return {};
    }

    let subMetadataMap: Map<string, Attribute>;
    try {
      const rawDefinitions = await firstValueFrom(
        this.metadataResolver.getRawAttributes$(recordCkId, true),
      );
      subMetadataMap = new Map(
        rawDefinitions.map((meta) => {
          const subAttr = this.mapToFormAttribute(meta, undefined);
          return [subAttr.attributeName, subAttr];
        }),
      );
    } catch (err) {
      // Resolver failure (network/auth/cache) must not abort the whole mapping pipeline. Falling back
      // to an empty map means sub-attributes are emitted with their form values without type conversion;
      // the backend will reject the payload with a meaningful error rather than the user seeing nothing.
      console.error(
        `AttributeMapperService: failed to resolve sub-attributes for record '${recordCkId}'`,
        err,
      );
      subMetadataMap = new Map();
    }

    const result: Record<string, unknown> = {};
    for (const [subKey, subValue] of Object.entries(value)) {
      if (!subKey) continue;
      const mapped = await this.mapSingleAttributeToInput(
        subKey,
        subValue,
        subMetadataMap.get(subKey),
      );
      if (mapped !== null) {
        result[mapped.attributeName] = mapped.value;
      }
    }

    return result;
  }

  /**
   * Recursively maps a RECORD_ARRAY form value (array of flat objects) to the wire shape expected by the
   * backend mutation: an array of flat objects [{ subAttr: subVal }, { subAttr: subVal }].
   *
   * Each item is a record sharing the same recordCkId; metadata is fetched (and Apollo-cached) once per item
   * via mapRecordValueToGraphQL.
   */
  private async mapRecordArrayValueToGraphQL(
    value: unknown,
    recordCkId: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    if (!Array.isArray(value)) return [];
    const result: Record<string, unknown>[] = [];
    for (const item of value) {
      result.push(await this.mapRecordValueToGraphQL(item, recordCkId));
    }
    return result;
  }

  /** Processes a single attribute value for mutation payload (type-specific conversion). */
  private async processAttributeValue(
    value: unknown,
    metadata?: Attribute,
  ): Promise<unknown> {
    const attributeType = metadata?.attributeValueType;
    switch (attributeType) {
      case "RECORD":
        return await this.mapRecordValueToGraphQL(value, metadata?.id?.ckId);

      case "RECORD_ARRAY":
        return await this.mapRecordArrayValueToGraphQL(
          value,
          metadata?.id?.ckId,
        );

      case "GEOSPATIAL_POINT":
        return convertGeospatialPointToGeoJSON(value);

      case "TIME_SPAN":
        return this.convertTimeSpanToSeconds(value);

      case "BINARY":
        // MeshMakers expects byte[] (array of numbers). Accept File, ArrayBuffer, base64 string, or byte[].
        return await this.convertBinaryToByteArray(value);

      case "BINARY_LINKED":
        // MeshMakers: prefer File for multipart upload; also accept base64 string, ArrayBuffer or byte[].
        return this.convertBinaryLinkedValue(value);
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
    value: unknown,
    mode: "number" | "string",
  ): number[] | string[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    if (mode === "number") {
      return value.map((v) => {
        if (this.isRecordValue(v) && "key" in v) {
          return Number(v["key"]);
        }
        return Number(v);
      });
    }
    return value.map((v) => {
      if (this.isRecordValue(v) && "key" in v) {
        return String(v["key"]);
      }
      return String(v);
    });
  }

  private arrayBufferToByteArray(buffer: ArrayBuffer): number[] {
    return Array.from(new Uint8Array(buffer));
  }

  // ─── Geo / time / binary helpers ──────────────────────────────────────────────────

  /** Normalizes API/GeoJSON value to form shape { longitude, latitude } for edit mode. */
  private normalizeGeospatialPointForForm(value: unknown): {
    longitude: number | null;
    latitude: number | null;
  } {
    if (value == null) return { longitude: null, latitude: null };
    if (typeof value === "string") {
      try {
        value = JSON.parse(value) as unknown;
      } catch {
        return { longitude: null, latitude: null };
      }
    }
    if (!this.isRecordValue(value)) {
      return { longitude: null, latitude: null };
    }
    if ("longitude" in value && "latitude" in value) {
      return {
        longitude:
          value["longitude"] != null ? Number(value["longitude"]) : null,
        latitude:
          value["latitude"] != null ? Number(value["latitude"]) : null,
      };
    }
    if (
      Array.isArray(value["coordinates"]) &&
      value["coordinates"].length >= 2
    ) {
      return {
        longitude: Number(value["coordinates"][0]),
        latitude: Number(value["coordinates"][1]),
      };
    }
    return { longitude: null, latitude: null };
  }

  /**
   * Converts a TimeSpan control value to seconds.
   */
  private convertTimeSpanToSeconds(value: unknown): number {
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
      const bytes = base64ToByteArray(base64);
      const uint8 = new Uint8Array(bytes);
      const blob = new Blob([uint8], { type: contentType });
      return new File([blob], filename, { type: contentType });
    } catch {
      return null;
    }
  }

  /**
   * Converts supported binary representations into byte arrays. Returns the original value as a fallback
   * when the input shape is not recognized so the backend can produce a meaningful validation error.
   */
  private async convertBinaryToByteArray(
    value: unknown,
  ): Promise<number[] | unknown> {
    if (
      Array.isArray(value) &&
      (value.length === 0 || typeof value[0] === "number")
    ) {
      return value as number[];
    }

    const fileValue = getFileFromValue(value);
    if (fileValue) {
      try {
        return await fileToByteArray(fileValue);
      } catch (e) {
        console.error("Error converting File to byte array:", e);
        return value;
      }
    }

    if (typeof value === "string") {
      try {
        return base64ToByteArray(value);
      } catch (e) {
        console.error("Error converting Base64 to byte array:", e);
        return value;
      }
    }

    return value;
  }

  /**
   * Normalizes a BINARY_LINKED form value to one of the wire shapes the backend accepts. Order matters:
   * a real File is preferred (multipart upload preserves filename and content type), with byte[] / base64
   * accepted as fallbacks for callers that already have raw bytes.
   */
  private convertBinaryLinkedValue(value: unknown): unknown {
    if (value instanceof File) return value;
    if (Array.isArray(value) && value[0] instanceof File) return value[0];
    if (typeof value === "string") {
      try {
        return base64ToByteArray(value);
      } catch (e) {
        console.error("Error converting BINARY_LINKED base64 to byte array:", e);
        return null;
      }
    }
    if (value instanceof ArrayBuffer) {
      return this.arrayBufferToByteArray(value);
    }
    if (Array.isArray(value) && typeof value[0] === "number") {
      return value;
    }
    return null;
  }

  // ─── Type recognition (single responsibility: attribute type checks) ─────────────

  private isEnum(attr: Pick<Attribute, "attributeValueType"> | CkAttributeMetadata): boolean {
    return attr.attributeValueType === "ENUM";
  }

  /**
   * Checks whether the attribute is a record type.
   */
  private isRecord(attr: Pick<Attribute, "attributeValueType"> | CkAttributeMetadata): boolean {
    return attr.attributeValueType === "RECORD";
  }

  /**
   * Checks whether the attribute is a record array type.
   */
  private isRecordArray(
    attr: Pick<Attribute, "attributeValueType"> | CkAttributeMetadata,
  ): boolean {
    return attr.attributeValueType === "RECORD_ARRAY";
  }

  /**
   * Checks whether the attribute is a geospatial point type.
   */
  private isGeospatialPoint(
    attr: Pick<Attribute, "attributeValueType"> | CkAttributeMetadata,
  ): boolean {
    return attr.attributeValueType === "GEOSPATIAL_POINT";
  }

  /** True when optional scalar/array is "cleared" (send null to remove value). */
  private isOptionalEmptyScalarOrArray(
    value: unknown,
    metadata: Attribute,
  ): boolean {
    if (value === "" || value == null) return true;
    const t = metadata?.attributeValueType;
    if (this.recognition.isArray(t) && Array.isArray(value) && value.length === 0)
      return true;
    return false;
  }

  private isOptionalEmptyBinary(metadata: Attribute, value: unknown): boolean {
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
  private isValueEmpty(value: unknown): boolean {
    if (!this.isRecordValue(value)) {
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
        (this.isRecordValue(val) && Object.keys(val).length === 0) ||
        (Array.isArray(val) && val.length === 0)
      );
    });
  }

  // ─── API → Form: parsing initial / default values ──────────────────────────────────

  /** Parses raw API value into form-friendly value for a given attribute type. */
  private parseInitialValue(
    type: string,
    value: unknown,
    attrMetadata: CkAttributeMetadata | Attribute,
  ): unknown {
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
      if (this.isRecordValue(value)) {
        const attrs = value["attributes"];
        return Array.isArray(attrs) ? attrs : [];
      }
      return [];
    }

    // 3. Handle RECORD_ARRAY (list of attribute groups)
    if (this.recognition.isRecordArray(type)) {
      // Expect an array of records. Map each record to its list of attributes.
      if (Array.isArray(value)) {
        return value.map((item) => {
          if (Array.isArray(item)) return item; // Already parsed
          if (this.isRecordValue(item)) {
            const attrs = item["attributes"];
            return Array.isArray(attrs) ? attrs : [];
          }
          return [];
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
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        value instanceof Date
      ) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
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
  private parseTimeSpanForForm(value: unknown): Date | null {
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
  private parseBinaryForForm(value: unknown): File[] {
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
  private parseBinaryLinkedForForm(value: unknown): File[] {
    if (!this.isRecordValue(value)) return [];
    if (value instanceof File) return [value];
    const filename =
      (typeof value["filename"] === "string"
        ? value["filename"]
        : typeof value["fileName"] === "string"
          ? value["fileName"]
          : null) ?? "document.bin";
    const contentType =
      (typeof value["contentType"] === "string"
        ? value["contentType"]
        : null) ?? "application/octet-stream";
    const base64 =
      typeof value["contentBase64"] === "string"
        ? value["contentBase64"]
        : typeof value["data"] === "string"
          ? value["data"]
          : typeof value["base64"] === "string"
            ? value["base64"]
            : null;
    if (base64) {
      const file = this.base64ToFile(base64, filename, contentType);
      if (file) return [file];
    }
    const size =
      typeof value["size"] === "number" ? Math.max(0, value["size"]) : 0;
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

  private getDefaultPlaceholder(type: string): unknown {
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
  private parseDefaultValue(
    type: string,
    rawDefault: unknown,
    attrMetadata: CkAttributeMetadata | Attribute,
  ): unknown {
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
      if (
        typeof rawDefault === "string" ||
        typeof rawDefault === "number" ||
        rawDefault instanceof Date
      ) {
        const date = new Date(rawDefault);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
    }
    if (this.recognition.isTime(type)) {
      if (typeof rawDefault === "number") {
        const d = new Date(0);
        d.setUTCHours(0, 0, 0, 0);
        d.setSeconds(rawDefault);
        return d;
      }
      if (
        typeof rawDefault === "string" ||
        typeof rawDefault === "number" ||
        rawDefault instanceof Date
      ) {
        const date = new Date(rawDefault);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
    }
    if (this.recognition.isArray(type)) {
      const arr = Array.isArray(rawDefault) ? rawDefault : [rawDefault];
      if (this.recognition.isStringArray(type)) {
        return arr.map((v) => String(v));
      }
      if (this.recognition.isIntArray(type)) {
        return arr.map((v) => Number(v));
      }
      return arr;
    }
    if (this.recognition.isGeoSpatialPoint(type)) {
      return this.normalizeGeospatialPointForForm(rawDefault);
    }
    return rawDefault;
  }

  /** Returns primitive arrays for Kendo MultiSelect (valuePrimitive: true). */
  private parseArrayType(type: string, value: unknown): string[] | number[] {
    if (this.recognition.isStringArray(type)) {
      const source =
        this.isRecordValue(value) && "_v" in value ? value["_v"] : value;
      if (!Array.isArray(source)) return [];
      return source.map((v) =>
        this.isRecordValue(v) && "key" in v ? String(v["key"]) : String(v),
      );
    }
    if (this.recognition.isIntArray(type)) {
      const source =
        this.isRecordValue(value) && "_v" in value ? value["_v"] : value; // Handle _v wrapper format from upstream
      if (!Array.isArray(source)) return [];
      return source.map((v) =>
        this.isRecordValue(v) && "key" in v ? Number(v["key"]) : Number(v),
      );
    }
    return [];
  }

  private getId(attr: CkAttributeMetadata | Attribute): Attribute["id"] {
    if (!this.isCkAttributeMetadata(attr)) {
      return attr.id;
    }
    if (this.isEnum(attr)) {
      return {
        ckId: attr.attribute?.ckEnum?.ckEnumId?.fullName ?? "",

        rtId: null,
      };
    } else if (this.isRecord(attr) || this.isRecordArray(attr)) {
      return {
        ckId: attr.attribute?.ckRecord?.ckRecordId?.fullName ?? "",

        rtId: null,
      };
    } else {
      return {
        ckId: attr.ckAttributeId?.fullName ?? "",

        rtId: null,
      };
    }
  }
  private getEnumOptions(
    attr: CkAttributeMetadata | Attribute,
  ): AttributeEnumOption[] {
    if (attr?.enumOptions) {
      return attr.enumOptions;
    }
    if (this.isCkAttributeMetadata(attr) && attr.attribute?.ckEnum) {
      return (
        attr.attribute.ckEnum.values?.map((v: AttributeEnumOption | null) => ({
          key: v?.key ?? null,
          name: v?.name ?? null,
        })) ?? []
      );
    }
    return [];
  }
}
