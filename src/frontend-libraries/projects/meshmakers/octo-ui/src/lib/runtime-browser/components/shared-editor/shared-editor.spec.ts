import { TestBed } from "@angular/core/testing";
import { RtEntityInputDto, RtEntityUpdateDto } from "@meshmakers/octo-services";
import { NotificationService } from "@progress/kendo-angular-notification";
import { SharedEditor } from "./shared-editor";

/**
 * Verifies that multipart context is enabled exactly when a File appears anywhere in the payload —
 * including deeply nested positions inside RECORD / RECORD_ARRAY values. Top-level-only detection
 * was the root cause of the original ASSET1002 bug for nested binary attributes.
 */
describe("SharedEditor", () => {
  let service: SharedEditor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SharedEditor,
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj("NotificationService", ["show"]),
        },
      ],
    });
    service = TestBed.inject(SharedEditor);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("prepareMutationOptions", () => {
    it("does not enable multipart when no File is present", () => {
      const entity: RtEntityInputDto = {
        ckTypeId: "Foo/Bar",
        attributes: [{ attributeName: "name", value: "x" }],
      };
      const options = service.prepareMutationOptions(entity);
      expect(options.variables.entities).toEqual([entity]);
      expect(options.context).toBeUndefined();
    });

    it("enables multipart for a File at top-level attribute value", () => {
      const file = new File([], "x.bin");
      const entity: RtEntityInputDto = {
        ckTypeId: "Foo/Bar",
        attributes: [{ attributeName: "doc", value: file }],
      };
      const options = service.prepareMutationOptions(entity);
      expect(options.context).toEqual({ useMultipart: true });
    });

    it("enables multipart for a File nested inside a RECORD value", () => {
      const file = new File([], "spec.pdf");
      const entity: RtEntityInputDto = {
        ckTypeId: "Foo/Bar",
        attributes: [
          {
            attributeName: "namePlate",
            value: { manufacturerName: "X", datasheet: file },
          },
        ],
      };
      const options = service.prepareMutationOptions(entity);
      expect(options.context).toEqual({ useMultipart: true });
    });

    it("enables multipart for a File nested inside a RECORD_ARRAY value", () => {
      const file = new File([], "marking.png");
      const entity: RtEntityInputDto = {
        ckTypeId: "Foo/Bar",
        attributes: [
          {
            attributeName: "markings",
            value: [{ name: "Logo", file }],
          },
        ],
      };
      const options = service.prepareMutationOptions(entity);
      expect(options.context).toEqual({ useMultipart: true });
    });
  });

  describe("prepareUpdateMutationOptions", () => {
    it("enables multipart when any entity contains a nested File", () => {
      const file = new File([], "x.bin");
      const entities: RtEntityUpdateDto[] = [
        {
          rtId: "abc",
          item: {
            ckTypeId: "Foo/Bar",
            attributes: [
              {
                attributeName: "wrapper",
                value: { inner: { deeper: file } },
              },
            ],
          },
        },
      ];
      const options = service.prepareUpdateMutationOptions(entities);
      expect(options.context).toEqual({ useMultipart: true });
    });
  });
});
