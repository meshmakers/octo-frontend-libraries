import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService } from '@meshmakers/shared-ui';
import {
  CommunicationService,
  GetEntitiesByCkTypeDtoGQL,
  GraphDirectionDto,
} from '@meshmakers/octo-services';
import { CreateEntitiesDtoGQL } from '../../../graphQL/createEntities';
import { DeleteEntitiesDtoGQL } from '../../../graphQL/deleteEntities';
import { GetLatestValidationExecutionDtoGQL } from '../../../graphQL/getLatestValidationExecution';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { GetNodeMappingsDtoGQL } from '../../../graphQL/getNodeMappings';
import { GetOrphanCandidatesDtoGQL } from '../../../graphQL/getOrphanCandidates';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
import {
  PerspectiveDefinition,
  TreeNavigationConfigService,
} from '../../services/tree-navigation-config.service';
import { BulkMappingDialogService } from './bulk-mapping-dialog.service';
import { MappingCoverageTreeComponent } from './mapping-coverage-tree.component';
import { MappingEditDialogService } from './mapping-edit-dialog.service';

interface OrphanItemStub {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName: string | null;
  attributes: { items: { attributeName: string; value: unknown }[] };
  associations: {
    mappings: { totalCount: number };
    parent: { items: never[] };
  };
}

function orphanItem(rtId: string, name: string, mappingCount = 0): OrphanItemStub {
  return {
    rtId,
    ckTypeId: 'Loxone/Control',
    rtWellKnownName: null,
    attributes: { items: [{ attributeName: 'name', value: name }] },
    associations: {
      mappings: { totalCount: mappingCount },
      parent: { items: [] },
    },
  };
}

function orphanPage(items: OrphanItemStub[], hasNextPage: boolean, endCursor: string | null) {
  return {
    data: {
      runtime: {
        runtimeEntities: {
          totalCount: items.length,
          pageInfo: { hasNextPage, endCursor },
          items,
        },
      },
    },
  };
}

