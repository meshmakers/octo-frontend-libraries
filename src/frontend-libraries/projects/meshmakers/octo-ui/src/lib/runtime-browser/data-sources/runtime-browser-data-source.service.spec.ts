import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { fileIcon } from '@progress/kendo-svg-icons';
import { ApolloTestingController, ApolloTestingModule, } from 'apollo-angular/testing';
import { of, throwError } from 'rxjs';
import { DeleteEntitiesDtoGQL } from '../../graphQL/deleteEntities';
import { GetCkModelsDtoGQL } from '../../graphQL/getCkModels';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../../graphQL/getRuntimeEntityAssociationsById';
import { GetTreeAssociationTargetsDtoGQL } from '../../graphQL/getTreeAssociationTargets';
import { GetTreesDtoGQL } from '../../graphQL/getTrees';
import { AssociationModOptionsDto, CkModelDto, CkTypeDto, GetCkModelByIdDtoGQL, GetCkTypesDtoGQL, GraphDirectionDto, RtAssociationDto, RtEntityDto, } from '../../graphQL/globalTypes';
import { UpdateRuntimeEntitiesDtoGQL } from '../../graphQL/updateRuntimeEntities';
import { UpdateTreeNodesDtoGQL } from '../../graphQL/updateTreeNodes';
import { TreeNavigationConfigService } from '../services/tree-navigation-config.service';
import { TypeHelperService } from '../services/type-helper.service';
import { RuntimeBrowserDataSource } from './runtime-browser-data-source.service';

