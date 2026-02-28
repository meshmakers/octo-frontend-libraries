import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { CkTypeSelectorService } from './ck-type-selector.service';
import { GetCkTypesDtoGQL, GetCkTypesQueryDto } from '../graphQL/getCkTypes';
import { GetCkTypeByRtCkTypeIdDtoGQL, GetCkTypeByRtCkTypeIdQueryDto } from '../graphQL/getCkTypeByRtCkTypeId';
import { GetDerivedCkTypesDtoGQL } from '../graphQL/getDerivedCkTypes';

type MockCkTypesResult = Apollo.QueryResult<GetCkTypesQueryDto>;
type MockCkTypeByIdResult = Apollo.QueryResult<GetCkTypeByRtCkTypeIdQueryDto>;

describe('CkTypeSelectorService', () => {
  let service: CkTypeSelectorService;
  let getCkTypesGQLMock: jasmine.SpyObj<GetCkTypesDtoGQL>;
  let getCkTypeByRtCkTypeIdGQLMock: jasmine.SpyObj<GetCkTypeByRtCkTypeIdDtoGQL>;
  let getDerivedCkTypesGQLMock: jasmine.SpyObj<GetDerivedCkTypesDtoGQL>;

  const mockCkTypeItem = {
    __typename: 'CkType' as const,
    ckTypeId: { __typename: 'CkTypeId' as const, fullName: 'TestModel-1.0.0/Customer-1' },
    rtCkTypeId: 'TestModel/Customer',
    isAbstract: false,
    isFinal: true,
    description: 'Test customer type',
    baseType: {
      __typename: 'CkType' as const,
      ckTypeId: { __typename: 'CkTypeId' as const, fullName: 'TestModel-1.0.0/Entity-1' },
      rtCkTypeId: 'TestModel/Entity',
      isAbstract: true,
      isFinal: false
    }
  };

  const mockCkTypesResponse = {
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        types: {
          __typename: 'CkTypeDtoConnection',
          totalCount: 1,
          items: [mockCkTypeItem]
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as unknown as MockCkTypesResult;

  const mockCkTypeByIdResponse = {
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        types: {
          __typename: 'CkTypeDtoConnection',
          items: [{
            __typename: 'CkType',
            ckTypeId: { __typename: 'CkTypeId', fullName: 'TestModel-1.0.0/Customer-1' },
            rtCkTypeId: 'TestModel/Customer'
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as unknown as MockCkTypeByIdResult;

  beforeEach(() => {
    getCkTypesGQLMock = jasmine.createSpyObj('GetCkTypesDtoGQL', ['fetch']);
    getCkTypeByRtCkTypeIdGQLMock = jasmine.createSpyObj('GetCkTypeByRtCkTypeIdDtoGQL', ['fetch']);
    getDerivedCkTypesGQLMock = jasmine.createSpyObj('GetDerivedCkTypesDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        CkTypeSelectorService,
        { provide: GetCkTypesDtoGQL, useValue: getCkTypesGQLMock },
        { provide: GetCkTypeByRtCkTypeIdDtoGQL, useValue: getCkTypeByRtCkTypeIdGQLMock },
        { provide: GetDerivedCkTypesDtoGQL, useValue: getDerivedCkTypesGQLMock }
      ]
    });

    service = TestBed.inject(CkTypeSelectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCkTypeByRtCkTypeId', () => {
    it('should return CkTypeSelectorItem when type is found', (done) => {
      getCkTypeByRtCkTypeIdGQLMock.fetch.and.returnValue(of(mockCkTypeByIdResponse));

      service.getCkTypeByRtCkTypeId('TestModel/Customer').subscribe(result => {
        expect(result).toBeTruthy();
        expect(result?.fullName).toBe('TestModel-1.0.0/Customer-1');
        expect(result?.rtCkTypeId).toBe('TestModel/Customer');
        expect(result?.isAbstract).toBeFalse();
        expect(result?.isFinal).toBeFalse();
        done();
      });

      expect(getCkTypeByRtCkTypeIdGQLMock.fetch).toHaveBeenCalledWith({
        variables: { rtCkTypeId: 'TestModel/Customer' },
        fetchPolicy: 'network-only'
      });
    });

    it('should return null when type is not found', (done) => {
      const emptyResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              items: []
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypeByIdResult;
      getCkTypeByRtCkTypeIdGQLMock.fetch.and.returnValue(of(emptyResponse));

      service.getCkTypeByRtCkTypeId('NonExistent/Type').subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should return null when items array is null', (done) => {
      const nullItemsResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              items: null
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypeByIdResult;
      getCkTypeByRtCkTypeIdGQLMock.fetch.and.returnValue(of(nullItemsResponse));

      service.getCkTypeByRtCkTypeId('TestModel/Customer').subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should return null when constructionKit is null', (done) => {
      const nullCkResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: null
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypeByIdResult;
      getCkTypeByRtCkTypeIdGQLMock.fetch.and.returnValue(of(nullCkResponse));

      service.getCkTypeByRtCkTypeId('TestModel/Customer').subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });
  });

  describe('getCkTypes', () => {
    it('should return CkTypeSelectorResult with items', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes().subscribe(result => {
        expect(result.items.length).toBe(1);
        expect(result.totalCount).toBe(1);
        const item = result.items[0];
        expect(item.fullName).toBe('TestModel-1.0.0/Customer-1');
        expect(item.rtCkTypeId).toBe('TestModel/Customer');
        expect(item.isAbstract).toBeFalse();
        expect(item.isFinal).toBeTrue();
        expect(item.description).toBe('Test customer type');
        expect(item.baseTypeFullName).toBe('TestModel-1.0.0/Entity-1');
        expect(item.baseTypeRtCkTypeId).toBe('TestModel/Entity');
        done();
      });
    });

    it('should use default pagination parameters', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes().subscribe(() => {
        const callArgs = getCkTypesGQLMock.fetch.calls.mostRecent().args[0]!;
        expect(callArgs.variables!.ckModelIds).toBeNull();
        expect(callArgs.variables!.first).toBe(50);
        expect(callArgs.variables!.searchFilter).toBeNull();
        expect(callArgs.fetchPolicy).toBe('network-only');
        done();
      });
    });

    it('should apply custom pagination parameters', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes({ first: 20, skip: 10 }).subscribe(() => {
        expect(getCkTypesGQLMock.fetch).toHaveBeenCalledWith({
          variables: {
            ckModelIds: null,
            first: 20,
            after: jasmine.any(String),
            searchFilter: null
          },
          fetchPolicy: 'network-only'
        });
        done();
      });
    });

    it('should filter by model IDs', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes({ ckModelIds: ['model-1', 'model-2'] }).subscribe(() => {
        const callArgs = getCkTypesGQLMock.fetch.calls.mostRecent().args[0]!;
        expect(callArgs.variables!.ckModelIds).toEqual(['model-1', 'model-2']);
        expect(callArgs.variables!.first).toBe(50);
        expect(callArgs.variables!.searchFilter).toBeNull();
        expect(callArgs.fetchPolicy).toBe('network-only');
        done();
      });
    });

    it('should apply search filter', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes({ searchText: 'Customer' }).subscribe(() => {
        const callArgs = getCkTypesGQLMock.fetch.calls.mostRecent().args[0]!;
        expect(callArgs.variables!.searchFilter).toEqual(jasmine.objectContaining({
          type: 'ATTRIBUTE_FILTER',
          attributePaths: ['ckTypeId'],
          searchTerm: 'Customer'
        }));
        done();
      });
    });

    it('should return empty result when types is null', (done) => {
      const nullTypesResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: null
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypesResult;
      getCkTypesGQLMock.fetch.and.returnValue(of(nullTypesResponse));

      service.getCkTypes().subscribe(result => {
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        done();
      });
    });

    it('should return empty result when constructionKit is null', (done) => {
      const nullCkResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: null
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypesResult;
      getCkTypesGQLMock.fetch.and.returnValue(of(nullCkResponse));

      service.getCkTypes().subscribe(result => {
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        done();
      });
    });

    it('should handle null items in the array', (done) => {
      const responseWithNulls = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              totalCount: 2,
              items: [mockCkTypeItem, null]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypesResult;
      getCkTypesGQLMock.fetch.and.returnValue(of(responseWithNulls));

      service.getCkTypes().subscribe(result => {
        expect(result.items.length).toBe(1);
        expect(result.totalCount).toBe(2);
        done();
      });
    });

    it('should handle empty ckModelIds array as null', (done) => {
      getCkTypesGQLMock.fetch.and.returnValue(of(mockCkTypesResponse));

      service.getCkTypes({ ckModelIds: [] }).subscribe(() => {
        const callArgs = getCkTypesGQLMock.fetch.calls.mostRecent().args[0]!;
        expect(callArgs.variables!.ckModelIds).toBeNull();
        done();
      });
    });

    it('should map item without base type correctly', (done) => {
      const itemWithoutBaseType = {
        ...mockCkTypeItem,
        baseType: null
      };
      const response = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              totalCount: 1,
              items: [itemWithoutBaseType]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypesResult;
      getCkTypesGQLMock.fetch.and.returnValue(of(response));

      service.getCkTypes().subscribe(result => {
        const item = result.items[0];
        expect(item.baseTypeFullName).toBeUndefined();
        expect(item.baseTypeRtCkTypeId).toBeUndefined();
        done();
      });
    });

    it('should handle null description', (done) => {
      const itemWithNullDescription = {
        ...mockCkTypeItem,
        description: null
      };
      const response = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              totalCount: 1,
              items: [itemWithNullDescription]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockCkTypesResult;
      getCkTypesGQLMock.fetch.and.returnValue(of(response));

      service.getCkTypes().subscribe(result => {
        const item = result.items[0];
        expect(item.description).toBeUndefined();
        done();
      });
    });
  });
});
