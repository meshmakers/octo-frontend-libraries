import { TestBed } from '@angular/core/testing';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { fileIcon } from '@progress/kendo-svg-icons';
import {
  ApolloTestingController,
  ApolloTestingModule,
} from 'apollo-angular/testing';
import { of, throwError } from 'rxjs';
import { DeleteEntitiesDtoGQL } from '../../graphQL/deleteEntities';
import { GetCkModelsDtoGQL } from '../../graphQL/getCkModels';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../../graphQL/getRuntimeEntityAssociationsById';
import { GetTreeNodesDtoGQL } from '../../graphQL/getTreeNodes';
import { GetTreesDtoGQL } from '../../graphQL/getTrees';
import {
  AssociationModOptionsDto,
  CkModelDto,
  CkTypeDto,
  GetCkModelByIdDtoGQL,
  GetCkTypesDtoGQL,
  GraphDirectionDto,
  RtAssociationDto,
  RtEntityDto,
} from '../../graphQL/globalTypes';
import { UpdateRuntimeEntitiesDtoGQL } from '../../graphQL/updateRuntimeEntities';
import { UpdateTreeNodesDtoGQL } from '../../graphQL/updateTreeNodes';
import { TypeHelperService } from '../services/type-helper.service';
import { RuntimeBrowserDataSource } from './runtime-browser-data-source.service';