describe('MappingCoverageTreeComponent', () => {
  let component: MappingCoverageTreeComponent;
  let fixture: ComponentFixture<MappingCoverageTreeComponent>;
  let getOrphanCandidatesGQL: jasmine.SpyObj<GetOrphanCandidatesDtoGQL>;
  let getEntitiesByCkTypeGQL: jasmine.SpyObj<GetEntitiesByCkTypeDtoGQL>;
  let treeNavConfig: jasmine.SpyObj<TreeNavigationConfigService>;
  let bulkDialog: jasmine.SpyObj<BulkMappingDialogService>;
  let createEntitiesGQL: jasmine.SpyObj<CreateEntitiesDtoGQL>;
  let getLatestValidationGQL: jasmine.SpyObj<GetLatestValidationExecutionDtoGQL>;
  let communicationService: jasmine.SpyObj<CommunicationService>;

  const SYSTEMS_PERSPECTIVE: PerspectiveDefinition = {
    key: 'Systems',
    displayName: 'Systems',
    rootMode: 'Type',
    rootCkTypeId: 'EnergyIQ/DistributionSystem',
    primaryRoleId: 'EnergyIQ/SystemMembers',
    primaryDirection: 'Outbound',
    sortIndex: 1,
  };

  beforeEach(async () => {
    getOrphanCandidatesGQL = jasmine.createSpyObj('GetOrphanCandidatesDtoGQL', ['fetch']);
    getEntitiesByCkTypeGQL = jasmine.createSpyObj('GetEntitiesByCkTypeDtoGQL', ['fetch']);
    getEntitiesByCkTypeGQL.fetch.and.returnValue(
      of({ data: { runtime: { runtimeEntities: { items: [] } } } }) as unknown as ReturnType<
        GetEntitiesByCkTypeDtoGQL['fetch']
      >,
    );
    treeNavConfig = jasmine.createSpyObj('TreeNavigationConfigService', ['perspectives']);
    treeNavConfig.perspectives.and.resolveTo([]);
    bulkDialog = jasmine.createSpyObj('BulkMappingDialogService', ['open']);
    createEntitiesGQL = jasmine.createSpyObj('CreateEntitiesDtoGQL', ['mutate']);
    getLatestValidationGQL = jasmine.createSpyObj('GetLatestValidationExecutionDtoGQL', ['fetch']);
    communicationService = jasmine.createSpyObj('CommunicationService', [
      'executePipeline',
      'getLatestPipelineExecution',
    ]);

    await TestBed.configureTestingModule({
      imports: [MappingCoverageTreeComponent],
      providers: [
        { provide: EntitySelectorDialogService, useValue: {} },
        { provide: MappingEditDialogService, useValue: {} },
        { provide: ConfirmationService, useValue: {} },
        { provide: CommunicationService, useValue: communicationService },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: getEntitiesByCkTypeGQL },
        { provide: GetNodeMappingsDtoGQL, useValue: {} },
        { provide: GetRuntimeEntityByIdDtoGQL, useValue: {} },
        { provide: GetLatestValidationExecutionDtoGQL, useValue: getLatestValidationGQL },
        { provide: GetOrphanCandidatesDtoGQL, useValue: getOrphanCandidatesGQL },
        { provide: GetMappingCoverageNodeDtoGQL, useValue: {} },
        { provide: CreateEntitiesDtoGQL, useValue: createEntitiesGQL },
        { provide: DeleteEntitiesDtoGQL, useValue: {} },
        { provide: UpdateRuntimeEntitiesDtoGQL, useValue: {} },
        { provide: TreeNavigationConfigService, useValue: treeNavConfig },
        { provide: BulkMappingDialogService, useValue: bulkDialog },
      ],
    }).compileComponents();

    // No fixture.detectChanges(): ngOnInit would load roots/pipelines, which
    // is out of scope here — these specs exercise the orphan-catalogue load.
    fixture = TestBed.createComponent(MappingCoverageTreeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadOrphanCandidates paging', () => {
    beforeEach(() => {
      component['orphanCkType'].set('Loxone/Control');
    });

    it('collects all pages until hasNextPage is false', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValues(
        of(orphanPage([orphanItem('a1', 'Alpha'), orphanItem('b2', 'Beta', 3)], true, 'cursor-1')),
        of(orphanPage([orphanItem('c3', 'Gamma')], false, 'cursor-2')),
      );

      await component['loadOrphanCandidates']();

      expect(getOrphanCandidatesGQL.fetch).toHaveBeenCalledTimes(2);
      const candidates = component['orphanCandidates']();
      expect(candidates.length).toBe(3);
      // Unmapped first, then alphabetical.
      expect(candidates.map(c => c.name)).toEqual(['Alpha', 'Gamma', 'Beta']);
    });

    it('passes the previous endCursor as after on the follow-up page', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValues(
        of(orphanPage([orphanItem('a1', 'Alpha')], true, 'cursor-1')),
        of(orphanPage([], false, null)),
      );

      await component['loadOrphanCandidates']();

      const secondCallVariables = getOrphanCandidatesGQL.fetch.calls.argsFor(1)[0]?.variables;
      expect(secondCallVariables?.after).toBe('cursor-1');
    });

    it('stops after a single page when hasNextPage is false', async () => {
      getOrphanCandidatesGQL.fetch.and.returnValue(
        of(orphanPage([orphanItem('a1', 'Alpha')], false, 'cursor-1')),
      );

      await component['loadOrphanCandidates']();

      expect(getOrphanCandidatesGQL.fetch).toHaveBeenCalledTimes(1);
      expect(component['orphanCandidates']().length).toBe(1);
    });

    it('sets the error signal when the query fails', async () => {
      getOrphanCandidatesGQL.fetch.and.throwError(new Error('boom'));

      await component['loadOrphanCandidates']();

      expect(component['orphanError']()).toBe('Failed to load source candidates.');
      expect(component['orphanCandidates']().length).toBe(0);
    });
  });

  describe('orphan full-text search', () => {
    beforeEach(async () => {
      component['orphanCkType'].set('Loxone/Control');
      const withParent = orphanItem('a1', 'Raumregler', 0);
      withParent.associations.parent.items = [
        {
          rtId: 'p1',
          ckTypeId: 'Loxone/Room',
          rtWellKnownName: null,
          attributes: { items: [{ attributeName: 'name', value: 'Wohnzimmer' }] },
          associations: { parent: { items: [] } },
        },
      ] as never[];
      getOrphanCandidatesGQL.fetch.and.returnValue(
        of(orphanPage([withParent, orphanItem('b2', 'Meter Keller', 0)], false, null)),
      );
      await component['loadOrphanCandidates']();
    });

    it('filters by entity name (case-insensitive contains)', () => {
      component['orphanSearchText'].set('meter');
      expect(component['orphanFilteredList']().map(c => c.name)).toEqual(['Meter Keller']);
    });

    it('matches the parent breadcrumb (search by room)', () => {
      component['orphanSearchText'].set('wohnzimmer');
      expect(component['orphanFilteredList']().map(c => c.name)).toEqual(['Raumregler']);
    });

    it('shows everything again when cleared', () => {
      component['orphanSearchText'].set('meter');
      component['orphanSearchText'].set('');
      expect(component['orphanFilteredList']().length).toBe(2);
    });

    it('select-all respects the active search filter', () => {
      component['orphanSearchText'].set('meter');
      component['selectAllVisibleOrphans']();
      expect(component['orphanSelectedIds']().has('b2')).toBeTrue();
      expect(component['orphanSelectedCount']()).toBe(1);
    });

    it('is reset when the source type changes', () => {
      component['orphanSearchText'].set('meter');
      component['onOrphanCkTypeChange']('MQTT/Topic');
      expect(component['orphanSearchText']()).toBe('');
    });
  });

  describe('late-arriving source-candidate config (ngOnChanges)', () => {
    function changeConfigTo(sourceCandidateCkTypeIds: string[]): void {
      const previous = component.config;
      component.config = { ...component.config, sourceCandidateCkTypeIds };
      component.ngOnChanges({
        config: new SimpleChange(previous, component.config, false),
      });
    }

    it('initialises the orphan type selection when the config arrives late', () => {
      expect(component['orphanCkType']()).toBeNull();

      changeConfigTo(['Loxone/Control', 'MQTT/Topic']);

      expect(component['orphanCkType']()).toBe('Loxone/Control');
    });

    it('loads the catalogue immediately when the orphan tab is already active', () => {
      getOrphanCandidatesGQL.fetch.and.returnValue(
        of(orphanPage([orphanItem('a1', 'Alpha')], false, null)),
      );
      component['activeTab'].set('orphans');

      changeConfigTo(['Loxone/Control']);

      expect(getOrphanCandidatesGQL.fetch).toHaveBeenCalled();
    });

    it('does not reload when the tab is inactive', () => {
      changeConfigTo(['Loxone/Control']);

      expect(getOrphanCandidatesGQL.fetch).not.toHaveBeenCalled();
    });

    it('clears a selection whose type was removed from the config', () => {
      changeConfigTo(['Loxone/Control']);
      expect(component['orphanCkType']()).toBe('Loxone/Control');

      changeConfigTo(['MQTT/Topic']);

      expect(component['orphanCkType']()).toBe('MQTT/Topic');
    });

    it('ignores the first change (ngOnInit handles the initial config)', () => {
      const config = { ...component.config, sourceCandidateCkTypeIds: ['Loxone/Control'] };
      component.config = config;
      component.ngOnChanges({ config: new SimpleChange(undefined, config, true) });

      expect(component['orphanCkType']()).toBeNull();
    });
  });

  describe('perspective switching', () => {
    it('merges the built-in Spatial perspective with the configured ones', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);

      await component['loadPerspectives']();

      expect(component['perspectives']().map(p => p.key)).toEqual(['Spatial', 'Systems']);
    });

    it('keeps only the built-in perspective when loading fails', async () => {
      treeNavConfig.perspectives.and.rejectWith(new Error('boom'));

      await component['loadPerspectives']();

      expect(component['perspectives']().map(p => p.key)).toEqual(['Spatial']);
    });

    it('applies the Type perspective: root nav override + roots from its root CK type', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);
      await component['loadPerspectives']();

      await component['onPerspectiveChange']('Systems');

      expect(component['activePerspectiveKey']()).toBe('Systems');
      expect(component['activeRootCkTypeId']()).toBe('EnergyIQ/DistributionSystem');
      expect(component['dataSource'].getRootPerspectiveNav()).toEqual({
        childRoleId: 'EnergyIQ/SystemMembers',
        childDirection: GraphDirectionDto.OutboundDto,
      });
      const rootQueryVariables =
        getEntitiesByCkTypeGQL.fetch.calls.mostRecent().args[0]?.variables;
      expect(rootQueryVariables?.ckTypeId).toBe('EnergyIQ/DistributionSystem');
      expect(component['selectedRoot']()).toBeNull();
      expect(component['selectedNode']()).toBeNull();
    });

    it('clears the nav override when switching back to Spatial', async () => {
      treeNavConfig.perspectives.and.resolveTo([SYSTEMS_PERSPECTIVE]);
      await component['loadPerspectives']();
      await component['onPerspectiveChange']('Systems');

      await component['onPerspectiveChange']('Spatial');

      expect(component['dataSource'].getRootPerspectiveNav()).toBeNull();
      expect(component['activeRootCkTypeId']()).toBe(component.config.rootCkTypeId);
      const rootQueryVariables =
        getEntitiesByCkTypeGQL.fetch.calls.mostRecent().args[0]?.variables;
      expect(rootQueryVariables?.ckTypeId).toBe(component.config.rootCkTypeId);
    });
  });

  describe('orphan multi-select + bulk mapping', () => {
    beforeEach(async () => {
      component['orphanCkType'].set('Loxone/Control');
      getOrphanCandidatesGQL.fetch.and.returnValue(
        of(orphanPage([orphanItem('a1', 'Alpha'), orphanItem('b2', 'Beta')], false, null)),
      );
      await component['loadOrphanCandidates']();
    });

    it('toggles, selects all visible and clears the selection', () => {
      component['toggleOrphanSelected']('a1');
      expect(component['orphanSelectedCount']()).toBe(1);
      expect(component['isOrphanSelected']('a1')).toBeTrue();

      component['toggleOrphanSelected']('a1');
      expect(component['orphanSelectedCount']()).toBe(0);

      component['selectAllVisibleOrphans']();
      expect(component['orphanSelectedCount']()).toBe(2);

      component['clearOrphanSelection']();
      expect(component['orphanSelectedCount']()).toBe(0);
    });

    it('creates one mapping per selected source in a single mutation', async () => {
      component['selectAllVisibleOrphans']();
      bulkDialog.open.and.resolveTo({
        confirmed: true,
        value: {
          targetRtId: 'space-1',
          targetCkTypeId: 'EnergyIQ/Space',
          targetName: 'Wohnzimmer',
          sourceAttributePath: 'tempActual',
          targetAttributePath: 'Temperature',
          mappingExpression: 'value',
          enabled: true,
        },
      });
      createEntitiesGQL.mutate.and.returnValue(of({ data: {} }) as never);

      await component['bulkMapSelected']();

      expect(createEntitiesGQL.mutate).toHaveBeenCalledTimes(1);
      const variables = createEntitiesGQL.mutate.calls.mostRecent().args[0]
        ?.variables as { entities: Record<string, unknown>[] };
      expect(variables.entities.length).toBe(2);
      const first = variables.entities[0] as {
        ckTypeId: string;
        attributes: { attributeName: string; value: unknown }[];
        associations: { roleName: string; targets: { target: { rtId: string } }[] }[];
      };
      expect(first.ckTypeId).toBe(component.config.mappingCkTypeId);
      expect(first.attributes.find(a => a.attributeName === 'TargetAttributePath')?.value)
        .toBe('Temperature');
      expect(first.associations.map(a => a.roleName)).toEqual([
        component.config.mappingSourceOutboundRoleName,
        component.config.mappingTargetOutboundRoleName,
      ]);
      expect(first.associations[0].targets[0].target.rtId).toBe('a1');
      expect(first.associations[1].targets[0].target.rtId).toBe('space-1');
      // Selection is cleared and the catalogue reloaded.
      expect(component['orphanSelectedCount']()).toBe(0);
      expect(getOrphanCandidatesGQL.fetch.calls.count()).toBeGreaterThan(1);
    });

    it('creates nothing when the dialog is cancelled', async () => {
      component['toggleOrphanSelected']('a1');
      bulkDialog.open.and.resolveTo({ confirmed: false });

      await component['bulkMapSelected']();

      expect(createEntitiesGQL.mutate).not.toHaveBeenCalled();
      expect(component['orphanSelectedCount']()).toBe(1);
    });
  });

  describe('generation result loading', () => {
    function latestExecutionResponse(
      outputData: string | null,
    ): ReturnType<GetLatestValidationExecutionDtoGQL['fetch']> {
      return of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [
                {
                  rtId: 'pipe-1',
                  associations: {
                    executions: {
                      items: [
                        {
                          rtId: 'exec-1',
                          attributes: {
                            items: [
                              { attributeName: 'outputData', value: outputData },
                              { attributeName: 'completedAt', value: '2026-07-04T10:00:00Z' },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      }) as unknown as ReturnType<GetLatestValidationExecutionDtoGQL['fetch']>;
    }

    it('parses GenerateDataPointMappings statistics from OutputData', async () => {
      getLatestValidationGQL.fetch.and.returnValue(
        latestExecutionResponse(
          JSON.stringify({
            totalContainers: 10,
            matchedContainers: 8,
            unmatchedContainers: 2,
            unmatchedContainerNames: ['Keller', 'Dach'],
            totalSuggestions: 42,
            ruleHits: { temp: 20, co2: 22 },
            definedRuleIds: ['temp', 'co2'],
          }),
        ),
      );

      await component['loadGenerationResult']({
        rtId: 'pipe-1',
        ckTypeId: 'System.Communication/Pipeline',
        name: 'Auto-Map',
        definition: null,
      });

      const stats = component['generationStats']();
      expect(stats?.totalSuggestions).toBe(42);
      expect(stats?.matchedContainers).toBe(8);
      expect(stats?.unmatchedContainerNames).toEqual(['Keller', 'Dach']);
      expect(component['generationCompletedAt']()).toBe('2026-07-04T10:00:00Z');
    });

    it('degrades to null statistics for a non-statistics OutputData payload', async () => {
      getLatestValidationGQL.fetch.and.returnValue(
        latestExecutionResponse(JSON.stringify({ summary: { ok: 1 }, nodes: [] })),
      );

      await component['loadGenerationResult']({
        rtId: 'pipe-1',
        ckTypeId: 'System.Communication/Pipeline',
        name: 'Auto-Map',
        definition: null,
      });

      expect(component['generationStats']()).toBeNull();
      expect(component['generationCompletedAt']()).toBe('2026-07-04T10:00:00Z');
    });
  });

  describe('mapping backup export/import', () => {
    const EXPORT_PIPELINE = {
      rtId: 'exp-1',
      ckTypeId: 'System.Communication/Pipeline',
      name: 'Export DataPoint Mappings',
      definition: 'transformations:\n  - type: ExportDataPointMappings@1\n',
    };
    const IMPORT_PIPELINE = {
      rtId: 'imp-1',
      ckTypeId: 'System.Communication/Pipeline',
      name: 'Import DataPoint Mappings',
      definition: 'transformations:\n  - type: ImportDataPointMappings@1\n',
    };

    function latestBackupExecutionResponse(
      outputData: string | null,
    ): ReturnType<GetLatestValidationExecutionDtoGQL['fetch']> {
      return of({
        data: {
          runtime: {
            runtimeEntities: {
              items: [
                {
                  rtId: 'pipe-1',
                  associations: {
                    executions: {
                      items: [
                        {
                          rtId: 'exec-1',
                          attributes: {
                            items: [
                              { attributeName: 'outputData', value: outputData },
                              { attributeName: 'completedAt', value: '2026-07-04T11:00:00Z' },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      }) as unknown as ReturnType<GetLatestValidationExecutionDtoGQL['fetch']>;
    }

    beforeEach(() => {
      component.tenantId = 'energyiq';
      component['validationPipelines'].set([EXPORT_PIPELINE, IMPORT_PIPELINE]);
      // Poll snapshot ('prev') + first poll result (new id, done).
      communicationService.getLatestPipelineExecution.and.returnValues(
        Promise.resolve({ id: 'prev' } as never),
        Promise.resolve({ id: 'new', status: 'Completed' } as never),
      );
      communicationService.executePipeline.and.resolveTo(null);
    });

    it('detects the backup pipelines from their definitions', () => {
      expect(component['exportBackupPipeline']()?.rtId).toBe('exp-1');
      expect(component['importBackupPipeline']()?.rtId).toBe('imp-1');

      component['validationPipelines'].set([
        { rtId: 'x', ckTypeId: 'System.Communication/Pipeline', name: 'Other', definition: null },
      ]);
      expect(component['exportBackupPipeline']()).toBeNull();
      expect(component['importBackupPipeline']()).toBeNull();
    });

    it('exports: runs the export pipeline and downloads the OutputData document', async () => {
      const exportDocument = JSON.stringify({ mappings: [{ name: 'M1' }] });
      getLatestValidationGQL.fetch.and.returnValue(latestBackupExecutionResponse(exportDocument));
      const saveSpy = spyOn(
        component as unknown as { saveJsonFile: (content: string, fileName: string) => void },
        'saveJsonFile',
      );

      await component['exportMappings']();

      expect(communicationService.executePipeline).toHaveBeenCalledWith('energyiq', 'exp-1', null);
      expect(saveSpy).toHaveBeenCalledWith(exportDocument, 'datapoint-mappings.json');
      expect(component['backupError']()).toBeNull();
      expect(component['backupRunning']()).toBeNull();
    });

    it('imports: sends { body: document } as pipeline input and shows statistics', async () => {
      getLatestValidationGQL.fetch.and.returnValue(
        latestBackupExecutionResponse(JSON.stringify({
          total: 5,
          resolved: 4,
          unresolved: 1,
          unresolvedEntries: [{ name: 'M5', reason: 'source not found' }],
        })),
      );
      const documentContent = { mappings: [{ name: 'M1' }] };
      const file = new File([JSON.stringify(documentContent)], 'datapoint-mappings.json', {
        type: 'application/json',
      });
      const event = { target: { files: [file], value: '' } } as unknown as Event;

      await component['onImportFileSelected'](event);

      expect(communicationService.executePipeline).toHaveBeenCalledWith(
        'energyiq', 'imp-1', { body: documentContent });
      const stats = component['importStats']();
      expect(stats?.resolved).toBe(4);
      expect(stats?.unresolved).toBe(1);
      expect(component['importCompletedAt']()).toBe('2026-07-04T11:00:00Z');
      expect(component['unresolvedImportNames']()).toBe('M5 (source not found)');
      expect(component['backupRunning']()).toBeNull();
    });

    it('rejects a non-JSON file without starting the pipeline', async () => {
      const file = new File(['not json {'], 'broken.json', { type: 'application/json' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;

      await component['onImportFileSelected'](event);

      expect(communicationService.executePipeline).not.toHaveBeenCalled();
      expect(component['backupError']()).toContain('broken.json');
    });
  });
});
