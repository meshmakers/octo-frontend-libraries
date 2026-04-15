import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";
import { Attribute } from "../models/attribute";
import { CkAttributeMetadata } from "../models/attribute-metadata";
import {
  AttributeMapperService,
  BINARY_LINKED_REFERENCE_FLAG,
} from "./attribute-mapper.service";
import { AttributeMetadataResolverService } from "./attribute-metadata-resolver.service";

/**
 * Focused on the mutation-mapping path (form → GraphQL): top-level handling, empty / optional rules,
 * type conversion (BINARY, GEO, TIME_SPAN), and recursive RECORD / RECORD_ARRAY mapping including the
 * resolver-failure fallback. Reading-side parsing (parseInitialValue) is exercised indirectly by
 * the attributes-group component tests.
 */
describe("AttributeMapperService", () => {
  let service: AttributeMapperService;
  let resolverSpy: jasmine.SpyObj<AttributeMetadataResolverService>;

  /** Builds a top-level Attribute matching what AttributeDataService produces for the form. */
  function attr(
    name: string,
    type: string,
    optional = false,
    ckId = "",
  ): Attribute {
    return {
      id: { ckId, rtId: null },
      attributeName: name,
      attributeValueType: type,
      isOptional: optional,
      enumOptions: [],
      value: undefined,
    };
  }

  /** Builds a raw CkAttributeMetadata as returned by AttributeMetadataResolverService for a record. */
  function ckMeta(
    name: string,
    type: string,
    optional = false,
    ckAttributeFullName?: string,
  ): CkAttributeMetadata {
    return {
      attributeName: name,
      attributeValueType: type,
      isOptional: optional,
      ckAttributeId: ckAttributeFullName
        ? { fullName: ckAttributeFullName }
        : null,
      attribute: null,
    };
  }

  beforeEach(() => {
    resolverSpy = jasmine.createSpyObj<AttributeMetadataResolverService>(
      "AttributeMetadataResolverService",
      ["getRawAttributes$"],
    );

    TestBed.configureTestingModule({
      providers: [
        AttributeMapperService,
        { provide: AttributeMetadataResolverService, useValue: resolverSpy },
      ],
    });
    service = TestBed.inject(AttributeMapperService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("mapFormValueToGraphQLAttributes — top-level", () => {
    it("returns empty array when form value is not an object", async () => {
      expect(await service.mapFormValueToGraphQLAttributes(null, [])).toEqual(
        [],
      );
      expect(await service.mapFormValueToGraphQLAttributes("oops", [])).toEqual(
        [],
      );
    });

    it("emits scalar attributes verbatim when value is present", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { name: "Acme", count: 3 },
        [attr("name", "STRING"), attr("count", "INTEGER")],
      );
      expect(result).toEqual([
        { attributeName: "name", value: "Acme" },
        { attributeName: "count", value: 3 },
      ]);
    });

    it("skips required scalar when value is null/undefined", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { name: null, count: undefined },
        [attr("name", "STRING"), attr("count", "INTEGER")],
      );
      expect(result).toEqual([]);
    });

    it("emits explicit null for optional scalar that was cleared", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { description: null },
        [attr("description", "STRING", true)],
      );
      expect(result).toEqual([{ attributeName: "description", value: null }]);
    });

    it("converts GEOSPATIAL_POINT to GeoJSON shape", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { location: { longitude: 19.94, latitude: 50.06 } },
        [attr("location", "GEOSPATIAL_POINT")],
      );
      expect(result).toEqual([
        {
          attributeName: "location",
          value: { type: "Point", coordinates: [19.94, 50.06] },
        },
      ]);
    });

    it("converts TIME_SPAN Date to total seconds", async () => {
      const time = new Date(0);
      time.setHours(1, 2, 3); // 1h 2m 3s = 3723s
      const result = await service.mapFormValueToGraphQLAttributes(
        { duration: time },
        [attr("duration", "TIME_SPAN")],
      );
      expect(result).toEqual([{ attributeName: "duration", value: 3723 }]);
    });

    it("normalizes INTEGER_ARRAY values from {key} wrappers to primitives", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { codes: [{ key: 1 }, { key: "2" }, 3] },
        [attr("codes", "INTEGER_ARRAY")],
      );
      expect(result).toEqual([{ attributeName: "codes", value: [1, 2, 3] }]);
    });
  });

  describe("BINARY / BINARY_LINKED handling", () => {
    it("converts BINARY File to a byte array", async () => {
      const file = new File([new Uint8Array([1, 2, 3])], "x.bin", {
        type: "application/octet-stream",
      });
      const result = await service.mapFormValueToGraphQLAttributes(
        { payload: [file] },
        [attr("payload", "BINARY")],
      );
      expect(result.length).toBe(1);
      expect(result[0].attributeName).toBe("payload");
      expect(result[0].value).toEqual([1, 2, 3]);
    });

    it("preserves BINARY_LINKED File as-is (multipart upload path)", async () => {
      const file = new File([new Uint8Array([9])], "doc.pdf", {
        type: "application/pdf",
      });
      const result = await service.mapFormValueToGraphQLAttributes(
        { document: [file] },
        [attr("document", "BINARY_LINKED")],
      );
      expect(result).toEqual([{ attributeName: "document", value: file }]);
    });

    it("skips synthetic BINARY_LINKED reference Files (no re-upload)", async () => {
      const reference = new File([], "preview.bin");
      (reference as unknown as Record<string, unknown>)[
        BINARY_LINKED_REFERENCE_FLAG
      ] = true;
      const result = await service.mapFormValueToGraphQLAttributes(
        { document: [reference] },
        [attr("document", "BINARY_LINKED")],
      );
      expect(result).toEqual([]);
    });

    it("emits null for cleared BINARY_LINKED so the backend detaches the link", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { document: [] },
        [attr("document", "BINARY_LINKED")],
      );
      expect(result).toEqual([{ attributeName: "document", value: null }]);
    });

    it("throws on malformed BINARY_LINKED base64 instead of silently nulling the value", async () => {
      spyOn(console, "error");
      // A non-base64 string must surface as an error, not a silent null that the backend
      // could interpret as "detach the link".
      await expectAsync(
        service.mapFormValueToGraphQLAttributes(
          { document: "###not-base64###" },
          [attr("document", "BINARY_LINKED")],
        ),
      ).toBeRejectedWithError(/BINARY_LINKED/);
    });
  });

  describe("RECORD / RECORD_ARRAY recursive mapping", () => {
    it("emits a flat object for RECORD value (not the {attributes:[…]} wrapper)", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        of([
          ckMeta("street", "STRING"),
          ckMeta("zipcode", "INTEGER"),
        ] as CkAttributeMetadata[]),
      );

      const result = await service.mapFormValueToGraphQLAttributes(
        { address: { street: "Main", zipcode: 1 } },
        [attr("address", "RECORD", false, "Basic/Address-1")],
      );

      expect(resolverSpy.getRawAttributes$).toHaveBeenCalledWith(
        "Basic/Address-1",
        true,
      );
      expect(result).toEqual([
        {
          attributeName: "address",
          value: { street: "Main", zipcode: 1 },
        },
      ]);
    });

    it("applies type conversion to nested attributes inside a RECORD", async () => {
      // address has a nested phone (RECORD) and a binary attachment (BINARY).
      resolverSpy.getRawAttributes$.and.callFake(
        (recordCkId: string, isRecord: boolean) => {
          expect(isRecord).toBeTrue();
          if (recordCkId === "Basic/Address-1") {
            return of([
              ckMeta("attachment", "BINARY"),
              ckMeta("location", "GEOSPATIAL_POINT"),
            ] as CkAttributeMetadata[]);
          }
          return of([] as CkAttributeMetadata[]);
        },
      );

      const file = new File([new Uint8Array([7, 8])], "a.bin");
      const result = await service.mapFormValueToGraphQLAttributes(
        {
          address: {
            attachment: [file],
            location: { longitude: 1, latitude: 2 },
          },
        },
        [attr("address", "RECORD", false, "Basic/Address-1")],
      );

      expect(result.length).toBe(1);
      expect(result[0].attributeName).toBe("address");
      expect(result[0].value).toEqual({
        attachment: [7, 8],
        location: { type: "Point", coordinates: [1, 2] },
      });
    });

    it("emits an array of flat objects for RECORD_ARRAY value", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        of([ckMeta("name", "STRING")] as CkAttributeMetadata[]),
      );

      const result = await service.mapFormValueToGraphQLAttributes(
        { tags: [{ name: "a" }, { name: "b" }] },
        [attr("tags", "RECORD_ARRAY", false, "Basic/Tag-1")],
      );

      expect(result).toEqual([
        { attributeName: "tags", value: [{ name: "a" }, { name: "b" }] },
      ]);
    });

    it("preserves camelCase sub-attribute names on the wire", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        of([
          ckMeta("manufacturerName", "STRING"),
          ckMeta("vATnumber", "STRING"),
        ] as CkAttributeMetadata[]),
      );

      const result = await service.mapFormValueToGraphQLAttributes(
        { namePlate: { manufacturerName: "X", vATnumber: "PL000" } },
        [attr("namePlate", "RECORD", false, "Basic/NamePlate-1")],
      );

      expect(result[0].value).toEqual({
        manufacturerName: "X",
        vATnumber: "PL000",
      });
    });

    it("falls back to empty sub-metadata when resolver throws (no crash, sub-values pass through)", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        throwError(() => new Error("network down")),
      );
      spyOn(console, "error"); // suppress expected error log

      const result = await service.mapFormValueToGraphQLAttributes(
        { address: { street: "Main" } },
        [attr("address", "RECORD", false, "Basic/Address-1")],
      );

      // Without sub-metadata each entry is treated as scalar with metadata=undefined → value passes through.
      expect(result).toEqual([
        { attributeName: "address", value: { street: "Main" } },
      ]);
      expect(console.error).toHaveBeenCalled();
    });

    it("passes record values through verbatim when recordCkId is missing", async () => {
      const result = await service.mapFormValueToGraphQLAttributes(
        { address: { street: "Main" } },
        [attr("address", "RECORD", false, "")],
      );
      // No metadata available → preserve user values as-is so data is not silently dropped.
      expect(result).toEqual([
        { attributeName: "address", value: { street: "Main" } },
      ]);
      expect(resolverSpy.getRawAttributes$).not.toHaveBeenCalled();
    });

    it("preserves explicit null sub-values in pass-through mode (cleared nested fields)", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        throwError(() => new Error("network down")),
      );
      spyOn(console, "error");

      const result = await service.mapFormValueToGraphQLAttributes(
        { address: { street: null, city: "Berlin" } },
        [attr("address", "RECORD", false, "Basic/Address-1")],
      );

      // Pass-through must preserve nulls so cleared nested fields reach the backend.
      expect(result).toEqual([
        {
          attributeName: "address",
          value: { street: null, city: "Berlin" },
        },
      ]);
    });

    it("resolves sub-metadata once for RECORD_ARRAY (shared across items)", async () => {
      resolverSpy.getRawAttributes$.and.returnValue(
        of([
          {
            attributeName: "qty",
            attributeValueType: "INTEGER",
            isOptional: false,
          } as unknown as CkAttributeMetadata,
        ]),
      );

      await service.mapFormValueToGraphQLAttributes(
        { lines: [{ qty: 1 }, { qty: 2 }, { qty: 3 }] },
        [attr("lines", "RECORD_ARRAY", false, "Basic/OrderLine-1")],
      );

      expect(resolverSpy.getRawAttributes$).toHaveBeenCalledTimes(1);
    });
  });
});
