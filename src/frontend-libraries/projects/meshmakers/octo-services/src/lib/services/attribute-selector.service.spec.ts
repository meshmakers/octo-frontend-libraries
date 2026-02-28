import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { AttributeSelectorService } from './attribute-selector.service';
import { GetCkTypeAvailableQueryColumnsDtoGQL, GetCkTypeAvailableQueryColumnsQueryDto } from '../graphQL/getCkTypeAvailableQueryColumns';
import { AttributeValueTypeDto } from '../graphQL/globalTypes';

type MockQueryResult = Apollo.QueryResult<GetCkTypeAvailableQueryColumnsQueryDto>;

describe('AttributeSelectorService', () => {
  let service: AttributeSelectorService;
  let getCkTypeAvailableQueryColumnsGQLMock: jasmine.SpyObj<GetCkTypeAvailableQueryColumnsDtoGQL>;

  const mockResponse = {
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        types: {
          __typename: 'CkTypeDtoConnection',
          items: [{
            __typename: 'CkType',
            ckTypeId: { __typename: 'CkTypeId', fullName: 'TestModel-1.0.0/Customer-1' },
            rtCkTypeId: 'TestModel/Customer',
            availableQueryColumns: {
              __typename: 'CkTypeQueryColumnDtoConnection',
              totalCount: 3,
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: 'cursor1',
                endCursor: 'cursor3'
              },
              items: [
                { __typename: 'CkTypeQueryColumn', attributePath: 'name', attributeValueType: AttributeValueTypeDto.StringDto },
                { __typename: 'CkTypeQueryColumn', attributePath: 'age', attributeValueType: AttributeValueTypeDto.IntDto },
                { __typename: 'CkTypeQueryColumn', attributePath: 'email', attributeValueType: AttributeValueTypeDto.StringDto }
              ]
            }
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as unknown as MockQueryResult;

  beforeEach(() => {
    getCkTypeAvailableQueryColumnsGQLMock = jasmine.createSpyObj('GetCkTypeAvailableQueryColumnsDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        AttributeSelectorService,
        { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: getCkTypeAvailableQueryColumnsGQLMock }
      ]
    });

    service = TestBed.inject(AttributeSelectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAvailableAttributes', () => {
    it('should return attributes for a valid ckTypeId', (done) => {
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(mockResponse));

      service.getAvailableAttributes('TestModel/Customer').subscribe(result => {
        expect(result.items.length).toBe(3);
        expect(result.totalCount).toBe(3);
        expect(result.items[0].attributePath).toBe('name');
        expect(result.items[0].attributeValueType).toBe(AttributeValueTypeDto.StringDto);
        expect(result.items[1].attributePath).toBe('age');
        expect(result.items[2].attributePath).toBe('email');
        done();
      });

      expect(getCkTypeAvailableQueryColumnsGQLMock.fetch).toHaveBeenCalledWith({
        variables: {
          rtCkId: 'TestModel/Customer',
          filter: undefined,
          first: 1000,
          after: undefined
        },
        fetchPolicy: 'network-only'
      });
    });

    it('should use default first parameter', (done) => {
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(mockResponse));

      service.getAvailableAttributes('TestModel/Customer').subscribe(() => {
        const callArgs = getCkTypeAvailableQueryColumnsGQLMock.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.first).toBe(1000);
        done();
      });
    });

    it('should apply filter parameter', (done) => {
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(mockResponse));

      service.getAvailableAttributes('TestModel/Customer', 'name').subscribe(() => {
        const callArgs = getCkTypeAvailableQueryColumnsGQLMock.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.filter).toBe('name');
        done();
      });
    });

    it('should apply pagination parameters', (done) => {
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(mockResponse));

      service.getAvailableAttributes('TestModel/Customer', undefined, 50, 'cursor1').subscribe(() => {
        const callArgs = getCkTypeAvailableQueryColumnsGQLMock.fetch.calls.mostRecent().args[0];
        expect(callArgs.variables.first).toBe(50);
        expect(callArgs.variables.after).toBe('cursor1');
        done();
      });
    });

    it('should return empty result when type is not found', (done) => {
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
      } as unknown as MockQueryResult;
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(emptyResponse));

      service.getAvailableAttributes('NonExistent/Type').subscribe(result => {
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
      } as unknown as MockQueryResult;
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(nullCkResponse));

      service.getAvailableAttributes('TestModel/Customer').subscribe(result => {
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        done();
      });
    });

    it('should filter out null items in the response', (done) => {
      const responseWithNulls = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              items: [{
                __typename: 'CkType',
                ckTypeId: { __typename: 'CkTypeId', fullName: 'TestModel-1.0.0/Customer-1' },
                rtCkTypeId: 'TestModel/Customer',
                availableQueryColumns: {
                  __typename: 'CkTypeQueryColumnDtoConnection',
                  totalCount: 2,
                  pageInfo: {
                    __typename: 'PageInfo',
                    hasNextPage: false,
                    hasPreviousPage: false,
                    startCursor: null,
                    endCursor: null
                  },
                  items: [
                    { __typename: 'CkTypeQueryColumn', attributePath: 'name', attributeValueType: AttributeValueTypeDto.StringDto },
                    null
                  ]
                }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockQueryResult;
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(responseWithNulls));

      service.getAvailableAttributes('TestModel/Customer').subscribe(result => {
        expect(result.items.length).toBe(1);
        expect(result.items[0].attributePath).toBe('name');
        done();
      });
    });

    it('should handle null availableQueryColumns', (done) => {
      const noColumnsResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            types: {
              __typename: 'CkTypeDtoConnection',
              items: [{
                __typename: 'CkType',
                ckTypeId: { __typename: 'CkTypeId', fullName: 'TestModel-1.0.0/Customer-1' },
                rtCkTypeId: 'TestModel/Customer',
                availableQueryColumns: null
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockQueryResult;
      getCkTypeAvailableQueryColumnsGQLMock.fetch.and.returnValue(of(noColumnsResponse));

      service.getAvailableAttributes('TestModel/Customer').subscribe(result => {
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        done();
      });
    });
  });
});
