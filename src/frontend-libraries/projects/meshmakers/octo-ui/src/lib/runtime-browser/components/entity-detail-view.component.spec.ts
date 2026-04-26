import { SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync } from "@angular/core/testing";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { PropertyConverterService } from "../../property-grid";
import { SelectEvent } from "@progress/kendo-angular-layout";
import { NotificationService } from "@progress/kendo-angular-notification";
import { of } from "rxjs";
import { GetBinaryInfoDtoGQL } from "../../graphQL/getBinaryInfo";
import { RtEntityDto } from "../../graphQL/globalTypes";
import { AttributeValueTypeDto, PropertyGridItem } from "../../property-grid";
import { EntityDetailViewComponent } from "./entity-detail-view.component";

describe("EntityDetailViewComponent", () => {
  let component: EntityDetailViewComponent;
  let fixture: ComponentFixture<EntityDetailViewComponent>;

  const mockNotificationService = {
    show: jasmine.createSpy("show"),
  };

  const mockPropertyConverterService = {
    convertRtEntityToProperties: jasmine
      .createSpy("convertRtEntityToProperties")
      .and.returnValue(of([])),
  };

  const mockGetBinaryInfoGQL = {
    fetch: jasmine.createSpy("fetch").and.returnValue(of({ data: null })),
  };

  const createMockEntity = (overrides?: Partial<RtEntityDto>): RtEntityDto =>
    ({
      rtId: "test-entity-123",
      ckTypeId: "TestNamespace/TestType",
      rtWellKnownName: "TestEntity",
      rtCreationDateTime: "2024-01-01T00:00:00Z",
      rtChangedDateTime: "2024-01-02T00:00:00Z",
      attributes: { items: [] },
      ...overrides,
    }) as RtEntityDto;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideAnimationsAsync(),
        { provide: NotificationService, useValue: mockNotificationService },
        {
          provide: PropertyConverterService,
          useValue: mockPropertyConverterService,
        },
        { provide: GetBinaryInfoDtoGQL, useValue: mockGetBinaryInfoGQL },
      ],
      imports: [EntityDetailViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntityDetailViewComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    mockNotificationService.show.calls.reset();
    mockPropertyConverterService.convertRtEntityToProperties.calls.reset();
    mockGetBinaryInfoGQL.fetch.calls.reset();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("getEntityIdentifier", () => {
    it("should return formatted identifier when entity is set", () => {
      component.entity = createMockEntity();
      expect(component.getEntityIdentifier()).toBe(
        "TestNamespace/TestType@test-entity-123",
      );
    });

    it('should return "Unknown" when entity is null', () => {
      component.entity = null;
      expect(component.getEntityIdentifier()).toBe("Unknown");
    });

    it('should return "Unknown" when entity has no ckTypeId', () => {
      component.entity = createMockEntity({
        ckTypeId: undefined as unknown as string,
      });
      expect(component.getEntityIdentifier()).toBe("Unknown");
    });
  });

  describe("getPropertyCount", () => {
    it("should return 0 when no properties", () => {
      expect(component.getPropertyCount()).toBe(0);
    });

    it("should return correct count when properties exist", () => {
      component.propertyGridItems = [
        {
          id: "prop1",
          name: "prop1",
          value: "val1",
          type: AttributeValueTypeDto.StringDto,
        },
        {
          id: "prop2",
          name: "prop2",
          value: "val2",
          type: AttributeValueTypeDto.StringDto,
        },
      ] as PropertyGridItem[];
      expect(component.getPropertyCount()).toBe(2);
    });
  });

  describe("getAssociationCount", () => {
    it("should return 0 when entity is null", () => {
      component.entity = null;
      expect(component.getAssociationCount()).toBe(0);
    });

    it("should return 0 when entity has no associations", () => {
      component.entity = createMockEntity();
      expect(component.getAssociationCount()).toBe(0);
    });

    it("should return 0 when associations.definitions is undefined", () => {
      component.entity = createMockEntity({
        associations: {} as RtEntityDto["associations"],
      });
      expect(component.getAssociationCount()).toBe(0);
    });

    it("should return correct count when entity has associations", () => {
      component.entity = createMockEntity({
        associations: {
          definitions: {
            totalCount: 5,
          },
        } as RtEntityDto["associations"],
      });
      expect(component.getAssociationCount()).toBe(5);
    });

    it("should return correct count for large number of associations", () => {
      component.entity = createMockEntity({
        associations: {
          definitions: {
            totalCount: 1234,
          },
        } as RtEntityDto["associations"],
      });
      expect(component.getAssociationCount()).toBe(1234);
    });
  });

  describe("onTabSelect - Associations tab loading", () => {
    beforeEach(() => {
      component.entity = createMockEntity();
      fixture.detectChanges();
    });

    it("should load associations when Associations tab is selected", fakeAsync(() => {
      const loadAssociationsSpy = spyOn(
        component as unknown as { loadAssociations: () => void },
        "loadAssociations",
      ).and.callThrough();

      // Select Associations tab (index 1)
      component["onTabSelect"]({ index: 1 } as SelectEvent);

      expect(loadAssociationsSpy).toHaveBeenCalledTimes(1);
    }));

    it("should load associations every time Associations tab is selected (regression test for disappearing data)", fakeAsync(() => {
      const loadAssociationsSpy = spyOn(
        component as unknown as { loadAssociations: () => void },
        "loadAssociations",
      ).and.callThrough();

      // First selection of Associations tab
      component["onTabSelect"]({ index: 1 } as SelectEvent);
      expect(loadAssociationsSpy).toHaveBeenCalledTimes(1);

      // Switch to Attributes tab
      component["onTabSelect"]({ index: 0 } as SelectEvent);
      expect(loadAssociationsSpy).toHaveBeenCalledTimes(1); // Should not increase

      // Second selection of Associations tab - THIS MUST LOAD AGAIN
      component["onTabSelect"]({ index: 1 } as SelectEvent);
      expect(loadAssociationsSpy).toHaveBeenCalledTimes(2);

      // Third selection
      component["onTabSelect"]({ index: 1 } as SelectEvent);
      expect(loadAssociationsSpy).toHaveBeenCalledTimes(3);
    }));

    it("should not load associations when Attributes tab is selected", fakeAsync(() => {
      const loadAssociationsSpy = spyOn(
        component as unknown as { loadAssociations: () => void },
        "loadAssociations",
      ).and.callThrough();

      // Select Attributes tab (index 0)
      component["onTabSelect"]({ index: 0 } as SelectEvent);

      expect(loadAssociationsSpy).not.toHaveBeenCalled();
    }));
  });

  describe("hasProperties", () => {
    it("should return false when no properties", () => {
      component.propertyGridItems = [];
      expect(component.hasProperties()).toBeFalse();
    });

    it("should return true when properties exist", () => {
      component.propertyGridItems = [
        {
          id: "test",
          name: "test",
          value: "val",
          type: AttributeValueTypeDto.StringDto,
        },
      ] as PropertyGridItem[];
      expect(component.hasProperties()).toBeTrue();
    });
  });

  describe("ngOnChanges", () => {
    it("should update property grid when entity changes", () => {
      const entity = createMockEntity();
      component.entity = entity;

      component.ngOnChanges({
        entity: new SimpleChange(null, entity, true),
      });

      expect(
        mockPropertyConverterService.convertRtEntityToProperties,
      ).toHaveBeenCalledWith(
        jasmine.objectContaining({
          rtId: entity.rtId,
          ckTypeId: entity.ckTypeId,
        }),
      );
    });

    it("should not update property grid when entity is null", () => {
      component.entity = null;

      component.ngOnChanges({
        entity: new SimpleChange(createMockEntity(), null, false),
      });

      // Should not be called because entity is null
      expect(
        mockPropertyConverterService.convertRtEntityToProperties,
      ).not.toHaveBeenCalled();
    });
  });
});

