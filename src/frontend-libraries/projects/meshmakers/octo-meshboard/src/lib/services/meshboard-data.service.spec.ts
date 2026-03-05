import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MeshBoardDataService } from './meshboard-data.service';
import { MeshBoardStateService } from './meshboard-state.service';
import { MeshBoardVariableService } from './meshboard-variable.service';
import { GetDashboardEntityDtoGQL } from '../graphQL/getDashboardEntity';
import { GetCkModelsWithStateDtoGQL } from '../graphQL/getCkModelsWithState';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { Apollo } from 'apollo-angular';
import {
  RuntimeEntityDataSource,
  StaticDataSource,
  PersistentQueryDataSource,
  AggregationQuery,
  ConstructionKitQueryDataSource,
  RepeaterQueryDataSource,
  MeshBoardVariable,
  RuntimeEntityData
} from '../models/meshboard.models';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';

describe('MeshBoardDataService', () => {
  let service: MeshBoardDataService;
  let getDashboardEntityGQLSpy: jasmine.SpyObj<GetDashboardEntityDtoGQL>;
  let getCkModelsWithStateGQLSpy: jasmine.SpyObj<GetCkModelsWithStateDtoGQL>;
  let getEntitiesByCkTypeGQLSpy: jasmine.SpyObj<GetEntitiesByCkTypeDtoGQL>;
  let executeRuntimeQueryGQLSpy: jasmine.SpyObj<ExecuteRuntimeQueryDtoGQL>;
  let apolloSpy: jasmine.SpyObj<Apollo>;
  let stateServiceSpy: jasmine.SpyObj<MeshBoardStateService>;
  let variableServiceSpy: jasmine.SpyObj<MeshBoardVariableService>;

  beforeEach(() => {
    getDashboardEntityGQLSpy = jasmine.createSpyObj('GetDashboardEntityDtoGQL', ['fetch']);
    getCkModelsWithStateGQLSpy = jasmine.createSpyObj('GetCkModelsWithStateDtoGQL', ['fetch']);
    getEntitiesByCkTypeGQLSpy = jasmine.createSpyObj('GetEntitiesByCkTypeDtoGQL', ['fetch']);
    executeRuntimeQueryGQLSpy = jasmine.createSpyObj('ExecuteRuntimeQueryDtoGQL', ['fetch']);
    apolloSpy = jasmine.createSpyObj('Apollo', ['query']);
    stateServiceSpy = jasmine.createSpyObj('MeshBoardStateService', ['getVariables']);
    variableServiceSpy = jasmine.createSpyObj('MeshBoardVariableService', ['convertToFieldFilterDto']);

    TestBed.configureTestingModule({
      providers: [
        MeshBoardDataService,
        { provide: GetDashboardEntityDtoGQL, useValue: getDashboardEntityGQLSpy },
        { provide: GetCkModelsWithStateDtoGQL, useValue: getCkModelsWithStateGQLSpy },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: getEntitiesByCkTypeGQLSpy },
        { provide: ExecuteRuntimeQueryDtoGQL, useValue: executeRuntimeQueryGQLSpy },
        { provide: Apollo, useValue: apolloSpy },
        { provide: MeshBoardStateService, useValue: stateServiceSpy },
        { provide: MeshBoardVariableService, useValue: variableServiceSpy }
      ]
    });

    service = TestBed.inject(MeshBoardDataService);
    stateServiceSpy.getVariables.and.returnValue([]);
    variableServiceSpy.convertToFieldFilterDto.and.returnValue(undefined);
  });

  // ========================================================================
  // fetchData Tests
  // ========================================================================

  describe('fetchData', () => {
    it('should return null for unsupported data source types', (done) => {
      const dataSource: PersistentQueryDataSource = {
        type: 'persistentQuery',
        queryRtId: 'test-query'
      };

      service.fetchData(dataSource).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should return static data for static data source', (done) => {
      const staticData = { rtId: 'static-1', ckTypeId: 'TestType', attributes: [], associations: [] };
      const dataSource: StaticDataSource = {
        type: 'static',
        data: staticData
      };

      service.fetchData(dataSource).subscribe(result => {
        expect(result).toEqual(staticData);
        done();
      });
    });

    it('should call fetchRuntimeEntity for runtimeEntity data source', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      // Mock the GraphQL response
      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'test-rt-id',
                ckTypeId: 'TestType',
                attributes: { items: [] },
                associations: { definitions: { items: [] } }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchData(dataSource).subscribe(result => {
        expect(getDashboardEntityGQLSpy.fetch).toHaveBeenCalled();
        expect(result).toBeDefined();
        const entity = result as RuntimeEntityData;
        expect(entity?.rtId).toBe('test-rt-id');
        done();
      });
    });
  });

  // ========================================================================
  // fetchRuntimeEntity Tests
  // ========================================================================

  describe('fetchRuntimeEntity', () => {
    it('should return null when rtId is missing', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        ckTypeId: 'TestType'
      };

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result).toBeNull();
        expect(getDashboardEntityGQLSpy.fetch).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return null when ckTypeId is missing', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id'
      };

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result).toBeNull();
        expect(getDashboardEntityGQLSpy.fetch).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return null when entity not found', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'non-existent',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: []
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should map entity data correctly', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'test-rt-id',
                ckTypeId: 'TestType',
                rtWellKnownName: 'test-name',
                rtCreationDateTime: '2024-01-01T00:00:00Z',
                rtChangedDateTime: '2024-01-02T00:00:00Z',
                attributes: {
                  items: [
                    { attributeName: 'attr1', value: 'value1' },
                    { attributeName: 'attr2', value: 42 }
                  ]
                },
                associations: {
                  definitions: {
                    totalCount: 1,
                    items: [{
                      targetRtId: 'target-1',
                      targetCkTypeId: 'TargetType',
                      originRtId: 'test-rt-id',
                      originCkTypeId: 'TestType',
                      ckAssociationRoleId: 'role-1'
                    }]
                  }
                }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result).toBeDefined();
        expect(result?.rtId).toBe('test-rt-id');
        expect(result?.ckTypeId).toBe('TestType');
        expect(result?.rtWellKnownName).toBe('test-name');
        expect(result?.attributes.length).toBe(2);
        expect(result?.attributes[0]).toEqual({ attributeName: 'attr1', value: 'value1' });
        expect(result?.associations.length).toBe(1);
        expect(result?.associations[0].targetRtId).toBe('target-1');
        done();
      });
    });

    it('should handle null attributes gracefully', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'test-rt-id',
                ckTypeId: 'TestType',
                attributes: {
                  items: [
                    null,
                    { attributeName: null, value: 'skip-me' },
                    { attributeName: 'valid', value: 'keep' }
                  ]
                },
                associations: { definitions: { items: [] } }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result?.attributes.length).toBe(1);
        expect(result?.attributes[0].attributeName).toBe('valid');
        done();
      });
    });

    it('should handle null associations gracefully', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'test-rt-id',
                ckTypeId: 'TestType',
                attributes: { items: [] },
                associations: {
                  definitions: {
                    items: [
                      null,
                      {
                        targetRtId: 'valid-target',
                        targetCkTypeId: 'TargetType',
                        originRtId: 'test-rt-id',
                        originCkTypeId: 'TestType',
                        ckAssociationRoleId: 'role-1'
                      }
                    ]
                  }
                }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result?.associations.length).toBe(1);
        expect(result?.associations[0].targetRtId).toBe('valid-target');
        done();
      });
    });
  });

  // ========================================================================
  // fetchEntityWithAssociations Tests
  // ========================================================================

  describe('fetchEntityWithAssociations', () => {
    it('should fetch entity by rtId and ckTypeId', (done) => {
      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'entity-1',
                ckTypeId: 'EntityType',
                attributes: { items: [] },
                associations: { definitions: { items: [] } }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchEntityWithAssociations('entity-1', 'EntityType').subscribe(result => {
        expect(result?.rtId).toBe('entity-1');
        expect(result?.ckTypeId).toBe('EntityType');
        done();
      });
    });

    it('should return null when entity not found', (done) => {
      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: null
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchEntityWithAssociations('missing', 'TestType').subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });
  });

  // ========================================================================
  // fetchAggregations Tests
  // ========================================================================

  describe('fetchAggregations', () => {
    it('should handle empty queries array', async () => {
      const results = await service.fetchAggregations([]);
      expect(results.size).toBe(0);
    });

    it('should fetch CK counts for ConstructionKit queries', async () => {
      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' },
        { id: 'types', ckTypeId: 'ConstructionKit/CkType', aggregation: 'count' }
      ];

      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: {
            models: { totalCount: 10 },
            types: { totalCount: 25 },
            attributes: { totalCount: 100 },
            associationRoles: { totalCount: 15 },
            enums: { totalCount: 5 },
            records: { totalCount: 3 }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);

      expect(results.get('models')).toBe(10);
      expect(results.get('types')).toBe(25);
    });

    it('should handle all CK type mappings', async () => {
      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' },
        { id: 'types', ckTypeId: 'ConstructionKit/CkType', aggregation: 'count' },
        { id: 'attrs', ckTypeId: 'ConstructionKit/CkAttribute', aggregation: 'count' },
        { id: 'roles', ckTypeId: 'ConstructionKit/CkAssociationRole', aggregation: 'count' },
        { id: 'enums', ckTypeId: 'ConstructionKit/CkEnum', aggregation: 'count' },
        { id: 'records', ckTypeId: 'ConstructionKit/CkRecord', aggregation: 'count' }
      ];

      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: {
            models: { totalCount: 10 },
            types: { totalCount: 20 },
            attributes: { totalCount: 30 },
            associationRoles: { totalCount: 40 },
            enums: { totalCount: 50 },
            records: { totalCount: 60 }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);

      expect(results.get('models')).toBe(10);
      expect(results.get('types')).toBe(20);
      expect(results.get('attrs')).toBe(30);
      expect(results.get('roles')).toBe(40);
      expect(results.get('enums')).toBe(50);
      expect(results.get('records')).toBe(60);
    });

    it('should return 0 for unknown CK types', async () => {
      const queries: AggregationQuery[] = [
        { id: 'unknown', ckTypeId: 'ConstructionKit/Unknown', aggregation: 'count' }
      ];

      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: {
            models: { totalCount: 10 },
            types: { totalCount: 20 },
            attributes: { totalCount: 30 },
            associationRoles: { totalCount: 40 },
            enums: { totalCount: 50 },
            records: { totalCount: 60 }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);
      expect(results.get('unknown')).toBe(0);
    });

    it('should fetch runtime entity counts for non-CK queries', async () => {
      const queries: AggregationQuery[] = [
        { id: 'customers', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
      ];

      getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              totalCount: 42
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);
      expect(results.get('customers')).toBe(42);
    });

    it('should handle mixed CK and runtime queries', async () => {
      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' },
        { id: 'customers', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
      ];

      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: {
            models: { totalCount: 10 },
            types: { totalCount: 20 },
            attributes: { totalCount: 30 },
            associationRoles: { totalCount: 40 },
            enums: { totalCount: 50 },
            records: { totalCount: 60 }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              totalCount: 100
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);
      expect(results.get('models')).toBe(10);
      expect(results.get('customers')).toBe(100);
    });

    it('should handle CK query errors gracefully', async () => {
      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' }
      ];

      apolloSpy.query.and.returnValue(throwError(() => new Error('Network error')));
      spyOn(console, 'error');

      const results = await service.fetchAggregations(queries);

      expect(results.get('models')).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle runtime query errors gracefully', async () => {
      const queries: AggregationQuery[] = [
        { id: 'customers', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
      ];

      getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(throwError(() => new Error('Network error')));
      spyOn(console, 'error');

      const results = await service.fetchAggregations(queries);

      expect(results.get('customers')).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should apply filters to runtime entity count queries', async () => {
      const variables: MeshBoardVariable[] = [
        { name: 'status', type: 'string', source: 'static', value: 'Active' }
      ];
      stateServiceSpy.getVariables.and.returnValue(variables);
      variableServiceSpy.convertToFieldFilterDto.and.returnValue([
        { attributePath: 'status', comparisonValue: 'Active', operator: FieldFilterOperatorsDto.EqualsDto }
      ]);

      const queries: AggregationQuery[] = [
        {
          id: 'active-customers',
          ckTypeId: 'OctoSdk/Customer',
          aggregation: 'count',
          filters: [{ attributePath: 'status', comparisonValue: '$status', operator: 'eq' }]
        }
      ];

      getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              totalCount: 25
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);

      expect(variableServiceSpy.convertToFieldFilterDto).toHaveBeenCalled();
      expect(results.get('active-customers')).toBe(25);
    });

    it('should handle null totalCount', async () => {
      const queries: AggregationQuery[] = [
        { id: 'customers', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
      ];

      getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              totalCount: null
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const results = await service.fetchAggregations(queries);
      expect(results.get('customers')).toBe(0);
    });
  });

  // ========================================================================
  // fetchCkQueryData Tests
  // ========================================================================

  // Helper to create a mock CK model item
  function createMockCkModel(modelState: string | null, customField?: string) {
    return {
      modelState,
      id: {
        name: 'TestModel',
        version: '1.0.0',
        fullName: 'Test/TestModel',
        semanticVersionedFullName: 'Test/TestModel@1.0.0'
      },
      ...(customField ? { customField } : {})
    };
  }

  describe('fetchCkQueryData', () => {
    it('should fetch and group models by modelState', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models',
        groupBy: 'modelState'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            models: {
              totalCount: 5,
              items: [
                createMockCkModel('Development'),
                createMockCkModel('Development'),
                createMockCkModel('Released'),
                createMockCkModel('Released'),
                createMockCkModel('Deprecated')
              ]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await service.fetchCkQueryData(dataSource);

      expect(result.totalCount).toBe(5);
      expect(result.items.length).toBe(3);

      const devItem = result.items.find(i => i.category === 'Development');
      expect(devItem?.value).toBe(2);

      const releasedItem = result.items.find(i => i.category === 'Released');
      expect(releasedItem?.value).toBe(2);

      const deprecatedItem = result.items.find(i => i.category === 'Deprecated');
      expect(deprecatedItem?.value).toBe(1);
    });

    it('should use default groupBy (modelState) when not specified', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            models: {
              totalCount: 2,
              items: [
                createMockCkModel('Development'),
                createMockCkModel('Released')
              ]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await service.fetchCkQueryData(dataSource);
      expect(result.items.length).toBe(2);
    });

    it('should handle null modelState as Unknown', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            models: {
              totalCount: 2,
              items: [
                createMockCkModel(null),
                createMockCkModel('Released')
              ]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await service.fetchCkQueryData(dataSource);

      const unknownItem = result.items.find(i => i.category === 'Unknown');
      expect(unknownItem?.value).toBe(1);
    });

    it('should handle null items in array', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            models: {
              totalCount: 2,
              items: [
                null,
                createMockCkModel('Released')
              ]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await service.fetchCkQueryData(dataSource);
      expect(result.items.length).toBe(1);
      expect(result.items[0].category).toBe('Released');
    });

    it('should return empty result for unsupported query targets', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'types' // Not yet implemented
      };

      spyOn(console, 'warn');
      const result = await service.fetchCkQueryData(dataSource);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(console.warn).toHaveBeenCalledWith('CK query target not yet implemented: types');
    });

    it('should handle query errors gracefully', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(throwError(() => new Error('Query failed')));
      spyOn(console, 'error');

      const result = await service.fetchCkQueryData(dataSource);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should group by custom field', async () => {
      const dataSource: ConstructionKitQueryDataSource = {
        type: 'constructionKitQuery',
        queryTarget: 'models',
        groupBy: 'customField'
      };

      getCkModelsWithStateGQLSpy.fetch.and.returnValue(of({
        data: {
          constructionKit: {
            models: {
              totalCount: 3,
              items: [
                createMockCkModel('Dev', 'A'),
                createMockCkModel('Dev', 'A'),
                createMockCkModel('Rel', 'B')
              ]
            }
          }
        },
        loading: false,
        networkStatus: 7
      } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await service.fetchCkQueryData(dataSource);

      expect(result.items.length).toBe(2);
      expect(result.items.find(i => i.category === 'A')?.value).toBe(2);
      expect(result.items.find(i => i.category === 'B')?.value).toBe(1);
    });
  });

  // ========================================================================
  // fetchRepeaterData Tests (Widget Group)
  // ========================================================================

  describe('fetchRepeaterData', () => {
    describe('Query Mode', () => {
      it('should return empty array when no queryRtId or ckTypeId configured', async () => {
        spyOn(console, 'warn');
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery'
        };

        const result = await service.fetchRepeaterData(dataSource);

        expect(result).toEqual([]);
        expect(console.warn).toHaveBeenCalledWith('RepeaterQueryDataSource has neither queryRtId nor ckTypeId configured');
      });

      it('should fetch data from persistent query', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123',
          maxItems: 10
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  associatedCkTypeId: 'TestType',
                  columns: [
                    { attributePath: 'name', attributeValueType: 'String' },
                    { attributePath: 'value', attributeValueType: 'Int32' }
                  ],
                  rows: {
                    totalCount: 2,
                    items: [
                      {
                        __typename: 'RtSimpleQueryRow',
                        rtId: 'entity-1',
                        ckTypeId: 'TestType',
                        cells: {
                          items: [
                            { attributePath: 'name', value: 'Machine 1' },
                            { attributePath: 'value', value: 100 }
                          ]
                        }
                      },
                      {
                        __typename: 'RtSimpleQueryRow',
                        rtId: 'entity-2',
                        ckTypeId: 'TestType',
                        cells: {
                          items: [
                            { attributePath: 'name', value: 'Machine 2' },
                            { attributePath: 'value', value: 200 }
                          ]
                        }
                      }
                    ]
                  }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result.length).toBe(2);
        expect(result[0].rtId).toBe('entity-1');
        expect(result[0].ckTypeId).toBe('TestType');
        expect(result[0].attributes.get('name')).toBe('Machine 1');
        expect(result[0].attributes.get('value')).toBe(100);
        expect(result[1].rtId).toBe('entity-2');
        expect(result[1].attributes.get('name')).toBe('Machine 2');
      });

      it('should sanitize attribute paths (replace dots with underscores)', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  associatedCkTypeId: 'TestType',
                  columns: [],
                  rows: {
                    totalCount: 1,
                    items: [{
                      __typename: 'RtSimpleQueryRow',
                      rtId: 'entity-1',
                      ckTypeId: 'TestType',
                      cells: {
                        items: [
                          { attributePath: 'nested.attribute.path', value: 'test-value' }
                        ]
                      }
                    }]
                  }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result[0].attributes.get('nested_attribute_path')).toBe('test-value');
        // Also stores original path
        expect(result[0].attributes.get('nested.attribute.path')).toBe('test-value');
      });

      it('should use default maxItems of 50', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  rows: { totalCount: 0, items: [] }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        await service.fetchRepeaterData(dataSource);

        expect(executeRuntimeQueryGQLSpy.fetch).toHaveBeenCalledWith({
          variables: {
            rtId: 'query-123',
            first: 50
          }
        });
      });

      it('should return empty array when query returns no items', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: []
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);
        expect(result).toEqual([]);
      });

      it('should return empty array when query result is null', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [null]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);
        expect(result).toEqual([]);
      });

      it('should handle query errors gracefully', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(throwError(() => new Error('Query failed')));
        spyOn(console, 'error');

        const result = await service.fetchRepeaterData(dataSource);

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });

      it('should generate row IDs when rtId is not available', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  associatedCkTypeId: 'TestType',
                  rows: {
                    totalCount: 2,
                    items: [
                      {
                        __typename: 'RtAggregationQueryRow',
                        ckTypeId: 'TestType',
                        cells: { items: [{ attributePath: 'count', value: 10 }] }
                      },
                      {
                        __typename: 'RtAggregationQueryRow',
                        ckTypeId: 'TestType',
                        cells: { items: [{ attributePath: 'count', value: 20 }] }
                      }
                    ]
                  }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result[0].rtId).toBe('row-0');
        expect(result[1].rtId).toBe('row-1');
      });

      it('should skip null rows', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  associatedCkTypeId: 'TestType',
                  rows: {
                    totalCount: 3,
                    items: [
                      { __typename: 'RtSimpleQueryRow', rtId: 'entity-1', ckTypeId: 'TestType', cells: { items: [] } },
                      null,
                      { __typename: 'RtSimpleQueryRow', rtId: 'entity-3', ckTypeId: 'TestType', cells: { items: [] } }
                    ]
                  }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);
        expect(result.length).toBe(2);
        expect(result[0].rtId).toBe('entity-1');
        expect(result[1].rtId).toBe('entity-3');
      });
    });

    describe('Entity Mode', () => {
      it('should fetch entities by CK type', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          ckTypeId: 'OctoSdk/Machine',
          maxItems: 20
        };

        getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeEntities: {
                totalCount: 2,
                items: [
                  {
                    rtId: 'machine-1',
                    ckTypeId: 'OctoSdk/Machine',
                    rtWellKnownName: 'Machine Alpha',
                    attributes: {
                      items: [
                        { attributeName: 'status', value: 'Running' },
                        { attributeName: 'temperature', value: 65 }
                      ]
                    }
                  },
                  {
                    rtId: 'machine-2',
                    ckTypeId: 'OctoSdk/Machine',
                    rtWellKnownName: 'Machine Beta',
                    attributes: {
                      items: [
                        { attributeName: 'status', value: 'Stopped' },
                        { attributeName: 'temperature', value: 22 }
                      ]
                    }
                  }
                ]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result.length).toBe(2);
        expect(result[0].rtId).toBe('machine-1');
        expect(result[0].ckTypeId).toBe('OctoSdk/Machine');
        expect(result[0].rtWellKnownName).toBe('Machine Alpha');
        expect(result[0].attributes.get('status')).toBe('Running');
        expect(result[0].attributes.get('temperature')).toBe(65);
        expect(result[1].rtId).toBe('machine-2');
        expect(result[1].rtWellKnownName).toBe('Machine Beta');
      });

      it('should apply filters with variable resolution', async () => {
        const variables: MeshBoardVariable[] = [
          { name: 'statusFilter', type: 'string', source: 'static', value: 'Active' }
        ];
        stateServiceSpy.getVariables.and.returnValue(variables);
        variableServiceSpy.convertToFieldFilterDto.and.returnValue([
          { attributePath: 'status', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: 'Active' }
        ]);

        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          ckTypeId: 'OctoSdk/Machine',
          filters: [{ attributePath: 'status', operator: 'eq', comparisonValue: '$statusFilter' }],
          maxItems: 10
        };

        getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeEntities: {
                totalCount: 1,
                items: [
                  {
                    rtId: 'machine-1',
                    ckTypeId: 'OctoSdk/Machine',
                    rtWellKnownName: 'Active Machine',
                    attributes: { items: [] }
                  }
                ]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(variableServiceSpy.convertToFieldFilterDto).toHaveBeenCalled();
        expect(result.length).toBe(1);
        expect(result[0].rtWellKnownName).toBe('Active Machine');
      });

      it('should handle entity fetch errors gracefully', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          ckTypeId: 'OctoSdk/Machine'
        };

        getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(throwError(() => new Error('Fetch failed')));
        spyOn(console, 'error');

        const result = await service.fetchRepeaterData(dataSource);

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle null entities gracefully', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          ckTypeId: 'OctoSdk/Machine'
        };

        getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeEntities: {
                totalCount: 3,
                items: [
                  { rtId: 'machine-1', ckTypeId: 'OctoSdk/Machine', attributes: { items: [] } },
                  null,
                  { rtId: 'machine-3', ckTypeId: 'OctoSdk/Machine', attributes: { items: [] } }
                ]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result.length).toBe(2);
        expect(result[0].rtId).toBe('machine-1');
        expect(result[1].rtId).toBe('machine-3');
      });

      it('should handle null attribute items gracefully', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          ckTypeId: 'OctoSdk/Machine'
        };

        getEntitiesByCkTypeGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeEntities: {
                totalCount: 1,
                items: [
                  {
                    rtId: 'machine-1',
                    ckTypeId: 'OctoSdk/Machine',
                    attributes: {
                      items: [
                        null,
                        { attributeName: null, value: 'skip-me' },
                        { attributeName: 'validAttr', value: 'keep-me' }
                      ]
                    }
                  }
                ]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        const result = await service.fetchRepeaterData(dataSource);

        expect(result[0].attributes.size).toBe(1);
        expect(result[0].attributes.get('validAttr')).toBe('keep-me');
      });

      it('should prefer queryRtId over ckTypeId when both are provided', async () => {
        const dataSource: RepeaterQueryDataSource = {
          type: 'repeaterQuery',
          queryRtId: 'query-123',
          ckTypeId: 'OctoSdk/Machine'
        };

        executeRuntimeQueryGQLSpy.fetch.and.returnValue(of({
          data: {
            runtime: {
              runtimeQuery: {
                items: [{
                  queryRtId: 'query-123',
                  rows: { totalCount: 0, items: [] }
                }]
              }
            }
          },
          loading: false,
          networkStatus: 7
        } as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

        await service.fetchRepeaterData(dataSource);

        expect(executeRuntimeQueryGQLSpy.fetch).toHaveBeenCalled();
        expect(getEntitiesByCkTypeGQLSpy.fetch).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty runtime response', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: null
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should handle undefined rtWellKnownName', (done) => {
      const dataSource: RuntimeEntityDataSource = {
        type: 'runtimeEntity',
        rtId: 'test-rt-id',
        ckTypeId: 'TestType'
      };

      getDashboardEntityGQLSpy.fetch.and.returnValue(of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [{
                rtId: 'test-rt-id',
                ckTypeId: 'TestType',
                rtWellKnownName: null,
                attributes: { items: [] },
                associations: { definitions: { items: [] } }
              }]
            }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      service.fetchRuntimeEntity(dataSource).subscribe(result => {
        expect(result?.rtWellKnownName).toBeUndefined();
        done();
      });
    });

    it('should handle CK query with null constructionKit data', async () => {
      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: null
        },
        loading: false,
        networkStatus: 7
      }));

      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' }
      ];

      const results = await service.fetchAggregations(queries);
      expect(results.get('models')).toBe(0);
    });

    it('should handle CK query with null totalCount values', async () => {
      apolloSpy.query.and.returnValue(of({
        data: {
          constructionKit: {
            models: { totalCount: null },
            types: null,
            attributes: { totalCount: undefined },
            associationRoles: {},
            enums: { totalCount: 5 },
            records: { totalCount: 0 }
          }
        },
        loading: false,
        networkStatus: 7
      }));

      const queries: AggregationQuery[] = [
        { id: 'models', ckTypeId: 'ConstructionKit/CkModel', aggregation: 'count' },
        { id: 'types', ckTypeId: 'ConstructionKit/CkType', aggregation: 'count' },
        { id: 'enums', ckTypeId: 'ConstructionKit/CkEnum', aggregation: 'count' },
        { id: 'records', ckTypeId: 'ConstructionKit/CkRecord', aggregation: 'count' }
      ];

      const results = await service.fetchAggregations(queries);
      expect(results.get('models')).toBe(0);
      expect(results.get('types')).toBe(0);
      expect(results.get('enums')).toBe(5);
      expect(results.get('records')).toBe(0);
    });
  });
});
