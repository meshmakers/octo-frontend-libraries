import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CkModelService } from './ck-model.service';
import { GetCkModelByIdDtoGQL } from '../graphQL/getCkModelById';
import { ModelStateDto } from '../graphQL/globalTypes';

describe('CkModelService', () => {
  let service: CkModelService;
  let getCkModelByIdGQLMock: jasmine.SpyObj<GetCkModelByIdDtoGQL>;

  const createMockResponse = (version: string | number | { major: number; minor: number; patch: number } | null) => ({
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        models: {
          __typename: 'CkModelDtoConnection',
          totalCount: version !== null ? 1 : 0,
          items: version !== null ? [{
            __typename: 'CkModel',
            id: {
              __typename: 'CkModelId',
              name: 'System.UI',
              version: version,
              fullName: 'System.UI-1.0.1',
              semanticVersionedFullName: 'System.UI-1'
            },
            modelState: ModelStateDto.AvailableDto
          }] : []
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as any);

  const emptyResponse = {
    data: {
      __typename: 'OctoQuery',
      constructionKit: {
        __typename: 'ConstructionKitQuery',
        models: {
          __typename: 'CkModelDtoConnection',
          totalCount: 0,
          items: []
        }
      }
    },
    loading: false,
    networkStatus: 7
  } as any;

  beforeEach(() => {
    getCkModelByIdGQLMock = jasmine.createSpyObj('GetCkModelByIdDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        CkModelService,
        { provide: GetCkModelByIdDtoGQL, useValue: getCkModelByIdGQLMock }
      ]
    });

    service = TestBed.inject(CkModelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isModelAvailable', () => {
    it('should return true when model is available', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.0.1')));

      const result = await service.isModelAvailable('System.UI');

      expect(result).toBeTrue();
      expect(getCkModelByIdGQLMock.fetch).toHaveBeenCalledWith({
        variables: { model: 'System.UI' }
      });
    });

    it('should return false when model is not found', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(emptyResponse));

      const result = await service.isModelAvailable('NonExistent.Model');

      expect(result).toBeFalse();
    });

    it('should return false when constructionKit is null', async () => {
      const nullCkResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: null
        },
        loading: false,
        networkStatus: 7
      } as any;
      getCkModelByIdGQLMock.fetch.and.returnValue(of(nullCkResponse));

      const result = await service.isModelAvailable('System.UI');

      expect(result).toBeFalse();
    });

    it('should return false when models is null', async () => {
      const nullModelsResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            models: null
          }
        },
        loading: false,
        networkStatus: 7
      } as any;
      getCkModelByIdGQLMock.fetch.and.returnValue(of(nullModelsResponse));

      const result = await service.isModelAvailable('System.UI');

      expect(result).toBeFalse();
    });
  });

  describe('isModelAvailableWithMinVersion', () => {
    it('should return true when model version >= required version', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.0.1')));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.0.0');

      expect(result).toBeTrue();
    });

    it('should return true when versions are equal', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.0.1')));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.0.1');

      expect(result).toBeTrue();
    });

    it('should return false when model version < required version', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.0.0')));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.0.1');

      expect(result).toBeFalse();
    });

    it('should return false when model is not found', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(emptyResponse));

      const result = await service.isModelAvailableWithMinVersion('NonExistent.Model', '1.0.0');

      expect(result).toBeFalse();
    });

    it('should return false when model has no version', async () => {
      const noVersionResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            models: {
              __typename: 'CkModelDtoConnection',
              totalCount: 1,
              items: [{
                __typename: 'CkModel',
                id: {
                  __typename: 'CkModelId',
                  name: 'System.UI',
                  version: null as any,
                  fullName: 'System.UI',
                  semanticVersionedFullName: 'System.UI'
                },
                modelState: ModelStateDto.AvailableDto
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any;
      getCkModelByIdGQLMock.fetch.and.returnValue(of(noVersionResponse));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.0.0');

      expect(result).toBeFalse();
    });

    it('should handle version object format', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse({ major: 1, minor: 2, patch: 3 })));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.2.0');

      expect(result).toBeTrue();
    });

    it('should compare major version correctly', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('2.0.0')));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.9.9');

      expect(result).toBeTrue();
    });

    it('should compare minor version correctly', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.5.0')));

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.4.9');

      expect(result).toBeTrue();
    });

    it('should return false for invalid version format', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('invalid')));
      spyOn(console, 'warn');

      const result = await service.isModelAvailableWithMinVersion('System.UI', '1.0.0');

      expect(result).toBeFalse();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('getModelVersion', () => {
    it('should return version string when model is found', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse('1.0.1')));

      const result = await service.getModelVersion('System.UI');

      expect(result).toBe('1.0.1');
    });

    it('should return null when model is not found', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(emptyResponse));

      const result = await service.getModelVersion('NonExistent.Model');

      expect(result).toBeNull();
    });

    it('should return null when model has no version', async () => {
      const noVersionResponse = {
        data: {
          __typename: 'OctoQuery',
          constructionKit: {
            __typename: 'ConstructionKitQuery',
            models: {
              __typename: 'CkModelDtoConnection',
              totalCount: 1,
              items: [{
                __typename: 'CkModel',
                id: {
                  __typename: 'CkModelId',
                  name: 'System.UI',
                  version: null as any,
                  fullName: 'System.UI',
                  semanticVersionedFullName: 'System.UI'
                },
                modelState: ModelStateDto.AvailableDto
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any;
      getCkModelByIdGQLMock.fetch.and.returnValue(of(noVersionResponse));

      const result = await service.getModelVersion('System.UI');

      expect(result).toBeNull();
    });

    it('should convert version object to string', async () => {
      getCkModelByIdGQLMock.fetch.and.returnValue(of(createMockResponse({ major: 1, minor: 2, patch: 3 })));

      const result = await service.getModelVersion('System.UI');

      expect(result).toBeTruthy();
    });
  });
});
