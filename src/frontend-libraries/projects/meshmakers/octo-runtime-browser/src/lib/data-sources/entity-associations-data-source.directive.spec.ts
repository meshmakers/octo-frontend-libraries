import { TestBed } from '@angular/core/testing';
import { FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { of } from 'rxjs';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../graphQL/getRuntimeEntityAssociationsById';
import { GraphDirectionDto } from '../graphQL/globalTypes';
import {
  AssociationDisplayItem,
  EntityAssociationsDataSourceDirective,
} from './entity-associations-data-source.directive';

describe('EntityAssociationsDataSourceDirective', () => {
  let directive: EntityAssociationsDataSourceDirective;

  const mockListViewComponent = {
    pageSize: 20,
    skip: 0,
  };

  const mockAssociations = [
    {
      targetRtId: 'target-1',
      targetCkTypeId: 'TargetType',
      originRtId: 'entity-1',
      originCkTypeId: 'OriginType',
      ckAssociationRoleId: 'role-1',
    },
    {
      targetRtId: 'entity-1',
      targetCkTypeId: 'OriginType',
      originRtId: 'origin-2',
      originCkTypeId: 'OtherType',
      ckAssociationRoleId: 'role-2',
    },
  ];

  const mockGQLResponse = {
    data: {
      runtime: {
        runtimeEntities: {
          items: [
            {
              rtId: 'entity-1',
              associations: {
                definitions: {
                  items: mockAssociations,
                  totalCount: 2,
                },
              },
            },
          ],
        },
      },
    },
  };

  const mockGetAssociationsGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockGQLResponse)),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        EntityAssociationsDataSourceDirective,
        { provide: ListViewComponent, useValue: mockListViewComponent },
        {
          provide: GetRuntimeEntityAssociationsByIdDtoGQL,
          useValue: mockGetAssociationsGQL,
        },
      ],
    }).compileComponents();

    directive = TestBed.inject(EntityAssociationsDataSourceDirective);
  });

  afterEach(() => {
    mockGetAssociationsGQL.fetch.calls.reset();
    mockGetAssociationsGQL.fetch.and.returnValue(of(mockGQLResponse));
  });

  it('should be created', () => {
    expect(directive).toBeTruthy();
  });

  describe('fetchData without entity set', () => {
    it('should return empty result when entity is not set', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result?.data.length).toBe(0);
        expect(result?.totalCount).toBe(0);
        expect(mockGetAssociationsGQL.fetch).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('fetchData with entity set', () => {
    beforeEach(() => {
      directive.setEntityId('entity-1', 'OriginType');
      mockGetAssociationsGQL.fetch.calls.reset();
    });

    it('should fetch associations and return typed result', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result).toBeTruthy();
        expect(result?.data.length).toBe(2);
        expect(result?.totalCount).toBe(2);
        done();
      });
    });

    it('should determine outbound direction correctly', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        const items = result?.data as AssociationDisplayItem[];
        // First association: originRtId === entity-1 -> Outbound
        expect(items[0].direction).toBe('Outbound');
        expect(items[0].relatedRtId).toBe('target-1');
        expect(items[0].relatedCkTypeId).toBe('TargetType');
        done();
      });
    });

    it('should determine inbound direction correctly', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        const items = result?.data as AssociationDisplayItem[];
        // Second association: originRtId !== entity-1 -> Inbound
        expect(items[1].direction).toBe('Inbound');
        expect(items[1].relatedRtId).toBe('origin-2');
        expect(items[1].relatedCkTypeId).toBe('OtherType');
        done();
      });
    });

    it('should call GraphQL with correct variables', (done) => {
      const options: FetchDataOptions = {
        state: { take: 10, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        expect(mockGetAssociationsGQL.fetch).toHaveBeenCalled();
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.rtId).toBe('entity-1');
        expect(callArgs.variables.ckTypeId).toBe('OriginType');
        expect(callArgs.variables.direction).toBe(GraphDirectionDto.AnyDto);
        expect(callArgs.variables.first).toBe(10);
        done();
      });
    });

    it('should use cache-first policy by default', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.fetchPolicy).toBe('cache-first');
        done();
      });
    });

    it('should use network-only policy when forceRefresh is true', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
        forceRefresh: true,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.fetchPolicy).toBe('network-only');
        done();
      });
    });

    it('should handle empty result', (done) => {
      mockGetAssociationsGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [
                  {
                    rtId: 'entity-1',
                    associations: {
                      definitions: {
                        items: [],
                        totalCount: 0,
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      );

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result?.data.length).toBe(0);
        expect(result?.totalCount).toBe(0);
        done();
      });
    });

    it('should handle null items in response', (done) => {
      mockGetAssociationsGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [
                  {
                    rtId: 'entity-1',
                    associations: {
                      definitions: {
                        items: [mockAssociations[0], null, mockAssociations[1]],
                        totalCount: 2,
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      );

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result?.data.length).toBe(2);
        done();
      });
    });
  });

  describe('filter setters', () => {
    beforeEach(() => {
      directive.setEntityId('entity-1', 'OriginType');
      mockGetAssociationsGQL.fetch.calls.reset();
    });

    it('should set direction filter', (done) => {
      directive.setDirection(GraphDirectionDto.OutboundDto);

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.direction).toBe(
          GraphDirectionDto.OutboundDto,
        );
        done();
      });
    });

    it('should set role filter', (done) => {
      directive.setRoleId('specific-role');

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.roleId).toBe('specific-role');
        done();
      });
    });

    it('should set relatedRtCkId filter', (done) => {
      directive.setRelatedRtCkId('RelatedType');

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.relatedRtCkId).toBe('RelatedType');
        done();
      });
    });

    it('should set relatedRtId filter', (done) => {
      directive.setRelatedRtId('specific-entity');

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetAssociationsGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.relatedRtId).toBe('specific-entity');
        done();
      });
    });
  });
});