describe('RuntimeBrowserDataSource', () => {
    type BrowserItem = RtEntityDto | CkModelDto | CkTypeDto | {
        isCkModelsRoot?: boolean;
        ckModelId?: string;
    };

    let service: RuntimeBrowserDataSource;
    let consoleErrorSpy: Mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let consoleWarnSpy: Mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let consoleDebugSpy: Mock;
    let controller: ApolloTestingController;

    const mockTreeEntity: RtEntityDto = {
      rtId: 'tree-1',
      ckTypeId: 'Basic/Tree',
      rtDisplayName: 'Main Tree',
      rtDisplayDescription: 'Tree description',
      attributes: {
        items: [
          { attributeName: 'name', value: 'Main Tree' },
          { attributeName: 'description', value: 'Tree description' },
        ],
      },
      associations: {
        targets: {
          items: [],
          totalCount: 2,
        },
      },
    } as unknown as RtEntityDto;

    const mockTreesResponse = {
      data: {
        runtime: {
          runtimeEntities: {
            items: [mockTreeEntity],
          },
        },
      },
    };

    const mockBasicCkResponse = {
      data: {
        constructionKit: {
          models: {
            items: [{ id: { fullName: 'Basic' }, modelState: 'Released' }],
          },
        },
      },
    };

    const mockCkModelsResponse = {
      data: {
        constructionKit: {
          models: {
            items: [
              {
                id: { fullName: 'Basic' },
                modelState: 'Released',
                dependencies: [],
              },
              {
                id: { fullName: 'Custom' },
                modelState: 'Draft',
                dependencies: ['Basic'],
              },
            ],
          },
        },
      },
    };

    const mockCkTypesResponse = {
      data: {
        constructionKit: {
          types: {
            items: [
              {
                ckTypeId: { fullName: 'Basic/Entity' },
                isAbstract: false,
                isFinal: false,
              },
              {
                ckTypeId: { fullName: 'Basic/Tree' },
                isAbstract: false,
                isFinal: true,
              },
            ],
          },
        },
      },
    };

    // Build a getCkTypeAssociationRoles response from a list of inbound roles.
    const rolesResponse = (inAll: {
        roleId: string;
        navigationPropertyName: string;
        targetCkTypeId: string;
    }[]) => ({
      data: {
        constructionKit: {
          types: {
            items: [
              {
                rtCkTypeId: 'rt',
                associations: {
                  in: {
                    all: inAll.map((r) => ({
                      roleId: {
                        fullName: r.roleId,
                        semanticVersionedFullName: `${r.roleId}:1.0.0`,
                      },
                      rtRoleId: r.roleId,
                      navigationPropertyName: r.navigationPropertyName,
                      multiplicity: 'N',
                      targetCkTypeId: { fullName: r.targetCkTypeId },
                      // For an inbound role the related (navigable) type is the
                      // origin side; the data source queries targets() with this.
                      rtOriginCkTypeId: r.targetCkTypeId,
                      rtTargetCkTypeId: 'Self/Type',
                    })),
                  },
                  out: { all: [] },
                },
              },
            ],
          },
        },
      },
    });

    // Build a getTreeAssociationTargets response.
    const targetsResponse = (items: {
        rtId: string;
        ckTypeId: string;
        name: string;
    }[], totalCount: number) => ({
      data: {
        runtime: {
          runtimeEntities: {
            items: [
              {
                associations: {
                  targets: {
                    totalCount,
                    items: items.map((i) => ({
                      rtId: i.rtId,
                      ckTypeId: i.ckTypeId,
                      rtDisplayName: i.name,
                      rtDisplayDescription: null,
                      rtWellKnownName: null,
                      attributes: {
                        items: [{ attributeName: 'name', value: i.name }],
                      },
                    })),
                  },
                },
              },
            ],
          },
        },
      },
    });

    // Inbound roles per CK type: Basic/Tree has ParentChild (→TreeNode, flattened)
    // and RelatedClassification (→Asset, grouped); other types have none.
    const inboundRolesByType: Record<string, {
        roleId: string;
        navigationPropertyName: string;
        targetCkTypeId: string;
    }[]> = {
      'Basic/Tree': [
        {
          roleId: 'System/ParentChild',
          navigationPropertyName: 'Children',
          targetCkTypeId: 'Basic/TreeNode',
        },
        {
          roleId: 'Basic/RelatedClassification',
          navigationPropertyName: 'RelatedClassifications',
          targetCkTypeId: 'Basic/Asset',
        },
      ],
    };

    const node1 = { rtId: 'node-1', ckTypeId: 'Basic/TreeNode', name: 'Node 1' };
    const node2 = { rtId: 'node-2', ckTypeId: 'Basic/TreeNode', name: 'Node 2' };
    const asset1 = { rtId: 'asset-1', ckTypeId: 'Basic/Asset', name: 'Asset 1' };

    // getParentChildAssociation reads target* fields (roleId-scoped call).
    const mockAssocResponse = {
      data: {
        runtime: {
          runtimeEntities: {
            items: [
              {
                associations: {
                  definitions: {
                    items: [
                      { targetCkTypeId: 'Basic/Tree', targetRtId: 'parent-1' },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    };

    // Role discovery reads the entity's ACTUAL inbound edges (no roleId filter):
    // 2 ParentChild (from TreeNode) + 1 RelatedClassification (from Asset).
    const discoveryDefsResponse = {
      data: {
        runtime: {
          runtimeEntities: {
            items: [
              {
                associations: {
                  definitions: {
                    items: [
                      {
                        ckAssociationRoleId: 'System/ParentChild',
                        originCkTypeId: 'Basic/TreeNode',
                        originRtId: 'node-1',
                      },
                      {
                        ckAssociationRoleId: 'System/ParentChild',
                        originCkTypeId: 'Basic/TreeNode',
                        originRtId: 'node-2',
                      },
                      {
                        ckAssociationRoleId: 'Basic/RelatedClassification',
                        originCkTypeId: 'Basic/Asset',
                        originRtId: 'asset-1',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    };

    // roleId present → getParentChildAssociation; absent → inbound-edge discovery.
    const assocFetchFake = (options: {
        variables: {
            roleId?: string;
        };
    }) => of(options.variables.roleId ? mockAssocResponse : discoveryDefsResponse);

    const mockDeleteResponse = {
      data: {
        runtime: {
          runtimeEntities: {
            delete: true,
          },
        },
      },
    };

    const mockGetTreesGQL = {
      fetch: vi.fn().mockName('fetch').mockReturnValue(of(mockTreesResponse)),
    };

    // Returns inbound roles for the requested CK type (empty when unknown).
    const rolesFetchFake = (options: {
        variables: {
            ckTypeId: string;
        };
    }) => of(rolesResponse(inboundRolesByType[options.variables.ckTypeId] ?? []));

    // Returns targets/counts per role. `first: 1` is a count call (no items).
    const targetsFetchFake = (options: {
        variables: {
            roleId: string;
            first?: number;
        };
    }) => {
      const isCount = options.variables.first === 1;
      switch (options.variables.roleId) {
        case 'System/ParentChild':
          return of(targetsResponse(isCount ? [] : [node1, node2], 2));
        case 'Basic/RelatedClassification':
          return of(targetsResponse(isCount ? [] : [asset1], 2));
        default:
          return of(targetsResponse([], 0));
      }
    };

    const mockGetCkTypeAssociationRolesGQL = {
      fetch: vi.fn().mockName('fetch').mockImplementation(rolesFetchFake),
    };

    const mockGetTreeAssociationTargetsGQL = {
      fetch: vi.fn().mockName('fetch').mockImplementation(targetsFetchFake),
    };

    const mockGetCkModelsGQL = {
      fetch: vi.fn().mockName('fetch').mockReturnValue(of(mockCkModelsResponse)),
    };

    const mockGetCkTypesGQL = {
      fetch: vi.fn().mockName('fetch').mockReturnValue(of(mockCkTypesResponse)),
    };

    const mockGetCkModelByIdGQL = {
      fetch: vi.fn().mockName('fetch').mockReturnValue(of(mockBasicCkResponse)),
    };

    const mockGetRuntimeEntityAssociationsByIdDtoGQL = {
      fetch: vi.fn().mockName('fetch').mockImplementation(assocFetchFake),
    };

    const mockDeleteEntitiesDtoGQL = {
      mutate: vi.fn().mockName('mutate').mockReturnValue(of(mockDeleteResponse)),
    };

    const mockUpdateTreeNodesGQL = {
      mutate: vi.fn().mockName('mutate').mockReturnValue(of({ data: {} })),
    };

    const mockUpdateRuntimeEntitiesGQL = {
      mutate: vi.fn().mockName('mutate').mockReturnValue(of({ data: {} })),
    };

    const mockTypeHelperService = {
      isRuntimeEntity: vi.fn().mockName('isRuntimeEntity').mockReturnValue(true),
    };

    // No per-tenant overrides by default → pure auto-discovery (Phase 1 behavior).
    // No configured perspectives → only the built-in spatial perspective (AB#4263).
    const mockTreeNavConfig = {
      resolve: vi.fn().mockName('resolve').mockResolvedValue(undefined),
      perspectives: vi.fn().mockName('perspectives').mockResolvedValue([]),
    };

    beforeEach(async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
      consoleDebugSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);

      await TestBed.configureTestingModule({
        imports: [ApolloTestingModule],
        providers: [
          RuntimeBrowserDataSource,
          { provide: GetTreesDtoGQL, useValue: mockGetTreesGQL },
          {
            provide: GetCkTypeAssociationRolesDtoGQL,
            useValue: mockGetCkTypeAssociationRolesGQL,
          },
          {
            provide: GetTreeAssociationTargetsDtoGQL,
            useValue: mockGetTreeAssociationTargetsGQL,
          },
          { provide: GetCkModelsDtoGQL, useValue: mockGetCkModelsGQL },
          { provide: GetCkTypesDtoGQL, useValue: mockGetCkTypesGQL },
          { provide: GetCkModelByIdDtoGQL, useValue: mockGetCkModelByIdGQL },
          {
            provide: GetRuntimeEntityAssociationsByIdDtoGQL,
            useValue: mockGetRuntimeEntityAssociationsByIdDtoGQL,
          },
          { provide: DeleteEntitiesDtoGQL, useValue: mockDeleteEntitiesDtoGQL },
          { provide: UpdateTreeNodesDtoGQL, useValue: mockUpdateTreeNodesGQL },
          { provide: UpdateRuntimeEntitiesDtoGQL, useValue: mockUpdateRuntimeEntitiesGQL },
          { provide: TypeHelperService, useValue: mockTypeHelperService },
          { provide: TreeNavigationConfigService, useValue: mockTreeNavConfig },
        ],
      }).compileComponents();

      controller = TestBed.inject(ApolloTestingController);
      service = TestBed.inject(RuntimeBrowserDataSource);
    });

    afterEach(() => {
      mockGetTreesGQL.fetch.mockClear();
      mockGetCkTypeAssociationRolesGQL.fetch.mockClear();
      mockGetTreeAssociationTargetsGQL.fetch.mockClear();
      mockGetCkModelsGQL.fetch.mockClear();
      mockGetCkTypesGQL.fetch.mockClear();
      mockGetCkModelByIdGQL.fetch.mockClear();
      mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockClear();
      mockDeleteEntitiesDtoGQL.mutate.mockClear();
      mockTypeHelperService.isRuntimeEntity.mockClear();
      mockTreeNavConfig.resolve.mockClear();
      mockTreeNavConfig.resolve.mockResolvedValue(undefined);
      mockTreeNavConfig.perspectives.mockClear();
      mockTreeNavConfig.perspectives.mockResolvedValue([]);

      mockGetTreesGQL.fetch.mockReturnValue(of(mockTreesResponse));
      mockGetCkTypeAssociationRolesGQL.fetch.mockImplementation(rolesFetchFake);
      mockGetTreeAssociationTargetsGQL.fetch.mockImplementation(targetsFetchFake);
      mockGetCkModelsGQL.fetch.mockReturnValue(of(mockCkModelsResponse));
      mockGetCkTypesGQL.fetch.mockReturnValue(of(mockCkTypesResponse));
      mockGetCkModelByIdGQL.fetch.mockReturnValue(of(mockBasicCkResponse));
      mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation(assocFetchFake);
      mockDeleteEntitiesDtoGQL.mutate.mockReturnValue(of(mockDeleteResponse));
      mockUpdateTreeNodesGQL.mutate.mockClear();
      mockUpdateTreeNodesGQL.mutate.mockReturnValue(of({ data: {} }));
      mockUpdateRuntimeEntitiesGQL.mutate.mockClear();
      mockUpdateRuntimeEntitiesGQL.mutate.mockReturnValue(of({ data: {} }));
      controller.verify();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    describe('fetchRootNodes', () => {
      it('should return CK Models root node', async () => {
        const nodes = await service.fetchRootNodes();

        const ckModelsRoot = nodes.find((n) => n.text === 'CK Models');
        expect(ckModelsRoot).toBeTruthy();
        expect(ckModelsRoot?.expandable).toBe(true);
      });

      it('should include Tree entities when Basic CK is available', async () => {
        const nodes = await service.fetchRootNodes();

        expect(mockGetCkModelByIdGQL.fetch).toHaveBeenCalled();
        expect(mockGetTreesGQL.fetch).toHaveBeenCalled();

        const treeNode = nodes.find((n) => n.text === 'Main Tree');
        expect(treeNode).toBeTruthy();
      });

      it('should not fetch trees when Basic CK is not available', async () => {
        mockGetCkModelByIdGQL.fetch.mockReturnValue(of({
          data: { constructionKit: { models: { items: [] } } },
        }));

        const nodes = await service.fetchRootNodes();

        expect(mockGetTreesGQL.fetch).not.toHaveBeenCalled();
        expect(nodes.length).toBe(1);
      });

      it('should handle error when checking Basic CK availability', async () => {
        mockGetCkModelByIdGQL.fetch.mockReturnValue(throwError(() => new Error('Network error')));

        const nodes = await service.fetchRootNodes();

        expect(nodes.length).toBe(1);
        expect(mockGetTreesGQL.fetch).not.toHaveBeenCalled();
      });

      it('should handle empty tree response', async () => {
        mockGetTreesGQL.fetch.mockReturnValue(of({
          data: { runtime: { runtimeEntities: { items: [] } } },
        }));

        const nodes = await service.fetchRootNodes();

        expect(nodes.length).toBe(1);
      });

      it('should handle fetch root nodes error gracefully', async () => {
        mockGetCkModelByIdGQL.fetch.mockReturnValue(of(mockBasicCkResponse));
        mockGetTreesGQL.fetch.mockReturnValue(throwError(() => new Error('Fetch error')));

        const nodes = await service.fetchRootNodes();

        expect(nodes).toEqual([]);
      });

      it('should set expandable based on associations count', async () => {
        const nodes = await service.fetchRootNodes();

        const treeNode = nodes.find((n) => n.text === 'Main Tree');
        expect(treeNode?.expandable).toBe(true);
      });
    });

    describe('tree perspectives (AB#4263)', () => {
      const systemsPerspective = {
        key: 'Systems',
        displayName: 'Systems',
        sortIndex: 1,
        rootMode: 'Type' as const,
        rootCkTypeId: 'EnergyIQ/DistributionSystem',
        primaryRoleId: 'EnergyIQ/SystemMembers',
        secondaryRoleIds: ['EnergyIQ/SystemSpaces'],
      };

      // The root-entities-by-type inline query goes through Apollo; flush it while
      // fetchRootNodes is still awaiting.
      async function flushInline(operationName: string, response: {
            data: Record<string, unknown>;
        }): Promise<void> {
        for (let i = 0; i < 20; i++) {
          const matches = controller.match((op) => op.operationName === operationName);
          if (matches.length > 0) {
            matches[0].flush(response);
            return;
          }
          await Promise.resolve();
        }
        throw new Error(`inline operation not issued: ${operationName}`);
      }

      const oneDistributionSystem = {
        data: {
          runtime: {
            runtimeEntities: {
              items: [
                {
                  rtId: 'ds-1',
                  ckTypeId: 'EnergyIQ/DistributionSystem',
                  rtDisplayName: 'Heating circuit',
                  rtDisplayDescription: null,
                  rtWellKnownName: null,
                  attributes: {
                    items: [{ attributeName: 'name', value: 'Heating circuit' }],
                  },
                },
              ],
            },
          },
        },
      };

      it('getPerspectives prepends the built-in Spatial perspective and de-dupes by key', async () => {
        mockTreeNavConfig.perspectives.mockResolvedValue([systemsPerspective]);
        const list = await service.getPerspectives();
        expect(list[0].key).toBe('Spatial');
        expect(list.map((p) => p.key)).toContain('Systems');
        expect(list.filter((p) => p.key === 'Spatial').length).toBe(1);
      });

      it('roots a Type perspective on all instances of its CK type (no Basic/Tree fetch)', async () => {
        mockTreeNavConfig.perspectives.mockResolvedValue([systemsPerspective]);
        mockGetCkTypeAssociationRolesGQL.fetch.mockImplementation(() => of(rolesResponse([
          {
            roleId: 'EnergyIQ/SystemMembers',
            navigationPropertyName: 'SystemMembers',
            targetCkTypeId: 'Basic/NamedEntity',
          },
        ])));

        service.setActivePerspective('Systems');
        const rootsPromise = service.fetchRootNodes();
        await flushInline('getRuntimeEntitiesByCkType', oneDistributionSystem);
        const roots = await rootsPromise;

        expect(mockGetTreesGQL.fetch).not.toHaveBeenCalled();
        const ds = roots.find((n) => n.text === 'Heating circuit');
        expect(ds).toBeTruthy();
        expect(ds?.expandable).toBe(true);
      });

      it('restricts a Type-perspective root to its primary + secondary roles (whitelist-at-root-only)', async () => {
        mockTreeNavConfig.perspectives.mockResolvedValue([systemsPerspective]);
        mockGetCkTypeAssociationRolesGQL.fetch.mockImplementation(() => of(rolesResponse([
          {
            roleId: 'EnergyIQ/SystemMembers',
            navigationPropertyName: 'SystemMembers',
            targetCkTypeId: 'Basic/NamedEntity',
          },
          {
            roleId: 'EnergyIQ/SystemSpaces',
            navigationPropertyName: 'ServesSpaces',
            targetCkTypeId: 'EnergyIQ/Space',
          },
        ])));
        // The root DistributionSystem has whitelisted edges plus a non-whitelisted
        // 'Noise' role that must be filtered out at the root level.
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation((opts: {
                variables: {
                    roleId?: string;
                };
            }) => opts.variables.roleId
          ? of(mockAssocResponse)
          : of({
            data: {
              runtime: {
                runtimeEntities: {
                  items: [
                    {
                      associations: {
                        definitions: {
                          items: [
                            {
                              ckAssociationRoleId: 'EnergyIQ/SystemMembers',
                              originCkTypeId: 'EnergyIQ/HeatPump',
                              originRtId: 'hp-1',
                            },
                            {
                              ckAssociationRoleId: 'EnergyIQ/SystemSpaces',
                              originCkTypeId: 'EnergyIQ/Space',
                              originRtId: 'sp-1',
                            },
                            {
                              ckAssociationRoleId: 'EnergyIQ/SystemSpaces',
                              originCkTypeId: 'EnergyIQ/Space',
                              originRtId: 'sp-2',
                            },
                            {
                              ckAssociationRoleId: 'EnergyIQ/Noise',
                              originCkTypeId: 'EnergyIQ/Thing',
                              originRtId: 'th-1',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          }));

        service.setActivePerspective('Systems');
        const rootsPromise = service.fetchRootNodes();
        await flushInline('getRuntimeEntitiesByCkType', oneDistributionSystem);
        const roots = await rootsPromise;
        const dsRoot = roots.find((n) => n.text === 'Heating circuit')!;

        const children = await service.fetchChildren(dsRoot);
        const texts = children.map((c) => c.text);
        // Secondary role → group node; non-whitelisted role dropped; primary role
        // is flattened (not a group node).
        expect(texts.some((t) => t.includes('ServesSpaces'))).toBe(true);
        expect(texts.some((t) => t.includes('Noise'))).toBe(false);
        expect(texts.some((t) => t.includes('SystemMembers'))).toBe(false);
      });

      it('navigates a perspective root OUTBOUND when primaryDirection is Outbound', async () => {
        // Canonical EnergyIQ case: the SystemMembers association is authored on the
        // DistributionSystem (System --SystemMembers--> member), so members are
        // reached outbound. Discovery + schema roles must use the outbound side.
        mockTreeNavConfig.perspectives.mockResolvedValue([
          { ...systemsPerspective, secondaryRoleIds: undefined, primaryDirection: 'Outbound' },
        ]);

        // Schema: SystemMembers is an OUTBOUND role of DistributionSystem → members
        // are NamedEntity (used as the ckId for the flattened target fetch).
        mockGetCkTypeAssociationRolesGQL.fetch.mockReturnValue(of({
          data: {
            constructionKit: {
              types: {
                items: [
                  {
                    rtCkTypeId: 'rt',
                    associations: {
                      in: { all: [] },
                      out: {
                        all: [
                          {
                            roleId: {
                              fullName: 'EnergyIQ/SystemMembers',
                              semanticVersionedFullName: 'EnergyIQ/SystemMembers:1.0.0',
                            },
                            rtRoleId: 'EnergyIQ/SystemMembers',
                            navigationPropertyName: 'SystemMembers',
                            multiplicity: 'N',
                            targetCkTypeId: { fullName: 'Basic/NamedEntity' },
                            rtOriginCkTypeId: 'Self/Type',
                            rtTargetCkTypeId: 'Basic/NamedEntity',
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        }));

        // Discovery (no roleId) in OUTBOUND direction: the root's outbound edges
        // point to the members via targetCkTypeId.
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation((opts: {
                variables: {
                    roleId?: string;
                };
            }) => opts.variables.roleId
          ? of(mockAssocResponse)
          : of({
            data: {
              runtime: {
                runtimeEntities: {
                  items: [
                    {
                      associations: {
                        definitions: {
                          items: [
                            {
                              ckAssociationRoleId: 'EnergyIQ/SystemMembers',
                              targetCkTypeId: 'EnergyIQ/HeatPump',
                              targetRtId: 'hp-1',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          }));

        // Flattened primary members loaded via getTreeAssociationTargets.
        mockGetTreeAssociationTargetsGQL.fetch.mockReturnValue(of(targetsResponse([{ rtId: 'hp-1', ckTypeId: 'EnergyIQ/HeatPump', name: 'Heat pump' }], 1)));

        service.setActivePerspective('Systems');
        const rootsPromise = service.fetchRootNodes();
        await flushInline('getRuntimeEntitiesByCkType', oneDistributionSystem);
        const roots = await rootsPromise;
        const dsRoot = roots.find((n) => n.text === 'Heating circuit')!;
        expect(dsRoot.expandable).toBe(true);

        const children = await service.fetchChildren(dsRoot);
        // Member flattened directly under the system → outbound navigation reached it.
        expect(children.map((c) => c.text)).toContain('Heat pump');

        // Discovery was issued OUTBOUND, and the flattened target fetch too.
        const discoveryDirections = vi.mocked(mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch).mock.calls.map((c) => c[0] as {
                variables: {
                    roleId?: string;
                    direction?: string;
                };
            })
          .filter((a) => !a.variables.roleId)
          .map((a) => a.variables.direction);
        expect(discoveryDirections).toContain(GraphDirectionDto.OutboundDto);
        expect((vi.mocked(mockGetTreeAssociationTargetsGQL.fetch).mock.lastCall![0] as {
                variables: {
                    direction: string;
                };
            }).variables.direction).toBe(GraphDirectionDto.OutboundDto);
      });

      it('does not re-apply the perspective at a deep recurrence of a root (no cycle)', async () => {
        mockTreeNavConfig.perspectives.mockResolvedValue([
          { ...systemsPerspective, secondaryRoleIds: undefined, primaryDirection: 'Outbound' },
        ]);
        service.setActivePerspective('Systems');
        const rootsPromise = service.fetchRootNodes();
        await flushInline('getRuntimeEntitiesByCkType', oneDistributionSystem);
        await rootsPromise;

        // A deep occurrence of the same DistributionSystem carries a NORMAL id (no
        // perspective-root prefix) — e.g. reached as a member's back-reference.
        const deepDs = new TreeItemDataTyped<BrowserItem>('EnergyIQ/DistributionSystem@ds-1', 'Heating circuit', '', { rtId: 'ds-1', ckTypeId: 'EnergyIQ/DistributionSystem' } as RtEntityDto, fileIcon, true);
        // Inbound discovery for the deep node returns nothing → no members re-appear.
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation((opts: {
                variables: {
                    roleId?: string;
                };
            }) => opts.variables.roleId
          ? of(mockAssocResponse)
          : of({
            data: {
              runtime: {
                runtimeEntities: {
                  items: [
                    { associations: { definitions: { items: [] } } },
                  ],
                },
              },
            },
          }));

        const children = await service.fetchChildren(deepDs);
        expect(children.length).toBe(0);

        // The deep node was discovered INBOUND (default), not OUTBOUND — proving the
        // perspective's outbound navigation is not re-applied, so no cycle.
        const discoveryDirections = vi.mocked(mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch).mock.calls.map((c) => c[0] as {
                variables: {
                    roleId?: string;
                    direction?: string;
                };
            })
          .filter((a) => !a.variables.roleId)
          .map((a) => a.variables.direction);
        expect(discoveryDirections).toContain(GraphDirectionDto.InboundDto);
        expect(discoveryDirections).not.toContain(GraphDirectionDto.OutboundDto);
      });

      // Direct-parent back-edge suppression: the edge traversed downwards (system
      // --SystemMembers--> member) is the same edge the member's inbound
      // auto-discovery finds again; the parent must not reappear under its child.
      describe('direct-parent back-edge suppression', () => {
            // Schema: DistributionSystem navigates SystemMembers OUTBOUND; a member
            // (HeatPump) sees the same role INBOUND as 'MemberOfSystem'.
            interface SchemaRole {
                roleId: string;
                navigationPropertyName: string;
                rtOriginCkTypeId?: string;
                rtTargetCkTypeId?: string;
            }
            const schemaByType: Record<string, {
                in: SchemaRole[];
                out: SchemaRole[];
            }> = {
              'EnergyIQ/DistributionSystem': {
                in: [],
                out: [
                  {
                    roleId: 'EnergyIQ/SystemMembers',
                    navigationPropertyName: 'SystemMembers',
                    rtTargetCkTypeId: 'Basic/NamedEntity',
                  },
                ],
              },
              'EnergyIQ/HeatPump': {
                in: [
                  {
                    roleId: 'EnergyIQ/SystemMembers',
                    navigationPropertyName: 'MemberOfSystem',
                    rtOriginCkTypeId: 'EnergyIQ/DistributionSystem',
                  },
                ],
                out: [],
              },
            };

            const schemaRolesFake = (opts: {
                variables: {
                    ckTypeId: string;
                };
            }) => {
              const schema = schemaByType[opts.variables.ckTypeId] ?? { in: [], out: [] };
              const toRole = (r: SchemaRole) => ({
                roleId: { fullName: r.roleId, semanticVersionedFullName: `${r.roleId}:1` },
                rtRoleId: r.roleId,
                navigationPropertyName: r.navigationPropertyName,
                multiplicity: 'N',
                targetCkTypeId: { fullName: 'x' },
                rtOriginCkTypeId: r.rtOriginCkTypeId ?? 'Self/Type',
                rtTargetCkTypeId: r.rtTargetCkTypeId ?? 'Self/Type',
              });
              return of({
                data: {
                  constructionKit: {
                    types: {
                      items: [
                        {
                          rtCkTypeId: 'rt',
                          associations: {
                            in: { all: schema.in.map(toRole) },
                            out: { all: schema.out.map(toRole) },
                          },
                        },
                      ],
                    },
                  },
                },
              });
            };

            // Discovery per entity: the root's outbound members, the member's inbound
            // back-edge to its parent system plus (optionally) a second system.
            const discoveryFake = (memberSystems: {
                rtId: string;
            }[]) => (opts: {
                variables: {
                    roleId?: string;
                    rtId: string;
                };
            }) => {
              if (opts.variables.roleId) {
                return of(mockAssocResponse);
              }
              const items = opts.variables.rtId === 'ds-1'
                ? [
                  {
                    ckAssociationRoleId: 'EnergyIQ/SystemMembers',
                    targetCkTypeId: 'EnergyIQ/HeatPump',
                    targetRtId: 'hp-1',
                  },
                ]
                : memberSystems.map((s) => ({
                  ckAssociationRoleId: 'EnergyIQ/SystemMembers',
                  originCkTypeId: 'EnergyIQ/DistributionSystem',
                  originRtId: s.rtId,
                }));
              return of({
                data: {
                  runtime: {
                    runtimeEntities: {
                      items: [{ associations: { definitions: { items } } }],
                    },
                  },
                },
              });
            };

            // Expands the Systems root and returns the flattened HeatPump member item.
            // (Return type inferred — the service's internal BrowserItem union differs
            // from the spec-local one by the AssociationGroupNode member.)
            async function expandRootToMember() {
              service.setActivePerspective('Systems');
              const rootsPromise = service.fetchRootNodes();
              await flushInline('getRuntimeEntitiesByCkType', oneDistributionSystem);
              const roots = await rootsPromise;
              const dsRoot = roots.find((n) => n.text === 'Heating circuit')!;
              const children = await service.fetchChildren(dsRoot);
              return children.find((c) => c.text === 'Heat pump')!;
            }

            beforeEach(() => {
              mockTreeNavConfig.perspectives.mockResolvedValue([
                {
                  ...systemsPerspective,
                  secondaryRoleIds: undefined,
                  primaryDirection: 'Outbound',
                },
              ]);
              mockGetCkTypeAssociationRolesGQL.fetch.mockImplementation(schemaRolesFake);
              mockGetTreeAssociationTargetsGQL.fetch.mockImplementation((opts: {
                    variables: {
                        rtId: string;
                    };
                }) => of(opts.variables.rtId === 'ds-1'
                ? targetsResponse([{ rtId: 'hp-1', ckTypeId: 'EnergyIQ/HeatPump', name: 'Heat pump' }], 1)
                : targetsResponse([
                  {
                    rtId: 'ds-1',
                    ckTypeId: 'EnergyIQ/DistributionSystem',
                    name: 'Heating circuit',
                  },
                  {
                    rtId: 'ds-2',
                    ckTypeId: 'EnergyIQ/DistributionSystem',
                    name: 'Cooling circuit',
                  },
                ], 2)));
            });

            it('does not show the parent system again under a member reached from it', async () => {
              mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation(discoveryFake([{ rtId: 'ds-1' }]));

              const member = await expandRootToMember();
              expect(member).toBeTruthy();

              // The member's only inbound edge is the back-edge to ds-1 → no children.
              const memberChildren = await service.fetchChildren(member);
              expect(memberChildren.length).toBe(0);
            });

            it('keeps the other systems of an N:N member and excludes only the parent', async () => {
              mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation(discoveryFake([{ rtId: 'ds-1' }, { rtId: 'ds-2' }]));

              const member = await expandRootToMember();
              const memberChildren = await service.fetchChildren(member);

              // The back-edge to ds-1 is excluded from the count; ds-2 remains.
              const group = memberChildren.find((c) => c.text.includes('MemberOfSystem'))!;
              expect(group).toBeTruthy();
              expect(group.text).toBe('MemberOfSystem (1)');

              // Expanding the group loads both systems but drops the direct parent.
              const groupChildren = await service.fetchChildren(group);
              expect(groupChildren.map((c) => c.text)).toEqual(['Cooling circuit']);
            });
      });
    });

    describe('fetchChildren', () => {
      it('should fetch CK models when expanding CK Models root', async () => {
        const ckModelsRoot = new TreeItemDataTyped<BrowserItem>('ck-models-root', 'CK Models', '', { isCkModelsRoot: true }, fileIcon, true);

        const children = await service.fetchChildren(ckModelsRoot);

        expect(mockGetCkModelsGQL.fetch).toHaveBeenCalled();
        expect(children.length).toBe(2);
        expect(children[0].text).toBe('Basic');
        expect(children[1].text).toBe('Custom');
      });

      it('should fetch CK types when expanding a CK model', async () => {
        const ckModel: CkModelDto = {
          id: { fullName: 'Basic', name: 'Basic', semanticVersionedFullName: 'Basic', version: '1.0.0' },
          dependencies: [],
        };
        const modelNode = new TreeItemDataTyped<BrowserItem>('model:Basic', 'Basic', '', ckModel, fileIcon, true);

        const children = await service.fetchChildren(modelNode);

        expect(mockGetCkTypesGQL.fetch).toHaveBeenCalled();
        const callArgs = vi.mocked(mockGetCkTypesGQL.fetch).mock.lastCall![0];
        expect(callArgs.variables.ckModelIds).toContain('Basic');
        expect(children.length).toBe(2);
      });

      it('should return empty array for CK type nodes', async () => {
        const ckType: CkTypeDto = {
          ckTypeId: { fullName: 'Basic/Entity', semanticVersionedFullName: 'Basic/Entity' },
          isAbstract: false,
          isFinal: false,
          rtCkTypeId: 'Basic/Entity',
        };
        const typeNode = new TreeItemDataTyped<BrowserItem>('type:Basic/Entity', 'Basic/Entity', '', ckType, fileIcon, false);

        const children = await service.fetchChildren(typeNode);

        expect(children).toEqual([]);
      });

      it('should return empty array for entity without rtId', async () => {
        const ckType: CkTypeDto = {
          ckTypeId: { fullName: 'Test/Type', semanticVersionedFullName: 'Test/Type' },
          isAbstract: false,
          isFinal: false,
          rtCkTypeId: 'Test/Type',
        };
        const invalidNode = new TreeItemDataTyped<BrowserItem>('invalid', 'Invalid', '', ckType, fileIcon, false);

        const children = await service.fetchChildren(invalidNode);

        expect(children).toEqual([]);
      });

      const makeTreeEntityNode = () => new TreeItemDataTyped<BrowserItem>('Basic/Tree@tree-1', 'Main Tree', '', { rtId: 'tree-1', ckTypeId: 'Basic/Tree' } as RtEntityDto, fileIcon, true);

      it('should flatten System/ParentChild children directly under the entity', async () => {
        const children = await service.fetchChildren(makeTreeEntityNode());

        expect(mockGetCkTypeAssociationRolesGQL.fetch).toHaveBeenCalled();
        expect(children.find((c) => c.text === 'Node 1')).toBeTruthy();
        expect(children.find((c) => c.text === 'Node 2')).toBeTruthy();
      });

      it('should render non-parent-child roles as expandable group nodes', async () => {
        const children = await service.fetchChildren(makeTreeEntityNode());

        const group = children.find((c) => c.text === 'RelatedClassifications (1)');
        expect(group).toBeTruthy();
        expect(group?.expandable).toBe(true);
        expect((group?.item as {
                isAssociationGroup?: boolean;
            }).isAssociationGroup).toBe(true);
      });

      it('aggregates one role across concrete origin subtypes into a single group', async () => {
        // Two RelatedClassification edges from two different concrete asset
        // subtypes must collapse into ONE group, sized by the edge count, using
        // the schema origin base (Basic/Asset) as the ckId.
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockImplementation((options: {
                variables: {
                    roleId?: string;
                };
            }) => options.variables.roleId
          ? of(mockAssocResponse)
          : of({
            data: {
              runtime: {
                runtimeEntities: {
                  items: [
                    {
                      associations: {
                        definitions: {
                          items: [
                            {
                              ckAssociationRoleId: 'Basic/RelatedClassification',
                              originCkTypeId: 'Basic/AssetTypeA',
                              originRtId: 'a1',
                            },
                            {
                              ckAssociationRoleId: 'Basic/RelatedClassification',
                              originCkTypeId: 'Basic/AssetTypeB',
                              originRtId: 'b1',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          }));

        const children = await service.fetchChildren(makeTreeEntityNode());

        const groups = children.filter((c) => c.text?.startsWith('RelatedClassifications'));
        expect(groups.length).toBe(1);
        expect(groups[0].text).toBe('RelatedClassifications (2)');
      });

      it('should mark a child entity expandable only when its type has inbound roles', async () => {
        const children = await service.fetchChildren(makeTreeEntityNode());

        // Basic/TreeNode has no inbound roles in this fixture → not expandable.
        const node1 = children.find((c) => c.text === 'Node 1');
        expect(node1?.expandable).toBe(false);
      });

      it('should lazily load the targets of an association group node', async () => {
        const children = await service.fetchChildren(makeTreeEntityNode());
        const group = children.find((c) => c.text === 'RelatedClassifications (1)')!;

        const groupChildren = await service.fetchChildren(group as TreeItemDataTyped<BrowserItem>);

        expect(groupChildren.find((c) => c.text === 'Asset 1')).toBeTruthy();
      });

      it('hides a role when the tenant config sets visible=false', async () => {
        mockTreeNavConfig.resolve.mockImplementation((_ckTypeId, roleId) => Promise.resolve(roleId === 'Basic/RelatedClassification'
          ? { visible: false }
          : undefined));

        const children = await service.fetchChildren(makeTreeEntityNode());

        expect(children.find((c) => c.text?.startsWith('RelatedClassifications'))).toBeUndefined();
        // ParentChild children remain.
        expect(children.find((c) => c.text === 'Node 1')).toBeTruthy();
      });

      it('flattens a role and applies the displayName override', async () => {
        mockTreeNavConfig.resolve.mockImplementation((_ckTypeId, roleId) => Promise.resolve(roleId === 'Basic/RelatedClassification'
          ? { grouped: false, displayName: 'Klassifizierungen' }
          : undefined));

        const children = await service.fetchChildren(makeTreeEntityNode());

        // grouped=false → the target is flattened directly under the entity...
        expect(children.find((c) => c.text === 'Asset 1')).toBeTruthy();
        // ...and there is no group node for it.
        expect(children.find((c) => c.text?.startsWith('Klassifizierungen'))).toBeUndefined();
      });

      it('should handle CK models fetch error', async () => {
        mockGetCkModelsGQL.fetch.mockReturnValue(throwError(() => new Error('Error')));

        const ckModelsRoot = new TreeItemDataTyped<BrowserItem>('ck-models-root', 'CK Models', '', { isCkModelsRoot: true }, fileIcon, true);

        const children = await service.fetchChildren(ckModelsRoot);

        expect(children).toEqual([]);
      });

      it('should handle CK types fetch error', async () => {
        mockGetCkTypesGQL.fetch.mockReturnValue(throwError(() => new Error('Error')));

        const ckModel: CkModelDto = {
          id: { fullName: 'Basic', name: 'Basic', semanticVersionedFullName: 'Basic', version: '1.0.0' },
          dependencies: [],
        };
        const modelNode = new TreeItemDataTyped<BrowserItem>('model:Basic', 'Basic', '', ckModel, fileIcon, true);

        const children = await service.fetchChildren(modelNode);

        expect(children).toEqual([]);
      });

      it('should handle empty CK models response', async () => {
        mockGetCkModelsGQL.fetch.mockReturnValue(of({
          data: { constructionKit: { models: { items: [] } } },
        }));

        const ckModelsRoot = new TreeItemDataTyped<BrowserItem>('ck-models-root', 'CK Models', '', { isCkModelsRoot: true }, fileIcon, true);

        const children = await service.fetchChildren(ckModelsRoot);

        expect(children).toEqual([]);
      });

      it('should skip null items in CK models response', async () => {
        mockGetCkModelsGQL.fetch.mockReturnValue(of({
          data: {
            constructionKit: {
              models: {
                items: [
                  null,
                  { id: { fullName: 'ValidModel' }, modelState: 'Released' },
                ],
              },
            },
          },
        }));

        const ckModelsRoot = new TreeItemDataTyped<BrowserItem>('ck-models-root', 'CK Models', '', { isCkModelsRoot: true }, fileIcon, true);

        const children = await service.fetchChildren(ckModelsRoot);

        expect(children.length).toBe(1);
        expect(children[0].text).toBe('ValidModel');
      });
    });

    describe('getParentChildAssociation', () => {
      it('should fetch associations with Outbound direction for parent association', async () => {
        const ckTypeId = 'Basic/Tree';
        const rtId = 'tree-1';

        const result = await service.getParentChildAssociation(ckTypeId, rtId, true);

        expect(mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch).toHaveBeenCalledWith({
          variables: {
            ckTypeId,
            rtId,
            direction: GraphDirectionDto.OutboundDto,
            roleId: 'System/ParentChild',
          },
          fetchPolicy: 'network-only',
        });

        expect(result).toBeDefined();
        expect(result?.length).toBe(1);
        expect(result?.[0].targetRtId).toBe('parent-1');
      });

      it('should fetch associations with Inbound direction for child association', async () => {
        const ckTypeId = 'Basic/Tree';
        const rtId = 'tree-1';

        await service.getParentChildAssociation(ckTypeId, rtId, false);

        expect(mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch).toHaveBeenCalledWith(expect.objectContaining({
          variables: expect.objectContaining({
            direction: GraphDirectionDto.InboundDto,
          }),
        }));
      });

      it('should return undefined and log error when fetch fails', async () => {
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockReturnValue(throwError(() => new Error('GraphQL Error')));

        const result = await service.getParentChildAssociation('Type', 'ID', true);

        expect(result).toBeUndefined();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error on attempt to get association', expect.any(Error));
      });

      it('should handle missing data gracefully', async () => {
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.mockReturnValue(of({
          data: { runtime: null },
        }));

        const result = await service.getParentChildAssociation('Type', 'ID', true);
        expect(result).toBeUndefined();
      });
    });

    describe('getRuntimeEntityParentData', () => {
      it('should return parent ckTypeId and rtId when association exists', async () => {
        vi.spyOn(service, 'getParentChildAssociation').mockResolvedValue([
                {
                  targetCkTypeId: 'Parent/Type',
                  targetRtId: 'parent-123',
                } as RtAssociationDto,
        ]);

        const result = await service.getRuntimeEntityParentData('Child/Type', 'child-1');

        expect(service.getParentChildAssociation).toHaveBeenCalledWith('Child/Type', 'child-1', true);
        expect(result).toEqual({ ckTypeId: 'Parent/Type', rtId: 'parent-123' });
      });

      it('should return undefined if no parent associations found', async () => {
        vi.spyOn(service, 'getParentChildAssociation').mockResolvedValue([]);

        const result = await service.getRuntimeEntityParentData('Child/Type', 'child-1');

        expect(result).toBeUndefined();
      });

      it('should return undefined if associations is undefined', async () => {
        vi.spyOn(service, 'getParentChildAssociation').mockResolvedValue(undefined);

        const result = await service.getRuntimeEntityParentData('Child/Type', 'child-1');

        expect(result).toBeUndefined();
      });
    });

    describe('deleteRtEntityAndChildren', () => {
      let mockItemToDelete: TreeItemDataTyped<BrowserItem>;

      beforeEach(() => {
        mockItemToDelete = new TreeItemDataTyped<BrowserItem>('tree-1', 'Tree Item', '', { rtId: 'tree-1', ckTypeId: 'Basic/Tree' } as RtEntityDto, fileIcon, false);
      });

      it('should return false and log error if item is not a runtime entity', async () => {
        mockTypeHelperService.isRuntimeEntity.mockReturnValue(false);

        const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith('The item given for deletion is not a runtime entity', mockItemToDelete);
        expect(mockDeleteEntitiesDtoGQL.mutate).not.toHaveBeenCalled();
      });

      it('should return true when deletion is successful', async () => {
        mockTypeHelperService.isRuntimeEntity.mockReturnValue(true);

        const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

        expect(mockDeleteEntitiesDtoGQL.mutate).toHaveBeenCalledWith({
          variables: {
            rtEntityIds: [{ ckTypeId: 'Basic/Tree', rtId: 'tree-1' }],
          },
        });
        expect(result).toBe(true);
      });

      it('should return false when deletion API returns false', async () => {
        mockDeleteEntitiesDtoGQL.mutate.mockReturnValue(of({
          data: { runtime: { runtimeEntities: { delete: false } } },
        }));

        const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

        expect(result).toBe(false);
      });

      it('should catch GraphQL level errors in response and return false', async () => {
        mockTypeHelperService.isRuntimeEntity.mockReturnValue(true);

        mockDeleteEntitiesDtoGQL.mutate.mockReturnValue(of({
          error: { message: 'Some GQL error' },
        }));

        const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error on attempt to cascade delete nodes during Delete Node operation', expect.anything());
      });

      it('should catch network exceptions and return false', async () => {
        mockTypeHelperService.isRuntimeEntity.mockReturnValue(true);

        mockDeleteEntitiesDtoGQL.mutate.mockReturnValue(throwError(() => new Error('Network fail')));

        const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error on attempt to cascade delete nodes during Delete Node operation', expect.any(Error));
      });
    });

    describe('updateParentChildAssociation', () => {
      const params = {
        srcId: 'child-123',
        oldType: 'Type/A',
        oldId: 'parent-old',
        newType: 'Type/B',
        newId: 'parent-new',
      };

      it('should construct the correct mutation payload to swap parents', async () => {
        mockUpdateTreeNodesGQL.mutate.mockReturnValue(of({ data: { update: true } }));

        const result = await service.updateParentChildAssociation(params.srcId, params.oldType, params.oldId, params.newType, params.newId);

        expect(mockUpdateTreeNodesGQL.mutate).toHaveBeenCalledWith({
          variables: {
            entities: [
              {
                rtId: params.srcId,
                item: {
                  parent: [
                    {
                      target: { rtId: params.oldId, ckTypeId: params.oldType },
                      modOption: AssociationModOptionsDto.DeleteDto,
                    },
                  ],
                },
              },
              {
                rtId: params.srcId,
                item: {
                  parent: [
                    {
                      target: { rtId: params.newId, ckTypeId: params.newType },
                      modOption: AssociationModOptionsDto.CreateDto,
                    },
                  ],
                },
              },
            ],
          },
          fetchPolicy: 'network-only',
        });
        expect(result).toBe(true);
      });

      it('should return false and log error when the GraphQL response contains errors', async () => {
        // Simulate a GraphQL error inside a successful 200 OK response
        mockUpdateTreeNodesGQL.mutate.mockReturnValue(of({
          data: null,
          error: { message: 'Unauthorized modification' },
        }));

        const result = await service.updateParentChildAssociation(params.srcId, params.oldType, params.oldId, params.newType, params.newId);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Error on attempt to switch object parents/), params.srcId, expect.any(Object));
      });

      it('should return false and log error when a network/exception occurs', async () => {
        // Simulate a complete stream failure (e.g., 500 error or timeout)
        mockUpdateTreeNodesGQL.mutate.mockReturnValue(throwError(() => new Error('Connection Timeout')));

        const result = await service.updateParentChildAssociation(params.srcId, params.oldType, params.oldId, params.newType, params.newId);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('updateEntityAssociation', () => {
      const params = {
        srcId: 'machine-1',
        srcType: 'Industry.Basic/Machine',
        navProp: 'Parent',
        oldParentType: 'Basic/TreeNode',
        oldParentId: 'node-old',
        newParentType: 'Basic/TreeNode',
        newParentId: 'node-new',
      };

      it('should construct the correct generic mutation payload', async () => {
        mockUpdateRuntimeEntitiesGQL.mutate.mockReturnValue(of({ data: { runtime: { runtimeEntities: { update: [{ rtId: params.srcId }] } } } }));

        const result = await service.updateEntityAssociation(params.srcId, params.srcType, params.navProp, params.oldParentType, params.oldParentId, params.newParentType, params.newParentId);

        expect(mockUpdateRuntimeEntitiesGQL.mutate).toHaveBeenCalledWith({
          variables: {
            entities: [
              {
                rtId: params.srcId,
                item: {
                  ckTypeId: params.srcType,
                  attributes: [],
                  associations: [
                    {
                      roleName: params.navProp,
                      targets: [
                        {
                          target: { rtId: params.oldParentId, ckTypeId: params.oldParentType },
                          modOption: AssociationModOptionsDto.DeleteDto,
                        },
                        {
                          target: { rtId: params.newParentId, ckTypeId: params.newParentType },
                          modOption: AssociationModOptionsDto.CreateDto,
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          fetchPolicy: 'network-only',
        });
        expect(result).toBe(true);
      });

      it('should return false when GraphQL response contains error', async () => {
        mockUpdateRuntimeEntitiesGQL.mutate.mockReturnValue(of({ data: null, error: { message: 'Association not allowed' } }));

        const result = await service.updateEntityAssociation(params.srcId, params.srcType, params.navProp, params.oldParentType, params.oldParentId, params.newParentType, params.newParentId);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Error on attempt to move entity/), params.srcId, expect.any(Object));
      });

      it('should return false when network error occurs', async () => {
        mockUpdateRuntimeEntitiesGQL.mutate.mockReturnValue(throwError(() => new Error('Network error')));

        const result = await service.updateEntityAssociation(params.srcId, params.srcType, params.navProp, params.oldParentType, params.oldParentId, params.newParentType, params.newParentId);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
});
