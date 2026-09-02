import { TestBed } from '@angular/core/testing';
import { ApolloTestingController, ApolloTestingModule, } from 'apollo-angular/testing';
import { MappingCoverageConfigService } from './mapping-coverage-config.service';

describe('MappingCoverageConfigService', () => {
    let service: MappingCoverageConfigService;
    let controller: ApolloTestingController;

    const typeExistsResponse = (present: boolean) => ({
        data: {
            constructionKit: {
                types: {
                    items: present
                        ? [{ rtCkTypeId: 'System.UI/MappingCoverageConfiguration' }]
                        : [],
                },
            },
        },
    });

    const configResponse = (items: {
        rtId: string;
        sourceCandidateCkTypeIds: (string | null)[];
    }[]) => ({
        data: {
            runtime: {
                systemUIMappingCoverageConfiguration: { items },
            },
        },
    });

    // Waits up to a few microtasks for the named operation to be issued, then flushes it.
    async function flushOp(operationName: string, response: {
        data: Record<string, unknown>;
    }): Promise<void> {
        for (let i = 0; i < 10; i++) {
            const matches = controller.match((op) => op.operationName === operationName);
            if (matches.length > 0) {
                matches[0].flush(response);
                return;
            }
            await Promise.resolve();
        }
        throw new Error(`operation not issued: ${operationName}`);
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [ApolloTestingModule],
            providers: [MappingCoverageConfigService],
        });
        controller = TestBed.inject(ApolloTestingController);
        service = TestBed.inject(MappingCoverageConfigService);
    });

    afterEach(() => {
        controller.verify();
    });

    it('reports typePresent=false and does not query the singleton when the CK type is absent', async () => {
        const promise = service.loadConfig();
        await flushOp('mappingCoverageConfigTypeExists', typeExistsResponse(false));
        const config = await promise;

        expect(config.typePresent).toBe(false);
        expect(config.rtId).toBeNull();
        expect(config.sourceCandidateCkTypeIds).toEqual([]);
        controller.expectNone((op) => op.operationName === 'getMappingCoverageConfiguration');
    });

    it('loads the singleton with its source CK types, dropping empty entries', async () => {
        const promise = service.loadConfig();
        await flushOp('mappingCoverageConfigTypeExists', typeExistsResponse(true));
        await flushOp('getMappingCoverageConfiguration', configResponse([
            {
                rtId: 'cfg-1',
                sourceCandidateCkTypeIds: ['Loxone/Control', null, '', 'MQTT/Topic'],
            },
        ]));
        const config = await promise;

        expect(config.typePresent).toBe(true);
        expect(config.rtId).toBe('cfg-1');
        expect(config.sourceCandidateCkTypeIds).toEqual([
            'Loxone/Control',
            'MQTT/Topic',
        ]);
    });

    it('reports rtId=null when the type is installed but no instance exists', async () => {
        const promise = service.loadConfig();
        await flushOp('mappingCoverageConfigTypeExists', typeExistsResponse(true));
        await flushOp('getMappingCoverageConfiguration', configResponse([]));
        const config = await promise;

        expect(config.typePresent).toBe(true);
        expect(config.rtId).toBeNull();
        expect(config.sourceCandidateCkTypeIds).toEqual([]);
    });

    it('creates the singleton (with well-known name) when saving without an rtId', async () => {
        const promise = service.saveConfig(null, ['Loxone/Control']);
        await flushOp('createMappingCoverageConfiguration', {
            data: {
                runtime: {
                    systemUIMappingCoverageConfigurations: {
                        create: [{ rtId: 'cfg-new' }],
                    },
                },
            },
        });
        const rtId = await promise;

        expect(rtId).toBe('cfg-new');
        const ops = controller.match((op) => op.operationName === 'createMappingCoverageConfiguration');
        expect(ops.length).toBe(0); // already flushed above
    });

    it('updates the singleton when saving with an rtId', async () => {
        const promise = service.saveConfig('cfg-1', ['Loxone/Control', '']);
        let capturedVariables: Record<string, unknown> | undefined;
        for (let i = 0; i < 10; i++) {
            const matches = controller.match((op) => op.operationName === 'updateMappingCoverageConfiguration');
            if (matches.length > 0) {
                capturedVariables = matches[0].operation.variables;
                matches[0].flush({
                    data: {
                        runtime: {
                            systemUIMappingCoverageConfigurations: {
                                update: [{ rtId: 'cfg-1' }],
                            },
                        },
                    },
                });
                break;
            }
            await Promise.resolve();
        }
        const rtId = await promise;

        expect(rtId).toBe('cfg-1');
        // Empty ids are dropped before the mutation goes out.
        expect(capturedVariables?.['entities']).toEqual([
            { rtId: 'cfg-1', item: { sourceCandidateCkTypeIds: ['Loxone/Control'] } },
        ]);
    });
});
