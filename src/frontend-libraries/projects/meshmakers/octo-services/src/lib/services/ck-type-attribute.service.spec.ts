import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { CkTypeAttributeService } from './ck-type-attribute.service';
import { GetCkTypeAttributesDtoGQL, GetCkTypeAttributesQueryDto } from '../graphQL/getCkTypeAttributes';
import { GetCkRecordAttributesDtoGQL, GetCkRecordAttributesQueryDto } from '../graphQL/getCkRecordAttributes';
import { AttributeValueTypeDto } from '../graphQL/globalTypes';

type MockTypeQueryResult = Apollo.QueryResult<GetCkTypeAttributesQueryDto>;
type MockRecordQueryResult = Apollo.QueryResult<GetCkRecordAttributesQueryDto>;

describe('CkTypeAttributeService', () => {
  let service: CkTypeAttributeService;
  let getCkTypeAttributesGQLMock: jasmine.SpyObj<GetCkTypeAttributesDtoGQL>;
  let getCkRecordAttributesGQLMock: jasmine.SpyObj<GetCkRecordAttributesDtoGQL>;

  const mockTypeAttributesResponse = {
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
            attributes: {
              __typename: 'CkTypeAttributeDtoConnection',
              items: [
                { __typename: 'CkTypeAttribute', attributeName: 'name', attributeValueType: AttributeValueTypeDto.StringDto },
                { __typename: 'CkTypeAttribute', attributeName: 'age', attributeValueType: AttributeValueTypeDto.IntDto }
              ]
            }
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as unknown as MockTypeQueryResult;

  const mockRecordAttributesResponse = {
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        records: {
          __typename: 'CkRecordDtoConnection',
          items: [{
            __typename: 'CkRecord',
            ckRecordId: { __typename: 'CkRecordId', fullName: 'TestModel-1.0.0/StatusRecord-1' },
            rtCkRecordId: 'TestModel/StatusRecord',
            attributes: {
              __typename: 'CkTypeAttributeDtoConnection',
              items: [
                { __typename: 'CkTypeAttribute', attributeName: 'status', attributeValueType: AttributeValueTypeDto.StringDto },
                { __typename: 'CkTypeAttribute', attributeName: 'code', attributeValueType: AttributeValueTypeDto.IntDto }
              ]
            }
          }]
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as unknown as MockRecordQueryResult;

  beforeEach(() => {
    getCkTypeAttributesGQLMock = jasmine.createSpyObj('GetCkTypeAttributesDtoGQL', ['fetch']);
    getCkRecordAttributesGQLMock = jasmine.createSpyObj('GetCkRecordAttributesDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        CkTypeAttributeService,
        { provide: GetCkTypeAttributesDtoGQL, useValue: getCkTypeAttributesGQLMock },
        { provide: GetCkRecordAttributesDtoGQL, useValue: getCkRecordAttributesGQLMock }
      ]
    });

    service = TestBed.inject(CkTypeAttributeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCkTypeAttributes', () => {
    it('should return attributes for a valid ckTypeId', (done) => {
      getCkTypeAttributesGQLMock.fetch.and.returnValue(of(mockTypeAttributesResponse));

      service.getCkTypeAttributes('TestModel-1.0.0/Customer-1').subscribe(result => {
        expect(result.length).toBe(2);
        expect(result[0].attributeName).toBe('name');
        expect(result[0].attributeValueType).toBe(AttributeValueTypeDto.StringDto);
        expect(result[1].attributeName).toBe('age');
        expect(result[1].attributeValueType).toBe(AttributeValueTypeDto.IntDto);
        done();
      });

      expect(getCkTypeAttributesGQLMock.fetch).toHaveBeenCalledWith({
        variables: { ckTypeId: 'TestModel-1.0.0/Customer-1', first: 1000 },
        fetchPolicy: 'network-only'
      });
    });

    it('should return empty array when type is not found', (done) => {
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
      } as unknown as MockTypeQueryResult;
      getCkTypeAttributesGQLMock.fetch.and.returnValue(of(emptyResponse));
      spyOn(console, 'warn');

      service.getCkTypeAttributes('NonExistent/Type').subscribe(result => {
        expect(result).toEqual([]);
        expect(console.warn).toHaveBeenCalled();
        done();
      });
    });

    it('should return empty array when attributes is null', (done) => {
      const noAttrsResponse = {
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
                attributes: null
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockTypeQueryResult;
      getCkTypeAttributesGQLMock.fetch.and.returnValue(of(noAttrsResponse));
      spyOn(console, 'warn');

      service.getCkTypeAttributes('TestModel-1.0.0/Customer-1').subscribe(result => {
        expect(result).toEqual([]);
        done();
      });
    });

    it('should handle GraphQL errors gracefully', (done) => {
      getCkTypeAttributesGQLMock.fetch.and.returnValue(throwError(() => new Error('GraphQL Error')));
      spyOn(console, 'error');

      service.getCkTypeAttributes('TestModel-1.0.0/Customer-1').subscribe(result => {
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
        done();
      });
    });

    it('should filter out null attributes', (done) => {
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
                attributes: {
                  __typename: 'CkTypeAttributeDtoConnection',
                  items: [
                    { __typename: 'CkTypeAttribute', attributeName: 'name', attributeValueType: AttributeValueTypeDto.StringDto },
                    null
                  ]
                }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockTypeQueryResult;
      getCkTypeAttributesGQLMock.fetch.and.returnValue(of(responseWithNulls));

      service.getCkTypeAttributes('TestModel-1.0.0/Customer-1').subscribe(result => {
        expect(result.length).toBe(1);
        expect(result[0].attributeName).toBe('name');
        done();
      });
    });
  });

  describe('getCkRecordAttributes', () => {
    it('should return attributes for a valid ckRecordId', (done) => {
      getCkRecordAttributesGQLMock.fetch.and.returnValue(of(mockRecordAttributesResponse));

      service.getCkRecordAttributes('TestModel-1.0.0/StatusRecord-1').subscribe(result => {
        expect(result.length).toBe(2);
        expect(result[0].attributeName).toBe('status');
        expect(result[0].attributeValueType).toBe(AttributeValueTypeDto.StringDto);
        expect(result[1].attributeName).toBe('code');
        expect(result[1].attributeValueType).toBe(AttributeValueTypeDto.IntDto);
        done();
      });

      expect(getCkRecordAttributesGQLMock.fetch).toHaveBeenCalledWith({
        variables: { ckRecordId: 'TestModel-1.0.0/StatusRecord-1', first: 1000 },
        fetchPolicy: 'network-only'
      });
    });

    it('should return empty array when record is not found', (done) => {
      const emptyResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            records: {
              __typename: 'CkRecordDtoConnection',
              items: []
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockRecordQueryResult;
      getCkRecordAttributesGQLMock.fetch.and.returnValue(of(emptyResponse));
      spyOn(console, 'warn');

      service.getCkRecordAttributes('NonExistent/Record').subscribe(result => {
        expect(result).toEqual([]);
        expect(console.warn).toHaveBeenCalled();
        done();
      });
    });

    it('should handle GraphQL errors gracefully', (done) => {
      getCkRecordAttributesGQLMock.fetch.and.returnValue(throwError(() => new Error('GraphQL Error')));
      spyOn(console, 'error');

      service.getCkRecordAttributes('TestModel-1.0.0/StatusRecord-1').subscribe(result => {
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
        done();
      });
    });

    it('should filter out null attributes', (done) => {
      const responseWithNulls = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            records: {
              __typename: 'CkRecordDtoConnection',
              items: [{
                __typename: 'CkRecord',
                ckRecordId: { __typename: 'CkRecordId', fullName: 'TestModel-1.0.0/StatusRecord-1' },
                rtCkRecordId: 'TestModel/StatusRecord',
                attributes: {
                  __typename: 'CkTypeAttributeDtoConnection',
                  items: [
                    { __typename: 'CkTypeAttribute', attributeName: 'status', attributeValueType: AttributeValueTypeDto.StringDto },
                    null
                  ]
                }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as unknown as MockRecordQueryResult;
      getCkRecordAttributesGQLMock.fetch.and.returnValue(of(responseWithNulls));

      service.getCkRecordAttributes('TestModel-1.0.0/StatusRecord-1').subscribe(result => {
        expect(result.length).toBe(1);
        expect(result[0].attributeName).toBe('status');
        done();
      });
    });
  });
});
