import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { gridIcon } from '@progress/kendo-svg-icons';
import { GetCkTypeAssociationRolesDtoGQL } from '../../../graphQL/getCkTypeAssociationRoles';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../../../graphQL/getRuntimeEntityAssociationsById';
import { TreeNavigationConfigService } from '../../services/tree-navigation-config.service';
import { MappingCoverageTreeDataSource } from './mapping-coverage-tree-data-source';
import { CoverageNodePayload, DEFAULT_MAPPING_COVERAGE_TREE_CONFIG, } from './mapping-coverage-tree.models';

interface CoverageChildStub {
    rtId: string;
    ckTypeId: string;
    name: string;
    mappingCount?: number;
    grandChildren?: number;
}

/** Builds a getMappingCoverageNode response for one entity + its children. */
function coverageNodeResponse(rtId: string, ckTypeId: string, name: string, ownMappings: number, children: CoverageChildStub[]) {
    return {
        data: {
            runtime: {
                runtimeEntities: {
                    items: [
                        {
                            rtId,
                            ckTypeId,
                            rtWellKnownName: null,
                            attributes: { items: [{ attributeName: 'name', value: name }] },
                            associations: {
                                ownMappings: { totalCount: ownMappings },
                                children: {
                                    totalCount: children.length,
                                    items: children.map(c => ({
                                        rtId: c.rtId,
                                        ckTypeId: c.ckTypeId,
                                        attributes: { items: [{ attributeName: 'name', value: c.name }] },
                                        associations: {
                                            grandChildren: { totalCount: c.grandChildren ?? 0 },
                                            mappings: { totalCount: c.mappingCount ?? 0 },
                                        },
                                    })),
                                },
                            },
                        },
                    ],
                },
            },
        },
    };
}

interface EdgeStub {
    roleId: string;
    originCkTypeId: string;
    originRtId: string;
}

function associationsResponse(edges: EdgeStub[]) {
    return {
        data: {
            runtime: {
                runtimeEntities: {
                    items: [
                        {
                            associations: {
                                definitions: {
                                    totalCount: edges.length,
                                    items: edges.map(e => ({
                                        ckAssociationRoleId: e.roleId,
                                        originCkTypeId: e.originCkTypeId,
                                        originRtId: e.originRtId,
                                        targetCkTypeId: 'EnergyIQ/Space',
                                        targetRtId: 'space1',
                                    })),
                                },
                            },
                        },
                    ],
                },
            },
        },
    };
}

interface SchemaRoleStub {
    rtRoleId: string;
    navigationPropertyName: string;
    rtOriginCkTypeId: string;
}

function schemaRolesResponse(roles: SchemaRoleStub[]) {
    return {
        data: {
            constructionKit: {
                types: { items: [{ associations: { in: { all: roles } } }] },
            },
        },
    };
}

function entityItem(payload: Partial<CoverageNodePayload> & {
    rtId: string;
    ckTypeId: string;
}) {
    const full: CoverageNodePayload = {
        name: payload.rtId,
        mappingCount: 0,
        hasChildren: true,
        isRoot: false,
        validationStatus: null,
        validationDetail: null,
        ...payload,
    };
    return new TreeItemDataTyped<CoverageNodePayload>(full.rtId, full.name, '', full, gridIcon, true, false);
}

