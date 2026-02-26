import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GetRuntimeEntityByIdDtoGQL } from '../graphQL/getRuntimeEntityById';
import { RtEntityDto } from '../graphQL/globalTypes';
import { EntityDetailDataSource } from './entity-detail-data-source.service';

describe('EntityDetailDataSource', () => {
  let service: EntityDetailDataSource;
  let consoleErrorSpy: jasmine.Spy;

  const mockEntity: RtEntityDto = {
    rtId: 'entity-1',
    ckTypeId: 'Test/Entity',
    attributes: {
      items: [
        { attributeName: 'name', value: 'Test Entity' },
        { attributeName: 'description', value: 'A test entity' },
      ],
    },
    associations: {
      targets: {
        items: [],
        totalCount: 0,
      },
    },
  } as unknown as RtEntityDto;

  const mockGQLResponse = {
    data: {
      runtime: {
        runtimeEntities: {
          items: [mockEntity],
        },
      },
    },
  };

  const mockGetRuntimeEntityByIdGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockGQLResponse)),
  };

  beforeEach(async () => {
    // Suppress expected console.error messages in error tests
    consoleErrorSpy = spyOn(console, 'error');

    await TestBed.configureTestingModule({
      providers: [
        EntityDetailDataSource,
        {
          provide: GetRuntimeEntityByIdDtoGQL,
          useValue: mockGetRuntimeEntityByIdGQL,
        },
      ],
    }).compileComponents();

    service = TestBed.inject(EntityDetailDataSource);
  });

  afterEach(() => {
    mockGetRuntimeEntityByIdGQL.fetch.calls.reset();
    mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(of(mockGQLResponse));
    consoleErrorSpy.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchEntityDetails', () => {
    it('should fetch entity details successfully', async () => {
      const result = await service.fetchEntityDetails(
        'entity-1',
        'Test/Entity',
      );

      expect(result).toBeTruthy();
      expect(result?.rtId).toBe('entity-1');
      expect(result?.ckTypeId).toBe('Test/Entity');
    });

    it('should call GraphQL with correct variables', async () => {
      await service.fetchEntityDetails('entity-123', 'Custom/Type');

      expect(mockGetRuntimeEntityByIdGQL.fetch).toHaveBeenCalled();
      const callArgs =
        mockGetRuntimeEntityByIdGQL.fetch.calls.mostRecent().args[0];
      expect(callArgs.variables.rtId).toBe('entity-123');
      expect(callArgs.variables.ckTypeId).toBe('Custom/Type');
    });

    it('should return null when entity not found', async () => {
      mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [],
              },
            },
          },
        }),
      );

      const result = await service.fetchEntityDetails(
        'nonexistent',
        'Test/Type',
      );

      expect(result).toBeNull();
    });

    it('should return null when response has no items', async () => {
      mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: null,
              },
            },
          },
        }),
      );

      const result = await service.fetchEntityDetails(
        'entity-1',
        'Test/Entity',
      );

      expect(result).toBeNull();
    });

    it('should throw error on fetch failure', async () => {
      const error = new Error('Network error');
      mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(
        throwError(() => error),
      );

      await expectAsync(
        service.fetchEntityDetails('entity-1', 'Test/Entity'),
      ).toBeRejectedWithError('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch entity details:',
        error,
      );
    });
  });

  describe('fetchEntityWithAssociations', () => {
    it('should fetch entity with associations', async () => {
      const result = await service.fetchEntityWithAssociations(
        'entity-1',
        'Test/Entity',
      );

      expect(result).toBeTruthy();
      expect(result?.rtId).toBe('entity-1');
    });

    it('should call fetchEntityDetails internally', async () => {
      spyOn(service, 'fetchEntityDetails').and.callThrough();

      await service.fetchEntityWithAssociations('entity-1', 'Test/Entity');

      expect(service.fetchEntityDetails).toHaveBeenCalledWith(
        'entity-1',
        'Test/Entity',
      );
    });

    it('should return null when entity not found', async () => {
      mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(
        of({
          data: {
            runtime: {
              runtimeEntities: {
                items: [],
              },
            },
          },
        }),
      );

      const result = await service.fetchEntityWithAssociations(
        'nonexistent',
        'Test/Type',
      );

      expect(result).toBeNull();
    });

    it('should throw error on fetch failure', async () => {
      const error = new Error('Connection failed');
      mockGetRuntimeEntityByIdGQL.fetch.and.returnValue(
        throwError(() => error),
      );

      await expectAsync(
        service.fetchEntityWithAssociations('entity-1', 'Test/Entity'),
      ).toBeRejectedWithError('Connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch entity details:',
        error,
      );
    });
  });
});