describe('RuntimeBrowserDataSource', () => {
  type BrowserItem =
    | RtEntityDto
    | CkModelDto
    | CkTypeDto
    | { isCkModelsRoot?: boolean; ckModelId?: string };

  let service: RuntimeBrowserDataSource;
  let consoleErrorSpy: jasmine.Spy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let consoleWarnSpy: jasmine.Spy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let consoleDebugSpy: jasmine.Spy;
  let controller: ApolloTestingController;

  const mockTreeEntity: RtEntityDto = {
    rtId: 'tree-1',
    ckTypeId: 'Basic/Tree',
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

  const mockTreeNodesResponse = {
    data: {
      runtime: {
        runtimeEntities: {
          items: [
            {
              rtId: 'tree-1',
              ckTypeId: 'Basic/Tree',
              associations: {
                targets: {
                  items: [
                    {
                      rtId: 'node-1',
                      ckTypeId: 'Basic/TreeNode',
                      attributes: {
                        items: [{ attributeName: 'name', value: 'Node 1' }],
                      },
                      associations: { targets: { totalCount: 0 } },
                    },
                    {
                      rtId: 'node-2',
                      ckTypeId: 'Basic/TreeNode',
                      attributes: {
                        items: [{ attributeName: 'name', value: 'Node 2' }],
                      },
                      associations: { targets: { totalCount: 3 } },
                    },
                  ],
                  totalCount: 2,
                },
              },
            },
          ],
        },
      },
    },
  };

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
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockTreesResponse)),
  };

  const mockGetTreeNodesGQL = {
    fetch: jasmine
      .createSpy('fetch')
      .and.returnValue(of(mockTreeNodesResponse)),
  };

  const mockGetCkModelsGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockCkModelsResponse)),
  };

  const mockGetCkTypesGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockCkTypesResponse)),
  };

  const mockGetCkModelByIdGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockBasicCkResponse)),
  };

  const mockGetRuntimeEntityAssociationsByIdDtoGQL = {
    fetch: jasmine.createSpy('fetch').and.returnValue(of(mockAssocResponse)),
  };

  const mockDeleteEntitiesDtoGQL = {
    mutate: jasmine.createSpy('mutate').and.returnValue(of(mockDeleteResponse)),
  };

  const mockUpdateTreeNodesGQL = {
    mutate: jasmine.createSpy('mutate').and.returnValue(of({ data: {} })),
  };

  const mockUpdateRuntimeEntitiesGQL = {
    mutate: jasmine.createSpy('mutate').and.returnValue(of({ data: {} })),
  };

  const mockTypeHelperService = {
    isRuntimeEntity: jasmine.createSpy('isRuntimeEntity').and.returnValue(true),
  };

  beforeEach(async () => {
    consoleErrorSpy = spyOn(console, 'error');
    consoleWarnSpy = spyOn(console, 'warn');
    consoleDebugSpy = spyOn(console, 'debug');

    await TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
      providers: [
        RuntimeBrowserDataSource,
        { provide: GetTreesDtoGQL, useValue: mockGetTreesGQL },
        { provide: GetTreeNodesDtoGQL, useValue: mockGetTreeNodesGQL },
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
      ],
    }).compileComponents();

    controller = TestBed.inject(ApolloTestingController);
    service = TestBed.inject(RuntimeBrowserDataSource);
  });

  afterEach(() => {
    mockGetTreesGQL.fetch.calls.reset();
    mockGetTreeNodesGQL.fetch.calls.reset();
    mockGetCkModelsGQL.fetch.calls.reset();
    mockGetCkTypesGQL.fetch.calls.reset();
    mockGetCkModelByIdGQL.fetch.calls.reset();
    mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.calls.reset();
    mockDeleteEntitiesDtoGQL.mutate.calls.reset();
    mockTypeHelperService.isRuntimeEntity.calls.reset();

    mockGetTreesGQL.fetch.and.returnValue(of(mockTreesResponse));
    mockGetTreeNodesGQL.fetch.and.returnValue(of(mockTreeNodesResponse));
    mockGetCkModelsGQL.fetch.and.returnValue(of(mockCkModelsResponse));
    mockGetCkTypesGQL.fetch.and.returnValue(of(mockCkTypesResponse));
    mockGetCkModelByIdGQL.fetch.and.returnValue(of(mockBasicCkResponse));
    mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.and.returnValue(
      of(mockAssocResponse),
    );
    mockDeleteEntitiesDtoGQL.mutate.and.returnValue(of(mockDeleteResponse));
    mockUpdateTreeNodesGQL.mutate.calls.reset();
    mockUpdateTreeNodesGQL.mutate.and.returnValue(of({ data: {} }));
    mockUpdateRuntimeEntitiesGQL.mutate.calls.reset();
    mockUpdateRuntimeEntitiesGQL.mutate.and.returnValue(of({ data: {} }));
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
      expect(ckModelsRoot?.expandable).toBeTrue();
    });

    it('should include Tree entities when Basic CK is available', async () => {
      const nodes = await service.fetchRootNodes();

      expect(mockGetCkModelByIdGQL.fetch).toHaveBeenCalled();
      expect(mockGetTreesGQL.fetch).toHaveBeenCalled();

      const treeNode = nodes.find((n) => n.text === 'Main Tree');
      expect(treeNode).toBeTruthy();
    });

    it('should not fetch trees when Basic CK is not available', async () => {
      mockGetCkModelByIdGQL.fetch.and.returnValue(
        of({
          data: { constructionKit: { models: { items: [] } } },
        }),
      );

      const nodes = await service.fetchRootNodes();

      expect(mockGetTreesGQL.fetch).not.toHaveBeenCalled();
      expect(nodes.length).toBe(1);
    });

    it('should handle error when checking Basic CK availability', async () => {
      mockGetCkModelByIdGQL.fetch.and.returnValue(
        throwError(() => new Error('Network error')),
      );

      const nodes = await service.fetchRootNodes();

      expect(nodes.length).toBe(1);
      expect(mockGetTreesGQL.fetch).not.toHaveBeenCalled();
    });

    it('should handle empty tree response', async () => {
      mockGetTreesGQL.fetch.and.returnValue(
        of({
          data: { runtime: { runtimeEntities: { items: [] } } },
        }),
      );

      const nodes = await service.fetchRootNodes();

      expect(nodes.length).toBe(1);
    });

    it('should handle fetch root nodes error gracefully', async () => {
      mockGetCkModelByIdGQL.fetch.and.returnValue(of(mockBasicCkResponse));
      mockGetTreesGQL.fetch.and.returnValue(
        throwError(() => new Error('Fetch error')),
      );

      const nodes = await service.fetchRootNodes();

      expect(nodes).toEqual([]);
    });

    it('should set expandable based on associations count', async () => {
      const nodes = await service.fetchRootNodes();

      const treeNode = nodes.find((n) => n.text === 'Main Tree');
      expect(treeNode?.expandable).toBeTrue();
    });
  });

  describe('fetchChildren', () => {
    it('should fetch CK models when expanding CK Models root', async () => {
      const ckModelsRoot = new TreeItemDataTyped<BrowserItem>(
        'ck-models-root',
        'CK Models',
        '',
        { isCkModelsRoot: true },
        fileIcon,
        true,
      );

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
      const modelNode = new TreeItemDataTyped<BrowserItem>(
        'model:Basic',
        'Basic',
        '',
        ckModel,
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(modelNode);

      expect(mockGetCkTypesGQL.fetch).toHaveBeenCalled();
      const callArgs = mockGetCkTypesGQL.fetch.calls.mostRecent().args[0];
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
      const typeNode = new TreeItemDataTyped<BrowserItem>(
        'type:Basic/Entity',
        'Basic/Entity',
        '',
        ckType,
        fileIcon,
        false,
      );

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
      const invalidNode = new TreeItemDataTyped<BrowserItem>(
        'invalid',
        'Invalid',
        '',
        ckType,
        fileIcon,
        false,
      );

      const children = await service.fetchChildren(invalidNode);

      expect(children).toEqual([]);
    });

    it('should fetch tree children for runtime entities', async () => {
      const treeNode = new TreeItemDataTyped<BrowserItem>(
        'Basic/Tree@tree-1',
        'Main Tree',
        '',
        { rtId: 'tree-1', ckTypeId: 'Basic/Tree' } as RtEntityDto,
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(treeNode);

      expect(mockGetTreeNodesGQL.fetch).toHaveBeenCalled();
      expect(children.length).toBe(2);
      expect(children[0].text).toBe('Node 1');
      expect(children[1].text).toBe('Node 2');
    });

    it('should set expandable flag based on children count', async () => {
      const treeNode = new TreeItemDataTyped<BrowserItem>(
        'Basic/Tree@tree-1',
        'Main Tree',
        '',
        { rtId: 'tree-1', ckTypeId: 'Basic/Tree' } as RtEntityDto,
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(treeNode);

      const node1 = children.find((c) => c.text === 'Node 1');
      const node2 = children.find((c) => c.text === 'Node 2');

      expect(node1?.expandable).toBeFalse();
      expect(node2?.expandable).toBeTrue();
    });

    it('should handle CK models fetch error', async () => {
      mockGetCkModelsGQL.fetch.and.returnValue(
        throwError(() => new Error('Error')),
      );

      const ckModelsRoot = new TreeItemDataTyped<BrowserItem>(
        'ck-models-root',
        'CK Models',
        '',
        { isCkModelsRoot: true },
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(ckModelsRoot);

      expect(children).toEqual([]);
    });

    it('should handle CK types fetch error', async () => {
      mockGetCkTypesGQL.fetch.and.returnValue(
        throwError(() => new Error('Error')),
      );

      const ckModel: CkModelDto = {
        id: { fullName: 'Basic', name: 'Basic', semanticVersionedFullName: 'Basic', version: '1.0.0' },
        dependencies: [],
      };
      const modelNode = new TreeItemDataTyped<BrowserItem>(
        'model:Basic',
        'Basic',
        '',
        ckModel,
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(modelNode);

      expect(children).toEqual([]);
    });

    it('should handle empty CK models response', async () => {
      mockGetCkModelsGQL.fetch.and.returnValue(
        of({
          data: { constructionKit: { models: { items: [] } } },
        }),
      );

      const ckModelsRoot = new TreeItemDataTyped<BrowserItem>(
        'ck-models-root',
        'CK Models',
        '',
        { isCkModelsRoot: true },
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(ckModelsRoot);

      expect(children).toEqual([]);
    });

    it('should skip null items in CK models response', async () => {
      mockGetCkModelsGQL.fetch.and.returnValue(
        of({
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
        }),
      );

      const ckModelsRoot = new TreeItemDataTyped<BrowserItem>(
        'ck-models-root',
        'CK Models',
        '',
        { isCkModelsRoot: true },
        fileIcon,
        true,
      );

      const children = await service.fetchChildren(ckModelsRoot);

      expect(children.length).toBe(1);
      expect(children[0].text).toBe('ValidModel');
    });
  });

  describe('getParentChildAssociation', () => {
    it('should fetch associations with Outbound direction for parent association', async () => {
      const ckTypeId = 'Basic/Tree';
      const rtId = 'tree-1';

      const result = await service.getParentChildAssociation(
        ckTypeId,
        rtId,
        true,
      );

      expect(
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch,
      ).toHaveBeenCalledWith({
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

      expect(
        mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch,
      ).toHaveBeenCalledWith(
        jasmine.objectContaining({
          variables: jasmine.objectContaining({
            direction: GraphDirectionDto.InboundDto,
          }),
        }),
      );
    });

    it('should return undefined and log error when fetch fails', async () => {
      mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.and.returnValue(
        throwError(() => new Error('GraphQL Error')),
      );

      const result = await service.getParentChildAssociation(
        'Type',
        'ID',
        true,
      );

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error on attempt to get association',
        jasmine.any(Error),
      );
    });

    it('should handle missing data gracefully', async () => {
      mockGetRuntimeEntityAssociationsByIdDtoGQL.fetch.and.returnValue(
        of({
          data: { runtime: null },
        }),
      );

      const result = await service.getParentChildAssociation(
        'Type',
        'ID',
        true,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getRuntimeEntityParentData', () => {
    it('should return parent ckTypeId and rtId when association exists', async () => {
      spyOn(service, 'getParentChildAssociation').and.resolveTo([
        {
          targetCkTypeId: 'Parent/Type',
          targetRtId: 'parent-123',
        } as RtAssociationDto,
      ]);

      const result = await service.getRuntimeEntityParentData(
        'Child/Type',
        'child-1',
      );

      expect(service.getParentChildAssociation).toHaveBeenCalledWith(
        'Child/Type',
        'child-1',
        true,
      );
      expect(result).toEqual({ ckTypeId: 'Parent/Type', rtId: 'parent-123' });
    });

    it('should return undefined if no parent associations found', async () => {
      spyOn(service, 'getParentChildAssociation').and.resolveTo([]);

      const result = await service.getRuntimeEntityParentData(
        'Child/Type',
        'child-1',
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined if associations is undefined', async () => {
      spyOn(service, 'getParentChildAssociation').and.resolveTo(undefined);

      const result = await service.getRuntimeEntityParentData(
        'Child/Type',
        'child-1',
      );

      expect(result).toBeUndefined();
    });
  });

  describe('deleteRtEntityAndChildren', () => {
    let mockItemToDelete: TreeItemDataTyped<BrowserItem>;

    beforeEach(() => {
      mockItemToDelete = new TreeItemDataTyped<BrowserItem>(
        'tree-1',
        'Tree Item',
        '',
        { rtId: 'tree-1', ckTypeId: 'Basic/Tree' } as RtEntityDto,
        fileIcon,
        false,
      );
    });

    it('should return false and log error if item is not a runtime entity', async () => {
      mockTypeHelperService.isRuntimeEntity.and.returnValue(false);

      const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'The item given for deletion is not a runtime entity',
        mockItemToDelete,
      );
      expect(mockDeleteEntitiesDtoGQL.mutate).not.toHaveBeenCalled();
    });

    it('should return true when deletion is successful', async () => {
      mockTypeHelperService.isRuntimeEntity.and.returnValue(true);

      const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

      expect(mockDeleteEntitiesDtoGQL.mutate).toHaveBeenCalledWith({
        variables: {
          rtEntityIds: [{ ckTypeId: 'Basic/Tree', rtId: 'tree-1' }],
        },
      });
      expect(result).toBeTrue();
    });

    it('should return false when deletion API returns false', async () => {
      mockDeleteEntitiesDtoGQL.mutate.and.returnValue(
        of({
          data: { runtime: { runtimeEntities: { delete: false } } },
        }),
      );

      const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

      expect(result).toBeFalse();
    });

    it('should catch GraphQL level errors in response and return false', async () => {
      mockTypeHelperService.isRuntimeEntity.and.returnValue(true);

      mockDeleteEntitiesDtoGQL.mutate.and.returnValue(
        of({
          error: { message: 'Some GQL error' },
        }),
      );

      const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error on attempt to cascade delete nodes during Delete Node operation',
        jasmine.anything(),
      );
    });

    it('should catch network exceptions and return false', async () => {
      mockTypeHelperService.isRuntimeEntity.and.returnValue(true);

      mockDeleteEntitiesDtoGQL.mutate.and.returnValue(
        throwError(() => new Error('Network fail')),
      );

      const result = await service.deleteRtEntityAndChildren(mockItemToDelete);

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error on attempt to cascade delete nodes during Delete Node operation',
        jasmine.any(Error),
      );
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
      mockUpdateTreeNodesGQL.mutate.and.returnValue(
        of({ data: { update: true } }),
      );

      const result = await service.updateParentChildAssociation(
        params.srcId,
        params.oldType,
        params.oldId,
        params.newType,
        params.newId,
      );

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
      expect(result).toBeTrue();
    });

    it('should return false and log error when the GraphQL response contains errors', async () => {
      // Simulate a GraphQL error inside a successful 200 OK response
      mockUpdateTreeNodesGQL.mutate.and.returnValue(
        of({
          data: null,
          error: { message: 'Unauthorized modification' },
        }),
      );

      const result = await service.updateParentChildAssociation(
        params.srcId,
        params.oldType,
        params.oldId,
        params.newType,
        params.newId,
      );

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        jasmine.stringMatching(/Error on attempt to switch object parents/),
        params.srcId,
        jasmine.any(Object),
      );
    });

    it('should return false and log error when a network/exception occurs', async () => {
      // Simulate a complete stream failure (e.g., 500 error or timeout)
      mockUpdateTreeNodesGQL.mutate.and.returnValue(
        throwError(() => new Error('Connection Timeout')),
      );

      const result = await service.updateParentChildAssociation(
        params.srcId,
        params.oldType,
        params.oldId,
        params.newType,
        params.newId,
      );

      expect(result).toBeFalse();
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
      mockUpdateRuntimeEntitiesGQL.mutate.and.returnValue(
        of({ data: { runtime: { runtimeEntities: { update: [{ rtId: params.srcId }] } } } }),
      );

      const result = await service.updateEntityAssociation(
        params.srcId,
        params.srcType,
        params.navProp,
        params.oldParentType,
        params.oldParentId,
        params.newParentType,
        params.newParentId,
      );

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
      expect(result).toBeTrue();
    });

    it('should return false when GraphQL response contains error', async () => {
      mockUpdateRuntimeEntitiesGQL.mutate.and.returnValue(
        of({ data: null, error: { message: 'Association not allowed' } }),
      );

      const result = await service.updateEntityAssociation(
        params.srcId, params.srcType, params.navProp,
        params.oldParentType, params.oldParentId,
        params.newParentType, params.newParentId,
      );

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        jasmine.stringMatching(/Error on attempt to move entity/),
        params.srcId,
        jasmine.any(Object),
      );
    });

    it('should return false when network error occurs', async () => {
      mockUpdateRuntimeEntitiesGQL.mutate.and.returnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.updateEntityAssociation(
        params.srcId, params.srcType, params.navProp,
        params.oldParentType, params.oldParentId,
        params.newParentType, params.newParentId,
      );

      expect(result).toBeFalse();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
