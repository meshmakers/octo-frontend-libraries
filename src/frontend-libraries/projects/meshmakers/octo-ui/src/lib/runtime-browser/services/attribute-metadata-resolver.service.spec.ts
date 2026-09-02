import type { MockedObject } from "vitest";
import { TestBed } from "@angular/core/testing";
import { firstValueFrom, of, throwError } from "rxjs";
import { GetCkAttributesDetailedDtoGQL } from "../../graphQL/getCkAttributesDetailed";
import { GetCkRecordDetailedDtoGQL } from "../../graphQL/getCkRecordDetailed";
import { AttributeMetadataResolverService } from "./attribute-metadata-resolver.service";

describe("AttributeMetadataResolverService", () => {
    let service: AttributeMetadataResolverService;
    let typesGqlSpy: MockedObject<GetCkAttributesDetailedDtoGQL>;
    let recordGqlSpy: MockedObject<GetCkRecordDetailedDtoGQL>;

    beforeEach(() => {
        typesGqlSpy = {
            fetch: vi.fn().mockName("GetCkAttributesDetailedDtoGQL.fetch")
        };
        recordGqlSpy = {
            fetch: vi.fn().mockName("GetCkRecordDetailedDtoGQL.fetch")
        };

        TestBed.configureTestingModule({
            providers: [
                AttributeMetadataResolverService,
                { provide: GetCkAttributesDetailedDtoGQL, useValue: typesGqlSpy },
                { provide: GetCkRecordDetailedDtoGQL, useValue: recordGqlSpy },
            ],
        });
        service = TestBed.inject(AttributeMetadataResolverService);
    });

    it("returns empty array when ckId is missing without hitting GraphQL", async () => {
        const result = await firstValueFrom(service.getRawAttributes$(""));
        expect(result).toEqual([]);
        expect(typesGqlSpy.fetch).not.toHaveBeenCalled();
        expect(recordGqlSpy.fetch).not.toHaveBeenCalled();
    });

    it("dispatches to types GQL for CK Type lookup (isRecord=false)", async () => {
        typesGqlSpy.fetch.mockReturnValue(of({
            data: {
                constructionKit: {
                    types: {
                        items: [
                            {
                                attributes: {
                                    items: [
                                        {
                                            attributeName: "name",
                                            attributeValueType: "STRING",
                                            isOptional: false,
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            },
        }) as never);

        const result = await firstValueFrom(service.getRawAttributes$("Foo/Bar", false));
        expect(typesGqlSpy.fetch).toHaveBeenCalledWith({
            variables: { ckId: "Foo/Bar" },
        });
        expect(recordGqlSpy.fetch).not.toHaveBeenCalled();
        expect(result.length).toBe(1);
        expect(result[0].attributeName).toBe("name");
    });

    it("dispatches to record GQL for CK Record lookup (isRecord=true)", async () => {
        recordGqlSpy.fetch.mockReturnValue(of({
            data: {
                constructionKit: {
                    records: {
                        items: [
                            {
                                attributes: {
                                    items: [
                                        {
                                            attributeName: "street",
                                            attributeValueType: "STRING",
                                            isOptional: true,
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            },
        }) as never);

        const result = await firstValueFrom(service.getRawAttributes$("Basic/Address-1", true));
        expect(recordGqlSpy.fetch).toHaveBeenCalledWith({
            variables: { ckId: "Basic/Address-1" },
        });
        expect(typesGqlSpy.fetch).not.toHaveBeenCalled();
        expect(result.length).toBe(1);
        expect(result[0].attributeName).toBe("street");
    });

    it("swallows GraphQL errors and emits an empty array (mapper relies on this fallback)", async () => {
        typesGqlSpy.fetch.mockReturnValue(throwError(() => new Error("boom")) as never);
        vi.spyOn(console, "error").mockReturnValue(undefined);

        const result = await firstValueFrom(service.getRawAttributes$("Foo/Bar"));
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
    });
});
