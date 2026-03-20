import { TestBed } from '@angular/core/testing';
import { FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { of } from 'rxjs';
import { GetRuntimeEntitiesByTypeDtoGQL } from '../../graphQL/getRuntimeEntitiesByType';
import { RtEntityDto } from '../../graphQL/globalTypes';
import { CkTypeEntitiesDataSourceDirective } from './ck-type-entities-data-source.directive';

describe('CkTypeEntitiesDataSourceDirective', () => {
  let directive: CkTypeEntitiesDataSourceDirective;

  const mockListViewComponent = {
    pageSize: 20,
    skip: 0,
  };

  const mockEntities = [
    {
      rtId: 'entity-1',
      ckTypeId: 'TestType',
      rtWellKnownName: 'test-entity-1',
      rtCreationDateTime: '2024-01-01T00:00:00Z',
      rtChangedDateTime: '2024-01-02T00:00:00Z',
    },
    {
      rtId: 'entity-2',
      ckTypeId: 'TestType',
      rtWellKnownName: 'test-entity-2',
      rtCreationDateTime: '2024-01-03T00:00:00Z',
      rtChangedDateTime: '2024-01-04T00:00:00Z',
    },
  ];

  const mockGQLResponse = {
    data: {
      runtime: {
        runtimeEntities: {
          items: mockEntities,
          totalCount: 2,
          pageInfo: {
            hasNextPage: false,
            endCursor: 'cursor-2',
          },
        },
      },
    },
  };

  const mockGetRuntimeEntitiesGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockGQLResponse)),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        CkTypeEntitiesDataSourceDirective,
        { provide: ListViewComponent, useValue: mockListViewComponent },
        {
          provide: GetRuntimeEntitiesByTypeDtoGQL,
          useValue: mockGetRuntimeEntitiesGQL,
        },
      ],
    }).compileComponents();

    directive = TestBed.inject(CkTypeEntitiesDataSourceDirective);
  });

  afterEach(() => {
    mockGetRuntimeEntitiesGQL.fetch.calls.reset();
    mockGetRuntimeEntitiesGQL.fetch.and.returnValue(of(mockGQLResponse));
  });

  it('should be created', () => {
    expect(directive).toBeTruthy();
  });

  describe('fetchData without ckTypeId', () => {
    it('should return empty result when ckTypeId is not set', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result?.data.length).toBe(0);
        expect(result?.totalCount).toBe(0);
        expect(mockGetRuntimeEntitiesGQL.fetch).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('fetchData with ckTypeId', () => {
    beforeEach(() => {
      directive.setRtCkTypeId('TestType');
      mockGetRuntimeEntitiesGQL.fetch.calls.reset();
    });

    it('should fetch entities and return typed result', (done) => {
      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe((result) => {
        expect(result).toBeTruthy();
        expect(result?.data.length).toBe(2);
        expect(result?.totalCount).toBe(2);
        const first = result?.data[0] as RtEntityDto;
        const second = result?.data[1] as RtEntityDto;
        expect(first.rtId).toBe('entity-1');
        expect(first.ckTypeId).toBe('TestType');
        expect(second.rtId).toBe('entity-2');
        done();
      });
    });

    it('should call GraphQL with correct ckTypeId', (done) => {
      const options: FetchDataOptions = {
        state: { take: 10, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        expect(mockGetRuntimeEntitiesGQL.fetch).toHaveBeenCalled();
        const callArgs =
          mockGetRuntimeEntitiesGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.ckTypeId).toBe('TestType');
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
          mockGetRuntimeEntitiesGQL.fetch.calls.mostRecent().args[0];
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
          mockGetRuntimeEntitiesGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.fetchPolicy).toBe('network-only');
        done();
      });
    });

    it('should include sort definitions when sorting is applied', (done) => {
      const options: FetchDataOptions = {
        state: {
          take: 20,
          skip: 0,
          sort: [{ field: 'rtWellKnownName', dir: 'asc' }],
        },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetRuntimeEntitiesGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.sort).toBeTruthy();
        expect(callArgs.variables.sort.length).toBe(1);
        done();
      });
    });

    it('should handle empty result', (done) => {
      mockGetRuntimeEntitiesGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [],
                totalCount: 0,
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
      mockGetRuntimeEntitiesGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [mockEntities[0], null, mockEntities[1]],
                totalCount: 2,
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

  describe('setRtCkTypeId', () => {
    it('should update ckTypeId and allow fetching', (done) => {
      directive.setRtCkTypeId('NewType');
      mockGetRuntimeEntitiesGQL.fetch.calls.reset();

      const options: FetchDataOptions = {
        state: { take: 20, skip: 0 },
        textSearch: null,
      };

      directive.fetchData(options).subscribe(() => {
        const callArgs =
          mockGetRuntimeEntitiesGQL.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.ckTypeId).toBe('NewType');
        done();
      });
    });
  });
});
