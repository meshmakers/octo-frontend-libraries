import type { Mock } from "vitest";
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GetRuntimeEntityByIdDtoGQL } from '../../graphQL/getRuntimeEntityById';
import { RtEntityDto } from '../../graphQL/globalTypes';
import { EntityDetailDataSource } from './entity-detail-data-source.service';

describe('EntityDetailDataSource', () => {
    let service: EntityDetailDataSource;
    let consoleErrorSpy: Mock;

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
        fetch: vi.fn().mockName('fetch').mockReturnValue(of(mockGQLResponse)),
    };

    beforeEach(async () => {
        // Suppress expected console.error messages in error tests
        consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

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
        mockGetRuntimeEntityByIdGQL.fetch.mockClear();
        mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(of(mockGQLResponse));
        consoleErrorSpy.mockClear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('fetchEntityDetails', () => {
        it('should fetch entity details successfully', async () => {
            const result = await service.fetchEntityDetails('entity-1', 'Test/Entity');

            expect(result).toBeTruthy();
            expect(result?.rtId).toBe('entity-1');
            expect(result?.ckTypeId).toBe('Test/Entity');
        });

        it('should call GraphQL with correct variables', async () => {
            await service.fetchEntityDetails('entity-123', 'Custom/Type');

            expect(mockGetRuntimeEntityByIdGQL.fetch).toHaveBeenCalled();
            const callArgs = vi.mocked(mockGetRuntimeEntityByIdGQL.fetch).mock.lastCall[0];
            expect(callArgs.variables.rtId).toBe('entity-123');
            expect(callArgs.variables.ckTypeId).toBe('Custom/Type');
        });

        it('should return null when entity not found', async () => {
            mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(of({
                data: {
                    runtime: {
                        runtimeEntities: {
                            items: [],
                        },
                    },
                },
            }));

            const result = await service.fetchEntityDetails('nonexistent', 'Test/Type');

            expect(result).toBeNull();
        });

        it('should return null when response has no items', async () => {
            mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(of({
                data: {
                    runtime: {
                        runtimeEntities: {
                            items: null,
                        },
                    },
                },
            }));

            const result = await service.fetchEntityDetails('entity-1', 'Test/Entity');

            expect(result).toBeNull();
        });

        it('should throw error on fetch failure', async () => {
            const error = new Error('Network error');
            mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(throwError(() => error));

            await expect(service.fetchEntityDetails('entity-1', 'Test/Entity')).rejects.toThrowError('Network error');

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch entity details:', error);
        });
    });

    describe('fetchEntityWithAssociations', () => {
        it('should fetch entity with associations', async () => {
            const result = await service.fetchEntityWithAssociations('entity-1', 'Test/Entity');

            expect(result).toBeTruthy();
            expect(result?.rtId).toBe('entity-1');
        });

        it('should call fetchEntityDetails internally', async () => {
            vi.spyOn(service, 'fetchEntityDetails');

            await service.fetchEntityWithAssociations('entity-1', 'Test/Entity');

            expect(service.fetchEntityDetails).toHaveBeenCalledWith('entity-1', 'Test/Entity');
        });

        it('should return null when entity not found', async () => {
            mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(of({
                data: {
                    runtime: {
                        runtimeEntities: {
                            items: [],
                        },
                    },
                },
            }));

            const result = await service.fetchEntityWithAssociations('nonexistent', 'Test/Type');

            expect(result).toBeNull();
        });

        it('should throw error on fetch failure', async () => {
            const error = new Error('Connection failed');
            mockGetRuntimeEntityByIdGQL.fetch.mockReturnValue(throwError(() => error));

            await expect(service.fetchEntityWithAssociations('entity-1', 'Test/Entity')).rejects.toThrowError('Connection failed');

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch entity details:', error);
        });
    });
});