describe('MappingCoverageTreeDataSource (association auto-discovery)', () => {
    let dataSource: MappingCoverageTreeDataSource;
    let coverageNodeGQL: MockedObject<GetMappingCoverageNodeDtoGQL>;
    let associationsGQL: MockedObject<GetRuntimeEntityAssociationsByIdDtoGQL>;
    let rolesGQL: MockedObject<GetCkTypeAssociationRolesDtoGQL>;
    let treeNavConfig: MockedObject<TreeNavigationConfigService>;

    beforeEach(() => {
        coverageNodeGQL = {
            fetch: vi.fn().mockName("GetMappingCoverageNodeDtoGQL.fetch")
        };
        associationsGQL = {
            fetch: vi.fn().mockName("GetRuntimeEntityAssociationsByIdDtoGQL.fetch")
        };
        rolesGQL = {
            fetch: vi.fn().mockName("GetCkTypeAssociationRolesDtoGQL.fetch")
        };
        treeNavConfig = {
            resolve: vi.fn().mockName("TreeNavigationConfigService.resolve")
        };
        treeNavConfig.resolve.mockResolvedValue(undefined);

        TestBed.configureTestingModule({
            providers: [
                MappingCoverageTreeDataSource,
                { provide: GetMappingCoverageNodeDtoGQL, useValue: coverageNodeGQL },
                { provide: GetRuntimeEntityAssociationsByIdDtoGQL, useValue: associationsGQL },
                { provide: GetCkTypeAssociationRolesDtoGQL, useValue: rolesGQL },
                { provide: TreeNavigationConfigService, useValue: treeNavConfig },
            ],
        });
        dataSource = TestBed.inject(MappingCoverageTreeDataSource);
        dataSource.setConfig(DEFAULT_MAPPING_COVERAGE_TREE_CONFIG);
    });

    /** Space with one spatial child; edges: 2 sensors + excluded roles. */
    function arrangeSpaceWithSensors(): void {
        coverageNodeGQL.fetch.mockImplementation(((options: {
            variables?: {
                childRoleId?: string;
            };
        }) => {
            if (options.variables?.childRoleId === 'EnergyIQ/SpaceSensors') {
                return of(coverageNodeResponse('space1', 'EnergyIQ/Space', 'Space 1', 0, [
                    { rtId: 'sensor1', ckTypeId: 'EnergyIQ/TemperatureSensor', name: 'Temp', mappingCount: 2 },
                    { rtId: 'sensor2', ckTypeId: 'EnergyIQ/HumiditySensor', name: 'Hum' },
                ]));
            }
            return of(coverageNodeResponse('space1', 'EnergyIQ/Space', 'Space 1', 1, [
                { rtId: 'childSpace', ckTypeId: 'EnergyIQ/Space', name: 'Child Space', grandChildren: 1 },
            ]));
        }) as never);
        associationsGQL.fetch.mockReturnValue(of(associationsResponse([
            { roleId: 'EnergyIQ/SpaceSensors', originCkTypeId: 'EnergyIQ/TemperatureSensor', originRtId: 'sensor1' },
            { roleId: 'EnergyIQ/SpaceSensors', originCkTypeId: 'EnergyIQ/HumiditySensor', originRtId: 'sensor2' },
            // Excluded: the spatial child role is already flattened…
            { roleId: 'System/ParentChild', originCkTypeId: 'EnergyIQ/Space', originRtId: 'childSpace' },
            // …and mapping edges belong to the detail panel, not the tree.
            { roleId: 'System.Communication/MapsTo', originCkTypeId: 'System.Communication/DataPointMapping', originRtId: 'map1' },
        ])) as never);
        rolesGQL.fetch.mockImplementation(((options: {
            variables?: {
                ckTypeId?: string;
            };
        }) => {
            if (options.variables?.ckTypeId === 'EnergyIQ/Space') {
                return of(schemaRolesResponse([
                    {
                        rtRoleId: 'EnergyIQ/SpaceSensors',
                        navigationPropertyName: 'containedSensors',
                        rtOriginCkTypeId: 'EnergyIQ/Sensor',
                    },
                    {
                        rtRoleId: 'System/ParentChild',
                        navigationPropertyName: 'children',
                        rtOriginCkTypeId: 'EnergyIQ/Space',
                    },
                ]));
            }
            return of(schemaRolesResponse([]));
        }) as never);
    }

    it('adds a group node per discovered role next to the spatial children', async () => {
        arrangeSpaceWithSensors();

        const children = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));

        expect(children.length).toBe(2);
        // Spatial child stays flattened first.
        expect(children[0].item.rtId).toBe('childSpace');
        expect(children[0].item.associationGroup).toBeUndefined();
        // Discovered role becomes a group node with schema label + edge count,
        // using the schema origin BASE type as the target ckId.
        const group = children[1];
        expect(group.text).toBe('containedSensors (2)');
        expect(group.item.associationGroup?.roleId).toBe('EnergyIQ/SpaceSensors');
        expect(group.item.associationGroup?.targetCkTypeId).toBe('EnergyIQ/Sensor');
        expect(group.expandable).toBe(true);
    });

    it('expands a group node into its target entities with mapping counts', async () => {
        arrangeSpaceWithSensors();
        const children = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));
        const group = children[1];

        const targets = await dataSource.fetchChildren(group);

        expect(targets.map(t => t.item.rtId)).toEqual(['sensor1', 'sensor2']);
        expect(targets[0].item.mappingCount).toBe(2);
        expect(targets[0].text).toContain('[2]');
        // The group expansion must navigate the group's role, not the hierarchy.
        const lastVariables = vi.mocked(coverageNodeGQL.fetch).mock.lastCall[0]?.variables;
        expect(lastVariables?.childRoleId).toBe('EnergyIQ/SpaceSensors');
        expect(lastVariables?.childCkTypeId).toBe('EnergyIQ/Sensor');
    });

    it('honours TreeNavigationConfiguration overrides (hide + relabel)', async () => {
        arrangeSpaceWithSensors();
        treeNavConfig.resolve.mockImplementation((_sourceCkTypeId: string, roleId: string) => Promise.resolve(roleId === 'EnergyIQ/SpaceSensors'
            ? { displayName: 'Sensors' }
            : undefined));

        const children = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));
        expect(children[1].text).toBe('Sensors (2)');

        treeNavConfig.resolve.mockResolvedValue({ visible: false });
        const hidden = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));
        expect(hidden.length).toBe(1);
        expect(hidden[0].item.rtId).toBe('childSpace');
    });

    it('flattens a role when its override sets grouped: false', async () => {
        arrangeSpaceWithSensors();
        treeNavConfig.resolve.mockImplementation((_sourceCkTypeId: string, roleId: string) => Promise.resolve(roleId === 'EnergyIQ/SpaceSensors' ? { grouped: false } : undefined));

        const children = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));

        expect(children.every(c => !c.item.associationGroup)).toBe(true);
        expect(children.map(c => c.item.rtId)).toEqual(['childSpace', 'sensor1', 'sensor2']);
    });

    it('marks children without spatial grandchildren expandable when their type has navigable inbound roles', async () => {
        arrangeSpaceWithSensors();
        rolesGQL.fetch.mockImplementation(((options: {
            variables?: {
                ckTypeId?: string;
            };
        }) => {
            if (options.variables?.ckTypeId === 'EnergyIQ/TemperatureSensor') {
                // Only a mapping role → NOT navigable → not expandable.
                return of(schemaRolesResponse([
                    {
                        rtRoleId: 'System.Communication/MapsTo',
                        navigationPropertyName: 'mappedAsTarget',
                        rtOriginCkTypeId: 'System.Communication/DataPointMapping',
                    },
                ]));
            }
            if (options.variables?.ckTypeId === 'EnergyIQ/Space') {
                return of(schemaRolesResponse([
                    {
                        rtRoleId: 'EnergyIQ/SpaceSensors',
                        navigationPropertyName: 'containedSensors',
                        rtOriginCkTypeId: 'EnergyIQ/Sensor',
                    },
                ]));
            }
            return of(schemaRolesResponse([]));
        }) as never);

        const children = await dataSource.fetchChildren(entityItem({ rtId: 'space1', ckTypeId: 'EnergyIQ/Space', name: 'Space 1' }));
        const targets = await dataSource.fetchChildren(children[1]);

        // sensor1 has no spatial grandchildren and only excluded inbound roles.
        expect(targets[0].expandable).toBe(false);
        // The spatial child has grandchildren → expandable regardless of schema.
        expect(children[0].expandable).toBe(true);
    });
});
